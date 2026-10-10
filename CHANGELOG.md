# Registro de cambios

Formato: [versión semántica](https://semver.org/lang/es/). Cada PR añade su línea en «Sin publicar»; la versión se fija al fusionar (ver CLAUDE.md).

## Sin publicar

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
