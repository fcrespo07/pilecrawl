// Definiciones de piezas y tablas de rotación SRS.
// Coordenadas: x hacia la derecha, y hacia abajo (fila 0 = arriba del tablero).

export type KickTable = 'JLSTZ' | 'I' | 'O';

export interface PieceDef {
  id: number;
  name: string;
  color: number;
  kicks: KickTable;
  size: number;
  /** multiplicador de puntos de las líneas que completa esta pieza */
  scoreMult: number;
  /** shapes[rot] = lista de celdas [x, y] dentro de la matriz size×size */
  shapes: [number, number][][];
}

export const GARBAGE_ID = 12;

function buildShapes(rows: string[]): [number, number][][] {
  const size = rows.length;
  let m = rows.map((r) => r.split('').map((c) => (c === '#' ? 1 : 0)));
  const shapes: [number, number][][] = [];
  for (let r = 0; r < 4; r++) {
    const cells: [number, number][] = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) cells.push([x, y]);
    shapes.push(cells);
    // rotación horaria de la matriz
    m = m.map((row, y) => row.map((_, x) => m[size - 1 - x][y]));
  }
  return shapes;
}

function def(id: number, name: string, color: number, kicks: KickTable, rows: string[], scoreMult = 1): PieceDef {
  return { id, name, color, kicks, size: rows.length, shapes: buildShapes(rows), scoreMult };
}

export const PIECES: Record<string, PieceDef> = {
  I: def(1, 'I', 0x2ef2ff, 'I', ['....', '####', '....', '....']),
  O: def(2, 'O', 0xffe14d, 'O', ['##', '##']),
  T: def(3, 'T', 0xc04dff, 'JLSTZ', ['.#.', '###', '...']),
  S: def(4, 'S', 0x4dff88, 'JLSTZ', ['.##', '##.', '...']),
  Z: def(5, 'Z', 0xff4d6a, 'JLSTZ', ['##.', '.##', '...']),
  J: def(6, 'J', 0x4d7cff, 'JLSTZ', ['#..', '###', '...']),
  L: def(7, 'L', 0xff9a3d, 'JLSTZ', ['..#', '###', '...']),
  // Piezas extra: cada una la añade su propio perk
  M1: def(8, '·', 0xff7ad9, 'JLSTZ', ['#'], 0.5),
  D2: def(9, 'D', 0xb4ff4d, 'JLSTZ', ['##', '..']),
  V3: def(10, 'V', 0x4dffe1, 'JLSTZ', ['#.', '##']),
  I3: def(11, 'I3', 0xffb3f0, 'JLSTZ', ['...', '###', '...']),
  X5: def(13, 'X', 0xe6e8ff, 'JLSTZ', ['.#.', '###', '.#.'], 3),
  P5: def(14, 'P', 0x8f7bff, 'JLSTZ', ['##.', '##.', '#..'], 2),
};

export const STANDARD = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export const PIECE_BY_ID: PieceDef[] = [];
for (const p of Object.values(PIECES)) PIECE_BY_ID[p.id] = p;

export const GARBAGE_COLOR = 0x6b7390;
export const GOLD_COLOR = 0xffd447;

export function colorOfId(id: number): number {
  if (id === GARBAGE_ID) return GARBAGE_COLOR;
  return PIECE_BY_ID[id]?.color ?? 0xffffff;
}

// Tablas SRS en notación oficial (y hacia arriba); se invierte la y al usarlas.
const K_JLSTZ: Record<string, [number, number][]> = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const K_I: Record<string, [number, number][]> = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
// 180º: lista genérica (ya en y hacia abajo)
const K_180: [number, number][] = [[0, 0], [0, -1], [1, 0], [-1, 0], [1, -1], [-1, -1], [0, 1]];

export function getKicks(table: KickTable, from: number, to: number): [number, number][] {
  if (table === 'O') return [[0, 0]];
  if ((from + 2) % 4 === to) return K_180;
  const t = table === 'I' ? K_I : K_JLSTZ;
  return t[`${from}>${to}`].map(([x, y]) => [x, -y] as [number, number]);
}
