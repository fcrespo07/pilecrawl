# Registro de cambios

Formato: [versión semántica](https://semver.org/lang/es/). Cada PR añade su línea en «Sin publicar»; la versión se fija al fusionar (ver CLAUDE.md).

## Sin publicar

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
