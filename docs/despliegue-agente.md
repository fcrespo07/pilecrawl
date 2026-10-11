# Despliegue de Pilecrawl en una Raspberry Pi con k3s: guía para un agente

**Para quién es:** un agente (p. ej. Claude Code) que despliega este juego en la Raspberry Pi del usuario, de principio a fin. Dónde ejecutarlo: **en la propia Pi** (lo más simple, con `sudo k3s kubectl`) o en un PC con `kubectl` apuntando a la Pi (kubeconfig de k3s, `/etc/rancher/k3s/k3s.yaml`, cambiando `127.0.0.1` por la IP de la Pi). Define esto al empezar cada sesión de shell (los bloques de abajo usan `K`):

```bash
K() { sudo k3s kubectl "$@"; }   # si usas otro kubectl (PC), cámbialo por: K() { kubectl "$@"; }
```

**Reglas para el agente**
1. Ejecuta los pasos en orden. Cada uno tiene **Comprobar** (¿ya está hecho? entonces sáltalo: todo es idempotente) y **Verificar** (¿ha funcionado?). Si la verificación falla, mira **Si falla** antes de seguir; no avances con un paso roto.
2. Nunca escribas secretos (tokens, claves) en el repositorio, en `git`, en logs ni en tu respuesta final. `k8s/config.yaml` está en `.gitignore`.
3. Antes de cualquier acción destructiva o que cambie algo fuera de la Pi (borrar volúmenes, reinstalar k3s, tocar el router), pregunta al usuario.
4. Si algo de esta guía no se corresponde con lo que ves (nombres, versiones), no improvises en silencio: dilo y propón el cambio.
5. Estado conocido: el servidor y la imagen tienen pruebas y se construyen en CI, pero **los manifiestos de `k8s/` no se han ejecutado nunca en un cluster**. Es posible que el primer despliegue necesite un retoque. Si lo necesita, arréglalo y cuéntaselo al usuario para que lo lleve al repositorio.

## 0. Datos que hay que pedirle al usuario (pregúntalos todos antes de empezar)

| Dato | Para qué | Notas |
|---|---|---|
| **Dominio público** (p. ej. `juego.midominio.com`) | Dirección del juego | Debe estar en Cloudflare (DNS gestionado por Cloudflare). Sin dominio solo se puede probar con `port-forward`. |
| **Token de Cloudflare Tunnel** | Sacar el juego a internet sin abrir puertos | Lo crea el usuario (paso U2). Es un secreto: pídelo por un canal privado y no lo repitas. |
| **`admin-token`** | Moderación del ranking | Puedes **generarlo tú**: `openssl rand -hex 32`. Dáselo al usuario una sola vez para que lo guarde. |
| **Usuario de GitHub y nombre del repositorio** | Nombre de la imagen en GHCR | Por defecto `fcrespo07/tetris-roguelite`. El usuario tiene pendiente renombrar el repositorio: confírmalo con `git remote get-url origin`. |
| **¿Activa anuncios?** sí/no | Variables de anuncios | Por defecto **no**. Si sí: necesita cuenta de AdSense aprobada (paso U3) con `ca-pub-…`, número de bloque y página de privacidad. Detalles y advertencia legal (consentimiento europeo) en `docs/anuncios.md`. |
| **Dirección de la página de privacidad** | Enlace en Rankings (y obligatoria con anuncios) | Ya no hace falta: la web trae `/privacidad.html` y `/acerca.html`. Pide solo `VITE_CONTACT_EMAIL` y `VITE_SITE_OWNER` (el correo y el nombre que saldrán en ellas). Guía de anuncios para el dueño: `docs/anuncios.md`. |
| **Palabras prohibidas en apodos** | `nick-blocklist` | Opcional; lista separada por comas. |
| **¿Instalas con imagen de GHCR o la construyes en la Pi?** | Paso 3 | Por defecto GHCR (A). Si el usuario no quiere hacer público el paquete, usa la construcción local (B). |

## Pasos que solo puede hacer el usuario (pídeselos en el momento indicado y espera su confirmación)

- **U1. Hacer público el paquete de la imagen** (solo si usas GHCR): GitHub → su perfil → Packages → el paquete `tetris-roguelite` (el nombre del repositorio) → Package settings → Change visibility → Public. Existe una alternativa sin esto: construcción local (3B).
- **U2. Crear el túnel en Cloudflare:** panel de Cloudflare → Zero Trust → Networks → Tunnels → Create a tunnel → tipo Cloudflared → ponle nombre → **copiar el token** (la cadena larga que sale en el comando de instalación, después de `--token`). En la pestaña *Public Hostname* (o *Published application routes*): añadir el dominio elegido con servicio `HTTP` y URL `blockrogue.blockrogue.svc.cluster.local:80`. No hace falta ejecutar el comando de instalación que muestra Cloudflare: lo hace el cluster.
- **U3. (Opcional) Cuenta de AdSense:** crearla con el dominio, esperar la aprobación y crear un bloque de display adaptable. Sin esto, no actives anuncios.

## 1. Comprobaciones previas de la Pi

```bash
uname -m                      # debe ser aarch64
cat /etc/os-release | head -3 # Raspberry Pi OS 64 bits o Ubuntu arm64
free -m | sed -n 2p           # con 8 GB va sobrado; con menos de 1 GB libre, avisa
df -h / | tail -1             # al menos 5 GB libres; si es tarjeta SD, avisa al usuario (SQLite escribe mucho; mejor SSD)
command -v curl openssl git   # deben existir; si falta alguno: sudo apt install -y curl openssl git
```

**Si falla:** si `uname -m` no es `aarch64`, para y pregunta (la imagen publicada es arm64). Si es SD, continúa pero avisa.

## 2. k3s

**Comprobar:** `K get nodes` (o `sudo k3s kubectl get nodes`). Si el nodo está `Ready`, salta al paso 3.

**Si no está instalado:**
1. Raspberry Pi OS necesita cgroups de memoria. Comprueba: `grep -o 'cgroup_memory=1' /boot/firmware/cmdline.txt`. Si no sale, **pregunta al usuario** y añade ` cgroup_memory=1 cgroup_enable=memory` al final de la única línea de `/boot/firmware/cmdline.txt` (haz copia antes: `sudo cp /boot/firmware/cmdline.txt /boot/firmware/cmdline.txt.bak`) y reinicia (`sudo reboot`; avisa al usuario de que se corta la conexión). Ubuntu no lo necesita.
2. `curl -sfL https://get.k3s.io | sh -`

**Verificar:** `sudo k3s kubectl get nodes` muestra el nodo `Ready` (puede tardar un minuto) y `sudo k3s kubectl -n kube-system get pods` sin `CrashLoopBackOff`.

**Si falla:** `sudo journalctl -u k3s --no-pager | tail -50`. Fallo típico: `failed to find memory cgroup` → falta el paso de cgroups.

**Seguridad:** no abras el puerto 6443 ni nada al router. Si hay cortafuegos: `sudo apt install -y ufw && sudo ufw allow OpenSSH && sudo ufw enable` (pregunta antes de activar `ufw` por si cortas tu propia sesión SSH).

## 3. La imagen

Variables: `REPO=<usuario>/<repositorio>` en minúsculas (p. ej. `fcrespo07/tetris-roguelite`); `IMAGE=ghcr.io/$REPO:latest`.

**3A. GHCR (por defecto).** La construye el workflow `Imagen` al llegar a `master`.
- **Comprobar que se puede descargar** (ya con k3s del paso 2): `K run probe -n default --rm -i --restart=Never --image=$IMAGE --command -- true` (tarda un poco; debe terminar sin `ErrImagePull`). Si falla, pide al usuario que confirme en GitHub → Actions que el último workflow «Imagen» de `master` terminó en verde y que hizo público el paquete (U1), o pasa a 3B.
- Si en `k8s/deployment.yaml` la línea `image:` no coincide con `$IMAGE`, cámbiala (`sed -i "s#image: .*#image: $IMAGE#" k8s/deployment.yaml`), **sin hacer commit** si el usuario no lo ha pedido.

**3B. Construcción local en la Pi (si no se quiere el paquete público).**
```bash
sudo apt install -y docker.io          # si no está
git clone https://github.com/$REPO && cd $(basename $REPO)   # si ya estás en el repo, git pull
sudo docker build -t blockrogue:local \
  --build-arg VITE_RANKING=1 \
  --build-arg VITE_PRIVACY_URL="<url o vacío>" \
  --build-arg VITE_AD_PROVIDER="<adsense o vacío>" --build-arg VITE_AD_CLIENT="<ca-pub o vacío>" \
  --build-arg VITE_AD_SLOT="<bloque o vacío>" --build-arg VITE_AD_CONSENT="<none o vacío>" .
sudo docker save blockrogue:local | sudo k3s ctr images import -
```
**Verificar:** `sudo k3s ctr images ls | grep blockrogue:local`. En el paso 5 tendrás que cambiar la imagen del Deployment **justo después de `apply -k` y antes de `rollout status`** (ahí se indica).

**Importante con 3A:** los valores de anuncios y privacidad se fijan al **construir** la imagen. En GHCR salen de las *variables* del repositorio (Settings → Secrets and variables → Actions → Variables): `VITE_CONTACT_EMAIL`, `VITE_SITE_OWNER`, `VITE_AD_PROVIDER`, `VITE_AD_CLIENT`, `VITE_AD_SLOT`, `VITE_AD_CONSENT`. Si el usuario quiere anuncios o página de privacidad, tiene que ponerlas ahí **y relanzar el workflow** (Actions → Imagen → Run workflow) antes de seguir. Sin anuncios no hace falta tocar nada.

## 4. Configuración (namespace, ConfigMap y Secret)

```bash
cd <raíz del repositorio>
K apply -f k8s/namespace.yaml                       # el namespace tiene que existir antes que la configuración
test -f k8s/config.yaml || cp k8s/config.example.yaml k8s/config.yaml
```
Edita `k8s/config.yaml` (no lo subas a git):
- `trust-proxy`: **`cloudflare`** (con Cloudflare Tunnel). Si no lo pones, el límite de 5 jugadores nuevos por hora cuenta a todos juntos y el ranking parece roto al registrar al sexto.
- `admin-token`: el que generaste (`openssl rand -hex 32`). No dejes el valor de ejemplo.
- `nick-blocklist`: lo que dé el usuario, o vacío.
- `cors-origins`: vacío (el juego y la API salen del mismo dominio).

```bash
K apply -f k8s/config.yaml
```
**Verificar:** `K -n blockrogue get configmap,secret blockrogue` los muestra. `grep -c 'CAMBIA-ESTO' k8s/config.yaml` debe dar `0`.

## 5. Despliegue del juego

```bash
K apply -k k8s/
# SOLO con la imagen local (3B): cambiar antes de esperar, o el pod quedará en ImagePullBackOff
K -n blockrogue set image deployment/blockrogue blockrogue=blockrogue:local
K -n blockrogue patch deployment blockrogue -p '{"spec":{"template":{"spec":{"containers":[{"name":"blockrogue","imagePullPolicy":"IfNotPresent"}]}}}}'
K -n blockrogue delete cronjob blockrogue-updater   # solo 3B: el actualizador baja de GHCR y no aplica con imagen local
K -n blockrogue rollout status deployment/blockrogue --timeout=180s
```
**Verificar:**
```bash
K -n blockrogue get pods                                  # 1/1 Running
K -n blockrogue port-forward svc/blockrogue 8080:80 & PF=$!
sleep 2
curl -s localhost:8080/api/health                         # {"ok":true}
curl -s localhost:8080/api/config                         # JSON con rulesVersion y modes
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/ # 200
kill $PF
```
**Si falla:**
- `ImagePullBackOff`/`ErrImagePull`: el paquete no es público (U1) o el nombre de imagen no coincide. `K -n blockrogue describe pod -l app=blockrogue | tail -20`. Usa 3B como alternativa.
- `CrashLoopBackOff`: `K -n blockrogue logs deploy/blockrogue --previous`. Si dice que no puede escribir en `/data`, comprueba el PVC (`K -n blockrogue get pvc` debe estar `Bound`) y que el pod usa `fsGroup: 1000`.
- PVC en `Pending`: `K get storageclass` debe tener `local-path (default)`; en k3s viene por defecto.
- Pod `Pending` por recursos: `K -n blockrogue describe pod`.

## 6. Túnel de Cloudflare (requiere U2 hecho)

Pide al usuario el token. Después:
```bash
K -n blockrogue get secret cloudflared >/dev/null 2>&1 || \
  K -n blockrogue create secret generic cloudflared --from-literal=token='<TOKEN>'
cp k8s/cloudflared.example.yaml /tmp/cloudflared.yaml    # no hace falta editar nada
K apply -f /tmp/cloudflared.yaml
K -n blockrogue rollout status deployment/cloudflared --timeout=120s
```
(Si necesitas cambiar el token: `K -n blockrogue delete secret cloudflared` y créalo de nuevo, luego `K -n blockrogue rollout restart deployment/cloudflared`. Para que el token no quede en el historial de la shell, léelo con `read -rs TOKEN` y usa `--from-literal=token="$TOKEN"`.)

**Verificar:**
```bash
K -n blockrogue logs deploy/cloudflared --tail=20      # debe decir "Registered tunnel connection"
curl -s https://<DOMINIO>/api/health                   # {"ok":true}
curl -sI https://<DOMINIO>/ | head -1                  # HTTP/2 200
```
**Si falla:** token mal copiado (logs con `Unauthorized`), nombre público sin configurar en Cloudflare o con URL distinta de `blockrogue.blockrogue.svc.cluster.local:80` (la web da 502/1033), DNS que aún no propaga (espera unos minutos).

## 7. Prueba del ranking de punta a punta

Comprueba que la IP del cliente se lee bien y que la API responde. Crea un jugador de prueba y bórralo:
```bash
D=https://<DOMINIO>
R=$(curl -s -X POST $D/api/players -H 'content-type: application/json' -d '{"nickname":"prueba-despliegue"}'); echo $R | head -c 100
TOKEN=$(echo $R | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -s $D/api/players/me -H "Authorization: Bearer $TOKEN"                         # debe devolver el apodo
curl -s -X DELETE $D/api/players/me -H "Authorization: Bearer $TOKEN"              # {"ok":true}
```
Si el apodo ya existe de una prueba anterior, el POST devuelve 409: bórralo con el token guardado o usa otro apodo.

**Prueba del límite por IP (opcional, solo si dudas de `trust-proxy`):** registra 6 jugadores seguidos desde tu red; el quinto o el sexto debe dar 429 (el jugador de prueba de arriba ya cuenta, y si lo borraste, el límite sigue contando). Si el **primero** ya da 429 o el límite salta con tráfico normal, `trust-proxy` no se aplicó: `K -n blockrogue get configmap blockrogue -o yaml | grep trust-proxy` y `K -n blockrogue rollout restart deployment/blockrogue`. Borra los jugadores de prueba después.

Pide al usuario que **abra el juego en su navegador**, juegue una partida corta hasta perder, pulse «Publicar puntuación» con un apodo y vea su posición en Rankings. Es la prueba que más importa, y solo él puede hacerla.

## 8. Copias de seguridad (comprobar, no instalar nada)

El servidor hace una copia diaria en `/data/backups` y conserva 7. Comprueba que existe:
```bash
K -n blockrogue exec deploy/blockrogue -- ls -la /data /data/backups
```
Debe haber `blockrogue.db` y, tras el primer arranque, un fichero `blockrogue-AAAA-MM-DD.db`. Esas copias están en el mismo disco: **recomienda al usuario copiarlas fuera de la Pi** de vez en cuando (por ejemplo `K -n blockrogue cp <pod>:/data/backups ./copias`, con el nombre de pod de `K -n blockrogue get pods`).

## 9. Anuncios (solo si el usuario los quiere)

Requiere U3 hecho y haber puesto las variables del repositorio y relanzado el workflow (paso 3). Después: `K -n blockrogue rollout restart deployment/blockrogue`. Verifica en el navegador (no con `curl`) que la portada muestra el aviso de consentimiento, que aceptar carga el anuncio y que el enlace «Preferencias de anuncios» del pie lo retira. **Advierte al usuario**, con las palabras de `docs/anuncios.md`, de que el aviso propio no sirve como CMP para tráfico del Espacio Económico Europeo con AdSense y de que `VITE_AD_CONSENT=none` carga anuncios sin preguntar.

## 10. Actualizar y revertir

**Normalmente no hay que hacer nada:** el CronJob `blockrogue-updater` (`k8s/updater.yaml`, se instala con `apply -k`) comprueba GHCR cada 5 minutos y reinicia el juego cuando hay imagen nueva. Estado: `K -n blockrogue get cronjob,jobs` y `K -n blockrogue logs job/<último job>` (dice «sin cambios» o «Deployment reiniciado»). Si falla con «HTTP 401/403» hacia el registro, el paquete de GHCR no es público (U1). Para pausarlo: `K -n blockrogue patch cronjob blockrogue-updater -p '{"spec":{"suspend":true}}'`. Tras el primer despliegue reinicia una vez (no tiene aún el digest anotado); es normal.

```bash
# forzar la actualización a mano

K -n blockrogue rollout restart deployment/blockrogue && K -n blockrogue rollout status deployment/blockrogue
# volver a la versión anterior si algo falla
K -n blockrogue rollout undo deployment/blockrogue
# logs
K -n blockrogue logs deploy/blockrogue --tail=100
```
Los datos viven en el PVC `blockrogue-data`: reiniciar o actualizar no los borra. **No borres el PVC ni el namespace sin pedir permiso al usuario** (se perdería el ranking).

Moderación (necesita el `admin-token`; el id de un jugador sale de `GET /api/admin/players?nickname=...`):
```bash
curl "https://<DOMINIO>/api/admin/players?nickname=Apodo" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST https://<DOMINIO>/api/admin/players/<id>/hide -H "Authorization: Bearer $ADMIN_TOKEN" -d '{}'
curl -X DELETE https://<DOMINIO>/api/admin/runs/<runId> -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 11. Informe final al usuario

Termina con un resumen corto: qué quedó funcionando (con la dirección), qué pasos hizo él y cuáles quedaron pendientes, **qué retoques hiciste a los manifiestos** (para llevarlos al repositorio), el recordatorio de copiar las copias fuera de la Pi, y los riesgos de tener la Pi en casa (cortes de luz, red doméstica; lo ideal es ponerla en una red aparte). **No incluyas ningún token ni clave** en el informe, salvo el `admin-token` recién generado si el usuario aún no lo tiene, una sola vez.
