// Presión: condiciones opcionales de la Expedición. Cada una endurece una regla de la partida y
// vale 1 punto. Los puntos multiplican los fragmentos que da la partida.
// Se desbloquean en cadena: para tener Presión N hace falta haber ganado (vencer al Monolito) con
// Presión N-1. Solo cambia Expedición: el arcade no la ve.
import type { Mods } from './perks';

export type PressureId = 'garbage' | 'nohold' | 'twochoices' | 'onepiece';

export interface PressureDef {
  id: PressureId;
  name: string;
  /** Qué endurece, en una línea. */
  desc: string;
}

export const PRESSURE: PressureDef[] = [
  { id: 'garbage', name: 'Basura temprana', desc: 'La basura empieza en el nivel 2, no en el 4.' },
  { id: 'nohold', name: 'Sin reserva', desc: 'No se puede guardar ninguna pieza.' },
  { id: 'twochoices', name: 'Dos cartas', desc: 'Cada subida de nivel ofrece 2 cartas, no 3.' },
  { id: 'onepiece', name: 'Cola corta', desc: 'Solo se ve la pieza siguiente.' },
];

export const PRESSURE_BY_ID = Object.fromEntries(PRESSURE.map((p) => [p.id, p])) as Record<PressureId, PressureDef>;

/** Cuánto suma cada punto de Presión al multiplicador de fragmentos. */
export const PRESSURE_STEP = 0.25;

/** Ids válidos, sin repetir, en el orden de `PRESSURE`. Lo que no existe se descarta. */
export function cleanPressure(ids: readonly unknown[]): PressureId[] {
  return PRESSURE.map((p) => p.id).filter((id) => ids.includes(id));
}

/** Multiplicador de fragmentos de N puntos de Presión: 1 sin puntos, 2 con todos. */
export function pressureMult(points: number): number {
  return 1 + PRESSURE_STEP * points;
}

/** Cuántos puntos de Presión se pueden elegir. `winsByPoints[n]` son las victorias con n puntos. */
export function allowedPoints(winsByPoints: readonly number[]): number {
  let n = 0;
  while (n < PRESSURE.length && (winsByPoints[n] ?? 0) >= 1) n++;
  return n;
}

/** Aplica las condiciones a las reglas base. Va antes que las mejoras y los perks, que pueden sumar encima. */
export function applyPressure(mods: Mods, ids: readonly PressureId[]) {
  if (ids.includes('garbage')) mods.garbageFrom = 2;
  if (ids.includes('nohold')) mods.noHold = true;
  if (ids.includes('twochoices')) mods.choices = Math.min(mods.choices, 2);
  if (ids.includes('onepiece')) mods.preview = Math.min(mods.preview, 1);
}
