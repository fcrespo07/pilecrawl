/** Generador con semilla (mulberry32). Rápido, 32 bits y con el mismo resultado en cualquier navegador. */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla nueva para una partida libre. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}
