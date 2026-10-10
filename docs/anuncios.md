# Anuncios: cómo funcionan y qué esperar

## Cómo funcionan, sin humo

1. **Una red de anuncios** (Google AdSense, la más sencilla) hace de intermediaria entre anunciantes y webs. Te registras con tu dominio, la revisan y, si te aprueban, te da un identificador de editor (`ca-pub-…`) y te deja crear **bloques** (huecos), cada uno con un número (`slot`).
2. **Tu página carga un script de la red.** Al abrirse, el script pregunta a la red «¿qué anuncio pongo en este hueco, para este visitante?». Los anunciantes pujan en una subasta de milisegundos y gana uno.
3. **Cobras por dos vías:** por cada 1 000 impresiones (CPM) o por cada clic (CPC). Lo que ves en el panel es un RPM: lo que ganas por cada 1 000 visitas a la página. Google se queda con una parte (en AdSense, alrededor del 32 %) y te paga al superar un mínimo (unos 70 €/$) por transferencia.
4. **No siempre hay anuncio** (`fill rate`), los bloqueadores de anuncios los quitan (entre un tercio y la mitad del público de juegos, según estimaciones habituales) y **nunca debes hacer clic en los tuyos ni pedir que otros lo hagan**: Google cierra cuentas por eso, sin aviso ni apelación útil.

## Cuánto esperar con poco tráfico

Cifras orientativas **de memoria, sin medir nada**; compruébalo con tu propio panel. Un RPM de display en una web de juegos pequeña, con público europeo, suele quedar entre 0,3 y 3 €. El hueco actual está solo en la portada (una impresión por visita, quizá dos), así que:

| Jugadores al día | Impresiones/día | Ingreso aproximado al mes |
|---|---|---|
| 100 | 200 | 2 – 20 € |
| 1 000 | 2 000 | 20 – 200 € |
| 10 000 | 20 000 | 200 – 2 000 € |

Con poca gente, no paga ni la luz de la Pi. Además AdSense a veces rechaza webs pequeñas con poco contenido («contenido de poco valor»): un juego a secas puede no ser aprobado hasta que tenga página de privacidad, de contacto y algo de texto.

**Lo que más rinde en juegos no es el banner sino el anuncio entre partidas** (a pantalla completa) y el de recompensa («mira un anuncio para repetir carta»). Eso exige un SDK de portal (CrazyGames, Poki) y, sobre todo, tráfico que ellos te mandan. Mi recomendación sigue siendo la del informe de monetización: si quieres ingresos reales, publica en un portal, que pone él los anuncios y comparte contigo los ingresos (confirma sus condiciones actuales: porcentaje, exclusividad, si permiten un servidor propio para el ranking). El ranking de la Pi y los anuncios propios son compatibles con tener tu propia web, pero no esperes vivir de ello.

## Qué hay implementado

- Un hueco en la portada (`#ad-slot`, plegado mientras no haya anuncio) y `src/ads/providers.ts` con un proveedor de **AdSense** que no lleva ningún identificador dentro: sale de variables del build.
- **Aviso de consentimiento propio y mínimo:** el script de Google solo se carga si el jugador pulsa «Sí». La respuesta se guarda en el navegador.
- Con el juego dentro de un portal, no se activa ningún proveedor (`VITE_AD_PROVIDER` vacío) y se usa su SDK. El adaptador para el SDK de cada portal no está escrito: depende de sus condiciones y de su documentación, y no hay forma de probarlo sin una cuenta. La interfaz es `AdProvider` en `src/ui/adSlot.ts`.

## Cómo activarlo (cuando tengas cuenta aprobada)

1. Dominio propio, página de privacidad (borrador en `docs/despliegue.md`, sección 9) y contacto.
2. Alta en AdSense con el dominio; espera la aprobación; crea un bloque de display adaptable.
3. Crea `public/ads.txt` con la línea que te indica AdSense (`google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`). Sin ese fichero los ingresos bajan.
4. En las variables del repositorio (Settings → Secrets and variables → Actions → Variables): `VITE_AD_PROVIDER=adsense`, `VITE_AD_CLIENT=ca-pub-…`, `VITE_AD_SLOT=<número del bloque>`, `VITE_PRIVACY_URL=https://…`. Relanza el workflow `Imagen` y reinicia el despliegue.

## Consentimiento y RGPD: lo que falta

Para visitantes del Espacio Económico Europeo y Reino Unido, Google exige una **plataforma de gestión del consentimiento certificada** (CMP, estándar TCF) para servir anuncios. El aviso Sí/No de este proyecto **no lo es**: con él, lo normal es que Google limite o no muestre anuncios a ese tráfico. Qué hacer:

- **Para tráfico europeo:** activa el mensaje gratuito de Google (AdSense → Privacidad y mensajes), pon `VITE_AD_CONSENT=none` para quitar el aviso propio y comprueba en la documentación actual de Google que cumples.
- **Cuidado con `VITE_AD_CONSENT=none`:** carga los anuncios **sin preguntar**. Solo es legal fuera de la UE o si otro CMP (el de Google) ya pide el consentimiento antes. Con el aviso propio, la portada trae un enlace «Preferencias de anuncios» (pie de página) que borra la respuesta y vuelve a preguntar, porque retirar el consentimiento tiene que ser tan fácil como darlo.
- Hasta tener el CMP, la opción prudente es **no activar anuncios** (dejar `VITE_AD_PROVIDER` vacío) o probarlos solo con tráfico de fuera del EEE.

Esto es una advertencia práctica, no asesoramiento legal.
