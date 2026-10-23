// Racha: un medidor de 0 a 100 que sube jugando bien (varias líneas a la vez, combos, giros y
// limpiar rápido) y baja con cada pieza fijada. Mejora las probabilidades de las ofertas
// (como un Trébol temporal) y es lo que hace salir las hiperperks. Tiene tope para que no
// se convierta en una bola de nieve: a racha llena da lo mismo que un Trébol.
// Todo va por piezas y líneas, no por fotogramas, así que la repetición da lo mismo.

export const STREAK_MAX = 100;
/** Lo que baja con cada pieza fijada. Limpiar de una en una no llega a compensarlo. */
export const STREAK_DECAY = 2;
/** Si la pieza que limpia se colocó en menos de esto desde que apareció (como Reflejos), suma más. */
export const STREAK_FAST_MS = 1500;
export const STREAK_FAST_MULT = 1.5;
/** Lo que suma limpiar 1, 2, 3 o 4+ líneas a la vez. */
export const STREAK_LINES = [0, 4, 12, 20, 30];
export const STREAK_SPIN = 8;
/** Por cada paso de combo, con tope en 6 pasos. */
export const STREAK_COMBO = 3;
export const STREAK_COMBO_CAP = 6;
export const STREAK_PERFECT = 30;

/**
 * Tramos de racha: desde cuánta racha cuenta como buena racha y cómo se llama cada escalón.
 * Solo sirven para mostrarla (HUD, textos y efectos); no cambian ninguna regla.
 */
export const STREAK_TIERS = [20, 40, 60, 80];
export const STREAK_TIER_NAMES = ['Sin racha', 'Buena racha', 'Gran racha', 'Racha ardiente', 'Imparable'];

/** Tramo de una racha: 0 (sin racha) a 4. */
export function streakTier(streak: number): number {
  let t = 0;
  while (t < STREAK_TIERS.length && streak >= STREAK_TIERS[t]) t++;
  return t;
}

/** Suerte extra (en Tréboles) a racha llena. */
export const STREAK_MAX_LUCK = 1;

/** Desde qué nivel puede salir una hiperperk al subir, y con qué probabilidad sin racha y a racha llena. */
export const HYPER_FROM_LEVEL = 3;
/** Si aún no ha salido, a este nivel sale seguro: la racha solo la adelanta. */
export const HYPER_SURE_LEVEL = 8;
export const HYPER_CHANCE_BASE = 0.04;
export const HYPER_CHANCE_FULL = 0.3;

/** Lo que suma una limpieza normal (no cuentan las cascadas ni las líneas de bombas y prismas). */
export function streakGain(lines: number, spin: boolean, combo: number, perfect: boolean, fast: boolean): number {
  if (lines <= 0) return 0;
  let gain = STREAK_LINES[Math.min(lines, 4)] * (fast ? STREAK_FAST_MULT : 1);
  if (spin) gain += STREAK_SPIN;
  if (combo > 0) gain += STREAK_COMBO * Math.min(combo, STREAK_COMBO_CAP);
  if (perfect) gain += STREAK_PERFECT;
  return gain;
}

// Calor por rareza: cada tipo de jugada calienta una rareza distinta y la hace más probable en la
// siguiente oferta (multiplica su peso, ver `HEAT_BOOST` en perks.ts). Baja con cada pieza fijada.
/** Lo que baja el calor de cada rareza por pieza. */
export const HEAT_DECAY = { rare: 2, epic: 2, legendary: 1 };
/** Raras: dobles y triples, y cada paso de combo. */
export const HEAT_RARE_LINES = [0, 0, 18, 30, 30];
export const HEAT_RARE_COMBO = 5;
/** Épicas: cuádruples y giros. */
export const HEAT_EPIC_QUAD = 50;
export const HEAT_EPIC_SPIN = 30;
/** Legendarias: back-to-back, combos largos (desde el cuarto paso) y limpiar todo el tablero. */
export const HEAT_LEG_B2B = 30;
/** Cada limpieza difícil seguida de la cadena (cuádruples o giros) suma más que la anterior, hasta `HEAT_LEG_CHAIN_CAP`. */
export const HEAT_LEG_CHAIN = 20;
export const HEAT_LEG_CHAIN_CAP = 5;
/** Un cuádruple o un giro ya calienta algo la legendaria, aunque sea el primero. */
export const HEAT_LEG_HARD = 10;
export const HEAT_LEG_COMBO = 6;
export const HEAT_LEG_PERFECT = 100;

/** Lo que suma una limpieza normal a cada calor. */
export function heatGain(lines: number, spin: boolean, combo: number, b2b: boolean, perfect: boolean, chain = b2b ? 2 : 1) {
  if (lines <= 0) return { rare: 0, epic: 0, legendary: 0 };
  let rare = HEAT_RARE_LINES[Math.min(lines, 4)];
  if (combo > 0) rare += HEAT_RARE_COMBO * Math.min(combo, STREAK_COMBO_CAP);
  let epic = 0;
  if (lines >= 4) epic += HEAT_EPIC_QUAD;
  if (spin) epic += HEAT_EPIC_SPIN;
  let legendary = 0;
  if (lines >= 4 || spin) legendary += HEAT_LEG_HARD;
  if (b2b) legendary += HEAT_LEG_B2B + HEAT_LEG_CHAIN * (Math.min(Math.max(chain, 2), HEAT_LEG_CHAIN_CAP) - 2);
  if (combo >= 3) legendary += HEAT_LEG_COMBO * (Math.min(combo, 8) - 2);
  if (perfect) legendary += HEAT_LEG_PERFECT;
  return { rare, epic, legendary };
}

/** Suerte que da la racha, en las mismas unidades que `mods.luck`. */
export function streakLuck(streak: number): number {
  return (STREAK_MAX_LUCK * streak) / STREAK_MAX;
}

/** Probabilidad de que la subida a `level` traiga hiperperk, según la racha. */
export function hyperChance(streak: number, level = 0): number {
  if (level >= HYPER_SURE_LEVEL) return 1;
  return HYPER_CHANCE_BASE + ((HYPER_CHANCE_FULL - HYPER_CHANCE_BASE) * streak) / STREAK_MAX;
}
