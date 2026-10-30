# Portales de juegos (CrazyGames)

El juego se puede publicar en portales sin cambiar nada en pilecrawl.fun. Todo lo de portal sale de variables del build (`VITE_*`) y, sin ellas, no hace nada.

## Build para el portal

```
VITE_PORTAL=crazygames npm run build
```

Con `VITE_PORTAL=crazygames` el juego carga el SDK de CrazyGames (`src/portal/portal.ts`) y avisa de:

- **carga**: `loadingStop()` cuando el juego ha arrancado;
- **tiempo de juego**: `gameplayStart()` al empezar o reanudar una partida, `gameplayStop()` al pausar, acabar o volver a la portada;
- **celebración**: `happytime()` al subir de nivel.

Sin la variable no se pide ningún script externo y las llamadas no hacen nada.

## Anuncios

Apagados por defecto. `portal.midgameAd(done)` está preparado para anuncios entre partidas, pero no se llama todavía. Para activarlo en un build de portal: `VITE_PORTAL_ADS=1`.

## Antes de enviar

- Probar en el entorno de pruebas del portal: la versión de la API y las URLs del SDK se han escrito según SDK v3 y hay que comprobarlas con su documentación.
- Revisar los requisitos del portal (enlaces de salida, pantalla de carga, apodo y guardado local).
- El inglés cubre casi todo el juego (ver `src/i18n/`); faltan el ranking, los mensajes de partida guardada y compartir, que no se usan en un portal.

## itch.io (ZIP estático)

```
npm run build:itch
```

Genera `dist-itch/` y `pilecrawl-itch.zip` en la raíz (ambos fuera de git). Con `VITE_PORTAL=itch`:

- rutas relativas (`base: './'`), para que funcione dentro del iframe de itch;
- sin enlaces a pilecrawl.fun, GitHub ni anuncios (el pie se queda con la versión);
- botón de pantalla completa en la portada (solo si el navegador la permite).

Sin estadísticas ni ranking: en un build sin `VITE_RANKING=1` no se envía nada fuera.

En Windows, `zip` puede no existir: se puede comprimir `dist-itch/` con «Comprimir» del Explorador o `Compress-Archive` de PowerShell. El ZIP debe tener `index.html` en la raíz, no dentro de una carpeta.

## CrazyGames (ZIP)

```
npm run build:crazygames
```

Genera `dist-crazygames/` y `pilecrawl-crazygames.zip` (fuera de git). Con `VITE_PORTAL=crazygames`:

- rutas relativas, sin enlaces a pilecrawl.fun, GitHub ni anuncios (requisito: sin promoción cruzada);
- **portada de un clic**: solo Jugar (partida normal), Tutorial, Catálogo y Ajustes; sin selector de modos, Expedición ni paneles de ranking (Full Launch pide entrar a jugar a un clic);
- sin botón de pantalla completa propio (el portal lo prohíbe);
- adaptador del SDK v3 (carga, inicio y parada de juego, celebración); los anuncios siguen apagados salvo `VITE_PORTAL_ADS=1`.

Pendiente antes de enviar: guardado por el módulo de datos del SDK, anuncios entre partidas y probar en su herramienta de pruebas. Detalle en `informes/portales-plataformas.md`.
