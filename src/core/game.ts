import { Emitter } from './emitter';
import { baseMods, PERK_BY_ID, rollPerks, type Mods, type PerkDef } from './perks';
import { GARBAGE_ID, getKicks, PIECES, STANDARD, type PieceDef } from './pieces';

export const COLS = 10;
export const ROWS = 22; // 2 filas ocultas arriba
export const HIDDEN = 2;
export const VISIBLE = ROWS - HIDDEN;

/** Bit que marca un bloque como dorado dentro del valor de la celda. */
export const GOLD_BIT = 0x100;
export const cellType = (v: number) => v & 0xff;
export const isGold = (v: number) => (v & GOLD_BIT) !== 0;

export interface PieceSpec {
  def: PieceDef;
  bomb: boolean;
  prism: boolean;
  gold: boolean;
}

export interface ActivePiece extends PieceSpec {
  x: number;
  y: number;
  rot: number;
}

export type SpinKind = 'full' | 'mini' | null;
export type Cell = [number, number];
export type GameState = 'ready' | 'playing' | 'choosing' | 'paused' | 'over';

export interface ClearInfo {
  rows: number[];
  rowValues: number[][];
  lines: number;
  spin: SpinKind;
  spinName: string;
  combo: number;
  b2b: boolean;
  points: number;
  gold: number;
  perfect: boolean;
  cascade: number;
}

export interface GameEvents {
  move: void;
  rotate: { spin: boolean };
  hold: void;
  spawn: void;
  softdrop: void;
  harddrop: { from: Cell[]; to: Cell[]; color: number; dist: number };
  lock: { cells: Cell[]; color: number };
  clear: ClearInfo;
  spinNoLines: { spinName: string; points: number; cells: Cell[] };
  bomb: { cx: number; cy: number; removed: { x: number; y: number; v: number }[]; points: number };
  prism: { cells: Cell[]; removed: { x: number; y: number; v: number }[]; color: number; points: number };
  drill: { values: number[]; points: number };
  quake: { chain: number };
  garbage: { hole: number };
  garbageWarn: { progress: number };
  levelup: { level: number };
  interest: { amount: number };
  revive: { livesLeft: number };
  gameover: void;
  perk: { perk: PerkDef; stacks: number };
}

const LINE_SCORES = [0, 100, 300, 500, 800];
const SPIN_SCORES = [400, 800, 1200, 1600];
const MINI_SCORES = [100, 200, 400, 600];

export class Game {
  events = new Emitter<GameEvents>();
  board: number[][] = [];
  active: ActivePiece | null = null;
  queue: PieceSpec[] = [];
  hold: PieceSpec[] = [];
  holdUsed = false;

  state: GameState = 'ready';
  score = 0;
  level = 1;
  lines = 0;
  linesIntoLevel = 0;
  combo = -1;
  comboGraceLeft = 0;
  b2b = false;
  piecesLocked = 0;
  generated = 0;
  garbageCounter = 0;
  lives = 0;
  rerolls = 1;
  time = 0;
  maxCombo = 0;
  tetrises = 0;

  mods: Mods = baseMods();
  perks = new Map<string, number>();
  perkOrder: string[] = [];
  choices: PerkDef[] = [];
  pendingLevelUps = 0;

  softDropping = false;
  private gravityAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lowestY = 0;
  private lastWasRotate = false;
  private lastKick = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    this.active = null;
    this.queue = [];
    this.hold = [];
    this.holdUsed = false;
    this.state = 'ready';
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.linesIntoLevel = 0;
    this.combo = -1;
    this.comboGraceLeft = 0;
    this.b2b = false;
    this.piecesLocked = 0;
    this.generated = 0;
    this.garbageCounter = 0;
    this.lives = 0;
    this.rerolls = 1;
    this.time = 0;
    this.maxCombo = 0;
    this.tetrises = 0;
    this.mods = baseMods();
    this.perks.clear();
    this.perkOrder = [];
    this.choices = [];
    this.pendingLevelUps = 0;
  }

  start() {
    this.reset();
    this.state = 'playing';
    this.fillQueue();
    this.spawn();
  }

  // ─────────────────────────── Cola y bolsa ───────────────────────────

  private fillQueue() {
    while (this.queue.length < 8) {
      const bag = [...STANDARD];
      for (const k of this.mods.extraPieces) bag.push(k === 'SZ' ? (Math.random() < 0.5 ? 'S' : 'Z') : k);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      for (const k of bag) this.queue.push(this.makeSpec(PIECES[k]));
    }
  }

  private makeSpec(def: PieceDef): PieceSpec {
    this.generated++;
    const m = this.mods;
    const bomb = m.bombEvery > 0 && this.generated % m.bombEvery === 0;
    const prism = !bomb && m.prismEvery > 0 && this.generated % m.prismEvery === 0;
    const gold = !bomb && !prism && Math.random() < m.goldChance;
    return { def, bomb, prism, gold };
  }

  /** Re-marca bombas/prismas de la cola cuando cambia un perk que los afecta. */
  private refreshQueueSpecials() {
    const m = this.mods;
    const startIdx = this.generated - this.queue.length + 1;
    this.queue.forEach((s, i) => {
      const n = startIdx + i;
      if (!s.bomb && m.bombEvery > 0 && n % m.bombEvery === 0) { s.bomb = true; s.prism = false; s.gold = false; }
      if (!s.bomb && !s.prism && m.prismEvery > 0 && n % m.prismEvery === 0) { s.prism = true; s.gold = false; }
    });
  }

  // ─────────────────────────── Piezas activas ───────────────────────────

  cellsOf(p: { def: PieceDef; x: number; y: number; rot: number }): Cell[] {
    return p.def.shapes[p.rot].map(([cx, cy]) => [p.x + cx, p.y + cy] as Cell);
  }

  collides(def: PieceDef, x: number, y: number, rot: number): boolean {
    for (const [cx, cy] of def.shapes[rot]) {
      const bx = x + cx;
      const by = y + cy;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && this.board[by][bx] !== 0) return true;
    }
    return false;
  }

  private spawn(spec?: PieceSpec): boolean {
    const s = spec ?? this.queue.shift()!;
    this.fillQueue();
    const def = s.def;
    const x = Math.floor((COLS - def.size) / 2);
    // aparece en la primera fila visible si cabe, si no un poco más arriba
    let y = HIDDEN - 1;
    if (def.size === 1 || (def.size === 2 && def.name !== 'O')) y = HIDDEN;
    if (def.name === 'O') y = HIDDEN;
    this.active = { ...s, x, y, rot: 0 };
    if (this.collides(def, x, y, 0)) {
      if (!this.collides(def, x, y - 1, 0)) this.active.y = y - 1;
      else if (!this.collides(def, x, 0, 0)) this.active.y = 0;
      else {
        if (!this.topOut()) return false;
        return this.spawn();
      }
    }
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = this.active.y;
    this.lastWasRotate = false;
    this.holdUsed = false;
    this.events.emit('spawn', undefined);
    return true;
  }

  private onGround(): boolean {
    const a = this.active!;
    return this.collides(a.def, a.x, a.y + 1, a.rot);
  }

  private resetLockOnMove() {
    if (this.onGround() && this.lockResets < 15) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  }

  move(dx: number): boolean {
    if (this.state !== 'playing' || !this.active) return false;
    const a = this.active;
    if (this.collides(a.def, a.x + dx, a.y, a.rot)) return false;
    a.x += dx;
    this.lastWasRotate = false;
    this.resetLockOnMove();
    this.events.emit('move', undefined);
    return true;
  }

  rotate(dir: 1 | -1 | 2): boolean {
    if (this.state !== 'playing' || !this.active) return false;
    const a = this.active;
    if (a.def.kicks === 'O') return false;
    const to = (a.rot + dir + 4) % 4;
    const kicks = getKicks(a.def.kicks, a.rot, to);
    for (let i = 0; i < kicks.length; i++) {
      const [kx, ky] = kicks[i];
      if (!this.collides(a.def, a.x + kx, a.y + ky, to)) {
        a.x += kx;
        a.y += ky;
        a.rot = to;
        this.lastWasRotate = true;
        this.lastKick = i;
        this.resetLockOnMove();
        this.events.emit('rotate', { spin: this.detectSpin() !== null });
        return true;
      }
    }
    return false;
  }

  private stepDown(): boolean {
    const a = this.active!;
    if (this.collides(a.def, a.x, a.y + 1, a.rot)) return false;
    a.y++;
    this.lastWasRotate = false;
    if (a.y > this.lowestY) {
      this.lowestY = a.y;
      this.lockResets = 0;
    }
    return true;
  }

  hardDrop() {
    if (this.state !== 'playing' || !this.active) return;
    const a = this.active;
    const from = this.cellsOf(a);
    let dist = 0;
    while (!this.collides(a.def, a.x, a.y + 1, a.rot)) {
      a.y++;
      dist++;
    }
    if (dist > 0) this.lastWasRotate = false;
    this.addScore(dist * 2 * this.mods.hardDropMult, false);
    this.events.emit('harddrop', { from, to: this.cellsOf(a), color: a.def.color, dist });
    this.lockPiece();
  }

  holdPiece() {
    if (this.state !== 'playing' || !this.active) return;
    if (this.holdUsed && !this.mods.infiniteHold) return;
    const a = this.active;
    const spec: PieceSpec = { def: a.def, bomb: a.bomb, prism: a.prism, gold: a.gold };
    let next: PieceSpec | undefined;
    if (this.hold.length >= this.mods.holdSlots) next = this.hold.shift();
    this.hold.push(spec);
    if (this.mods.holdCost > 0) this.score = Math.max(0, this.score - this.mods.holdCost * this.level);
    this.events.emit('hold', undefined);
    this.spawn(next);
    this.holdUsed = true;
  }

  ghostY(): number {
    const a = this.active!;
    let y = a.y;
    while (!this.collides(a.def, a.x, y + 1, a.rot)) y++;
    return y;
  }

  // ─────────────────────────── Bucle ───────────────────────────

  gravityMs(): number {
    const gl = 1 + (this.level - 1) * 0.8;
    const t0 = Math.pow(Math.max(0.05, 0.8 - (gl - 1) * 0.007), gl - 1) * 1000;
    let t = t0;
    let speed = this.mods.gravitySpeed;
    if (this.mods.instinct) speed *= this.inDanger() ? 0.3 : 1.1;
    if (this.active?.gold) speed *= 2;
    t /= speed;
    return Math.max(t, 1);
  }

  stackHeight(): number {
    for (let y = 0; y < ROWS; y++) if (this.board[y].some((v) => v !== 0)) return ROWS - y;
    return 0;
  }

  inDanger(): boolean {
    return this.stackHeight() >= VISIBLE * 0.7;
  }

  update(dt: number) {
    if (this.state !== 'playing' || !this.active) return;
    this.time += dt;
    let ms = this.gravityMs();
    if (this.softDropping) ms = Math.min(ms, 25);
    this.gravityAcc += dt;
    while (this.gravityAcc >= ms) {
      this.gravityAcc -= ms;
      if (!this.stepDown()) {
        this.gravityAcc = 0;
        break;
      }
      if (this.softDropping) {
        if (this.mods.softDropPoints) this.addScore(1, false);
        this.events.emit('softdrop', undefined);
      }
    }
    if (this.onGround()) {
      this.lockTimer += dt;
      if (this.lockTimer >= this.mods.lockDelay) this.lockPiece();
    } else {
      this.lockTimer = 0;
    }
  }

  lockProgress(): number {
    if (!this.active || !this.onGround()) return 0;
    return Math.min(1, this.lockTimer / this.mods.lockDelay);
  }

  // ─────────────────────────── Fijar y limpiar ───────────────────────────

  private detectSpin(): SpinKind {
    const a = this.active;
    if (!a || !this.lastWasRotate) return null;
    if (a.def.name === 'T') {
      const corners: Cell[] = [[0, 0], [2, 0], [2, 2], [0, 2]];
      const filled = corners.map(([cx, cy]) => this.isSolid(a.x + cx, a.y + cy));
      const count = filled.filter(Boolean).length;
      if (count < 3) return null;
      // esquinas "frontales" según la orientación (hacia donde apunta la T)
      const front: Record<number, [number, number]> = { 0: [0, 1], 1: [1, 2], 2: [2, 3], 3: [3, 0] };
      const [f1, f2] = front[a.rot];
      if ((filled[f1] && filled[f2]) || this.lastKick === 4) return 'full';
      return 'mini';
    }
    if (this.mods.allSpin && a.def.kicks !== 'O') {
      const immobile =
        this.collides(a.def, a.x - 1, a.y, a.rot) &&
        this.collides(a.def, a.x + 1, a.y, a.rot) &&
        this.collides(a.def, a.x, a.y - 1, a.rot);
      return immobile ? 'full' : null;
    }
    return null;
  }

  private isSolid(x: number, y: number): boolean {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y < 0) return false;
    return this.board[y][x] !== 0;
  }

  private addScore(base: number, useMult = true): number {
    const pts = Math.round(useMult ? base * this.mods.scoreMult : base);
    this.score += pts;
    return pts;
  }

  private lockPiece() {
    const a = this.active!;
    const cells = this.cellsOf(a);
    const spin = this.detectSpin();
    this.active = null;
    this.piecesLocked++;

    if (a.bomb) {
      this.explode(cells);
    } else if (a.prism) {
      this.prismBlast(cells);
    } else {
      const value = a.def.id | (a.gold ? GOLD_BIT : 0);
      for (const [x, y] of cells) if (y >= 0) this.board[y][x] = value;
      this.events.emit('lock', { cells, color: a.def.color });
      this.resolveClears(spin, a.def, cells);
      // una pieza fijada por completo fuera del tablero es un bloqueo fuera: cuenta como topOut
      if (cells.some(([, y]) => y < 0) && !this.topOut()) return;
    }

    this.afterLock();
  }

  private findFullRows(): number[] {
    const rows: number[] = [];
    for (let y = 0; y < ROWS; y++) if (this.board[y].every((v) => v !== 0)) rows.push(y);
    return rows;
  }

  private removeRows(rows: number[]) {
    const set = new Set(rows);
    this.board = this.board.filter((_, y) => !set.has(y));
    while (this.board.length < ROWS) this.board.unshift(new Array(COLS).fill(0));
  }

  private resolveClears(spin: SpinKind, piece: PieceDef | null, cells: Cell[], cascade = 0) {
    const rows = this.findFullRows();
    const lines = rows.length;
    const lvl = this.level;
    const spinName = spin && piece ? `${piece.name}-SPIN${spin === 'mini' ? ' MINI' : ''}` : '';

    if (lines === 0) {
      if (cascade > 0) return;
      // spin sin líneas: puntúa pero no rompe ni da b2b
      if (spin) {
        const pts = this.addScore((spin === 'full' ? 400 : 100) * lvl);
        this.events.emit('spinNoLines', { spinName, points: pts, cells });
      }
      if (this.combo >= 0) {
        if (this.comboGraceLeft > 0) this.comboGraceLeft--;
        else this.combo = -1;
      }
      return;
    }

    const rowValues = rows.map((y) => [...this.board[y]]);
    const gold = rowValues.flat().filter(isGold).length;

    let base: number;
    if (spin === 'full') base = SPIN_SCORES[Math.min(lines, 3)];
    else if (spin === 'mini') base = MINI_SCORES[Math.min(lines, 3)];
    else base = LINE_SCORES[Math.min(lines, 4)];
    base *= lvl;
    if (lines === 1 && !spin) base *= this.mods.singleMult;
    if (lines >= 4) base *= this.mods.tetrisMult;
    if (piece) base *= piece.scoreMult;

    const difficult = lines >= 4 || spin !== null;
    let b2bApplied = false;
    if (cascade === 0) {
      if (difficult) {
        if (this.b2b) {
          base *= this.mods.b2bMult;
          b2bApplied = true;
        }
        this.b2b = true;
      } else {
        this.b2b = false;
      }
      this.combo++;
      this.comboGraceLeft = this.mods.comboGrace;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    } else {
      base *= 1 + cascade;
    }
    if (lines >= 4) this.tetrises++;

    let total = base;
    if (this.combo > 0 && cascade === 0) total += 50 * this.combo * lvl * this.mods.comboMult;
    total += gold * 300 * lvl;

    this.removeRows(rows);
    const perfect = this.board.every((r) => r.every((v) => v === 0));
    if (perfect) total += 3500 * lvl;

    const points = this.addScore(total);
    this.lines += lines;
    let counted = lines;
    if (lines >= 4 || spin) counted += this.mods.expBonus;
    this.addLevelProgress(counted);

    this.events.emit('clear', {
      rows, rowValues, lines, spin, spinName, combo: this.combo, b2b: b2bApplied, points, gold, perfect, cascade,
    });

    if (this.mods.quake && (lines >= 4 || (spin && lines >= 2) || cascade > 0)) {
      if (this.compact()) {
        this.events.emit('quake', { chain: cascade + 1 });
        this.resolveClears(null, null, [], cascade + 1);
      }
    }
  }

  /** Hace caer cada columna para rellenar huecos. Devuelve si algo se movió. */
  private compact(): boolean {
    let moved = false;
    for (let x = 0; x < COLS; x++) {
      const col: number[] = [];
      for (let y = ROWS - 1; y >= 0; y--) if (this.board[y][x] !== 0) col.push(this.board[y][x]);
      for (let y = ROWS - 1, i = 0; y >= 0; y--, i++) {
        const v = i < col.length ? col[i] : 0;
        if (this.board[y][x] !== v) moved = true;
        this.board[y][x] = v;
      }
    }
    return moved;
  }

  private explode(cells: Cell[]) {
    const cx = Math.round(cells.reduce((s, c) => s + c[0], 0) / cells.length);
    const cy = Math.round(cells.reduce((s, c) => s + c[1], 0) / cells.length);
    const removed: { x: number; y: number; v: number }[] = [];
    for (let y = cy - 2; y <= cy + 2; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
        if (this.board[y][x] !== 0) {
          removed.push({ x, y, v: this.board[y][x] });
          this.board[y][x] = 0;
        }
      }
    }
    const points = this.addScore(removed.length * 40 * this.level);
    this.events.emit('bomb', { cx, cy, removed, points });
    if (this.combo >= 0 && removed.length === 0) this.combo = -1;
  }

  private prismBlast(cells: Cell[]) {
    const counts = new Map<number, number>();
    for (const [x, y] of cells) {
      const below = y + 1;
      if (below < ROWS && this.board[below]?.[x]) {
        const t = cellType(this.board[below][x]);
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    if (counts.size === 0) {
      // aterrizó en el suelo: el color más abundante del tablero
      for (const row of this.board) for (const v of row) if (v) counts.set(cellType(v), (counts.get(cellType(v)) ?? 0) + 1);
    }
    let target = 0;
    let best = -1;
    for (const [t, c] of counts) if (c > best) { best = c; target = t; }
    const removed: { x: number; y: number; v: number }[] = [];
    if (target) {
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++)
          if (cellType(this.board[y][x]) === target) {
            removed.push({ x, y, v: this.board[y][x] });
            this.board[y][x] = 0;
          }
    }
    const points = this.addScore(removed.length * 60 * this.level);
    this.events.emit('prism', { cells, removed, color: target, points });
  }

  private afterLock() {
    const m = this.mods;

    if (m.drillEvery > 0 && this.piecesLocked % m.drillEvery === 0) {
      const bottom = this.board[ROWS - 1];
      if (bottom.some((v) => v !== 0)) {
        const values = [...bottom];
        this.removeRows([ROWS - 1]);
        this.lines++;
        const points = this.addScore(150 * this.level);
        this.addLevelProgress(1);
        this.events.emit('drill', { values, points });
      }
    }

    if (this.level >= 4) {
      this.garbageCounter++;
      const interval = this.garbageInterval();
      this.events.emit('garbageWarn', { progress: this.garbageCounter / interval });
      if (this.garbageCounter >= interval) {
        this.garbageCounter = 0;
        if (!this.addGarbage()) return;
      }
    }

    if (this.pendingLevelUps > 0) {
      this.beginChoice();
      return;
    }
    this.spawn();
  }

  garbageInterval(): number {
    return Math.max(5, 15 - Math.floor(this.level / 2)) + this.mods.garbageDelay;
  }

  garbageProgress(): number {
    if (this.level < 4) return 0;
    return this.garbageCounter / this.garbageInterval();
  }

  private lastHole = Math.floor(Math.random() * COLS);
  /** Sube el tablero una fila. Devuelve false si la partida termina. */
  private addGarbage(): boolean {
    // si hay bloques en la fila de arriba, subir el tablero los empujaría fuera
    if (this.board[0].some((v) => v !== 0) && !this.topOut()) return false;
    const hole = Math.random() < 0.7 ? this.lastHole : Math.floor(Math.random() * COLS);
    this.lastHole = hole;
    this.board.shift();
    const row = new Array(COLS).fill(GARBAGE_ID);
    row[hole] = 0;
    this.board.push(row);
    this.events.emit('garbage', { hole });
    return true;
  }

  /** Devuelve true si queda una vida y la partida sigue; false si termina. No genera pieza. */
  private topOut(): boolean {
    if (this.lives > 0) {
      this.lives--;
      // deja sólo las 5 filas de abajo
      for (let y = 0; y < ROWS - 5; y++) this.board[y].fill(0);
      this.combo = -1;
      this.events.emit('revive', { livesLeft: this.lives });
      return true;
    }
    this.active = null;
    this.state = 'over';
    this.events.emit('gameover', undefined);
    return false;
  }

  // ─────────────────────────── Niveles y perks ───────────────────────────

  linesNeeded(): number {
    // 8 líneas al principio, +1 cada 2 niveles (tope 16)
    const base = Math.min(16, 8 + Math.floor((this.level - 1) / 2));
    return Math.max(4, base - this.mods.linesReduction);
  }

  private addLevelProgress(n: number) {
    this.linesIntoLevel += n;
    while (this.linesIntoLevel >= this.linesNeeded()) {
      this.linesIntoLevel -= this.linesNeeded();
      this.level++;
      this.pendingLevelUps++;
      if (this.mods.interest > 0) {
        const amount = Math.round(this.score * this.mods.interest);
        this.score += amount;
        this.events.emit('interest', { amount });
      }
      this.events.emit('levelup', { level: this.level });
    }
  }

  private beginChoice() {
    this.state = 'choosing';
    this.choices = rollPerks(this.perks, this.mods.luck);
  }

  reroll(): boolean {
    if (this.state !== 'choosing' || this.rerolls <= 0) return false;
    this.rerolls--;
    this.choices = rollPerks(this.perks, this.mods.luck);
    return true;
  }

  choosePerk(index: number) {
    if (this.state !== 'choosing') return;
    const perk = this.choices[index];
    if (!perk) return;
    const stacks = (this.perks.get(perk.id) ?? 0) + 1;
    this.perks.set(perk.id, stacks);
    if (!this.perkOrder.includes(perk.id)) this.perkOrder.push(perk.id);
    perk.apply(this.mods, this);
    this.refreshQueueSpecials();
    this.events.emit('perk', { perk, stacks });
    this.pendingLevelUps--;
    if (this.pendingLevelUps > 0) {
      this.choices = rollPerks(this.perks, this.mods.luck);
      return;
    }
    this.choices = [];
    this.state = 'playing';
    this.spawn();
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  perkStacks(id: string) {
    return this.perks.get(id) ?? 0;
  }

  static perkDef(id: string) {
    return PERK_BY_ID[id];
  }
}
