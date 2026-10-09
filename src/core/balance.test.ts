import { describe, expect, it } from 'vitest';
import { COLS, Game, ROWS } from './game';
import type { PieceDef } from './pieces';

/**
 * Bot de referencia para equilibrar. No juega bien: elige, para cada pieza, la colocación
 * con mejor puntuación heurística (altura, huecos, irregularidad y líneas), y elige perks al azar.
 * Sirve para comparar cambios de reglas entre sí, no para decidir si el juego es "difícil" para una persona.
 */

/** Generador determinista (mulberry32) para que cada ejecución sea reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ejecuta `fn` con Math.random sustituido por un generador con semilla. */
function seeded<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = rng(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

interface Eval {
  lines: number;
  score: number;
}

/** Puntúa un tablero tras colocar la pieza. Pesos inspirados en la heurística clásica de Dellacherie. */
function evaluate(board: number[][], cells: [number, number][]): Eval {
  const b = board.map((r) => [...r]);
  for (const [x, y] of cells) if (y >= 0) b[y][x] = 1;

  let lines = 0;
  const kept = b.filter((row) => {
    const full = row.every((v) => v !== 0);
    if (full) lines++;
    return !full;
  });
  while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0));

  let aggregate = 0;
  let holes = 0;
  const heights: number[] = [];
  for (let x = 0; x < COLS; x++) {
    let top = -1;
    for (let y = 0; y < ROWS; y++) {
      if (kept[y][x] !== 0) {
        top = y;
        break;
      }
    }
    const h = top < 0 ? 0 : ROWS - top;
    heights.push(h);
    aggregate += h;
    if (top >= 0) for (let y = top; y < ROWS; y++) if (kept[y][x] === 0) holes++;
  }
  let bump = 0;
  for (let x = 0; x < COLS - 1; x++) bump += Math.abs(heights[x] - heights[x + 1]);

  return { lines, score: -0.51 * aggregate + 0.76 * lines - 0.36 * holes - 0.18 * bump };
}

/** Mejor colocación (rotación y columna) para la pieza activa. */
function bestPlacement(g: Game): { rot: number; x: number; score: number } | null {
  const a = g.active!;
  const def: PieceDef = a.def;
  const rots = def.kicks === 'O' ? [0] : [0, 1, 2, 3];
  let best: { rot: number; x: number; score: number } | null = null;
  for (const rot of rots) {
    for (let x = -2; x < COLS + 2; x++) {
      if (g.collides(def, x, a.y, rot)) continue;
      let y = a.y;
      while (!g.collides(def, x, y + 1, rot)) y++;
      const cells = def.shapes[rot].map(([cx, cy]) => [x + cx, y + cy] as [number, number]);
      const e = evaluate(g.board, cells);
      if (!best || e.score > best.score) best = { rot, x, score: e.score };
    }
  }
  return best;
}

export interface GameResult {
  level: number;
  lines: number;
  pieces: number;
  perks: number;
  score: number;
  overByTopOut: boolean;
}

/** Juega una partida completa con el bot. Corta a `maxPieces` para no colgarse. */
export function playBot(seed: number, maxPieces = 1500): GameResult {
  return seeded(seed, () => {
    const g = new Game();
    g.start();
    const choicePicker = rng(seed + 1);
    let pieces = 0;
    let guard = 0;
    while (g.state !== 'over' && pieces < maxPieces && guard++ < maxPieces * 50) {
      if (g.state === 'choosing') {
        g.choosePerk(Math.floor(choicePicker() * g.choices.length));
        continue;
      }
      if (g.state !== 'playing' || !g.active) break;
      const best = bestPlacement(g);
      const a = g.active;
      if (!best) {
        // ninguna colocación posible: la pieza no cabe y la partida acaba
        g.hardDrop();
        continue;
      }
      a.rot = best.rot;
      a.x = best.x;
      g.hardDrop();
      pieces++;
    }
    return {
      level: g.level,
      lines: g.lines,
      pieces,
      perks: g.perkOrder.length,
      score: g.score,
      overByTopOut: g.state === 'over',
    };
  });
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('bot de equilibrio', () => {
  const GAMES = 30;

  // El bot coloca con hard drop, así que la gravedad y el lock delay no le afectan:
  // estos números miden reglas de líneas, niveles, basura y perks, no el ritmo de caída.
  it('el bot sube de nivel y el juego no se bloquea', () => {
    const results = Array.from({ length: GAMES }, (_, i) => playBot(1000 + i));
    const stats = {
      games: results.length,
      medianLevel: median(results.map((r) => r.level)),
      meanLevel: +mean(results.map((r) => r.level)).toFixed(2),
      medianLines: median(results.map((r) => r.lines)),
      meanPieces: Math.round(mean(results.map((r) => r.pieces))),
      meanPerks: +mean(results.map((r) => r.perks)).toFixed(2),
      topOuts: results.filter((r) => r.overByTopOut).length,
    };
    console.log('[balance]', JSON.stringify(stats));
    expect(stats.medianLevel).toBeGreaterThanOrEqual(2);
  }, 60_000);
});
