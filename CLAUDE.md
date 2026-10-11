# Pilecrawl — contexto del proyecto

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
- Build de producción: `npm run build` (typecheck + vite build). Servidor: `npm run server` (compila y arranca; ver `docs/despliegue.md`).

## Estructura

```
index.html              portada (home), HUD, overlays (perks, pausa, fin)
src/main.ts             bucle principal, conecta juego, input, render, UI y audio
src/core/game.ts        lógica: tablero, piezas, rotación con rebotes, líneas, niveles, perks aplicados
src/core/pieces.ts      piezas y tablas de rebotes (kicks)
src/core/perks.ts       definición de perks (ventajas/desventajas), rarezas, roll
src/core/hypers.ts      hiperperks (habilidades activas: una por partida, se cargan con líneas)
src/core/modes.ts       modos de juego (partida, desafío diario, contrarreloj, tutorial) y semilla del diario
src/records.ts          récords por modo y último modo elegido (localStorage)
src/net/ranking.ts      cliente del ranking (opcional: VITE_RANKING=1); src/ui/ranking.ts, tabla y publicar
src/ads/providers.ts    proveedores de anuncios (AdSense) para el hueco de la portada
server/                 servidor del ranking: Node 22 + SQLite, revalida repeticiones con src/core
docs/                   despliegue en la Raspberry (k3s) y anuncios; k8s/ y Dockerfile en la raíz
src/core/emitter.ts     eventos tipados game → efectos/UI
src/input.ts            teclado con DAS/ARR
src/gestures.ts         táctil por gestos sobre el tablero (arrastrar, tocar, tirón abajo, deslizar arriba)
src/fx/renderer.ts      PixiJS: tablero, ghost, partículas, filtros, shake, textos
src/fx/postfx.ts        shader de pantalla (rejilla, aberración, pixelado, tinte)
src/fx/particles.ts     sistema de partículas con pool
src/fx/audio.ts         efectos y música procedural
src/fx/layout.ts        coordenadas lógicas (960×720) y paleta de acentos
src/ui/ui.ts            HUD DOM, cartas de perks, pausa, fin de partida, tooltips
src/ui/tutorial.ts      cuadro de consejos del tutorial (escucha eventos; no toca reglas)
src/ui/icons.ts         iconos SVG de perks (a mano; las de pieza se dibujan con la forma)
```

## Mecánica clave

- **Tablero:** 11 columnas × 18 filas visibles (`COLS`, `ROWS`, `HIDDEN` en `game.ts`). No volver al 10×20 clásico.
- **Niveles:** `linesNeeded()` en `game.ts`. 8 líneas al principio, +1 cada dos niveles, tope 16. Se resta `linesReduction` de los perks.
- **Perks:** cada uno tiene `pros` y `cons` (se muestran en verde y rojo) y un `apply(mods, game)`. Los efectos se leen de `Mods` (`perks.ts`). Los que dependen del estado (Ahorro, Vértigo, Coleccionista, Fénix) se calculan en `scoreMultNow()`. `mods.choices` es el número de cartas (Abanico = 4).
- **Pieles:** la de base es `pixel`. Solo las hiperperks cambian la piel, y solo mientras están activas (`HyperDef.skin`, leída con `game.skinNow()`; Plano, Apagón, Terminal, Neón). La recolorean: `src/fx/skins.ts` para el lienzo y `body[data-skin]` en `style.css` para el DOM (redefinen los tokens, incluidos `--hi`, `--hot`, `--shade` y `--raise` del estilo píxel). Son solo cosméticas; nunca deben cambiar reglas. El renderer aclara con `tone()` los colores fijos de textos y destellos; los acentos de nivel (`ACCENTS`) ya son claros.
- **Ofertas:** `rollOffer` sortea una rareza (peso × cartas que quedan) y saca todas las cartas de ella. Desde `CURSE_FROM_LEVEL` hay ofertas malditas con probabilidad `CURSE_CHANCE`, nunca dos seguidas, con cartas de `CURSES` (`curse: true`, solo `cons`); la oferta siguiente es rara o mejor (`blessedOffer`).
- **Racha:** medidor de 0 a 100 (`streak.ts`, `game.streak`). Sube al limpiar varias líneas a la vez, con combos, giros y limpiando rápido; baja con cada pieza fijada. Suma suerte a las ofertas (`offerLuck()`, tope de un Trébol) y decide si sale hiperperk. Se ve en el HUD y, con las probabilidades de cada rareza, en la pantalla de cartas.
- **Hiperperks:** habilidades activas a propósito más rotas que los perks (`hypers.ts`). No están garantizadas: desde el nivel `HYPER_FROM_LEVEL` (3), cada subida trae una con probabilidad `hyperChance(racha)` (4% a 30%); si no ha salido, al nivel `HYPER_SURE_LEVEL` (8) sale seguro. Se elige antes de la carta normal; una por partida. Se carga con líneas (`hyperCharge`, vía `addLines`) y se suelta con D o el botón táctil: es la acción `hyper` de la repetición. La duración va en pasos (`hyperLeft`), así que la pausa no la gasta. Los efectos viven en `game.ts` leyendo `hyperActive(id)`.
- **Piezas extra:** cada perk de pieza mete una pieza en `mods.extraPieces`. Las piezas están en `pieces.ts` (M1, D2, V3, I3, X5, P5).
- **Basura:** desde el nivel 4 sube una fila cada `garbageInterval()` piezas.
- **Bombas, taladro y prisma:** se marcan en la cola (`makeSpec`) y se resuelven en `lockPiece`.
- **Modos:** `MODES` en `modes.ts`. El modo va en `Game.start(seed, mode)` y en la repetición. El diario usa `dailySeed(fecha UTC)`, desbloqueos fijos y una mejora inicial con azar propio; el contrarreloj termina por pasos (`timeLimitMs`), así que la pausa y la elección de carta no gastan tiempo. Un modo nuevo que cambie reglas debe vivir en `game.ts` leyendo `MODES[this.mode]`, no en la UI.
- **Ranking:** el servidor (`server/app.ts`) solo acepta repeticiones con exactamente las claves de `Replay` (`validate.ts`): cualquier campo nuevo en una repetición, como la marca del modo de pruebas, la hace rechazar. Un cambio de reglas sube `RULES_VERSION`. Las partidas libres usan semilla y desbloqueos del servidor.
- **Tutorial:** modo `tutorial` (`MODES.tutorial.tutorial`), no sale en el selector (`PLAY_MODE_IDS`) y no guarda récord ni mejor nivel. Sus reglas viven en `game.ts` (`setupTutorial`, `TUTORIAL_*`): 2 filas casi llenas y piezas fijas al principio, 3 líneas por nivel, hiperperk segura al nivel 3 y cargada con 3 líneas, sin basura. El guion está en `src/ui/tutorial.ts` (pasos con `done` y textos para teclado y táctil). Entrada: botón «Tutorial» de la portada.
- **Móvil:** con puntero táctil y pantalla de pie el escenario pasa a vertical (`setLayout` en `layout.ts`: 540 de ancho, alto según la pantalla; los valores de `layout.ts` son `let` y se leen vivos). Reserva y cola van en una fila sobre el tablero y el HUD se recoloca con `body.portrait` en `style.css`. En horizontal queda el 960×720 de siempre. Los controles son gestos (`gestures.ts`) más el botón de pausa y la tarjeta Hiper; no tocan reglas ni repeticiones.
- **Eventos:** el juego emite eventos tipados (`game.events`). Los efectos y la UI escuchan, sin que `game.ts` sepa de Pixi ni del DOM.

## Decisiones de diseño

- Los perks cambian reglas, no solo suman números. Cada mejora buena tiene su contrapartida.
- Sin emojis en la interfaz. Los iconos son SVG propios.
- Estilo visual «Píxel» (elegido por el usuario entre seis propuestas, 2026-10-09): consola de 16 bits, cielo nocturno con colinas, bloques de 8×8, bordes de 4 px con esquinas de píxel. Fuentes Press Start 2P (títulos, números y lienzo) y VT323 (texto, con `font-size-adjust`). Los estilos están en `style.css`: base y, al final, la capa «Estilo píxel». Sustituye a «papel y tinta».
- Aspecto propio frente a Tetris (caso Xio): tablero 11×18, fantasma rayado con esquinas, y reserva (izquierda) y cola (columna a la derecha, como espera el jugador) junto al tablero (`HOLD_*`, `NEXT_*` en `layout.ts`). Las formas de las siete piezas se mantienen.
- Rareza: común, rara, épica, legendaria. Los pesos están en `RARITY_WEIGHT`. El perk Trébol sube las probabilidades de las demás.
- Efectos de pantalla (ondas de choque + `postfx.ts`: rejilla, aberración, pixelado, tinte): sutiles y ligados a eventos. Se apagan con F o con el botón del menú de pausa; se guarda en `blockrogue.fx`. `prefers-reduced-motion` los reduce y un equipo lento (>34 ms/fotograma durante 3 s) los apaga solo. `Renderer.ultiBurst(color)` es el gancho para las ultis.
- Récord en `localStorage` (`blockrogue.best`). Se envuelve en try/catch.
- Nombre: Pilecrawl (antes Block Rogue, Derrumbe y Tetrogue). Las claves guardadas siguen en `blockrogue.*` (`src/storage.ts` migra `tetrogue.*` y `derrumbe.*` a esas); la semilla del diario tampoco cambia, para no alterar los retos.

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

## Versionado

- Versión semántica en `package.json`. Sigue en 0.x: aún no está listo para publicar. Sube la minor (0.x.0) con novedades de juego (perks, modos, mecánicas) y la patch (0.x.y) con arreglos y retoques.
- **Cada PR añade su línea en español** bajo `## Sin publicar`, al principio de `CHANGELOG.md` (con número de PR). Así los PR abiertos a la vez no chocan por la versión.
- **La versión se sube al fusionar**: en el último commit del PR que se fusiona, Claude cambia `version` en `package.json` y `package-lock.json` (las dos primeras apariciones) y mueve lo de `Sin publicar` a una sección `## X.Y.Z — fecha`. El resto de PR abiertos rebasan sin tocar versión.
- La versión se ve en el juego (`[data-version]` en la portada; viene de `package.json` vía `__APP_VERSION__` en `vite.config.ts`).
- Las etiquetas `vX.Y.Z` y su release (con la sección del CHANGELOG) las crea solas `.github/workflows/release.yml` al llegar a master con una versión nueva. No hace falta etiquetar a mano. Ese workflow, lanzado a mano una vez, rellena v0.1.0 a v0.3.0.
