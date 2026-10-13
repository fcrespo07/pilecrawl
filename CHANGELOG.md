# Registro de cambios

Formato: [versión semántica](https://semver.org/lang/es/). Cada PR añade su línea en «Sin publicar»; la versión se fija al fusionar (ver CLAUDE.md).

## Sin publicar
- Administración del ranking en `/admin.html` (con `ADMIN_TOKEN`): ver cada tabla, borrar una puntuación o todas las de un jugador, ocultar jugadores y generar un código de recuperación nuevo para quien perdió el suyo (el anterior deja de valer; el código no se puede leer porque solo se guarda su hash). Acciones registradas en el log del servidor. La clave se compara por hash y solo los intentos fallidos cuentan para el bloqueo por IP.

## 0.24.4 — 2026-10-13
- Los nombres del ranking de la portada se ven completos: si no caben en una línea, bajan a la siguiente en vez de cortarse. Los paneles laterales son un poco más anchos, y por debajo de 1080 px bajan debajo del botón Jugar.
- Primera visita: en un navegador sin partidas guardadas, el tutorial aparece primero en la lista de modos y marcado. Tras empezar cualquier partida, la portada vuelve a la de siempre.

## 0.24.3 — 2026-10-13
- (#52) Las hiperperks se ven de arcoíris que cambia por bloques de color: carta de oferta, nombre, indicador de la partida, lista de la pausa y catálogo. Cambia a ritmo lento (unos 2,5 cambios por segundo, por debajo del límite de destellos). Con movimiento reducido quedan con el morado de base y franjas fijas. Solo cambia el aspecto, no las reglas.

## 0.24.2 — 2026-10-13
- Ranking: las lecturas se reintentan una vez si la red falla, y el aviso de «sin conexión» menciona que una red de colegio o empresa puede estar filtrando el servidor (#51).

## 0.24.1 — 2026-10-13
- Los ojos del marcianito del logo de la portada siguen al cursor (o al último toque, y tras un momento vuelven a su posición de reposo). Pasos de un píxel, sin coste con la partida en marcha y quietos con movimiento reducido (#50).

## 0.24.0 — 2026-10-13
- (#49) Con apodo, la partida se publica sola al acabar en arcade, diario y contrarreloj; el servidor solo guarda las que mejoran tu marca. Si el envío falla, queda el botón para reintentar. No cambian las reglas ni las repeticiones.

## 0.23.0 — 2026-10-13
- Pantalla de Ajustes (desde la portada y la pausa): volumen general, de música y de efectos, efectos de pantalla, teclas reasignables (hasta tres por acción, con aviso si chocan) y manejo (espera y repetición). En la pausa, «Guardar y salir» guarda la partida en el navegador y «Continuar partida» en la portada la retoma exactamente donde estaba; el guardado se borra al reanudar y se descarta con aviso si cambian las reglas. También hay «Salir sin guardar». No cambian las reglas ni las repeticiones (#48).

## 0.22.0 — 2026-10-13
- **Segunda vida** sale bastante menos: pesa un cuarto que el resto de legendarias dentro de su rareza y, cuando es la única desbloqueada (primeras partidas), la rareza legendaria entera sale un cuarto de veces. Los **combos pesan mucho más en la rareza de las ofertas**: un cuádruple o giro suma 10 de calor legendario aunque sea el primero y 50 de calor épico (antes 40); los seguidos (back-to-back) suman 30, 50, 70 y 90 de calor legendario según la cadena; los combos desde el tercer paso suman 6 por paso. Los multiplicadores a calor lleno suben (épica ×5, legendaria ×15) y el calor legendario baja más despacio (1 por pieza). `RULES_VERSION` sube a 10 (#47).

## 0.21.1 — 2026-10-13
- Frenesí dejaba el fondo casi negro: la piel neón tenía un degradado oscurísimo y ni estrellas ni colinas, así que el lienzo y la página parecían rotos. Ahora el fondo es violeta, con la misma sustancia visual que el resto de pieles. Solo cambia el aspecto, no las reglas (#46).

## 0.21.0 — 2026-10-11
- Las hiperperks con duración se pueden cortar: volver a pulsar D (o tocar la tarjeta Hiper) las termina al momento, sin devolver la carga (los primeros 0,3 s no cuentan, para evitar dobles toques). Tres hiperperks nuevas, cada una con su piel: **Diluvio** (todas las piezas son barras I, 10 s), **Gravedad** (el tablero se compacta al fijar cada pieza, 6 s) y **Escudo** (no puedes perder: si te desbordas se vacía el tablero salvo 5 filas, 10 s). `RULES_VERSION` sube a 8 (#42).

## 0.20.0 — 2026-10-11
- Arcade más loco y con legendarias de verdad. Las legendarias salían en menos de 1 de cada 200 ofertas (el peso iba por carta y había 24 comunes por 3 legendarias, además de pedir el nivel 7); ahora el peso va por rareza (común 52, rara 30, épica 13, legendaria 5) y epicas/legendarias se desbloquean en los niveles 3 y 5. Los combos influyen mucho más: un calor por rareza que suben jugadas distintas (dobles, triples y combos → rara; cuádruples y giros → épica; back-to-back, combos largos y tablero limpio → legendaria), visible en el panel de racha. Segunda vida pasa a legendaria (máx. 2) pero sigue disponible desde la primera partida. Tres legendarias nuevas: Furia, Eco y Casino. Abanico ahora suma +1 carta en vez de fijar 4; Casino no recorta las ofertas de hiperperk. Sube `RULES_VERSION` a 8 (#43).

## 0.19.9 — 2026-10-11
- Estadísticas anónimas de partidas para equilibrar con datos reales: al acabar o abandonar una partida el cliente envía un resumen sin identificadores (`POST /api/stats`), con casilla para apagarlas en la página de privacidad; el responsable las lee en `/stats.html` o en `/api/admin/stats` con `ADMIN_TOKEN`. El juego emite un evento `offer` nuevo (solo informa, sin cambio de reglas) (#45).

## 0.19.8 — 2026-10-11
- Cada PR despliega una vista previa del cliente en Cloudflare Pages (sin ranking ni anuncios) y comenta la URL; la guía incluye el aviso de caídas con `/api/health` (#44).

## 0.19.7 — 2026-10-11
- La versión que sirve la página también aparece en el menú de pausa, además del pie de la portada, para saber qué build tienes delante (#41).

## 0.19.6 — 2026-10-11
- Ranking en la portada: el panel del diario y el de partida (semana) enseñan los tres primeros y, si juegas, tu puesto con 2 puestos por encima y 2 por debajo (el servidor devuelve `near` en `/api/leaderboard`). El día del desafío lo marca el servidor (`/api/config` trae `now`), así que un reloj mal puesto no cambia el diario; sin servidor se usa el reloj local (#40). Arregla además la lista «Tus mejores» de la portada, que salía apretada.

## 0.19.5 — 2026-10-11
- Catálogo de mejoras accesible desde la primera pantalla de la portada (antes estaba dentro de «Cómo se juega y más»). Las mejoras que Expedición bloquea hasta cumplir un reto lo indican con el reto al lado (#39).

## 0.19.4 — 2026-10-11
- El logo (la criatura sobre la pila) sale en la portada, sobre el título, y en las cabeceras de las páginas de privacidad y contacto. Al compartir el enlace se ve con una imagen de vista previa (`og:image`) (#37).

## 0.19.4 — 2026-10-11
- Despliegue: actualización automática en la Pi. `k8s/updater.yaml` añade un CronJob que cada 5 minutos mira el digest de la imagen `latest` en GHCR (la que ya construye el workflow `Imagen`) y reinicia el juego si cambió; si la imagen nueva no arranca en 5 minutos, vuelve a la última buena y no la repite; solo conexiones de salida, sin secretos (#36).

## 0.19.3 — 2026-10-11
- Logo y favicon de Pilecrawl: una criatura sobre una pila de bloques, en píxel art (SVG, PNG y apple-touch-icon), como icono de la pestaña (portada y páginas de privacidad y contacto) (#35).

## 0.19.2 — 2026-10-11
- Anuncios: la web trae sus páginas de privacidad y de contacto (`/privacidad.html`, `/acerca.html`, con enlaces en el pie de la portada), `ads.txt` y la etiqueta de verificación de AdSense se generan solos en el build desde las variables, y con `VITE_AD_CONSENT=none` el enlace «Preferencias de anuncios» reabre el mensaje de consentimiento de Google. Variables nuevas: `VITE_CONTACT_EMAIL`, `VITE_SITE_OWNER` (#34).

## 0.19.1 — 2026-10-11
- La Expedición se marca como **beta** (etiqueta en el botón de la portada, en su tarjeta y en su pantalla): costes, fragmentos y retos están sin equilibrar (#33).

## 0.19.0 — 2026-10-11
- **Expedición: retos y perks bloqueados**: 8 perks (Cruz, Maestro del giro, Combo eterno, Interés compuesto, Bomba, Prisma, Terremoto y Fénix) no salen en las ofertas de la Expedición hasta cumplir su reto en una sola partida (3 cuádruples, 5 giros, combo 6, nivel 6, 30 y 60 líneas, nivel 9, 10 minutos). El progreso se ve en la pantalla de la Expedición y el catálogo indica el reto de cada perk. El arcade no cambia (#32).

## 0.18.0 — 2026-10-11
- **Modo Expedición (primera parte)**: nuevo modo con progresión entre partidas y sin ranking. Cada partida da fragmentos (8 por nivel + 1 por línea) que se gastan en 7 mejoras permanentes: Repuesto, Vista larga, Aguante, Calma, Ritmo, Vida de repuesto y Buen arranque. Se entra desde el botón «Expedición» de la portada; el progreso se guarda en el navegador (`blockrogue.exp`). Las repeticiones de este modo no se pueden validar y el servidor las rechaza; el arcade no cambia. Sin equilibrar (#31).

## 0.17.1 — 2026-10-11
- **Arreglo del cuelgue sin cartas**: si todas las cartas están al máximo, la subida de nivel ya no deja la partida parada: se resuelve sola con puntos (1000 × nivel) y un aviso en pantalla. Las partidas anteriores dejan de aceptarse en el ranking (reglas v7): hay que redesplegar el servidor (#30).
- Texto interno: «ulti» pasa a «hiperperk» en los comentarios (no había texto visible con «ulti»).

## 0.17.0 — 2026-10-11
- **Apodos en el ranking**: se puede cambiar el apodo (3 veces al día), recuperarlo en otro navegador con un código de recuperación (se ve en la ventana de Rankings) y generar un código nuevo que invalida el anterior. Los apodos son únicos también frente a parecidos («A.na», «4na», letras de otro alfabeto) y solo admiten escritura latina; el filtro de palabras prohibidas, propio y sumado a `NICK_BLOCKLIST`, entiende letras repetidas, cifras por letras y trucos de Unicode sin bloquear nombres como Ignazio o Pollack. La base de datos gana una columna `nick_key` (se migra sola al arrancar). Sin cambios en las repeticiones (#29).

## 0.16.0 — 2026-10-11
- **Móvil en vertical y con gestos**: en el móvil de pie el juego pasa a una disposición vertical centrada en el tablero (marcador arriba, reserva y siguientes sobre el tablero, hiperperk y racha debajo; las cartas se apilan). Los botones táctiles se sustituyen por gestos: arrastrar mueve, tocar gira, deslizar hacia arriba guarda, un tirón rápido hacia abajo suelta y arrastrar despacio baja; quedan el botón de pausa y la tarjeta Hiper. En horizontal sigue como antes (#28).

## 0.15.1 — 2026-10-10
- Despliegue: el namespace se crea antes de la configuración (si no, `kubectl apply -f k8s/config.yaml` fallaba) y el Ingress de Traefik pasa a ser opcional (`k8s/ingress.example.yaml`), porque la vía recomendada es Cloudflare Tunnel. Nueva guía para que un agente despliegue por ti (#27).

## 0.15.0 — 2026-10-10
- **Ranking en línea y despliegue**: servidor propio (`server/`, Node 22 + SQLite) que vuelve a jugar cada repetición con el motor del juego y calcula él la puntuación (desafío diario con semilla del día; partida libre y contrarreloj con semilla del servidor, de un solo uso). Tablas diaria, semanal y de siempre; apodo anónimo y borrado de datos; moderación por clave. En el juego: botón «Rankings» en la portada y «Publicar puntuación» al acabar (solo con `VITE_RANKING=1`). Imagen Docker arm64, manifiestos para k3s (`k8s/`), workflow de imagen y guías en `docs/` (despliegue en la Raspberry, anuncios). Adaptador de anuncios AdSense sin identificadores en el código y con aviso de consentimiento propio (#26).

## 0.14.1 — 2026-10-10
- Nuevo nombre: **Pilecrawl** (antes Block Rogue). Cambian títulos, portada, paquete y textos de los scripts. Las claves guardadas no cambian, así que los récords, ajustes y el reto diario se conservan (#25).

## 0.14.0 — 2026-10-10
- **Tutorial**: botón en la portada que abre una partida guiada y corta. Enseña mover, soltar y girar, subir de nivel, elegir mejoras (ventaja y precio, reroll, ofertas malditas), la racha y la hiperperk (aquí sale segura y se carga con 3 líneas). El cuadro de consejos avanza según lo que haces, funciona con teclado y con botones táctiles y se puede dejar con «Salir». No guarda récord ni cuenta para desbloquear rarezas (#24).

## 0.13.1 — 2026-10-10
- La portada se centra en jugar: en la primera pantalla van el nombre, los modos, un Jugar grande y el hueco de anuncio (separado del botón) en el centro, y a los lados «Tus mejores» y el diario de hoy, preparados para el ranking mundial; en móvil los paneles bajan debajo de Jugar. Historia, Rankings, catálogo, cómo se juega y controles quedan bajo el pliegue (#23).

## 0.13.0 — 2026-10-10
- **Catálogo y laboratorio**: una página nueva en la portada con todas las mejoras (por rareza), maldiciones e hiperperks y lo que hace cada una. Y un laboratorio en la pausa para probar: añadir y quitar mejoras, cambiar la hiperperk, la velocidad de caída, el nivel, las vidas y los rerolls. El laboratorio solo existe en desarrollo o con `?lab` en la dirección; usarlo marca la partida (`sandbox`): no guarda récord ni mejor nivel, y su repetición se rechaza para que no entre en rankings. (#22)

## 0.12.1 — 2026-10-10
- Bombardeo ya no deja la pantalla negra: el modo noche conserva el cielo de estrellas y las colinas de la piel Píxel, solo más oscuro (sin reglas nuevas) (#21).

## 0.12.0 — 2026-10-10
- **Racha**: un medidor nuevo en el HUD que sube con varias líneas a la vez, combos, giros y jugando rápido, y baja con cada pieza. Mejora las cartas que salen (la pantalla de cartas enseña la probabilidad de cada rareza) y adelanta las hiperperks: ya no se eligen siempre en el nivel 4, sino que desde el 3 pueden salir al subir (más cuanta más racha) y, si no han salido, salen seguro en el 8. Plano, Apagón, Terminal y Neón dejan de ser perks y pierden sus efectos de juego (puntos, cola, fantasma, combos): cada hiperperk pone su piel mientras está activa, y al soltarla el estallido de pantalla sale de su color. Reglas versión 6 (#20).

## 0.11.0 — 2026-10-10
- La cola de siguientes vuelve a una columna a la derecha del tablero y la reserva a otra a la izquierda (más cómodo y lo que el jugador espera). Efectos de pantalla con un shader propio: rejilla de monitor suave, aberración cromática con los golpes, pixelado al subir de nivel y pulso de color con la hiperperk. F o el botón «Efectos» del menú de pausa los apaga (se guarda); un equipo lento los apaga solo y avisa. En reposo no hay filtro de pantalla (la rejilla es estática). `Renderer.ultiBurst(color)` queda como gancho para las ultis (#19).

## 0.10.1 — 2026-10-10
- Portada rediseñada como menú principal: Arcade (con sus tres modos y récords) y, bloqueadas con «Próximamente», Historia y Rankings. Hueco de anuncio plegado y aislado en `src/ui/adSlot.ts`, sin ninguna red de anuncios (#18).

## 0.10.0 — 2026-10-09
- Nuevo estilo visual «Píxel» en toda la interfaz: consola de 16 bits con cielo nocturno, bloques de 8×8 píxeles, bordes de 4 px y letra de recreativa. Sustituye a «papel y tinta». Las pieles de los perks (Plano, Apagón, Terminal, Neón) recolorean el estilo píxel (#17).

## 0.9.0 — 2026-10-09
- **Hiperperks**: al subir al nivel 4 eliges una habilidad activa por partida (Cámara lenta, Frenesí, Arena, Bombardeo o Tabla rasa). Se carga limpiando líneas y se suelta con la tecla D o el botón táctil. Reglas versión 5 (#16).

## 0.8.0 — 2026-10-09
- Las cartas de cada subida de nivel son de la misma rareza (si no quedan bastantes, se completa con las de al lado) (#15).
- Ofertas malditas: desde el nivel 5, algunas subidas (nunca dos seguidas) solo ofrecen maldiciones y hay que elegir la menos mala; la siguiente oferta es rara o mejor. Ocho maldiciones nuevas. Reglas a la versión 4 (#15).
- La basura nunca sube más a menudo que cada 3 piezas, sumen lo que sumen los perks (#15).

## 0.7.0 — 2026-10-09
- Cuatro mejoras que cambian la piel de la interfaz mientras las tienes: Plano (común), Apagón y Terminal (raras) y Neón (épica). Si tienes varias, manda la última. La piel es solo aspecto (#14).
- Las reglas pasan a la versión 3 por las cartas nuevas (#14).
- La tecla 4 de la elección de cartas ya solo aparece con Abanico (#14).

## 0.6.0 — 2026-10-09
- Once mejoras nuevas: Respiro, Ahorro, Cosecha, Reflejos (comunes); Reciclaje, Vértigo, Salvavidas, Abanico (raras); Ancla, Coleccionista (épicas) y Fénix (legendaria). Con Abanico se eligen 4 cartas (tecla 4) (#13).
- Las reglas pasan a la versión 2: las repeticiones grabadas antes no valen (#13).
- El bot de equilibrio juega 60 partidas por caso en vez de 30, porque con 30 el azar de las cartas llenaba la banda entera (#13).

## 0.5.0 — 2026-10-09
- Modos de juego: **desafío diario** (misma semilla y mejora inicial para todos cada día) y **contrarreloj** (tres minutos). Selector en la portada y récord por modo (#12).

## 0.4.0 — 2026-10-09
- Nuevo nombre: **Block Rogue** (antes Derrumbe, y antes Tetrogue). Título, portada y paquete.
- Las partidas guardadas se migran desde las claves `tetrogue.*` y `derrumbe.*`.
- Interfaz de papel y tinta: aspecto de boletín impreso en HUD, menús y tablero (#2).
- Página de inicio a pantalla completa con récord, cómo se juega y controles (#9).
- La versión se muestra al pie de la portada y se lleva con este registro y etiquetas `vX.Y.Z`.

## 0.3.0 — 2026-10-09
- Tablero de 11×18, fantasma rayado y barra de reserva y cola sobre el tablero (#8).
- Se quita todo lo que relaciona el juego con Tetris; piezas con paleta propia (#7).
- Núcleo determinista: semilla, paso fijo y grabación de partidas para rankings (#10).

## 0.2.0 — 2026-10-09
- Controles táctiles en pantallas sin ratón (#3).
- Progresión ligera: el mejor nivel desbloquea perks más raros (#4).
- Arreglos de música al silenciar; cruz y prisma rehechos (#5).
- Todo lo anterior llega a master (#6).

## 0.1.0 — 2026-10-09
- Primera versión jugable: perks, niveles, basura, efectos y audio.
- Corrección de bugs del informe, tests, bot de equilibrio y CI (#1).
