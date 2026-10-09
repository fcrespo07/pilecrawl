// Progresión ligera entre partidas: el mejor nivel alcanzado desbloquea perks más raros.
import type { Rarity } from './perks';

/** Nivel mínimo (en cualquier partida anterior) para que aparezcan perks de cada rareza. */
export const UNLOCK_LEVEL: Record<Rarity, number> = {
  common: 0,
  rare: 0,
  epic: 4,
  legendary: 7,
};

export interface Meta {
  bestLevel: number;
  runs: number;
}

const KEY = 'tetrogue.meta';

/** Lee la progresión guardada. Sin almacenamiento o con datos rotos, empieza de cero. */
export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Meta>;
      return {
        bestLevel: Math.max(0, Math.floor(Number(p.bestLevel)) || 0),
        runs: Math.max(0, Math.floor(Number(p.runs)) || 0),
      };
    }
  } catch {
    /* sin almacenamiento o JSON roto: se empieza de cero */
  }
  return { bestLevel: 0, runs: 0 };
}

export function saveMeta(meta: Meta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    /* sin almacenamiento: la progresión dura lo que la pestaña */
  }
}
