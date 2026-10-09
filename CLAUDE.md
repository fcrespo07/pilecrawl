# Derrumbe — contexto del proyecto

Juego de bloques que caen, roguelite, en web. Cada cierto número de líneas se sube de nivel y el jugador elige 1 de 3 mejoras (perks) que cambian las reglas. Las mejoras se acumulan y pueden combinarse.

## Stack

- TypeScript (strict) + Vite 8 + PixiJS 8 (WebGL) + pixi-filters 6.
- Interfaz en HTML/CSS (`index.html`, `src/style.css`, `src/ui/`).
- Sonido 100% sintetizado con Web Audio (`src/fx/audio.ts`). No hay ficheros de audio.
- Sin frameworks de UI ni de juego.

## Comandos

- Desarrollo: `npm run dev` (puerto 5173, `--strictPort`).
- Arrancar y abrir navegador: `powershell -ExecutionPolicy Bypass -File jugar.ps1`. Ctrl+C para la sesión.
- Comprobar tipos: `npm run typecheck`.
- Build de producción: `npm run build` (typecheck + vite build).

## Estructura

```
index.html              HUD, overlays (inicio, perks, pausa, fin)
src/main.ts             bucle principal, conecta juego, input, render, UI y audio
src/core/game.ts        lógica: tablero, piezas, rotación con rebotes, líneas, niveles, perks aplicados
src/core/pieces.ts      piezas y tablas de rebotes (kicks)
src/core/perks.ts       definición de perks (ventajas/desventajas), rarezas, roll
src/core/emitter.ts     eventos tipados game → efectos/UI
src/input.ts            teclado con DAS/ARR
src/fx/renderer.ts      PixiJS: tablero, ghost, partículas, filtros, shake, textos
src/fx/particles.ts     sistema de partículas con pool
src/fx/audio.ts         efectos y música procedural
src/fx/layout.ts        coordenadas lógicas (960×720) y paleta de acentos
src/ui/ui.ts            HUD DOM, cartas de perks, pausa, fin de partida, tooltips
src/ui/icons.ts         iconos SVG de perks (a mano; las de pieza se dibujan con la forma)
```

## Mecánica clave

- **Tablero:** 11 columnas × 18 filas visibles (`COLS`, `ROWS`, `HIDDEN` en `game.ts`). No volver al 10×20 clásico.
- **Niveles:** `linesNeeded()` en `game.ts`. 8 líneas al principio, +1 cada dos niveles, tope 16. Se resta `linesReduction` de los perks.
- **Perks:** cada uno tiene `pros` y `cons` (se muestran en verde y rojo) y un `apply(mods, game)`. Los efectos se leen de `Mods` (`perks.ts`).
- **Piezas extra:** cada perk de pieza mete una pieza en `mods.extraPieces`. Las piezas están en `pieces.ts` (M1, D2, V3, I3, X5, P5).
- **Basura:** desde el nivel 4 sube una fila cada `garbageInterval()` piezas.
- **Bombas, taladro y prisma:** se marcan en la cola (`makeSpec`) y se resuelven en `lockPiece`.
- **Eventos:** el juego emite eventos tipados (`game.events`). Los efectos y la UI escuchan, sin que `game.ts` sepa de Pixi ni del DOM.

## Decisiones de diseño

- Los perks cambian reglas, no solo suman números. Cada mejora buena tiene su contrapartida.
- Sin emojis en la interfaz. Los iconos son SVG propios.
- Aspecto propio frente a Tetris (caso Xio): tablero 11×18, fantasma rayado con esquinas, y reserva y cola en una barra horizontal encima del tablero (`QUEUE_*` en `layout.ts`). Las formas de las siete piezas se mantienen.
- Rareza: común, rara, épica, legendaria. Los pesos están en `RARITY_WEIGHT`. El perk Trébol sube las probabilidades de las demás.
- Efectos visuales pesados (bloom, CRT) se pueden desactivar con F. El estado queda en la sesión, no se guarda.
- Récord en `localStorage` (`derrumbe.best`). Se envuelve en try/catch.

## Estado

- Tipado y build limpios.
- Probado en navegador: inicio, cuádruple, subida de nivel, elección de perks, pausa, fin de partida, bomba, prisma, terremoto, vida extra.
- **Sin equilibrar:** no se han jugado partidas reales. Las cifras (líneas por nivel, fuerza de los perks, velocidad de la basura) son estimaciones.
- **Sin probar:** el audio no se ha oído.
- **Pendiente sugerido:** jefes cada X niveles, sinergias entre perks, mejoras permanentes entre partidas.

## Convenciones

- Código y comentarios en español cuando explican el juego. Identificadores en inglés.
- No añadir emojis a la interfaz.
- Nada que lo relacione con Tetris: ni la palabra (tampoco T-spin, Perfect Clear), ni el nombre, ni la paleta oficial de piezas, ni la melodía Korobeiniki. Es marca registrada y The Tetris Company la defiende. Para 4 líneas se dice "cuádruple"; para los spins, "giro".
- Antes de dar algo por hecho, `npm run typecheck` y comprobar en el navegador.
- Los scripts de PowerShell van en ASCII puro: PowerShell 5.1 se rompe con caracteres como el guion largo.
