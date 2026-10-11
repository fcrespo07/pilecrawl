// Partida guardada de la Expedición en localStorage: fragmentos y mejoras compradas.
// Es del jugador y no cuenta para ningún ranking, así que no hace falta validarla en el servidor.
import { buy, CHALLENGE_PERKS, newUnlocks, shardsFor, UPGRADE_BY_ID, UPGRADES, type ExpeditionSave, type Owned, type RunStats, type UpgradeId } from './core/expedition';

const KEY = 'blockrogue.exp';

/** Entero >= 0 y finito; cualquier otra cosa (texto, negativo, Infinity) vale 0. */
const clean = (v: unknown): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const EMPTY = (): ExpeditionSave => ({ shards: 0, owned: {}, unlocked: [], runs: 0 });

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
    return { shards: clean(p.shards), owned, unlocked, runs: clean(p.runs) };
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

/** Suma los fragmentos de una partida terminada y abre los perks de los retos cumplidos. */
export function awardRun(stats: RunStats): { shards: number; unlocked: string[] } {
  const s = loadExpedition();
  const shards = shardsFor(stats.level, stats.lines);
  const unlocked = newUnlocks(s.unlocked, stats);
  save({ ...s, shards: s.shards + shards, unlocked: [...s.unlocked, ...unlocked], runs: s.runs + 1 });
  return { shards, unlocked };
}

/** Compra un nivel de la mejora. Devuelve si se pudo. */
export function buyUpgrade(id: UpgradeId): boolean {
  if (!UPGRADE_BY_ID[id]) return false;
  const next = buy(loadExpedition(), id);
  if (!next) return false;
  save(next);
  return true;
}
