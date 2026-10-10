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

/** Suerte que da la racha, en las mismas unidades que `mods.luck`. */
export function streakLuck(streak: number): number {
  return (STREAK_MAX_LUCK * streak) / STREAK_MAX;
}

/** Probabilidad de que la subida a `level` traiga hiperperk, según la racha. */
export function hyperChance(streak: number, level = 0): number {
  if (level >= HYPER_SURE_LEVEL) return 1;
  return HYPER_CHANCE_BASE + ((HYPER_CHANCE_FULL - HYPER_CHANCE_BASE) * streak) / STREAK_MAX;
}
