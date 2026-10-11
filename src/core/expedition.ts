// Expedición: el modo con progresión entre partidas. No entra en ningún ranking, así que aquí sí
// se puede ganar poder de verdad: cada partida da fragmentos y los fragmentos compran mejoras
// permanentes. Los números son pequeños a propósito y están sin equilibrar.
// Lo que se compra solo se aplica en `Game.start` y solo en este modo; el arcade no lo ve.

import type { Mods } from './perks';
import { PERK_BY_ID } from './perks';

export type UpgradeId = 'reroll' | 'vista' | 'aguante' | 'calma' | 'ritmo' | 'vida' | 'arranque';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** Qué da cada nivel, en una línea. */
  desc: string;
  /** Coste en fragmentos de cada nivel (su longitud es el nivel máximo). */
  costs: number[];
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'reroll', name: 'Repuesto', desc: '+1 cambio de cartas al empezar.', costs: [30, 60, 100] },
  { id: 'vista', name: 'Vista larga', desc: '+1 pieza visible en la cola.', costs: [50, 120] },
  { id: 'aguante', name: 'Aguante', desc: 'Las piezas tardan 60 ms más en fijarse.', costs: [40, 80, 120] },
  { id: 'calma', name: 'Calma', desc: 'La basura sube 1 pieza más tarde.', costs: [60, 140] },
  { id: 'ritmo', name: 'Ritmo', desc: 'Cada nivel pide 1 línea menos.', costs: [90, 200] },
  { id: 'vida', name: 'Vida de repuesto', desc: 'Empiezas con una vida extra.', costs: [220] },
  { id: 'arranque', name: 'Buen arranque', desc: 'Empiezas con una mejora común o rara al azar.', costs: [150] },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpgradeId, UpgradeDef>;

/** Niveles comprados de cada mejora (lo que no aparece es 0). */
export type Owned = Partial<Record<UpgradeId, number>>;

export interface ExpeditionSave {
  shards: number;
  owned: Owned;
  /** Perks abiertos por retos (ids de `CHALLENGES`). */
  unlocked: string[];
  /** Partidas de Expedición terminadas. */
  runs: number;
}

export const level = (owned: Owned, id: UpgradeId): number => Math.min(owned[id] ?? 0, UPGRADE_BY_ID[id].costs.length);

/** Coste del siguiente nivel; null si ya está al máximo. */
export function nextCost(owned: Owned, id: UpgradeId): number | null {
  return UPGRADE_BY_ID[id].costs[level(owned, id)] ?? null;
}

/** Fragmentos que da una partida: sube con el nivel y las líneas, no con el tiempo ni la puntuación. */
export function shardsFor(lvl: number, lines: number): number {
  return Math.max(0, lvl * 8 + lines);
}

/** Compra un nivel de `id` si alcanzan los fragmentos. Devuelve la partida guardada nueva, o null si no se pudo. */
export function buy(save: ExpeditionSave, id: UpgradeId): ExpeditionSave | null {
  const cost = nextCost(save.owned, id);
  if (cost === null || save.shards < cost) return null;
  return { ...save, shards: save.shards - cost, owned: { ...save.owned, [id]: level(save.owned, id) + 1 } };
}

/** Aplica a las reglas de la partida lo comprado (menos `arranque` y `vida`, que tocan al juego, no a `Mods`). */
export function applyUpgrades(mods: Mods, owned: Owned) {
  mods.preview += level(owned, 'vista');
  mods.lockDelay += 60 * level(owned, 'aguante');
  mods.garbageDelay += level(owned, 'calma');
  mods.linesReduction += level(owned, 'ritmo');
}

// ─────────────────────────── Retos ───────────────────────────

/** Lo que cuenta de una partida para los retos. */
export interface RunStats {
  quads: number;
  spins: number;
  maxCombo: number;
  level: number;
  lines: number;
  timeMs: number;
}

export interface Challenge {
  /** Perk que abre. Hasta conseguirlo, no sale en las ofertas de la Expedición. */
  perk: string;
  /** El reto, en una línea. Siempre se cumple dentro de una sola partida. */
  text: string;
  done: (s: RunStats) => boolean;
}

export const CHALLENGES: Challenge[] = [
  { perk: 'cross', text: 'Haz 3 cuádruples en una partida', done: (s) => s.quads >= 3 },
  { perk: 'allspin', text: 'Haz 5 giros que limpien líneas en una partida', done: (s) => s.spins >= 5 },
  { perk: 'eternal', text: 'Llega a un combo de 6', done: (s) => s.maxCombo >= 6 },
  { perk: 'interest', text: 'Llega al nivel 6', done: (s) => s.level >= 6 },
  { perk: 'bomb', text: 'Limpia 30 líneas en una partida', done: (s) => s.lines >= 30 },
  { perk: 'prism', text: 'Limpia 60 líneas en una partida', done: (s) => s.lines >= 60 },
  { perk: 'quake', text: 'Llega al nivel 9', done: (s) => s.level >= 9 },
  { perk: 'phoenix', text: 'Aguanta 10 minutos en una partida', done: (s) => s.timeMs >= 10 * 60_000 },
];

export const CHALLENGE_PERKS = CHALLENGES.map((c) => c.perk);

/** Perks que la Expedición deja fuera hasta que se cumpla su reto. */
export function lockedPerks(unlocked: readonly string[]): Set<string> {
  return new Set(CHALLENGE_PERKS.filter((id) => !unlocked.includes(id)));
}

/** Retos que esta partida cumple y aún no estaban abiertos: ids de perk, en el orden de `CHALLENGES`. */
export function newUnlocks(unlocked: readonly string[], stats: RunStats): string[] {
  return CHALLENGES.filter((c) => !unlocked.includes(c.perk) && c.done(stats)).map((c) => c.perk);
}

export const perkName = (id: string): string => PERK_BY_ID[id]?.name ?? id;
