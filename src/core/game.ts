import { Emitter } from './emitter';
import { baseMods, HEAT_MAX, NO_HEAT, offerOdds, PERK_BY_ID, rollCurses, rollOffer, rollPerks, type Heat, type Mods, type PerkDef, type Rarity } from './perks';
import { GARBAGE_ID, getKicks, PIECES, STANDARD, type PieceDef } from './pieces';
import { HYPER_BY_ID, rollHypers, type HyperDef, type HyperId } from './hypers';
import {
  HEAT_DECAY, heatGain, HYPER_FROM_LEVEL, hyperChance, STREAK_DECAY, STREAK_FAST_MS, STREAK_MAX, streakGain, streakLuck, streakTier,
} from './streak';
import type { SkinId } from '../fx/skins';
import { MODES, type ModeId } from './modes';
import { bossForLevel, DRIP_EVERY, isBossLevel, MAGNET_COLS, MAGNET_EVERY, type BossDef } from './bosses';
import { makeRng, randomSeed, type Rng } from './rng';
import { applyUpgrades, level as expLevel, lockedPerks, type Owned } from './expedition';
import { applyPressure, type PressureId } from './pressure';
import { COLS, ROWS, HIDDEN, VISIBLE, GOLD_BIT, cellType, isGold, STEP_MS, HYPER_STOP_GRACE, TACTIC_STEPS, WILD_STREAK_COST, REROLL_EVERY_LEVELS, SOFT_DROP_MS, RULES_VERSION, CURSE_FROM_LEVEL, EMPTY_OFFER_POINTS, GARBAGE_MIN_INTERVAL, CURSE_CHANCE, SHORTCUT_GARBAGE, TUTORIAL_HOLE, TUTORIAL_PIECES, TUTORIAL_LINES, TUTORIAL_HYPER_CHARGE, GRAVITY_MS, LINE_SCORES, SPIN_SCORES, MINI_SCORES } from './constants';
import type { PieceSpec, ActivePiece, SpinKind, Cell, GameState, EndReason, GameEvents, ReplayAction, Replay } from './types';

// Lo que vive en otros ficheros se vuelve a exportar desde aquí, para que los importadores no cambien.
export * from './constants';
export * from './types';

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
  /** Limpiezas difíciles seguidas (cuádruples o giros), para el calor legendario. */
  hardChain = 0;
  piecesLocked = 0;
  generated = 0;
  garbageCounter = 0;
  lives = 0;
  rerolls = 1;
  time = 0;
  maxCombo = 0;
  quads = 0;
  /** Giros que han limpiado líneas (los cuentan los retos de la Expedición). */
  spins = 0;
  /** Condiciones de Presión de esta partida (solo Expedición). */
  pressure: PressureId[] = [];
  /** Perks bloqueados en esta partida (solo Expedición, hasta cumplir su reto). */
  lockedPerks: ReadonlySet<string> = new Set();
  /** Bonus acumulado de Fénix (+0,25 por cada vez que revives). */
  phoenixBonus = 0;
  /** Hiperperk de la partida (solo una) o null si aún no se ha elegido. */
  hyper: HyperDef | null = null;
  /** Líneas cargadas hacia la hiperperk. No carga mientras está activa. */
  hyperCharge = 0;
  /** Pasos de simulación que le quedan activa. 0 = inactiva. */
  hyperLeft = 0;
  /** Una subida de nivel ha traído hiperperk: su elección va antes que la carta normal. */
  hyperPending = false;
  /** Nivel en que se usó la habilidad (una vez por nivel) y pasos que le quedan a la Pausa táctica. */
  skillUsedLevel = -1;
  skillLeft = 0;
  /** Cartas extra por subir de nivel con Tahúr, aún sin elegir. */
  bonusOffers = 0;
  /** Hiperperks que se ofrecen ahora. Si no está vacía, la elección es de hiperperk. */
  hyperChoices: HyperDef[] = [];
  /** Racha (0..STREAK_MAX): sube jugando bien y baja con cada pieza. Ver `streak.ts`. */
  streak = 0;
  /** Limpiezas seguidas con la racha en buena racha (tramo 1 o más), y la mejor de la partida. Solo para mostrar. */
  streakChain = 0;
  streakBest = 0;
  /** Calor por rareza: lo suben distintas jugadas y hace más probable esa rareza en la oferta. Ver `streak.ts`. */
  heat: Heat = { ...NO_HEAT };
  private harvestLines = 0;
  private lifelineReadyAt = 0;
  private pieceStart = 0;

  mods: Mods = baseMods();
  perks = new Map<string, number>();
  perkOrder: string[] = [];
  choices: PerkDef[] = [];
  /** La oferta actual es maldita (solo maldiciones). */
  cursedOffer = false;
  /** La oferta actual es la recompensa de una maldita: rara o mejor. */
  blessedOffer = false;
  /** La oferta actual premia haber superado un nivel jefe: épica o mejor, sin maldiciones. */
  bossOffer = false;
  /** Columna prohibida de Imán (-1: ninguna). */
  magnetCol = -1;
  pendingLevelUps = 0;
  /** El laboratorio se ha usado en esta partida: no puntúa en récords ni rankings (ver `lab*`). */
  sandbox = false;
  /** Multiplicador de velocidad de caída del laboratorio (1 = normal). */
  labGravity = 1;
  /** Mejor nivel de partidas anteriores: decide qué rarezas pueden salir. */
  bestLevel = Infinity;

  /** Semilla de la partida: con ella y las acciones grabadas se reproduce entera. */
  seed = 0;
  mode: ModeId = 'normal';
  endReason: EndReason | null = null;
  /** Pasos de simulación ejecutados (solo avanzan jugando, no en pausa ni eligiendo perk). */
  steps = 0;
  /** Acciones del jugador en esta partida. */
  actions: ReplayAction[] = [];
  /** Azar de la cola, el oro y la basura. */
  private rng: Rng = makeRng(0);
  /** Azar de las cartas, aparte para que elegir o descartar no cambie las piezas que vienen. */
  private perkRng: Rng = makeRng(0);
  /** Azar de las hiperperks, aparte para no mover las cartas normales. */
  private hyperRng: Rng = makeRng(0);
  private soft = false;
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
    this.hardChain = 0;
    this.piecesLocked = 0;
    this.generated = 0;
    this.garbageCounter = 0;
    this.lives = 0;
    this.rerolls = 1;
    this.time = 0;
    this.maxCombo = 0;
    this.quads = 0;
    this.spins = 0;
    this.lockedPerks = new Set();
    this.pressure = [];
    this.phoenixBonus = 0;
    this.hyper = null;
    this.hyperCharge = 0;
    this.hyperLeft = 0;
    this.hyperPending = false;
    this.hyperChoices = [];
    this.streak = 0;
    this.streakChain = 0;
    this.streakBest = 0;
    this.heat = { ...NO_HEAT };
    this.harvestLines = 0;
    this.lifelineReadyAt = 0;
    this.pieceStart = 0;
    this.mods = baseMods();
    this.perks.clear();
    this.perkOrder = [];
    this.choices = [];
    this.cursedOffer = false;
    this.blessedOffer = false;
    this.bossOffer = false;
    this.magnetCol = -1;
    this.pendingLevelUps = 0;
    this.bonusOffers = 0;
    this.skillUsedLevel = -1;
    this.skillLeft = 0;
    this.sandbox = false;
    this.labGravity = 1;
    this.steps = 0;
    this.actions = [];
    this.soft = false;
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.endReason = null;
  }

  /** Empieza una partida. Sin semilla se elige una al azar. */
  start(seed = randomSeed(), mode: ModeId = 'normal', upgrades: Owned = {}, unlocked: readonly string[] = [], pressure: readonly PressureId[] = []) {
    this.reset();
    this.seed = seed >>> 0;
    this.mode = mode;
    const def = MODES[mode];
    if (def.fixedBestLevel !== undefined) this.bestLevel = def.fixedBestLevel;
    this.rng = makeRng(this.seed);
    this.perkRng = makeRng((this.seed ^ 0x9e3779b9) >>> 0);
    this.hyperRng = makeRng((this.seed ^ 0x2545f491) >>> 0);
    this.lastHole = Math.floor(this.rng() * COLS);
    // Expedición: las mejoras permanentes solo cuentan en ese modo (el resto no las ve)
    if (def.expedition) {
      this.pressure = [...pressure];
      applyPressure(this.mods, pressure);
      applyUpgrades(this.mods, upgrades);
      this.lockedPerks = lockedPerks(unlocked);
      this.rerolls += expLevel(upgrades, 'reroll');
      this.lives += expLevel(upgrades, 'vida');
    }
    if (def.starterPerk || (def.expedition && expLevel(upgrades, 'arranque') > 0)) {
      // azar propio para no mover la cola ni las cartas: solo comunes y raras
      const [perk] = rollPerks(this.perks, 0, 1, 0, makeRng((this.seed ^ 0x5bd1e995) >>> 0), this.lockedPerks);
      if (perk) this.grantPerk(perk);
    }
    this.state = 'playing';
    this.fillQueue();
    if (def.tutorial) this.setupTutorial();
    this.spawn();
  }

  /**
   * Tutorial: dos filas casi llenas con el hueco a la derecha y las primeras piezas fijas, para que
   * la primera limpieza sea fácil. Las cartas y la hiperperk salen en los niveles 2 y 3 (ver `addLevelProgress`).
   */
  private setupTutorial() {
    for (let y = ROWS - 2; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) if (x !== TUTORIAL_HOLE && x !== TUTORIAL_HOLE + 1) this.board[y][x] = ((x + y) % 7) + 1;
    this.queue.splice(0, TUTORIAL_PIECES.length, ...TUTORIAL_PIECES.map((k) => this.makeSpec(PIECES[k])));
  }

  // ─────────────────────────── Cola y bolsa ───────────────────────────

  private fillQueue() {
    while (this.queue.length < 8) {
      // con la cruz, la T sale sustituida por la X: la bolsa no crece
      const bag = this.mods.crossSwap ? STANDARD.filter((k) => k !== 'T') : [...STANDARD];
      if (this.mods.crossSwap) bag.push('X5');
      for (const k of this.mods.extraPieces) bag.push(k === 'SZ' ? (this.rng() < 0.5 ? 'S' : 'Z') : k);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
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
    const gold = !bomb && !prism && this.rng() < m.goldChance;
    const heavy = m.heavyEvery > 0 && this.generated % m.heavyEvery === 0;
    return { def, bomb, prism, gold, ...(heavy ? { heavy } : {}) };
  }

  /** Re-marca bombas/prismas de la cola cuando cambia un perk que los afecta. */
  private refreshQueueSpecials() {
    const m = this.mods;
    const startIdx = this.generated - this.queue.length + 1;
    this.queue.forEach((s, i) => {
      const n = startIdx + i;
      if (!s.bomb && m.bombEvery > 0 && n % m.bombEvery === 0) { s.bomb = true; s.prism = false; s.gold = false; }
      if (!s.bomb && !s.prism && m.prismEvery > 0 && n % m.prismEvery === 0) { s.prism = true; s.gold = false; }
      if (m.heavyEvery > 0 && n % m.heavyEvery === 0) s.heavy = true;
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
      if (bx < 0 || bx >= COLS || by >= ROWS || bx === this.magnetCol) return true;
      if (by >= 0 && this.board[by][bx] !== 0) return true;
    }
    return false;
  }

  private spawn(spec?: PieceSpec): boolean {
    let s = spec ?? this.queue.shift()!;
    this.fillQueue();
    // Salvavidas: con el montón alto, la pieza que toca se cambia por una I (no afecta a la reserva)
    if (!spec && this.mods.lifeline && s.def.name !== 'I' && this.inDanger(0.7) && this.piecesLocked >= this.lifelineReadyAt) {
      s = { ...s, def: PIECES.I };
      this.lifelineReadyAt = this.piecesLocked + 12;
      this.events.emit('lifeline', undefined);
    }
    if (this.hyperActive('flood') && s.def.name !== 'I') s = { ...s, def: PIECES.I, hyperFrom: s.def };
    const def = s.def;
    const x = Math.floor((COLS - def.size) / 2);
    // aparece en la primera fila visible si cabe, si no un poco más arriba
    let y = HIDDEN - 1;
    if (def.size === 1 || (def.size === 2 && def.name !== 'O')) y = HIDDEN;
    if (def.name === 'O') y = HIDDEN;
    this.active = { ...s, x, y, rot: 0 };
    if (this.hyperActive('barrage')) this.active.hyperBomb = true;
    if (this.collides(def, x, y, 0)) {
      if (!this.collides(def, x, y - 1, 0)) this.active.y = y - 1;
      else if (!this.collides(def, x, 0, 0)) this.active.y = 0;
      else {
        // con una vida se reintenta la misma pieza: si no, se pierde al revivir (p. ej. desde hold)
        if (!this.topOut()) return false;
        return this.spawn(s);
      }
    }
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = this.active.y;
    this.lastWasRotate = false;
    this.holdUsed = false;
    this.pieceStart = this.time;
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
    this.record([this.steps, 'move', dx]);
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
    if (this.skillLeft > 0) return false; // Pausa táctica: sin giros mientras dura
    this.record([this.steps, 'rotate', dir]);
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
    this.record([this.steps, 'drop']);
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
    if (this.mods.noHold || (this.holdUsed && !this.mods.infiniteHold)) return;
    this.record([this.steps, 'hold']);
    const a = this.active;
    const spec: PieceSpec = { def: a.hyperFrom ?? a.def, bomb: a.bomb, prism: a.prism, gold: a.gold, ...(a.heavy ? { heavy: true } : {}) };
    let next: PieceSpec | undefined;
    if (this.hold.length >= this.mods.holdSlots) next = this.hold.shift();
    this.hold.push(spec);
    if (this.mods.holdCost > 0) this.score = Math.max(0, this.score - this.mods.holdCost * this.level);
    this.events.emit('hold', undefined);
    this.spawn(next);
    this.holdUsed = true;
  }

  /** Piezas de la cola que se ven (la maldición Cola ciega deja solo la siguiente). */
  previewCount(): number {
    return this.mods.blindQueue ? 1 : this.mods.preview;
  }

  ghostY(): number {
    const a = this.active!;
    let y = a.y;
    while (!this.collides(a.def, a.x, y + 1, a.rot)) y++;
    return y;
  }

  // ─────────────────────────── Bucle ───────────────────────────

  gravityMs(): number {
    let t = GRAVITY_MS[Math.min(this.level, GRAVITY_MS.length) - 1];
    let speed = this.mods.gravitySpeed;
    if (this.mods.instinct) speed *= this.inDanger() ? 0.3 : 1.1;
    if (this.active?.gold) speed *= 2;
    if (this.active?.heavy) speed *= 2;
    if (this.bossNow()?.id === 'gravity') speed *= 2;
    if (this.hyperActive('slowmo')) speed *= 0.12;
    if (this.skillLeft > 0) speed *= 0.0001;
    speed *= this.labGravity;
    t /= speed;
    return Math.max(t, 1);
  }

  stackHeight(): number {
    for (let y = 0; y < ROWS; y++) if (this.board[y].some((v) => v !== 0)) return ROWS - y;
    return 0;
  }

  inDanger(ratio = 0.7): boolean {
    return this.stackHeight() >= VISIBLE * ratio;
  }

  /** La caída rápida es parte de la partida: se graba cada vez que cambia. */
  get softDropping(): boolean {
    return this.soft;
  }

  set softDropping(on: boolean) {
    if (on === this.soft) return;
    this.soft = on;
    this.record([this.steps, 'soft', on ? 1 : 0]);
  }

  private record(a: ReplayAction) {
    this.actions.push(a);
  }

  /** Un paso fijo de simulación. Es lo único que debe hacer avanzar el tiempo de la partida. */
  step() {
    if (this.state !== 'playing' || !this.active) return;
    this.steps++;
    if (this.skillLeft > 0) this.skillLeft--;
    if (this.hyperLeft > 0 && --this.hyperLeft === 0) this.events.emit('hyperEnd', { hyper: this.hyper! });
    this.update(STEP_MS);
    // si la última pieza sube de nivel justo al acabar, no se llega a elegir carta
    if (this.timeLeftMs() <= 0 && (this.state === 'playing' || this.state === 'choosing')) this.endRun('time');
  }

  /** Pasos que dura la partida en este modo. 0 = sin límite. */
  timeLimitSteps(): number {
    return Math.round(MODES[this.mode].timeLimitMs / STEP_MS);
  }

  /** Tiempo que queda en contrarreloj (Infinity en los modos sin límite). */
  timeLeftMs(): number {
    const limit = this.timeLimitSteps();
    return limit ? Math.max(0, (limit - this.steps) * STEP_MS) : Infinity;
  }

  /** Datos para rejugar la partida en el servidor o en un reproductor. */
  replay(): Replay {
    // Infinity no sobrevive a JSON (sale null): cualquier nivel alto desbloquea lo mismo
    const bestLevel = Math.min(this.bestLevel, 9999);
    return { version: RULES_VERSION, mode: this.mode, seed: this.seed, bestLevel, actions: [...this.actions], steps: this.steps, ...(this.sandbox ? { sandbox: true as const } : {}) };
  }

  update(dt: number) {
    if (this.state !== 'playing' || !this.active) return;
    this.time += dt;
    let ms = this.gravityMs();
    if (this.softDropping && this.skillLeft === 0) ms = Math.min(ms, SOFT_DROP_MS);
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

  /** Parte de celda que la pieza lleva caída hacia la siguiente. Solo para dibujar: la simulación no la usa. */
  dropFraction(): number {
    if (!this.active || this.onGround()) return 0;
    let ms = this.gravityMs();
    if (this.softDropping) ms = Math.min(ms, SOFT_DROP_MS);
    return Math.min(1, this.gravityAcc / ms);
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

  /** Multiplicador total: el fijo de los perks y los que dependen del estado de la partida. */
  scoreMultNow(): number {
    const m = this.mods;
    let mult = m.scoreMult;
    if (m.vertigo > 0 && this.inDanger(0.5)) mult *= 1 + m.vertigo;
    if (m.collector > 0) mult *= 1 + m.collector * this.perkOrder.filter((id) => !PERK_BY_ID[id].curse).length;
    if (this.phoenixBonus > 0) mult *= 1 + this.phoenixBonus;
    if (m.fury > 0) mult *= 1 + (m.fury * this.streak) / STREAK_MAX;
    if (this.hyperActive('frenzy')) mult *= 3;
    return mult;
  }

  /** `mult` permite fijar el multiplicador antes de cambiar el tablero (Vértigo mide la altura). */
  private addScore(base: number, useMult = true, mult = this.scoreMultNow()): number {
    const pts = Math.round(useMult ? base * mult : base);
    this.score += pts;
    return pts;
  }

  private lockPiece() {
    const a = this.active!;
    const cells = this.cellsOf(a);
    const spin = this.detectSpin();
    this.active = null;
    this.piecesLocked++;
    // la racha baja con cada pieza; las líneas que haga la suben después
    this.addStreak(-STREAK_DECAY * this.mods.streakDecayMult);
    this.checkStreakEnd();
    for (const k of Object.keys(HEAT_DECAY) as (keyof Heat)[]) this.heat[k] = Math.max(0, this.heat[k] - HEAT_DECAY[k]);

    if (a.bomb || a.hyperBomb) {
      this.explode(cells);
    } else if (a.prism) {
      this.prismBlast(cells);
    } else {
      const value = a.def.id | (a.gold ? GOLD_BIT : 0);
      const sand = this.hyperActive('sand');
      const placed = sand ? this.sandCells(cells) : cells;
      for (const [x, y] of placed) if (y >= 0) this.board[y][x] = value;
      this.events.emit('lock', { cells: placed, color: a.def.color });
      const compacted = this.hyperActive('gravity') && this.compactBoard();
      this.resolveClears(sand || compacted ? null : spin, a.def, placed);
      // una pieza con algún bloque por encima del búfer oculto es un bloqueo fuera: cuenta como topOut
      if (placed.some(([, y]) => y < 0) && !this.topOut()) return;
    }

    this.afterLock();
  }

  private findFullRows(): number[] {
    const rows: number[] = [];
    const m = this.magnetCol;
    for (let y = 0; y < ROWS; y++) if (this.board[y].every((v, x) => v !== 0 || (x === m && !this.board[y].includes(GARBAGE_ID)))) rows.push(y);
    return rows;
  }

  private removeRows(rows: number[]) {
    const set = new Set(rows);
    this.board = this.board.filter((_, y) => !set.has(y));
    while (this.board.length < ROWS) this.board.unshift(new Array(COLS).fill(0));
  }

  /** `blast`: líneas que caen tras una bomba o un prisma. Puntúan como una línea normal, sin cadena ni combo. */
  private resolveClears(spin: SpinKind, piece: PieceDef | null, cells: Cell[], cascade = 0, blast = false) {
    const rows = this.findFullRows();
    const lines = rows.length;
    const lvl = this.level;
    const spinName = spin && piece ? `GIRO ${piece.name}${spin === 'mini' ? ' MINI' : ''}` : '';

    if (lines === 0) {
      if (cascade > 0 || blast) return;
      // spin sin líneas: puntúa pero no rompe ni da b2b
      if (spin) {
        const pts = this.addScore((spin === 'full' ? 400 : 100) * lvl);
        this.events.emit('spinNoLines', { spinName, points: pts, cells });
      }
      if (this.combo >= 0 && !this.hyperActive('frenzy')) {
        if (this.comboGraceLeft > 0) this.comboGraceLeft--;
        else this.combo = -1;
      }
      return;
    }

    const rowValues = rows.map((y) => [...this.board[y]]);
    const gold = rowValues.flat().filter(isGold).length;
    const garbageRows = rowValues.filter((r) => r.some((v) => cellType(v) === GARBAGE_ID)).length;

    let base: number;
    if (spin === 'full') base = SPIN_SCORES[Math.min(lines, 3)];
    else if (spin === 'mini') base = MINI_SCORES[Math.min(lines, 3)];
    else base = LINE_SCORES[Math.min(lines, 4)];
    base *= lvl;
    if (lines === 1 && !spin) base *= this.mods.singleMult;
    if (lines >= 4) base *= this.mods.quadMult;
    if (piece) base *= piece.scoreMult;

    const difficult = lines >= 4 || spin !== null;
    let b2bApplied = false;
    if (blast) {
      // no toca combo ni b2b: la bomba o el prisma no los mantienen ni los rompen
    } else if (cascade === 0) {
      if (difficult) {
        if (this.b2b) {
          base *= this.mods.b2bMult;
          b2bApplied = true;
        }
        this.b2b = true;
        this.hardChain++;
      } else {
        this.b2b = false;
        this.hardChain = 0;
      }
      this.combo++;
      this.comboGraceLeft = this.mods.comboGrace;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    } else {
      base *= 1 + cascade;
    }
    if (lines >= 4 && !blast) this.quads++;
    if (spin !== null) this.spins++;

    let total = base;
    if (this.combo > 0 && cascade === 0 && !blast) total += 50 * this.combo * lvl * this.mods.comboMult;
    total += gold * 150 * lvl;
    total += garbageRows * 200 * this.mods.recycle * lvl;
    // Reflejos: solo las piezas que limpian línea, y rápido desde que aparecen
    if (this.mods.reflexPoints > 0 && piece && cascade === 0 && !blast && this.time - this.pieceStart < 1500) {
      total += this.mods.reflexPoints * lines * lvl;
    }

    // el multiplicador se mide antes de quitar las filas: un cuádruple no debe perder Vértigo
    const mult = this.scoreMultNow();
    this.removeRows(rows);
    const perfect = this.board.every((r) => r.every((v) => v === 0));
    if (perfect) total += 3500 * lvl;
    // Erosión va después: quitar el último bloque suelto no convierte la limpieza en tablero limpio
    if (this.mods.erosion && cascade === 0 && !blast) this.erode();

    const points = this.addScore(total, true, mult);
    if (cascade === 0 && !blast) {
      const fast = this.time - this.pieceStart < STREAK_FAST_MS;
      const tierBefore = streakTier(this.streak);
      this.addStreak(streakGain(lines, spin !== null, this.combo, perfect, fast));
      this.noteStreakClear(tierBefore);
      const gain = heatGain(lines, spin !== null, this.combo, b2bApplied, perfect, this.hardChain);
      for (const k of Object.keys(gain) as (keyof Heat)[]) this.heat[k] = Math.min(HEAT_MAX, this.heat[k] + gain[k]);
    }
    this.addLines(lines);
    let counted = lines + garbageRows * this.mods.recycle;
    if (lines >= 4 || spin) counted += this.mods.expBonus;
    counted += Math.floor(lines * this.mods.echo);
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

  /** Erosión: quita el bloque más alto del tablero (el de más a la izquierda de la fila más alta). */
  private erode() {
    for (let y = 0; y < ROWS; y++) {
      const x = this.board[y].findIndex((v) => v !== 0);
      if (x < 0) continue;
      const v = this.board[y][x];
      this.board[y][x] = 0;
      this.events.emit('erode', { x, y, v });
      return;
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
    if (this.combo >= 0 && removed.length === 0 && !this.hyperActive('frenzy')) this.combo = -1;
    this.settleAfterBlast(removed);
  }

  /**
   * Tras una explosión o un prisma: en cada columna afectada, los bloques de encima de su casilla
   * borrada más baja caen a los huecos. El resto del tablero no se mueve (a diferencia de Terremoto).
   */
  private settleColumns(removed: { x: number; y: number }[]): number {
    const bottom = new Map<number, number>();
    for (const r of removed) bottom.set(r.x, Math.max(bottom.get(r.x) ?? -1, r.y));
    let columns = 0;
    for (const [x, from] of bottom) {
      const col: number[] = [];
      for (let y = from; y >= 0; y--) if (this.board[y][x] !== 0) col.push(this.board[y][x]);
      let moved = false;
      for (let y = from, i = 0; y >= 0; y--, i++) {
        const v = i < col.length ? col[i] : 0;
        if (this.board[y][x] !== v) {
          moved = true;
          this.board[y][x] = v;
        }
      }
      if (moved) columns++;
    }
    return columns;
  }

  /** Gravedad: todos los bloques caen a los huecos de su columna. Devuelve si algo se movió. */
  private compactBoard(): boolean {
    const all = Array.from({ length: COLS }, (_, x) => ({ x, y: ROWS - 1 }));
    const columns = this.settleColumns(all);
    if (columns > 0) this.events.emit('settle', { columns });
    return columns > 0;
  }

  private settleAfterBlast(removed: { x: number; y: number }[]) {
    if (removed.length === 0) return;
    const columns = this.settleColumns(removed);
    if (columns === 0) return;
    this.events.emit('settle', { columns });
    this.resolveClears(null, null, [], 0, true);
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
    this.settleAfterBlast(removed);
  }

  private afterLock() {
    const m = this.mods;

    if (m.drillEvery > 0 && this.piecesLocked % m.drillEvery === 0) {
      const bottom = this.board[ROWS - 1];
      if (bottom.some((v) => v !== 0)) {
        const values = [...bottom];
        this.removeRows([ROWS - 1]);
        this.addLines(1);
        const points = this.addScore(150 * this.level);
        this.addLevelProgress(1);
        this.events.emit('drill', { values, points });
      }
    }

    // Ancla: con un combo de dos o más piezas seguidas, la basura no avanza
    const anchored = (m.anchor && this.combo >= 1) || this.hyperActive('slowmo');
    if (this.level >= this.mods.garbageFrom && !anchored && !MODES[this.mode].tutorial) {
      this.garbageCounter++;
      const interval = this.garbageInterval();
      this.events.emit('garbageWarn', { progress: this.garbageCounter / interval });
      if (this.garbageCounter >= interval) {
        this.garbageCounter = 0;
        if (!this.addGarbage()) return;
      }
    }

    this.bossAfterLock();

    // Deriva y Ruleta (maldiciones): cambian el tablero cada cierto número de piezas
    if (m.driftEvery > 0 && this.piecesLocked % m.driftEvery === 0) this.driftBoard();
    if (m.rouletteEvery > 0 && this.piecesLocked % m.rouletteEvery === 0) this.spinRoulette();

    if (this.pendingLevelUps > 0) {
      if (m.levelClearRows > 0) this.breathe(m.levelClearRows * this.pendingLevelUps);
      this.beginChoice();
      return;
    }
    this.spawn();
  }

  /** Deriva: cada fila se desplaza una columna a la derecha y lo que sale por un lado entra por el otro. */
  private driftBoard() {
    this.board = this.board.map((row) => [row[COLS - 1], ...row.slice(0, COLS - 1)]);
    this.events.emit('drift', undefined);
  }

  /** Ruleta: el bloque más alto de una columna con bloques salta encima de otra columna al azar. */
  private spinRoulette() {
    const tops: number[] = [];
    for (let x = 0; x < COLS; x++) if (this.board.some((r) => r[x] !== 0)) tops.push(x);
    if (tops.length === 0) return;
    const from = tops[Math.floor(this.rng() * tops.length)];
    const others = Array.from({ length: COLS }, (_, x) => x).filter((x) => x !== from);
    const to = others[Math.floor(this.rng() * others.length)];
    const fromY = this.board.findIndex((r) => r[from] !== 0);
    // fila libre justo encima de la pila de `to`
    const dest = this.board.some((r) => r[to] !== 0) ? this.board.findIndex((r) => r[to] !== 0) - 1 : ROWS - 1;
    if (dest < HIDDEN) return; // sin sitio visible: no se mueve
    this.board[dest][to] = this.board[fromY][from];
    this.board[fromY][from] = 0;
    this.events.emit('roulette', { from: [from, fromY], to: [to, dest] });
  }

  /** Respiro: borra las `n` filas de abajo que tengan bloques. No puntúa ni cuenta como línea. */
  private breathe(n: number) {
    const rows: number[] = [];
    for (let y = ROWS - 1; y >= 0 && rows.length < n; y--) {
      if (this.board[y].some((v) => v !== 0)) rows.push(y);
      else break;
    }
    if (rows.length === 0) return;
    const values = rows.map((y) => [...this.board[y]]);
    this.removeRows(rows);
    this.events.emit('breather', { rows: values });
  }

  /** Suma líneas al total y, con Cosecha, da un reroll cada cierto número. */
  private addLines(n: number) {
    this.lines += n;
    this.chargeHyper(n);
    const every = this.mods.harvestEvery;
    if (every <= 0) return;
    this.harvestLines += n;
    let gained = 0;
    while (this.harvestLines >= every) {
      this.harvestLines -= every;
      gained++;
    }
    if (gained > 0) {
      this.rerolls += gained;
      this.events.emit('harvest', { rerolls: gained });
    }
  }

  /** Jefe activo en el nivel actual (null si no es nivel jefe o el modo no tiene jefes). */
  bossNow(): BossDef | null {
    return MODES[this.mode].bosses ? bossForLevel(this.level) : null;
  }

  /** Al cambiar de nivel: prepara (o quita) lo que dura el nivel jefe. */
  private syncBoss() {
    const boss = this.bossNow();
    this.magnetCol = -1;
    if (boss?.id === 'magnet') this.pickMagnetCol();
    this.events.emit('boss', { boss, level: this.level });
  }

  private pickMagnetCol() {
    const options = MAGNET_COLS.filter((c) => c !== this.magnetCol);
    this.magnetCol = options[Math.floor(this.rng() * options.length)];
    this.events.emit('bossMagnet', { col: this.magnetCol });
  }

  /** Efectos de jefe tras fijar una pieza. */
  private bossAfterLock() {
    const boss = this.bossNow();
    if (!boss) return;
    if (boss.id === 'drip' && this.piecesLocked % DRIP_EVERY === 0) {
      const x = Math.floor(this.rng() * COLS);
      let top = 0;
      while (top < ROWS && this.board[top][x] === 0) top++;
      const y = top - 1;
      // no llena la columna hasta arriba: el jefe aprieta, no mata de golpe
      if (y >= HIDDEN + 2) {
        this.board[y][x] = GARBAGE_ID;
        this.events.emit('bossDrop', { x, y });
      }
    }
    if (boss.id === 'magnet' && this.piecesLocked % MAGNET_EVERY === 0) this.pickMagnetCol();
  }

  garbageInterval(): number {
    // suelo después de sumar los perks: Terremoto y Marea juntos no pueden subir basura en cada pieza
    return Math.max(GARBAGE_MIN_INTERVAL, Math.max(5, 15 - Math.floor(this.level / 2)) + this.mods.garbageDelay);
  }

  garbageProgress(): number {
    if (this.level < this.mods.garbageFrom) return 0;
    return this.garbageCounter / this.garbageInterval();
  }

  private lastHole = 0;
  /** Sube el tablero una fila. Devuelve false si la partida termina. */
  private addGarbage(): boolean {
    // si hay bloques en la fila de arriba, subir el tablero los empujaría fuera
    if (this.board[0].some((v) => v !== 0) && !this.topOut()) return false;
    const hole = this.rng() < 0.7 ? this.lastHole : Math.floor(this.rng() * COLS);
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
    const shield = this.hyperActive('shield');
    if (shield || this.lives > 0) {
      if (!shield) this.lives--;
      // deja sólo las 5 filas de abajo; con Fénix, nada
      const keep = this.mods.phoenix ? 0 : 5;
      for (let y = 0; y < ROWS - keep; y++) this.board[y].fill(0);
      // tope de +50%: con Segunda vida, Fénix no debe crecer sin límite
      if (this.mods.phoenix && !shield) this.phoenixBonus = Math.min(0.5, this.phoenixBonus + 0.25);
      this.combo = -1;
      this.events.emit('revive', { livesLeft: this.lives });
      return true;
    }
    this.endRun('topout');
    return false;
  }

  private endRun(reason: EndReason) {
    this.active = null;
    this.choices = [];
    this.hyperChoices = [];
    this.hyperLeft = 0;
    this.pendingLevelUps = 0;
    this.bonusOffers = 0;
    this.skillLeft = 0;
    this.state = 'over';
    this.endReason = reason;
    this.events.emit('gameover', { reason });
  }

  // ─────────────────────────── Niveles y perks ───────────────────────────

  linesNeeded(): number {
    if (MODES[this.mode].tutorial) return TUTORIAL_LINES;
    // 8 líneas al principio, +1 cada 2 niveles (tope 16)
    const base = Math.min(16, 8 + Math.floor((this.level - 1) / 2));
    return Math.max(4, base - this.mods.linesReduction);
  }

  private addLevelProgress(n: number) {
    // Atajo: la primera línea de cada nivel vale más
    if (this.mods.shortcut > 0 && this.linesIntoLevel === 0 && n > 0) n += 2 * this.mods.shortcut;
    if (n >= 2 && this.bossNow()?.id === 'gravity') n *= 2;
    this.linesIntoLevel += n;
    while (this.linesIntoLevel >= this.linesNeeded()) {
      this.linesIntoLevel -= this.linesNeeded();
      const beaten = this.bossNow();
      this.level++;
      if (beaten) {
        this.rerolls++;
        this.events.emit('bossDown', { boss: beaten, level: this.level - 1 });
      }
      this.pendingLevelUps++;
      if (this.mods.gambler) this.bonusOffers++; // Tahúr: una carta extra por subida
      // Atajo: cada subida acerca la siguiente fila de basura
      if (this.mods.shortcut > 0) this.garbageCounter += SHORTCUT_GARBAGE;
      if (this.mods.rerollPerLevel > 0) this.rerolls += this.mods.rerollPerLevel;
      if (this.level % REROLL_EVERY_LEVELS === 0) {
        this.rerolls++;
        this.events.emit('harvest', { rerolls: 1 });
      }
      // la hiperperk no está garantizada: cada subida tiene una probabilidad que sube con la racha
      if (!this.hyper && !this.hyperPending && this.level >= HYPER_FROM_LEVEL && this.hyperRng() < hyperChance(this.streak, this.level)) {
        this.hyperPending = true;
      }
      // en el tutorial la hiperperk sale seguro en la segunda subida
      if (MODES[this.mode].tutorial && this.level === 3 && !this.hyper) this.hyperPending = true;
      if (this.mods.interest > 0) {
        const amount = Math.round(this.score * this.mods.interest);
        this.score += amount;
        this.events.emit('interest', { amount });
      }
      this.events.emit('levelup', { level: this.level });
      this.syncBoss();
    }
  }

  private beginChoice() {
    this.state = 'choosing';
    this.newOffer();
  }

  /** Nivel que se celebra en la oferta actual (con varias subidas seguidas, la primera pendiente). */
  offerLevel(): number {
    // sin subidas pendientes, lo que queda son cartas extra de Tahúr del nivel actual
    return this.pendingLevelUps > 0 ? this.level - this.pendingLevelUps + 1 : this.level;
  }

  /**
   * Oferta nueva: todas las cartas de la misma rareza. Desde el nivel 5, algunas (nunca dos
   * seguidas) son malditas: solo maldiciones, y hay que elegir la menos mala. La oferta que
   * sigue a una maldita es rara o mejor. Si tocan hiperperks, van antes y no cuentan como oferta.
   */
  private newOffer() {
    if (this.hyperPending) {
      this.rollChoices();
      this.skipEmptyOffer();
      return;
    }
    this.blessedOffer = this.cursedOffer;
    // oferta de jefe: la primera tras superar un nivel jefe (offerLevel es el nivel al que subes)
    this.bossOffer = this.pendingLevelUps > 0 && MODES[this.mode].bosses === true && isBossLevel(this.offerLevel() - 1);
    const cursed =
      !this.bossOffer &&
      this.offerLevel() >= CURSE_FROM_LEVEL && !this.cursedOffer && this.perkRng() < CURSE_CHANCE + this.mods.curseChance;
    this.cursedOffer = cursed;
    this.rollChoices();
    this.skipEmptyOffer();
  }

  /**
   * Sin cartas que ofrecer (todas al máximo), la subida no se puede elegir: se resuelve sola,
   * dando puntos, y la partida sigue. Así nunca queda parada esperando una elección vacía.
   */
  private skipEmptyOffer() {
    if (this.state !== 'choosing' || this.choosingHyper || this.choices.length > 0) return;
    const levels = this.pendingLevelUps;
    this.pendingLevelUps = 0;
    this.bonusOffers = 0;
    const points = this.addScore(EMPTY_OFFER_POINTS * this.level * levels, false);
    this.events.emit('emptyOffer', { points });
    this.choices = [];
    this.state = 'playing';
    this.spawn();
  }

  /** Saca las cartas del tipo de oferta actual (el reroll mantiene el tipo). */
  private rollChoices() {
    this.rollChoicesNow();
    const hyper = this.choosingHyper;
    const ids = hyper ? this.hyperChoices.map((h) => h.id) : this.choices.map((c) => c.id);
    if (ids.length > 0) this.events.emit('offer', { kind: hyper ? 'hyper' : this.cursedOffer ? 'curse' : 'perk', ids });
  }

  private rollChoicesNow() {
    const n = Math.max(2, this.mods.choices);
    if (this.hyperPending) {
      this.choices = [];
      this.hyperChoices = rollHypers(Math.max(3, this.mods.choices), this.hyperRng); // Casino no recorta las hiperperks
      return;
    }
    this.hyperChoices = [];
    if (this.cursedOffer) {
      this.choices = rollCurses(this.perks, n, this.perkRng);
      if (this.choices.length > 0) return;
      this.cursedOffer = false; // todas las maldiciones al máximo: oferta normal
    }
    this.choices = rollOffer(this.perks, this.offerLuck(), n, this.bestLevel, this.perkRng, this.blessedOffer, this.lockedPerks, this.heat, this.bossOffer ? 'epic' : undefined);
  }

  /** Suerte de las ofertas: la de los perks (Trébol) más la de la racha. */
  offerLuck(): number {
    return this.mods.luck + streakLuck(this.streak);
  }

  /** Probabilidad de cada rareza en la oferta normal, con la suerte de ahora. */
  offerOdds(): Record<Rarity, number> {
    // jugando, la próxima oferta es «bendita» si la última fue maldita
    const blessed = this.state === 'choosing' ? this.blessedOffer : this.cursedOffer;
    return offerOdds(this.perks, this.offerLuck(), this.bestLevel, blessed, this.lockedPerks, this.heat);
  }

  /** Probabilidad de que la próxima subida traiga hiperperk (0 si ya la tienes o aún no toca). */
  hyperOfferChance(): number {
    if (this.hyper || this.hyperPending || this.level + 1 < HYPER_FROM_LEVEL) return 0;
    return hyperChance(this.streak, this.level + 1);
  }

  private addStreak(n: number) {
    this.streak = Math.max(0, Math.min(STREAK_MAX, this.streak + n));
  }

  /** Cuenta la cadena de buena racha (solo para mostrarla) tras una limpieza. */
  private noteStreakClear(tierBefore: number) {
    const tier = streakTier(this.streak);
    if (tier === 0) return this.checkStreakEnd();
    this.streakChain++;
    this.streakBest = Math.max(this.streakBest, this.streakChain);
    this.events.emit('streakUp', { streak: this.streak, tier, tierUp: tier > tierBefore, chain: this.streakChain });
  }

  /** Si la racha ha caído del primer tramo, se corta la cadena. */
  private checkStreakEnd() {
    if (this.streakChain > 0 && streakTier(this.streak) === 0) {
      const chain = this.streakChain;
      this.streakChain = 0;
      this.events.emit('streakEnd', { chain });
    }
  }

  /** La elección en curso es de hiperperk, no de mejora normal. */
  get choosingHyper(): boolean {
    return this.hyperChoices.length > 0;
  }

  reroll(): boolean {
    if (this.state !== 'choosing' || this.rerolls <= 0) return false;
    this.rerolls--;
    this.record([this.steps, 'reroll']);
    this.rollChoices();
    return true;
  }

  choosePerk(index: number) {
    if (this.state !== 'choosing') return;
    if (this.choosingHyper) {
      const hyper = this.hyperChoices[index];
      if (!hyper) return;
      this.record([this.steps, 'pick', index]);
      // en el tutorial se carga con pocas líneas para poder soltarla enseguida
      this.hyper = MODES[this.mode].tutorial ? { ...hyper, charge: TUTORIAL_HYPER_CHARGE } : hyper;
      this.hyperPending = false;
      this.hyperCharge = 0;
      this.events.emit('hyperPick', { hyper: this.hyper });
      // la hiperperk no gasta la subida de nivel: después viene la carta normal
      this.newOffer();
      return;
    }
    const perk = this.choices[index];
    if (!perk) return;
    this.record([this.steps, 'pick', index]);
    this.grantPerk(perk);
    this.afterPick();
  }

  /** Tras coger (o saltar) una carta: la siguiente oferta pendiente, y si no quedan, a jugar. */
  private afterPick() {
    if (this.pendingLevelUps > 0) this.pendingLevelUps--;
    else if (this.bonusOffers > 0) this.bonusOffers--;
    if (this.pendingLevelUps > 0 || this.bonusOffers > 0) {
      this.newOffer();
      return;
    }
    this.choices = [];
    this.state = 'playing';
    this.spawn();
  }

  /** ¿Se puede saltar la oferta? Solo las normales: las malditas y las hiperperks hay que resolverlas. */
  canSkip(): boolean {
    // las cartas extra de Tahúr no se saltan: sería un reroll gratis por nivel
    return this.state === 'choosing' && !this.choosingHyper && !this.cursedOffer && this.choices.length > 0 && this.pendingLevelUps > 0;
  }

  /** Saltar la oferta: no coges carta y ganas un reroll. */
  skipOffer(): boolean {
    if (!this.canSkip()) return false;
    this.record([this.steps, 'skip']);
    this.rerolls++;
    this.events.emit('skip', { rerolls: this.rerolls });
    this.afterPick();
    return true;
  }

  /** Maldiciones que tienes, en el orden en que las cogiste (es el índice de `shedCurse`). */
  ownedCurses(): string[] {
    return this.perkOrder.filter((id) => PERK_BY_ID[id]?.curse);
  }

  /** Sacrificar una maldición: gasta un reroll y la quita (con todas sus copias menos una si hay varias). */
  shedCurse(index: number): boolean {
    if (this.state !== 'choosing' || this.rerolls <= 0) return false;
    const id = this.ownedCurses()[index];
    if (!id) return false;
    this.record([this.steps, 'shed', index]);
    this.rerolls--;
    const n = this.perkStacks(id);
    if (n > 1) this.perks.set(id, n - 1);
    else {
      this.perks.delete(id);
      this.perkOrder = this.perkOrder.filter((k) => k !== id);
    }
    this.rebuildMods();
    this.events.emit('shed', { perk: PERK_BY_ID[id] });
    return true;
  }

  // ─────────────────────────── Habilidad activa ───────────────────────────

  /** Hay una habilidad (Pausa táctica o Comodín) lista: sin usar este nivel y jugando. */
  skillReady(): boolean {
    if (this.mods.skill === '' || this.state !== 'playing' || !this.active || this.skillUsedLevel === this.level || this.skillLeft > 0) return false;
    // el Comodín no descarta piezas especiales (bomba, prisma, oro, pesada): se perderían
    const a = this.active;
    return !(this.mods.skill === 'wild' && (a.bomb || a.prism || a.gold || a.heavy || a.hyperBomb));
  }

  /** Usa la habilidad. Es una acción del jugador: se graba para la repetición. */
  useSkill(): boolean {
    if (!this.skillReady()) return false;
    const skill = this.mods.skill as 'tactic' | 'wild';
    this.record([this.steps, 'skill']);
    this.skillUsedLevel = this.level;
    this.events.emit('skill', { skill });
    if (skill === 'tactic') {
      this.skillLeft = TACTIC_STEPS;
      return true;
    }
    // Comodín: la pieza actual se descarta y entra la siguiente (la reserva sigue como estaba)
    this.addStreak(-WILD_STREAK_COST);
    const holdUsed = this.holdUsed;
    this.spawn();
    this.holdUsed = holdUsed;
    return true;
  }

  private grantPerk(perk: PerkDef) {
    const stacks = (this.perks.get(perk.id) ?? 0) + 1;
    this.perks.set(perk.id, stacks);
    if (!this.perkOrder.includes(perk.id)) this.perkOrder.push(perk.id);
    perk.apply(this.mods, this);
    this.refreshQueueSpecials();
    this.events.emit('perk', { perk, stacks });
  }

  // ─────────────────────────── Hiperperks ───────────────────────────

  /** Piel de la interfaz ahora: la de la hiperperk mientras está activa; null = la de base. */
  skinNow(): SkinId | null {
    return this.hyperLeft > 0 ? (this.hyper?.skin ?? null) : null;
  }

  /** La hiperperk `id` es la de la partida y está activa ahora. */
  hyperActive(id: HyperId): boolean {
    return this.hyperLeft > 0 && this.hyper?.id === id;
  }

  /** Lista para activar: elegida, cargada del todo y sin estar ya activa. */
  hyperReady(): boolean {
    return this.hyper !== null && this.hyperLeft === 0 && this.hyperCharge >= this.hyper.charge;
  }

  /** Lo que lleva cargado (0..1) o, activa, lo que le queda. */
  hyperMeter(): number {
    const h = this.hyper;
    if (!h) return 0;
    if (this.hyperLeft > 0) return this.hyperLeft / Math.round(h.durationMs / STEP_MS);
    return Math.min(1, this.hyperCharge / h.charge);
  }

  private chargeHyper(n: number) {
    const h = this.hyper;
    if (!h || this.hyperLeft > 0 || this.hyperCharge >= h.charge) return;
    this.hyperCharge = Math.min(h.charge, this.hyperCharge + n);
    if (this.hyperCharge >= h.charge) this.events.emit('hyperReady', { hyper: h });
  }

  /** Suelta la hiperperk. Es una acción del jugador: se graba para la repetición. */
  activateHyper(): boolean {
    if (this.state !== 'playing' || !this.active) return false;
    // con la hiperperk activa, volver a pulsar la corta (sin devolver la carga)
    if (this.hyperLeft > 0) {
      // un segundo toque justo después de soltarla (p. ej. doble toque sin querer) no la corta
      const total = Math.round(this.hyper!.durationMs / STEP_MS);
      return total - this.hyperLeft >= HYPER_STOP_GRACE ? this.stopHyper() : false;
    }
    if (!this.hyperReady()) return false;
    const h = this.hyper!;
    this.record([this.steps, 'hyper']);
    this.hyperCharge = 0;
    this.hyperLeft = Math.round(h.durationMs / STEP_MS);
    this.events.emit('hyper', { hyper: h });
    if (h.id === 'barrage') this.active!.hyperBomb = true;
    if (h.id === 'flood') this.floodActive();
    if (h.id === 'wipe') this.wipeBoard();
    // las instantáneas también avisan de que han terminado
    if (this.hyperLeft === 0) this.events.emit('hyperEnd', { hyper: h });
    return true;
  }

  /** Corta la hiperperk activa. Es una acción del jugador: se graba igual que soltarla. */
  private stopHyper(): boolean {
    const h = this.hyper!;
    this.record([this.steps, 'hyper']);
    this.hyperLeft = 0;
    const a = this.active!;
    // la pieza que ya está cayendo vuelve a ser la normal
    if (h.id === 'barrage') a.hyperBomb = false;
    if (h.id === 'flood' && a.hyperFrom && !this.collides(a.hyperFrom, a.x, a.y, 0)) {
      a.def = a.hyperFrom;
      a.rot = 0;
      a.hyperFrom = undefined;
    }
    this.events.emit('hyperEnd', { hyper: h });
    return true;
  }

  /** Diluvio: la pieza que cae ahora también pasa a ser una I. */
  private floodActive() {
    const a = this.active!;
    if (a.def.name === 'I') return;
    const x = Math.floor((COLS - PIECES.I.size) / 2);
    if (this.collides(PIECES.I, x, a.y, 0)) return;
    a.hyperFrom = a.def;
    a.def = PIECES.I;
    a.rot = 0;
    a.x = x;
  }

  /** Arena: cada bloque cae al hueco libre más bajo de su columna, aunque esté tapado. */
  private sandCells(cells: Cell[]): Cell[] {
    const taken = new Set<string>();
    const free = (x: number, y: number) => this.board[y][x] === 0 && !taken.has(`${x},${y}`);
    // primero los de abajo, para que cada bloque ocupe el hueco más bajo que quede
    return [...cells]
      .sort((a, b) => b[1] - a[1])
      .map(([x, y]) => {
        for (let ty = ROWS - 1; ty >= Math.max(0, y); ty--) {
          if (free(x, ty)) {
            taken.add(`${x},${ty}`);
            return [x, ty] as Cell;
          }
        }
        return [x, y] as Cell;
      });
  }

  /** Tabla rasa: vacía el tablero. Puntúa por bloque, sin tocar combo ni líneas. */
  private wipeBoard() {
    const removed: { x: number; y: number; v: number }[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (this.board[y][x] !== 0) {
          removed.push({ x, y, v: this.board[y][x] });
          this.board[y][x] = 0;
        }
    const points = this.addScore(removed.length * 40 * this.level);
    this.events.emit('wipe', { removed, points });
  }

  // ─────────────────────────── Laboratorio ───────────────────────────
  // Herramientas de pruebas (ver `ui/lab.ts`). Cualquier uso marca la partida como `sandbox`:
  // no guarda récord, no cuenta para rankings y su repetición se rechaza.

  /** Vuelve a calcular `mods` desde cero con los perks que hay (tras quitar uno). */
  private rebuildMods() {
    // algunos perks tocan también vidas o rerolls: esos valores los controla el laboratorio
    const { lives, rerolls } = this;
    this.mods = baseMods();
    for (const id of this.perkOrder) for (let i = 0; i < this.perkStacks(id); i++) PERK_BY_ID[id].apply(this.mods, this);
    this.lives = lives;
    this.rerolls = rerolls;
    this.refreshQueueSpecials();
  }

  private labOpen(): boolean {
    return this.state !== 'ready' && this.state !== 'over';
  }

  labAddPerk(id: string) {
    const perk = PERK_BY_ID[id];
    if (!perk || this.perkStacks(id) >= perk.max || !this.labOpen()) return;
    this.sandbox = true;
    const { lives, rerolls } = this;
    this.grantPerk(perk);
    this.lives = lives;
    this.rerolls = rerolls;
  }

  labRemovePerk(id: string) {
    const n = this.perkStacks(id);
    if (!n || !this.labOpen()) return;
    this.sandbox = true;
    if (n > 1) this.perks.set(id, n - 1);
    else {
      this.perks.delete(id);
      this.perkOrder = this.perkOrder.filter((k) => k !== id);
    }
    this.rebuildMods();
  }

  labClearPerks() {
    if (!this.labOpen()) return;
    this.sandbox = true;
    this.perks.clear();
    this.perkOrder = [];
    this.rebuildMods();
  }

  /** Cambia la hiperperk de la partida (null la quita) y la deja cargada. */
  labSetHyper(id: HyperId | null) {
    if (!this.labOpen()) return;
    this.sandbox = true;
    this.hyper = id ? HYPER_BY_ID[id] : null;
    this.hyperCharge = this.hyper ? this.hyper.charge : 0;
    this.hyperLeft = 0;
    this.hyperPending = false;
  }

  /** Ajusta números de la partida. Los que no se pasan se dejan como están. */
  labSet(v: { level?: number; lives?: number; rerolls?: number; gravity?: number }) {
    if (!this.labOpen()) return;
    this.sandbox = true;
    if (v.level !== undefined) {
      this.level = Math.max(1, Math.min(99, Math.round(v.level)));
      this.syncBoss();
      this.linesIntoLevel = 0;
    }
    if (v.lives !== undefined) this.lives = Math.max(0, Math.min(9, Math.round(v.lives)));
    if (v.rerolls !== undefined) this.rerolls = Math.max(0, Math.min(99, Math.round(v.rerolls)));
    if (v.gravity !== undefined) this.labGravity = Math.max(0.05, Math.min(10, v.gravity));
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
