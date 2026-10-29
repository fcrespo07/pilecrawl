// Partida guardada de la Expedición en localStorage: fragmentos, mejoras compradas, retos y Presión.
// Es del jugador y no cuenta para ningún ranking, así que no hace falta validarla en el servidor.
import { buy, CHALLENGE_PERKS, newUnlocks, shardsFor, UPGRADE_BY_ID, UPGRADES, type ExpeditionSave, type Owned, type RunStats, type UpgradeId } from './core/expedition';
import { allowedPoints, cleanPressure, PRESSURE_BY_ID, pressureMult, type PressureId } from './core/pressure';

const KEY = 'blockrogue.exp';

/** Entero >= 0 y finito; cualquier otra cosa (texto, negativo, Infinity) vale 0. */
const clean = (v: unknown): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const EMPTY = (): ExpeditionSave => ({ shards: 0, owned: {}, unlocked: [], runs: 0, pressure: [], pressureBest: [] });

export function loadExpedition(): ExpeditionSave {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ExpeditionSave> | null;
    if (!p || typeof p !== 'object') return EMPTY();
    const owned: Owned = {};
    for (const u of UPGRADES) {
      const n = clean((p.owned as Owned | undefined)?.[u.id]);
      if (n > 0) owned[u.id] = Math.min(n, u.costs.length);
    }
    const unlocked = Array.isArray(p.unlocked) ? CHALLENGE_PERKS.filter((id) => (p.unlocked as unknown[]).includes(id)) : [];
    const pressure = Array.isArray(p.pressure) ? cleanPressure(p.pressure) : [];
    const pressureBest = Array.isArray(p.pressureBest) ? p.pressureBest.map(clean) : [];
    return { shards: clean(p.shards), owned, unlocked, runs: clean(p.runs), pressure, pressureBest };
  } catch {
    /* sin almacenamiento o JSON roto: se empieza de cero */
    return EMPTY();
  }
}

function save(s: ExpeditionSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: la progresión dura lo que la pestaña */
  }
}

/** Suma los fragmentos de una partida terminada (con su Presión) y abre los perks de los retos cumplidos. */
export function awardRun(stats: RunStats, pressure: readonly PressureId[]): { shards: number; unlocked: string[]; points: number } {
  const s = loadExpedition();
  const points = pressure.length;
  const shards = Math.floor(shardsFor(stats.level, stats.lines) * pressureMult(points));
  const unlocked = newUnlocks(s.unlocked, stats);
  const pressureBest = [...s.pressureBest];
  pressureBest[points] = Math.max(pressureBest[points] ?? 0, stats.level);
  save({ ...s, shards: s.shards + shards, unlocked: [...s.unlocked, ...unlocked], runs: s.runs + 1, pressureBest });
  return { shards, unlocked, points };
}

/** Compra un nivel de la mejora. Devuelve si se pudo. */
export function buyUpgrade(id: UpgradeId): boolean {
  if (!UPGRADE_BY_ID[id]) return false;
  const next = buy(loadExpedition(), id);
  if (!next) return false;
  save(next);
  return true;
}

/** Puntos de Presión que se pueden elegir ahora. */
export const pressureAllowed = (s: ExpeditionSave): number => allowedPoints(s.pressureBest);

/** Activa o desactiva una condición para la próxima partida. Solo si ya está desbloqueada. */
export function togglePressure(id: PressureId): boolean {
  if (!PRESSURE_BY_ID[id]) return false;
  const s = loadExpedition();
  const on = s.pressure.includes(id);
  const next = on ? s.pressure.filter((x) => x !== id) : cleanPressure([...s.pressure, id]);
  if (!on && next.length > pressureAllowed(s)) return false;
  save({ ...s, pressure: next });
  return true;
}
