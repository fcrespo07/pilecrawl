// Partida guardada de la Expedición en localStorage: fragmentos, mejoras compradas, retos y Presión.
// Es del jugador y no cuenta para ningún ranking, así que no hace falta validarla en el servidor.
import { buy, CHALLENGE_PERKS, newUnlocks, RENAMED_CHALLENGE_PERKS, shardsFor, UPGRADE_BY_ID, UPGRADES, VICTORY_SHARDS, type ExpeditionSave, type Owned, type RunStats, type UpgradeId } from './core/expedition';
import { allowedPoints, cleanPressure, PRESSURE_BY_ID, pressureMult, type PressureId } from './core/pressure';

const KEY = 'blockrogue.exp';

/** Entero >= 0 y finito; cualquier otra cosa (texto, negativo, Infinity) vale 0. */
const clean = (v: unknown): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const EMPTY = (): ExpeditionSave => ({ shards: 0, owned: {}, unlocked: [], runs: 0, bestLevel: 0, wins: 0, pressure: [], pressureWins: [] });

export function loadExpedition(): ExpeditionSave {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ExpeditionSave> | null;
    if (!p || typeof p !== 'object') return EMPTY();
    const owned: Owned = {};
    for (const u of UPGRADES) {
      const n = clean((p.owned as Owned | undefined)?.[u.id]);
      if (n > 0) owned[u.id] = Math.min(n, u.costs.length);
    }
    // los retos cambiados conservan su cumplimiento: el perk nuevo queda abierto
    const kept = Array.isArray(p.unlocked) ? (p.unlocked as unknown[]).map((id) => (typeof id === 'string' && RENAMED_CHALLENGE_PERKS[id]) || id) : [];
    const unlocked = CHALLENGE_PERKS.filter((id) => kept.includes(id));
    const pressure = Array.isArray(p.pressure) ? cleanPressure(p.pressure) : [];
    const pressureWins = Array.isArray(p.pressureWins) ? p.pressureWins.map(clean) : [];
    return { shards: clean(p.shards), owned, unlocked, runs: clean(p.runs), bestLevel: clean(p.bestLevel), wins: clean(p.wins), pressure, pressureWins };
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

/**
 * Anota una partida terminada: fragmentos (con su Presión), mejor nivel, victorias, perks de los retos
 * cumplidos y mejor nivel con esa Presión. Devuelve lo necesario para la pantalla de fin.
 */
export function awardRun(stats: RunStats, pressure: readonly PressureId[], won: boolean): { shards: number; victory: number; unlocked: string[]; points: number; newBest: boolean } {
  const s = loadExpedition();
  const points = pressure.length;
  const run = Math.floor(shardsFor(stats.level, stats.lines) * pressureMult(points));
  const victory = won ? VICTORY_SHARDS : 0;
  const unlocked = newUnlocks(s.unlocked, stats);
  const pressureWins = [...s.pressureWins];
  if (won) pressureWins[points] = (pressureWins[points] ?? 0) + 1;
  const newBest = stats.level > s.bestLevel;
  save({
    ...s,
    shards: s.shards + run + victory,
    unlocked: [...s.unlocked, ...unlocked],
    runs: s.runs + 1,
    bestLevel: Math.max(s.bestLevel, stats.level),
    wins: s.wins + (won ? 1 : 0),
    pressureWins,
  });
  return { shards: run + victory, victory, unlocked, points, newBest };
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
export const pressureAllowed = (s: ExpeditionSave): number => allowedPoints(s.pressureWins);

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
