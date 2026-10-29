// Constantes del núcleo: tablero, ritmo de la simulación, reglas de la partida y puntuación.
// Salieron de `game.ts` sin cambiar ningún valor. `game.ts` las vuelve a exportar.

// Tablero propio de 11×18 visibles (no el 10×20 clásico del género)
export const COLS = 11;
export const ROWS = 20; // 2 filas ocultas arriba
export const HIDDEN = 2;
export const VISIBLE = ROWS - HIDDEN;

/** Bit que marca un bloque como dorado dentro del valor de la celda. */
export const GOLD_BIT = 0x100;
export const cellType = (v: number) => v & 0xff;
export const isGold = (v: number) => (v & GOLD_BIT) !== 0;

/**
 * Paso fijo de la simulación (ms). `main.ts` acumula el tiempo real y llama a `step()`
 * tantas veces como toque, así la partida no depende de los fotogramas y se puede rejugar.
 */
export const STEP_MS = 1000 / 120;
/** Pasos tras soltar una hiperperk en los que pulsar otra vez no la corta (0,3 s). */
export const HYPER_STOP_GRACE = 36;
/** Pausa táctica: pasos que se congela la caída (3 s). */
export const TACTIC_STEPS = Math.round(3000 / STEP_MS);
/** Comodín: racha que cuesta descartar la pieza. */
export const WILD_STREAK_COST = 25;
/** Cada cuántos niveles se regala un reroll (al llegar al 5, 10, 15…). */
export const REROLL_EVERY_LEVELS = 5;

/** Ritmo de la caída rápida (flecha abajo), en ms por celda. Antes 25 (40 celdas por segundo); ahora 40 (25 por segundo). */
export const SOFT_DROP_MS = 40;

/** Versión de las reglas. Súbela si un cambio hace que una repetición antigua dé otro resultado. */
export const RULES_VERSION = 16;

/** Ofertas malditas: desde qué nivel pueden salir y con qué probabilidad (nunca dos seguidas). */
export const CURSE_FROM_LEVEL = 5;

/** Puntos por subida de nivel cuando ya no queda ninguna carta que ofrecer (se multiplican por el nivel). */
export const EMPTY_OFFER_POINTS = 1000;

/** Mínimo de piezas entre filas de basura, sumen lo que sumen los perks. */
export const GARBAGE_MIN_INTERVAL = 3;
export const CURSE_CHANCE = 0.12;
/** Piezas que acerca la basura cada subida de nivel con Atajo. */
export const SHORTCUT_GARBAGE = 3;
/** Tutorial: columna donde empieza el hueco de 2 de ancho, primeras piezas, líneas por nivel y líneas que carga la hiperperk. */
export const TUTORIAL_HOLE = 7;
export const TUTORIAL_PIECES = ['O', 'T', 'J', 'I'];
export const TUTORIAL_LINES = 3;
export const TUTORIAL_HYPER_CHARGE = 3;

/**
 * Milisegundos por fila según el nivel (índice 0 = nivel 1). Es la curva
 * `pow(max(0.05, 0.8 - (gl - 1) * 0.007), gl - 1) * 1000` con `gl = 1 + (nivel - 1) * 0.8`,
 * precalculada: Math.pow puede variar en el último bit entre motores de JS y una repetición
 * tiene que dar lo mismo en el navegador y en el servidor. A partir del nivel 36 baja de 0,001 ms
 * y el tope de 1 ms manda, así que basta con repetir el último valor.
 */
export const GRAVITY_MS = [
  1000, 831.8238885347129, 684.1432447679812, 556.2812592712187,
  447.11578875116174, 355.19692825600004, 278.8601015198181, 216.32903949260634,
  165.80464009656242, 125.53735114344816, 93.88224890421264, 69.33728856380014,
  50.566212141249586, 36.4082873560642, 25.877425966872945, 18.153328543517738,
  12.567178840435696, 8.584127854099467, 5.784428305428814, 3.8446612803569895,
  2.5200839695077955, 1.628754036710081, 1.0377725058088998, 0.6517421964448413,
  0.4033625882088899, 0.2459680572025006, 0.14775440786951327, 0.08741665214219692,
  0.050927364340798496, 0.029209273457675194, 0.016489590811433415, 0.009160588535172952,
  0.005006840207751825, 0.0026917271023923135, 0.0014230588699773597, 0.0007396636587124455,
];

export const LINE_SCORES = [0, 100, 300, 500, 800];
export const SPIN_SCORES = [400, 800, 1200, 1600];
export const MINI_SCORES = [100, 200, 400, 600];
