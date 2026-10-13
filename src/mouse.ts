import { COLS, ROWS, type Game } from './core/game';
import { getKicks } from './core/pieces';
import type { Input } from './input';
import { mouseOn } from './settings';
import type { GestureView } from './gestures';

const WHEEL_STEP = 60;
const WHEEL_COOLDOWN_MS = 120;

/** Dónde acabará la pieza activa: posición `x` de su origen y giro (tras girar y desplazar de verdad) y su puntuación. */
export interface Placement {
  x: number;
  rot: number;
  score: number;
}

/**
 * Lo que de verdad pasa al pedir `rot` y `x`: gira con las patadas del juego desde donde está y se desplaza por la fila
 * donde queda, parándose en el primer bloqueo. Es la misma secuencia que `commitPlacement`, sin tocar la partida.
 */
function reach(game: Game, rot: number, x: number): { x: number; y: number; rot: number } {
  const a = game.active!;
  let cx = a.x;
  let cy = a.y;
  let cr = a.rot;
  const diff = (rot - a.rot + 4) % 4;
  if (diff !== 0 && a.def.kicks !== 'O') {
    const kicks = getKicks(a.def.kicks, a.rot, rot);
    for (const [kx, ky] of kicks) {
      if (!game.collides(a.def, a.x + kx, a.y + ky, rot)) {
        cx = a.x + kx;
        cy = a.y + ky;
        cr = rot;
        break;
      }
    }
  }
  for (let i = 0; i < COLS && cx !== x; i++) {
    const dx = Math.sign(x - cx);
    if (game.collides(a.def, cx + dx, cy, cr)) break;
    cx += dx;
  }
  return { x: cx, y: cy, rot: cr };
}

/** Puntúa soltar la pieza ahí: líneas completas suben; huecos nuevos y altura final bajan. */
function evaluate(game: Game, x: number, y0: number, rot: number): number {
  const a = game.active!;
  let y = y0;
  while (!game.collides(a.def, x, y + 1, rot)) y++;
  const cells = a.def.shapes[rot].map(([cx, cy]) => [x + cx, y + cy] as const);
  const mine = new Set(cells.map(([cx, cy]) => cy * COLS + cx));
  const rows = new Set(cells.map((c) => c[1]));
  let lines = 0;
  for (const r of rows) {
    if (r < 0 || r >= ROWS) continue;
    let full = true;
    for (let c = 0; c < COLS && full; c++) full = game.board[r][c] !== 0 || mine.has(r * COLS + c);
    if (full) lines++;
  }
  // hueco = celda vacía bajo la pieza que queda tapada (si llega hasta el suelo, no cuenta)
  let holes = 0;
  const lowest = new Map<number, number>();
  for (const [cx, cy] of cells) lowest.set(cx, Math.max(lowest.get(cx) ?? -99, cy));
  for (const [cx, cy] of lowest) {
    let r = cy + 1;
    while (r < ROWS && game.board[r][cx] === 0) r++;
    if (r < ROWS) holes += r - cy - 1;
  }
  const height = ROWS - Math.max(...cells.map((c) => c[1]));
  return lines * 10 - holes * 8 - height * 0.8;
}

/**
 * Colocación para la columna `col`: solo ofrece lo alcanzable (lo que se ve es donde acaba la pieza al hacer clic).
 * Con `forcedRot` (el jugador giró a mano) solo mira ese giro; si no, prueba los cuatro y se queda con el mejor.
 */
export function bestPlacement(game: Game, col: number, forcedRot: number | null): Placement | null {
  const a = game.active;
  if (!a) return null;
  const rots = forcedRot !== null ? [forcedRot] : a.def.kicks === 'O' ? [a.rot] : [0, 1, 2, 3];
  let best: Placement | null = null;
  for (const rot of rots) {
    const xs = a.def.shapes[rot].map((c) => c[0]);
    const want = Math.round(col - (Math.min(...xs) + Math.max(...xs)) / 2);
    const end = reach(game, rot, want);
    // un giro que no se pudo hacer no cuenta como ese giro
    if (end.rot !== rot) continue;
    const score = evaluate(game, end.x, end.y, end.rot);
    if (!best || score > best.score + 1e-9) best = { x: end.x, rot: end.rot, score };
  }
  return best;
}

/** Gira hasta el giro pedido y desplaza hasta la columna: las mismas acciones que el teclado. */
export function steer(game: Game, p: Placement) {
  const a = game.active!;
  const diff = (p.rot - a.rot + 4) % 4;
  if (diff === 1) game.rotate(1);
  else if (diff === 2) game.rotate(2);
  else if (diff === 3) game.rotate(-1);
  // las patadas del giro pueden haber movido la pieza: se lleva hasta la columna pedida
  for (let i = 0; i < COLS && a.x !== p.x; i++) if (!game.move(Math.sign(p.x - a.x))) break;
}

/** Lleva la pieza a la colocación y la suelta. */
export function commitPlacement(game: Game, p: Placement) {
  steer(game, p);
  game.hardDrop();
}

/**
 * Ratón en escritorio: el cursor elige la columna donde cae la pieza y el juego sugiere el mejor giro (la rueda y
 * el clic derecho lo cambian a mano). Un clic suelta la pieza. Se traduce a las acciones de siempre (girar, mover,
 * soltar, guardar) al hacer clic, no al mover el cursor: las repeticiones no cambian.
 */
export class Mouse {
  /** Colocación previsualizada (la lee el renderer), o null si el ratón no manda. */
  preview: Placement | null = null;
  private col: number | null = null;
  private manual: number | null = null;
  private wheelAcc = 0;
  private wheelAt = 0;
  private piece: unknown = null;

  constructor(el: HTMLElement, private game: Game, private input: Input, private view: GestureView, private geom: { boardX: () => number }) {
    el.addEventListener('pointermove', (e) => this.moveTo(e));
    el.addEventListener('pointerleave', () => this.hide());
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
  }

  /** El teclado o un menú toman el mando: se quita la previsualización hasta que el ratón se mueva. */
  hide() {
    this.col = null;
    this.manual = null;
    this.preview = null;
    this.wheelAcc = 0;
    this.piece = null;
  }

  private logical(e: MouseEvent) {
    const r = this.view.rect();
    return { x: ((e.clientX - r.left) / r.width) * this.view.logicalW(), y: ((e.clientY - r.top) / r.width) * this.view.logicalW() };
  }

  private inHold(e: MouseEvent): boolean {
    const p = this.logical(e);
    const b = this.view.holdBox();
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  private moveTo(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    if (!mouseOn.value || this.inHold(e)) return this.hide();
    const col = Math.floor((this.logical(e).x - this.geom.boardX()) / this.view.cell());
    this.col = Math.max(0, Math.min(COLS - 1, col));
  }

  /** Cada fotograma: recalcula la colocación (la pieza baja y el montón cambia) y la deja para el renderer. */
  update() {
    const g = this.game;
    if (!mouseOn.value || this.col === null || g.state !== 'playing' || !g.active) {
      this.preview = null;
      return;
    }
    // pieza nueva (también tras guardar): se olvida el giro manual
    if (g.active !== this.piece) {
      this.piece = g.active;
      this.manual = null;
    }
    this.preview = bestPlacement(g, this.col, this.manual);
  }

  private down(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || !mouseOn.value || this.game.state !== 'playing') return;
    e.preventDefault();
    if (e.button === 2) return this.turn(1);
    if (e.button !== 0) return;
    if (this.inHold(e)) return this.input.touchDown('hold');
    this.update();
    if (this.preview) {
      commitPlacement(this.game, this.preview);
      this.manual = null;
    }
  }

  private wheel(e: WheelEvent) {
    if (!mouseOn.value || this.game.state !== 'playing' || this.col === null) return;
    e.preventDefault();
    // trackpad o inercia lanzan decenas de eventos: se suma y se gira una vez por umbral, con una pausa entre giros
    this.wheelAcc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    if (Math.abs(this.wheelAcc) < WHEEL_STEP) return;
    const dir = this.wheelAcc > 0 ? 1 : -1;
    this.wheelAcc = 0;
    if (e.timeStamp - this.wheelAt < WHEEL_COOLDOWN_MS) return;
    this.wheelAt = e.timeStamp;
    this.turn(dir);
  }

  private turn(dir: 1 | -1) {
    const a = this.game.active;
    if (!a || a.def.kicks === 'O') return;
    this.manual = ((this.manual ?? this.preview?.rot ?? a.rot) + dir + 4) % 4;
  }
}
