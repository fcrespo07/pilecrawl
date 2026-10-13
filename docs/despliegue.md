# Despliegue de Pilecrawl en tu Raspberry Pi (k3s)

Una sola imagen contiene el juego (ficheros estáticos) y el servidor del ranking (Node 22 + SQLite). Corre en **un pod**, con un volumen para la base de datos. Todo lo de abajo lo ejecutas tú: desde la nube no se puede desplegar nada en tu casa.

> Estado: el servidor tiene pruebas automáticas y se ha probado de punta a punta en un navegador. La imagen Docker y los manifiestos de Kubernetes **no se han podido probar** (el entorno donde se escribieron no tiene Docker ni cluster). El workflow `Imagen` construye la imagen arm64 en cada PR, así que si el `Dockerfile` falla lo verás ahí antes de fusionar. Es muy posible que algo de los manifiestos necesite un retoque en tu primera prueba.

## 1. Qué se despliega

```
Internet ──► Cloudflare Tunnel (o Traefik) ──► Service ──► Pod blockrogue ──► /data (SQLite + copias)
```

- Un solo pod: SQLite y el límite de peticiones viven en un proceso. No subas `replicas`.
- `GET /` sirve el juego; `/api/*` es el ranking.
- El ranking solo acepta partidas que el servidor **vuelve a jugar** con el mismo código del juego y cuyo resultado coincide. No se fía de la puntuación que dice el navegador.

## 2. Preparar la Pi

1. Raspberry Pi OS **64 bits** (Lite), a ser posible arrancando desde un SSD, no desde la tarjeta SD (SQLite escribe mucho y las SD se corrompen).
2. Para k3s en Raspberry Pi OS, añade al final de la única línea de `/boot/firmware/cmdline.txt`: `cgroup_memory=1 cgroup_enable=memory` y reinicia.
3. Instala k3s: `curl -sfL https://get.k3s.io | sh -` y comprueba con `sudo k3s kubectl get nodes`.
4. Actualizaciones automáticas de seguridad: `sudo apt install unattended-upgrades`.
5. Cortafuegos: `ufw` con solo SSH abierto. **No abras el puerto 6443 (API de Kubernetes) a internet.**

## 3. Conseguir la imagen

**Opción A, GitHub Container Registry (recomendada).** El workflow `Imagen` construye `linux/arm64` y la sube a `ghcr.io/<usuario>/<repo>:latest` al llegar un cambio a `master`. Después, en GitHub: tu perfil → Packages → el paquete → Package settings → **Change visibility → Public** (si lo dejas privado, Kubernetes necesita un `imagePullSecret` con un token `read:packages`). Si renombras el repositorio, cambia la línea `image:` de `k8s/deployment.yaml`.

**Opción B, construirla en la Pi** (sin registro):

```bash
sudo apt install -y docker.io git
git clone https://github.com/<usuario>/<repo> && cd <repo>
sudo docker build -t blockrogue:local .
sudo docker save blockrogue:local | sudo k3s ctr images import -
# tras el apply del paso 5:
sudo k3s kubectl -n blockrogue set image deployment/blockrogue blockrogue=blockrogue:local
sudo k3s kubectl -n blockrogue patch deployment blockrogue -p '{"spec":{"template":{"spec":{"containers":[{"name":"blockrogue","imagePullPolicy":"IfNotPresent"}]}}}}'
```

El ranking se activa al construir (`VITE_RANKING=1`, ya es el valor por defecto del `Dockerfile`). Para las demás variables públicas (anuncios, página de privacidad) añade `--build-arg VITE_PRIVACY_URL=https://…` etc. En la opción A se leen de las **variables** del repositorio (Settings → Secrets and variables → Actions → Variables): `VITE_PRIVACY_URL`, `VITE_AD_PROVIDER`, `VITE_AD_CLIENT`, `VITE_AD_SLOT`, `VITE_AD_CONSENT`. No son secretos (acaban en el JavaScript del navegador).

## 4. Configuración

```bash
cp k8s/config.example.yaml k8s/config.yaml     # está en .gitignore
openssl rand -hex 32                            # pégalo como admin-token
```

| Variable | Qué hace | Por defecto en la imagen |
|---|---|---|
| `ADMIN_TOKEN` | Clave para ocultar jugadores, borrar partidas y generar códigos de recuperación (página `/admin.html`, con CSP estricta). Genérala larga: `openssl rand -base64 32`; el servidor avisa al arrancar si mide menos de 24 caracteres. Sin `trust-proxy: cloudflare` todos comparten IP y diez fallos de cualquiera bloquean el admin 10 minutos. Vacía: moderación desactivada. | (Secret) |
| `NICK_BLOCKLIST` | Palabras prohibidas en apodos, separadas por comas. | vacía: ponla tú |
| `CORS_ORIGINS` | Solo si el juego se sirve desde otro dominio. | vacía |
| `TRUST_PROXY` | De dónde sale la IP del cliente para los límites: `cloudflare` (Cloudflare Tunnel, usa `CF-Connecting-IP`), `proxy` (un solo proxy delante, p. ej. Traefik: último valor de `X-Forwarded-For`) o `none` (la del socket). | `none` |
| `DB_PATH` / `BACKUP_DIR` / `BACKUP_KEEP` | Base de datos y copias diarias (`VACUUM INTO`), 7 por defecto. | `/data/...` |

Pon en `k8s/config.yaml` `trust-proxy: cloudflare` si usas el túnel o `proxy` si usas Traefik. **Importante:** el ConfigMap es opcional y, si `trust-proxy` no está aplicado, detrás de Cloudflare todos los jugadores comparten la IP del pod de `cloudflared`: el ranking parecerá roto al registrar al sexto jugador en una hora (límite de 5 por IP). Con `none` detrás de un proxy, el límite por IP vería la IP del proxy y contaría a todos juntos. Solo es seguro si **todo** el tráfico pasa por ese proxy; si expusieras el pod directamente, cualquiera podría falsear su IP. El primer valor de `X-Forwarded-For` nunca se usa porque lo escribe el cliente.

## 5. Desplegar

```bash
sudo k3s kubectl apply -f k8s/namespace.yaml     # el namespace antes que la configuración
sudo k3s kubectl apply -f k8s/config.yaml
sudo k3s kubectl apply -k k8s/
sudo k3s kubectl -n blockrogue get pods -w
sudo k3s kubectl -n blockrogue port-forward svc/blockrogue 8080:80    # prueba en http://localhost:8080
```

## 6. Sacarlo a internet

**Cloudflare Tunnel (recomendado).** La Pi abre una conexión de salida hacia Cloudflare; no abres ningún puerto, no importa que tu IP cambie ni que tu operador use CGNAT, y el HTTPS lo pone Cloudflare. Necesitas una cuenta (gratis) y un dominio (unos 10 €/año, en Cloudflare o con los DNS apuntados a ellos). Crea el túnel en Zero Trust → Networks → Tunnels, copia el token y sigue los comentarios de `k8s/cloudflared.example.yaml`. Apunta el nombre público a `http://blockrogue.blockrogue.svc.cluster.local:80`. El Ingress de Traefik ya no se aplica por defecto (`k8s/ingress.example.yaml` es solo para quien no use el túnel).

**Sin túnel**: abrir 80/443 en el router hacia la Pi, DNS dinámico y certificados con Traefik. Aplica el Ingress copiando `k8s/ingress.example.yaml` a `k8s/ingress.yaml` (ignóralo en git si quieres), cambiando `host:` por tu dominio y ejecutando `sudo k3s kubectl apply -f k8s/ingress.yaml`. Funciona, pero tu IP de casa queda a la vista, recibirás escaneos a diario y no sirve si tu operador usa CGNAT. No lo recomiendo.

### Riesgos reales de exponer la Pi desde casa

- **Disponibilidad:** un corte de luz o de internet y el juego cae. Si un portal o una red social te manda un pico de tráfico, una Pi con una línea doméstica puede quedarse corta. Para un juego de verdad, una web estática en Cloudflare Pages o similar aguanta mejor; el ranking es lo único que necesita tu Pi.
- **Seguridad:** si alguien encuentra un fallo en el servidor, está dentro de tu red. Mitigaciones: el pod corre sin root, con sistema de ficheros de solo lectura y sin capacidades; usa el túnel (sin puertos abiertos); y lo ideal es poner la Pi en una VLAN o red de invitados, separada de tus ordenadores y del NAS.
- **Datos:** el ranking guarda apodos y puntuaciones. Es poco, pero tú eres el responsable (RGPD). Los registros de acceso de Traefik/Cloudflare contienen IPs.
- **Copias:** las diarias en `/data/backups` están en el mismo disco. Copia esa carpeta a otro sitio de vez en cuando: `sudo k3s kubectl -n blockrogue cp <pod>:/data/backups ./copias`.

## 7. Operar

```bash
# logs
sudo k3s kubectl -n blockrogue logs deploy/blockrogue -f
# actualizar a la última imagen (normalmente no hace falta: lo hace solo el CronJob blockrogue-updater, ver más abajo)
sudo k3s kubectl -n blockrogue rollout restart deploy/blockrogue
# ocultar un apodo ofensivo: primero su id, luego ocultarlo
curl "https://TU-DOMINIO/api/admin/players?nickname=Apodo" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST https://TU-DOMINIO/api/admin/players/<id>/hide -H "Authorization: Bearer $ADMIN_TOKEN" -d '{}'
# borrar una partida sospechosa (el id sale en la tabla: runId)
curl -X DELETE https://TU-DOMINIO/api/admin/runs/<runId> -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Actualizaciones automáticas.** El workflow `Imagen` construye y publica la imagen arm64 en GHCR en cada fusión a master. `k8s/updater.yaml` añade un CronJob que, cada 5 minutos, pregunta a GHCR por el digest de `latest` y, si cambió, reinicia el Deployment (que baja la imagen nueva). La Pi solo hace conexiones de salida y no necesita ningún secreto; el paquete de GHCR tiene que ser público. Cliente y servidor están en la misma imagen, así que un cambio de reglas (`RULES_VERSION`) se despliega siempre entero. Ver el último resultado: `sudo k3s kubectl -n blockrogue logs job/$(sudo k3s kubectl -n blockrogue get jobs -o name | tail -1 | cut -d/ -f2)`. Pausarlo: `sudo k3s kubectl -n blockrogue patch cronjob blockrogue-updater -p '{"spec":{"suspend":true}}'`. Si la imagen nueva no queda disponible en 5 minutos (`progressDeadlineSeconds`), el actualizador vuelve a la última que funcionó, anota la mala (`pilecrawl/bad-digest` en el Deployment) y no la reintenta hasta que salga otra distinta. Entre medias el juego está caído unos 5 minutos. Avisos: (1) los fallos del CronJob son silenciosos (por ejemplo, si el paquete pasa a privado): mira de vez en cuando `kubectl -n blockrogue get jobs`; (2) hasta que se publique la primera imagen que lleva `updater.mjs`, el CronJob falla con «Cannot find module» (inofensivo); (3) con `rollout undo` a mano, pausa también el CronJob, o volverá a poner `latest`.

La base se puede abrir con `sqlite3` desde una copia. Tablas: `players`, `runs`, `bests`, `replays`, `starts`, `stats`.

**Estadísticas anónimas.** Al acabar (o abandonar) una partida el cliente manda `POST /api/stats` con un resumen sin identificadores (modo, nivel, puntos, duración, final, versión, cartas vistas y elegidas); solo se guarda el día. Límite: 40 por hora y IP y 60 por minuto en total; máximo 200 000 filas (se borran las más antiguas) y se purgan a los 400 días. Sin `TRUST_PROXY=cloudflare` todos los jugadores comparten IP y el tope de 40/h valdría para toda la web: casi todas las estadísticas se perderían sin aviso. Se leen con `https://TU-DOMINIO/stats.html` (pide `ADMIN_TOKEN`) o con `curl "https://TU-DOMINIO/api/admin/stats?days=30&mode=normal&rules=7" -H "Authorization: Bearer $ADMIN_TOKEN"` (`mode=all` junta los modos). Para vaciar los datos de prueba: `curl -X DELETE "https://TU-DOMINIO/api/admin/stats?before=AAAA-MM-DD" -H "Authorization: Bearer $ADMIN_TOKEN"`. Cualquiera puede enviar datos falsos (no hay sesión): sirven para equilibrar, no para nada que dependa de que sean verdad. El jugador puede apagarlas en `privacidad.html`.

## 8. Cómo funciona el ranking (decisiones tomadas)

- **Identidad:** apodo + identificador y secreto aleatorios guardados en el navegador. No hay email ni contraseña. Quien borre el almacenamiento del navegador pierde el apodo. Cualquiera puede borrar sus datos desde la ventana de Rankings.
- **Partida libre y contrarreloj:** al empezar, el servidor da la semilla y los desbloqueos del jugador (el mejor nivel que **el servidor** ha visto en sus partidas verificadas). La semilla se usa una sola vez y caduca a las 6 h. Por eso las partidas con ranking usan los desbloqueos del servidor y no los del navegador: un jugador nuevo con ranking empieza sin épicas ni legendarias aunque ya las tuviera desbloqueadas jugando sin conexión.
- **Desafío diario:** la semilla es la del día (pública, sale del código) y los desbloqueos son fijos. **Decisión: cuenta el mejor de varios intentos** (la recomendación del plan; más partidas, más impresiones de anuncios). Cambiar a «un solo intento» es una comprobación más en `server/app.ts` (rechazar si ya hay una partida del jugador para esa fecha). Admite el día de hoy y el de ayer (una partida puede cruzar la medianoche UTC).
- **Tablas:** diaria; semanal (lunes UTC) y de siempre para partida libre y contrarreloj. Solo cuenta la mejor de cada jugador.
- **Validación:** la repetición se rechaza si lleva cualquier campo que no conozca el servidor. Así el modo de pruebas (`sandbox: true`) y cualquier otro truco quedan fuera automáticamente.
- **Lo que no impide:** un bot que juegue de verdad, con entradas perfectas. La repetición lo hace visible: `GET /api/runs/<runId>/replay` devuelve la de cada primer puesto para revisarla; la de un diario no se sirve hasta dos días después (plazo de envío), y una repetición idéntica a otra del mismo periodo se rechaza, para que nadie copie la del primero.
- **Si cambias las reglas:** sube `RULES_VERSION` (ya es la práctica) y las partidas con la versión anterior se rechazan y las tablas (y la comprobación de «¿mejora tu marca?») solo cuentan partidas con `RULES_VERSION` actual (`runs.version`). Las filas viejas siguen en `bests` y el panel de administración las ve, pero no hace falta borrar nada para empezar de cero.
- **Límites:** 240 peticiones/min por IP, 5 jugadores nuevos/hora por IP, 60 envíos y 120 partidas iniciadas por hora y jugador. Cuerpo máximo 512 KB. Repetición válida: hasta 300 000 pasos (unos 40 minutos de juego). Tope global de 30 revalidaciones por minuto. Las repeticiones de tablas diarias y semanales de más de 30 días se borran salvo la del primer puesto.

## 9. Borrador de página de privacidad

*No es asesoramiento legal.* Publícala en cualquier sitio (una página estática) y pon su dirección en `VITE_PRIVACY_URL`.

> **Responsable:** [tu nombre], [email de contacto].
> **Qué guardamos:** el apodo que eliges, un identificador aleatorio y las partidas que publicas (puntuación y repetición). No pedimos nombre real ni email. Tu dirección IP se usa solo para limitar abusos y puede aparecer en los registros de acceso del servidor, que se borran a los [N] días.
> **Para qué:** mostrar el ranking. **Cuánto tiempo:** mientras exista el juego o hasta que borres tus datos.
> **Tus derechos:** puedes borrar tus datos desde Rankings → «Borrar mis datos» o escribiendo a [email]. También puedes acceder a ellos, rectificarlos o reclamar ante la AEPD.
> **Anuncios:** si aceptas los anuncios, Google y sus socios usan cookies para mostrarlos. Puedes cambiarlo borrando los datos del sitio en tu navegador.

## 10. Vista previa por PR y aviso de caídas

**Vista previa** (`.github/workflows/preview.yml`): cada PR del propio repo compila el cliente sin `VITE_RANKING` ni anuncios y lo sube a Cloudflare Pages en `https://pr-N.pilecrawl-preview.pages.dev`; la URL queda en un comentario del PR. Los PR de forks no la reciben. Sin los secretos, el job se salta sin fallar. Pasos únicos:

1. Cloudflare → Workers & Pages → Create → Pages → *Direct Upload*, proyecto llamado `pilecrawl-preview` (sube cualquier carpeta de prueba).
2. Cloudflare → My Profile → API Tokens → token propio (Create Custom Token) con solo el permiso *Account · Cloudflare Pages · Edit*.
3. En GitHub → Settings → Secrets and variables → Actions → Secrets: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` (el ID de cuenta sale en la barra lateral del panel).

**Aviso de caídas:** `GET /api/health` responde `{"ok":true}` y comprueba la base de datos. En UptimeRobot (plan gratis) crea un monitor HTTP(s) sobre `https://pilecrawl.fun/api/health`, intervalo de 5 min (basta vigilar el código HTTP: da 500 si falla la base de datos), y añade tu correo como contacto de alerta.

Las vistas previas son públicas y no se borran solas; comprueba que la rama de producción del proyecto Pages no sea `pr-N`.
