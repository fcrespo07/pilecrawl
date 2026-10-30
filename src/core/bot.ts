import { COLS, ROWS, type Game } from './game';
import type { PieceDef } from './pieces';

/** Heurística de colocación del bot de pruebas (equilibrio y repeticiones). No se usa en el juego. */

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

export interface Placement {
  rot: number;
  x: number;
  score: number;
}

/** Todas las colocaciones posibles de la pieza activa, de mejor a peor. */
export function rankPlacements(g: Game): Placement[] {
  const a = g.active!;
  const def: PieceDef = a.def;
  const rots = def.kicks === 'O' ? [0] : [0, 1, 2, 3];
  const out: Placement[] = [];
  for (const rot of rots) {
    for (let x = -2; x < COLS + 2; x++) {
      if (g.collides(def, x, a.y, rot)) continue;
      let y = a.y;
      while (!g.collides(def, x, y + 1, rot)) y++;
      const cells = def.shapes[rot].map(([cx, cy]) => [x + cx, y + cy] as [number, number]);
      out.push({ rot, x, score: evaluate(g.board, cells).score });
    }
  }
  return out.sort((p, q) => q.score - p.score);
}

/** Mejor colocación (rotación y columna) para la pieza activa. */
export function bestPlacement(g: Game): Placement | null {
  return rankPlacements(g)[0] ?? null;
}
