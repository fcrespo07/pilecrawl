# Registro de cambios

Formato: [versión semántica](https://semver.org/lang/es/). Cada PR añade su línea en «Sin publicar»; la versión se fija al fusionar (ver CLAUDE.md).

## Sin publicar

## 0.4.0 — 2026-10-09
- Nuevo nombre: **Block Rogue** (antes Derrumbe, y antes Tetrogue). Título, portada y paquete.
- Las partidas guardadas se migran desde las claves `tetrogue.*` y `derrumbe.*`.
- La versión se muestra en el juego y se lleva con este registro y etiquetas `vX.Y.Z`.

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
