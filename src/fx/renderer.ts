import { Application, Container, Filter, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { ShockwaveFilter } from 'pixi-filters';
import { cellType, COLS, HIDDEN, isGold, ROWS, VISIBLE, type Cell, type Game, type PieceSpec } from '../core/game';

import { colorOfId, GOLD_COLOR, PIECES, type PieceDef } from '../core/pieces';
import {
  accentFor, BOARD_H, BOARD_W, BOARD_X, BOARD_Y, CELL, H, HOLD_W, HOLD_X, HOLD_Y, HYPER_COLOR, NEXT_W, NEXT_X, NEXT_Y, PORTRAIT, W, hex,
} from './layout';
import { Particles } from './particles';
import { PostFx } from './postfx';
import { skinOf, SKINS, type Skin, type SkinId } from './skins';

// estilo píxel: fuente de recreativa y oro claro para los textos flotantes sobre fondo oscuro
const PIXEL_FONT = '"Press Start 2P", monospace';
const GOLD_TEXT = 0xffc83d;

/** Si el sistema pide menos movimiento, las sacudidas y ondas se reducen al mínimo. */
const REDUCED_MOTION =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ───────────────────────── utilidades de color ─────────────────────────

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

function hsv(h: number, s: number, v: number): number {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

// ───────────────────────── texturas procedurales ─────────────────────────

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): Texture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  return Texture.from(cv);
}

/**
 * Bloque de 8×8 "píxeles": borde oscuro, brillo arriba a la izquierda y sombra escalonada abajo a la derecha.
 * Se dibuja al tamaño real de la celda en pantalla (`size` px) para que cada píxel caiga en píxeles enteros.
 */
function makeCellTexture(size: number): Texture {
  const s = size;
  const at = (i: number) => Math.round((i * s) / 8);
  return canvasTex(s, s, (c) => {
    // rectángulo en unidades de píxel del dibujo (8 por lado)
    const box = (x: number, y: number, w: number, h: number) => c.fillRect(at(x), at(y), at(x + w) - at(x), at(y + h) - at(y));
    c.fillStyle = '#ffffff';
    box(0, 0, 8, 8);
    c.fillStyle = '#5a5a5a';
    box(0, 7, 8, 1);
    box(7, 0, 1, 8);
    c.fillStyle = '#9c9c9c';
    box(1, 6, 6, 1);
    box(6, 1, 1, 6);
    c.fillStyle = '#ffffff';
    box(0, 0, 7, 1);
    box(0, 0, 1, 7);
    c.fillStyle = '#e8e8e8';
    box(1, 1, 5, 5);
    c.fillStyle = '#ffffff';
    box(1, 1, 2, 1);
    box(1, 2, 1, 1);
    const b = Math.max(1, Math.round(s / 32));
    c.fillStyle = '#202020';
    c.fillRect(0, 0, s, b);
    c.fillRect(0, 0, b, s);
    c.fillRect(0, s - b, s, b);
    c.fillRect(s - b, 0, b, s);
  });
}

/** Lado en píxeles de pantalla de una celda del tablero, para dibujar su textura sin reescalar. */
function cellPx(res: number) {
  return Math.max(16, Math.round(CELL * res));
}

/** Fantasma propio: rayado diagonal con esquinas marcadas, sin caja rellena. */
function makeGhostTexture(): Texture {
  const s = 64;
  return canvasTex(s, s, (c) => {
    c.save();
    c.beginPath();
    c.rect(6, 6, s - 12, s - 12);
    c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 3;
    for (let k = -s; k < s; k += 12) {
      c.beginPath();
      c.moveTo(k, s);
      c.lineTo(k + s, 0);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineWidth = 4;
    const a = 6, b = s - 6, l = 14;
    c.beginPath();
    c.moveTo(a, a + l); c.lineTo(a, a); c.lineTo(a + l, a);
    c.moveTo(b - l, a); c.lineTo(b, a); c.lineTo(b, a + l);
    c.moveTo(b, b - l); c.lineTo(b, b); c.lineTo(b - l, b);
    c.moveTo(a + l, b); c.lineTo(a, b); c.lineTo(a, b - l);
    c.stroke();
  });
}

function makeDotTexture(size = 32): Texture {
  return canvasTex(size, size, (c) => {
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  });
}

function makeVignette(): Texture {
  return canvasTex(W / 2, H / 2, (c) => {
    const g = c.createRadialGradient(W / 4, H / 4, H * 0.12, W / 4, H / 4, W * 0.32);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.fillRect(0, 0, W / 2, H / 2);
  });
}

function makeTrailTexture(): Texture {
  return canvasTex(8, 128, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.fillRect(0, 0, 8, 128);
  });
}

function makeBackground(skin: Skin): Texture {
  const w = W / 2, h = H / 2;
  const tex = canvasTex(w, h, (c) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(skin.bg0));
    g.addColorStop(1, hex(skin.bg1));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    if (!skin.stars) return;
    // cielo de estrellas con semilla fija (sale igual siempre) y colinas escalonadas al pie
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 140; k++) {
      c.fillStyle = rnd() < 0.2 ? 'rgba(255,210,63,0.8)' : 'rgba(255,255,255,0.55)';
      const sz = rnd() < 0.15 ? 2 : 1;
      c.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), sz, sz);
    }
    c.fillStyle = 'rgba(80,60,160,0.35)';
    for (let x = 0; x < w; x += 4) {
      const hh = 24 + Math.round(10 * Math.sin(x / 37) + 6 * Math.sin(x / 13)) * 2;
      c.fillRect(x, h - hh, 4, hh);
    }
  });
  // se dibuja a media resolución: sin suavizado al ampliar, para que estrellas y colinas sigan siendo píxeles
  tex.source.scaleMode = 'nearest';
  return tex;
}

// ───────────────────────── pool de sprites ─────────────────────────

class Pool {
  private items: Sprite[] = [];
  private used = 0;
  constructor(private parent: Container, private tex: Texture, private blend: 'normal' | 'add' = 'normal') {}
  begin() { this.used = 0; }
  setTexture(tex: Texture) {
    this.tex = tex;
    for (const s of this.items) s.texture = tex;
  }
  get(): Sprite {
    let s = this.items[this.used];
    if (!s) {
      s = new Sprite(this.tex);
      s.blendMode = this.blend;
      this.parent.addChild(s);
      this.items.push(s);
    }
    this.used++;
    s.visible = true;
    s.alpha = 1;
    s.rotation = 0;
    return s;
  }
  end() {
    for (let i = this.used; i < this.items.length; i++) this.items[i].visible = false;
  }
}

interface Timed { life: number; max: number }
interface Trail extends Timed { x: number; y0: number; y1: number; color: number }
interface Flash extends Timed { x: number; y: number; w: number; h: number; color: number }
interface FloatText extends Timed { t: Text; vy: number; baseScale: number }
interface Shock { f: ShockwaveFilter; t: number; dur: number }

// ───────────────────────── renderer ─────────────────────────

export class Renderer {
  app = new Application();
  private root = new Container();
  private bg = new Container();
  private world = new Container();
  private boardBg = new Graphics();
  private panels = new Graphics();
  private frame = new Graphics();
  private cellLayer = new Container();
  private fxLayer = new Container();
  private textLayer = new Container();
  private overlay = new Container();

  private tex!: { cell: Texture; ghost: Texture; dot: Texture; trail: Texture; vignette: Texture; square: Texture };
  private cells!: Pool;
  private ghosts!: Pool;
  private trails!: Pool;
  private flashes!: Pool;
  private glows!: Pool;
  particles!: Particles;

  private stars: { s: Sprite; speed: number }[] = [];
  private blobs: { s: Sprite; ph: number; sp: number }[] = [];
  private scanlines = new Graphics();
  private filterSig = -1;
  private vignette!: Sprite;
  private screenFlash!: Sprite;

  private shocks: Shock[] = [];
  private post = new PostFx();
  /** Efectos de pantalla (ondas, rejilla, aberración, pixelado). Los apaga F, el botón o un equipo lento. */
  highQuality = true;
  private slowT = 0;
  /** Se llama cuando el renderer apaga solo los efectos por ir lento. */
  onAutoOff?: () => void;

  private trailList: Trail[] = [];
  private flashList: Flash[] = [];
  private texts: FloatText[] = [];

  private time = 0;
  private trauma = 0;
  private kickY = 0;
  private punch = 0;
  private accent = accentFor(1);
  private accentTarget = accentFor(1);
  /** Colocación que sugiere el ratón (columna y giro); solo se dibuja, no cambia el juego. */
  preview: { x: number; rot: number } | null = null;
  private visX = 0;
  private visY = 0;
  private snapPiece = true;
  private overT = 0;
  private dangerAmt = 0;
  private skinId: SkinId = 'pixel';
  private skin: Skin = SKINS.pixel;
  private bgSprite!: Sprite;
  private panelKey = '';
  private labels: Text[] = [];

  constructor(private game: Game) {}

  async init(canvas: HTMLCanvasElement, resolution: number) {
    await this.app.init({
      canvas,
      width: W,
      height: H,
      resolution,
      autoDensity: true,
      antialias: true,
      roundPixels: true,
      background: '#e9e1cc',
      preference: 'webgl',
    });

    this.tex = {
      cell: makeCellTexture(cellPx(resolution)),
      ghost: makeGhostTexture(),
      dot: makeDotTexture(),
      trail: makeTrailTexture(),
      vignette: makeVignette(),
      square: Texture.WHITE,
    };

    this.app.stage.addChild(this.root);
    this.root.filterArea = new Rectangle(0, 0, W, H);
    this.root.addChild(this.bg, this.world, this.overlay);

    this.buildBackground();

    this.world.pivot.set(W / 2, H / 2);
    this.world.position.set(W / 2, H / 2);
    this.world.addChild(this.boardBg, this.panels, this.cellLayer, this.frame, this.fxLayer, this.textLayer);

    this.cells = new Pool(this.cellLayer, this.tex.cell);
    this.ghosts = new Pool(this.cellLayer, this.tex.ghost);
    this.trails = new Pool(this.fxLayer, this.tex.trail, 'normal');
    this.flashes = new Pool(this.fxLayer, Texture.WHITE);
    this.glows = new Pool(this.fxLayer, this.tex.dot, 'normal');
    this.particles = new Particles({ dot: this.tex.dot, spark: this.tex.dot, square: Texture.WHITE });
    this.fxLayer.addChild(this.particles.container);

    this.vignette = new Sprite(this.tex.vignette);
    this.vignette.width = W;
    this.vignette.height = H;
    this.vignette.alpha = 0;
    this.screenFlash = new Sprite(Texture.WHITE);
    this.screenFlash.width = W;
    this.screenFlash.height = H;
    this.screenFlash.alpha = 0;
    this.screenFlash.blendMode = 'normal';
    // rejilla de monitor: líneas estáticas (un Graphics, sin filtro) cada 3 px lógicos
    this.buildScanlines();
    this.overlay.addChild(this.scanlines, this.vignette, this.screenFlash);

    this.drawBoardBg();
    this.setupFilters();
    this.bindEvents();
  }

  /** El escenario cambió de disposición (vertical/horizontal) o de alto: rehace todo lo que depende de W, H y del tablero. */
  relayout(res: number) {
    this.app.renderer.resize(W, H, res);
    this.root.filterArea = new Rectangle(0, 0, W, H);
    this.world.pivot.set(W / 2, H / 2);
    this.world.position.set(W / 2, H / 2);
    const oldBg = this.bgSprite.texture;
    this.bgSprite.texture = makeBackground(this.skin);
    oldBg.destroy(true);
    this.bgSprite.width = W;
    this.bgSprite.height = H;
    this.vignette.width = W;
    this.vignette.height = H;
    this.screenFlash.width = W;
    this.screenFlash.height = H;
    this.buildScanlines();
    for (const sh of this.shocks) sh.f.center = { x: W / 2, y: H / 2 };
    this.post.resize(W, H);
    const old = this.tex.cell;
    this.tex.cell = makeCellTexture(cellPx(res));
    this.cells.setTexture(this.tex.cell);
    old.destroy(true);
    for (const t of this.labels) t.resolution = res;
    this.drawBoardBg();
    this.panelKey = '';
    this.stars.forEach((st) => { st.s.x = Math.random() * W; st.s.y = Math.random() * H; });
  }

  private buildScanlines() {
    this.scanlines.clear();
    for (let y = 2; y < H; y += 3) this.scanlines.rect(0, y, W, 1);
    this.scanlines.fill({ color: 0x000000, alpha: 0.07 });
  }

  setResolution(res: number) {
    this.app.renderer.resize(W, H, res);
    // la textura del bloque va al tamaño real de la celda y los textos a la resolución del lienzo
    const old = this.tex.cell;
    this.tex.cell = makeCellTexture(cellPx(res));
    this.cells.setTexture(this.tex.cell);
    old.destroy(true);
    for (const t of this.labels) t.resolution = res;
  }

  // ───────────── construcción ─────────────

  private buildBackground() {
    this.bgSprite = new Sprite(makeBackground(this.skin));
    this.bgSprite.width = W;
    this.bgSprite.height = H;
    this.bg.addChild(this.bgSprite);
  }

  /** Cambia la piel si la ha cambiado un perk (o una partida nueva la devuelve a la de base). */
  private updateSkin() {
    const id = this.game.skinNow() ?? 'pixel';
    if (id === this.skinId) return;
    this.skinId = id;
    this.skin = skinOf(id);
    const old = this.bgSprite.texture;
    this.bgSprite.texture = makeBackground(this.skin);
    old.destroy(true);
    this.app.renderer.background.color = this.skin.bg0;
    this.drawBoardBg();
    this.panelKey = '';
    this.accentTarget = accentFor(this.game.level);
  }

  /** Los colores fijos de los textos y destellos se aclaran para que se lean sobre fondo oscuro.
   *  Los acentos de nivel (ACCENTS) ya son claros y no pasan por aquí. */
  tone(c: number): number {
    return this.skin.dark ? lerpColor(c, 0xffffff, 0.45) : c;
  }

  private drawBoardBg() {
    const g = this.boardBg;
    g.clear();
    g.rect(BOARD_X - 4, BOARD_Y - 4, BOARD_W + 8, BOARD_H + 8).fill({ color: this.skin.panel, alpha: 1 });
    for (let x = 1; x < COLS; x++) {
      g.moveTo(BOARD_X + x * CELL, BOARD_Y).lineTo(BOARD_X + x * CELL, BOARD_Y + BOARD_H);
    }
    for (let y = 1; y < VISIBLE; y++) {
      g.moveTo(BOARD_X, BOARD_Y + y * CELL).lineTo(BOARD_X + BOARD_W, BOARD_Y + y * CELL);
    }
    g.stroke({ width: 1, color: this.skin.ink, alpha: 0.12 });
  }

  private setupFilters() {
    for (let i = 0; i < 3; i++) {
      const f = new ShockwaveFilter({ center: { x: W / 2, y: H / 2 }, amplitude: 28, wavelength: 140, speed: 620, brightness: 1.25, radius: 700 });
      f.enabled = false;
      this.shocks.push({ f, t: 0, dur: 1.2 });
    }
    for (const s of this.shocks) s.f.resolution = 'inherit';
    this.applyQuality();
  }

  applyQuality() {
    // Todo lo que pasa por filtros de pantalla cuelga de esta opción.
    if (!this.highQuality) this.post.clear();
    this.scanlines.visible = this.highQuality;
    this.syncFilters(true);
  }

  /** Los filtros de pantalla solo están en la cadena mientras hay un efecto vivo: en reposo, coste cero. */
  private syncFilters(force = false) {
    const on = this.highQuality;
    const post = on && this.post.active;
    const sig = (post ? 1 : 0) + this.shocks.reduce((n, s, i) => n + (on && s.f.enabled ? 2 << i : 0), 0);
    if (!force && sig === this.filterSig) return;
    this.filterSig = sig;
    const chain: Filter[] = [];
    if (on) for (const s of this.shocks) if (s.f.enabled) chain.push(s.f);
    if (post) chain.push(this.post.filter);
    this.root.filters = chain;
  }

  // ───────────── coordenadas ─────────────

  private px(x: number) { return BOARD_X + x * CELL; }
  private py(y: number) { return BOARD_Y + (y - HIDDEN) * CELL; }
  private cx(x: number) { return this.px(x) + CELL / 2; }
  private cy(y: number) { return this.py(y) + CELL / 2; }

  // ───────────── efectos públicos ─────────────

  /** Limpia los efectos que queden de la partida anterior. */
  reset() {
    for (const ft of this.texts) ft.t.destroy();
    this.texts = [];
    this.trailList = [];
    this.flashList = [];
    for (const s of this.shocks) s.f.enabled = false;
    this.post.clear();
    this.trauma = this.kickY = this.punch = 0;
    this.overT = 0;
    this.accentTarget = accentFor(1);
    this.snapPiece = true;
  }

  shake(amount: number) { this.trauma = Math.min(1, this.trauma + amount * (REDUCED_MOTION ? 0.25 : 1)); }

  /** Gancho para las hiperperks: estallido de pantalla (pixelado, aberración y pulso de color). */
  ultiBurst(color: number = HYPER_COLOR) {
    if (REDUCED_MOTION) { this.post.pulse(color, 0.5); return; }
    this.post.pixelate(10, 0.35);
    this.post.aberrate(0.9);
    this.post.pulse(color, 0.8);
  }

  shockwave(x: number, y: number, opts: { amplitude?: number; wavelength?: number; speed?: number; dur?: number } = {}) {
    if (REDUCED_MOTION) return;
    // si acaba de salir otra onda, se refuerza esa en vez de apilar distorsiones
    const recent = this.shocks.find((s) => s.f.enabled && s.t < 0.2);
    const s = recent ?? this.shocks.find((s) => !s.f.enabled) ?? this.shocks.reduce((a, b) => (a.t > b.t ? a : b));
    const amp = opts.amplitude ?? 14;
    if (recent) {
      s.f.amplitude = Math.max(s.f.amplitude, amp);
      return;
    }
    s.f.center = { x, y };
    s.f.amplitude = amp * 0.7;
    s.f.wavelength = Math.min(opts.wavelength ?? 110, 120);
    s.f.speed = Math.max(opts.speed ?? 900, 800);
    s.f.radius = 460;
    s.f.time = 0;
    s.t = 0;
    s.dur = opts.dur ?? s.f.radius / s.f.speed + 0.05;
    s.f.enabled = true;
  }

  flash(color = this.skin.ink, alpha = 0.35) {
    this.screenFlash.tint = color;
    this.screenFlash.alpha = Math.max(this.screenFlash.alpha, alpha * (REDUCED_MOTION ? 0.2 : 0.4));
  }

  floatText(str: string, x: number, y: number, o: { color?: number; size?: number; life?: number; vy?: number; delay?: number; font?: string } = {}) {
    const color = o.color === undefined ? this.skin.ink : this.tone(o.color);
    const t = new Text({
      text: str,
      style: {
        fontFamily: o.font ?? PIXEL_FONT,
        fontWeight: 'normal',
        // la fuente de píxeles es muy ancha: se reduce para que los textos quepan en el tablero
        fontSize: Math.round((o.size ?? 28) * 0.48),
        fill: color,
        stroke: { color: this.skin.paper, width: Math.max(3, (o.size ?? 28) / 7) },
        letterSpacing: 1,
        align: 'center',
      },
      resolution: this.app.renderer.resolution,
    });
    t.anchor.set(0.5);
    t.x = x;
    t.y = y;
    t.scale.set(0.3);
    t.alpha = 0;
    this.textLayer.addChild(t);
    const max = o.life ?? 1.3;
    this.texts.push({ t, life: max + (o.delay ?? 0), max, vy: o.vy ?? -40, baseScale: 1 });
  }

  // ───────────── eventos del juego → efectos ─────────────

  private bindEvents() {
    const g = this.game;
    const ev = g.events;

    ev.on('spawn', () => { this.snapPiece = true; });

    ev.on('harddrop', ({ from, to, color, dist }) => {
      if (dist <= 0) return;
      const cols = new Map<number, { top: number; bottom: number }>();
      for (let i = 0; i < to.length; i++) {
        const [x] = to[i];
        const c = cols.get(x);
        const top = from[i][1];
        const bottom = to[i][1];
        if (!c) cols.set(x, { top, bottom });
        else { c.top = Math.min(c.top, top); c.bottom = Math.max(c.bottom, bottom); }
      }
      for (const [x, { top, bottom }] of cols) {
        this.trailList.push({ x: this.px(x), y0: this.py(top), y1: this.py(bottom) + CELL, color, life: 0.28, max: 0.28 });
      }
      // polvo al aterrizar
      const lowest = new Map<number, number>();
      for (const [x, y] of to) lowest.set(x, Math.max(lowest.get(x) ?? -1, y));
      for (const [x, y] of lowest) {
        this.particles.emit({ x: this.cx(x), y: this.py(y) + CELL, color, count: 6, speed: 220, angle: -Math.PI / 2, spread: 2.2, life: 0.45, size: 6, gravity: 500, jitter: 10 });
      }
      this.kickY = Math.min(10, 3 + dist * 0.45);
      this.shake(Math.min(0.28, 0.06 + dist * 0.012));
    });

    ev.on('lock', ({ cells }) => {
      for (const [x, y] of cells) this.flashList.push({ x: this.px(x), y: this.py(y), w: CELL, h: CELL, color: this.skin.ink, life: 0.16, max: 0.16 });
    });

    ev.on('clear', (c) => {
      const midRow = c.rows.reduce((s, r) => s + r, 0) / c.rows.length;
      const cyRows = this.cy(midRow);
      // los textos se mantienen dentro del tablero aunque la línea esté abajo del todo
      const cyMid = Math.max(BOARD_Y + 90, Math.min(cyRows, BOARD_Y + BOARD_H - 150));
      const cxMid = BOARD_X + BOARD_W / 2;
      const big = c.lines >= 4 || c.spin !== null || c.perfect;

      c.rows.forEach((row, ri) => {
        this.flashList.push({ x: BOARD_X, y: this.py(row), w: BOARD_W, h: CELL, color: this.skin.ink, life: 0.35, max: 0.35 });
        c.rowValues[ri].forEach((v, x) => {
          const color = isGold(v) ? GOLD_COLOR : colorOfId(cellType(v));
          this.particles.emit({
            x: this.cx(x), y: this.cy(row), color, count: big ? 9 : 6, speed: big ? 520 : 340,
            angle: -Math.PI / 2, spread: Math.PI * 1.6, life: 0.9, size: big ? 9 : 7, gravity: 900, jitter: 12, shape: 'square',
          });
          this.particles.emit({ x: this.cx(x), y: this.cy(row), color, count: 3, speed: 600, life: 0.5, size: 5, gravity: 0, drag: 3, shape: 'spark' });
        });
      });

      // texto
      const lineNames = ['', 'SIMPLE', 'DOBLE', 'TRIPLE', 'CUÁDRUPLE'];
      let label = c.lines >= 4 ? 'CUÁDRUPLE' : lineNames[c.lines];
      if (c.spin) label = `${c.spinName}${c.lines ? ' ' + lineNames[Math.min(c.lines, 3)] : ''}`;
      if (c.cascade > 0) label = `CADENA ×${c.cascade + 1}`;
      const color = c.lines >= 4 ? 0x1f5fa8 : c.spin ? 0x7a3fa0 : c.cascade ? 0xb4541a : this.skin.ink;
      if (c.lines >= 2 || c.spin || c.cascade) this.floatText(label, cxMid, cyMid - 10, { color, size: big ? 40 : 28, life: 1.4 });
      if (c.b2b) this.floatText('BACK-TO-BACK', cxMid, cyMid - 52, { color: 0xb06a14, size: 18, life: 1.4 });
      let below = cyMid + (big ? 38 : 30);
      if (c.combo >= 1 && c.cascade === 0) {
        this.floatText(`COMBO ×${c.combo}`, cxMid, below, { color: 0x4c7d1c, size: 20 + Math.min(c.combo, 10) * 1.5, life: 1.2 });
        below += 32;
      }
      this.floatText(`+${c.points.toLocaleString('es-ES')}`, cxMid, below, { color: this.skin.ink, size: 16, life: 1.1, vy: -30 });
      below += 28;
      if (c.gold > 0) this.floatText(`+${c.gold} ORO`, cxMid, below, { color: GOLD_TEXT, size: 18, life: 1.3, vy: -30 });

      if (c.perfect) {
        this.floatText('TABLERO LIMPIO', cxMid, BOARD_Y + BOARD_H / 2, { color: this.skin.ink, size: 46, life: 2.2, vy: -10 });
        this.flash(this.skin.ink, 0.3);
        if (!REDUCED_MOTION) this.post.pixelate(10, 0.4);
        this.shockwave(cxMid, BOARD_Y + BOARD_H / 2, { amplitude: 24, wavelength: 160, speed: 800 });
      }

      this.shake(c.lines >= 4 ? 0.55 : c.spin ? 0.4 : 0.12 + c.lines * 0.08);
      this.punch = big ? 0.035 : 0.012 * c.lines;
      if (big) {
        this.shockwave(cxMid, cyRows, { amplitude: c.lines >= 4 ? 18 : 12 });
        this.post.aberrate(c.lines >= 4 ? 0.8 : 0.45);
        this.flash(c.lines >= 4 ? 0x1f5fa8 : 0x7a3fa0, 0.12);
      }
    });

    ev.on('spinNoLines', ({ spinName, cells }) => {
      const [x, y] = cells[0];
      this.floatText(spinName, this.cx(x), this.cy(y) - 20, { color: 0x7a3fa0, size: 22 });
      this.shake(0.12);
    });

    ev.on('bomb', ({ cx, cy, removed, points }) => {
      const x = this.cx(cx), y = this.cy(cy);
      for (const r of removed) {
        const color = isGold(r.v) ? GOLD_COLOR : colorOfId(cellType(r.v));
        this.particles.emit({ x: this.cx(r.x), y: this.cy(r.y), color, count: 8, speed: 600, life: 1, size: 9, gravity: 900, shape: 'square', jitter: 10 });
      }
      this.particles.emit({ x, y, color: 0xff6a2a, count: 70, speed: 900, life: 0.7, size: 12, gravity: 200, drag: 3 });
      this.particles.emit({ x, y, color: 0xffe14d, count: 40, speed: 700, life: 0.5, size: 6, gravity: 0, drag: 4, shape: 'spark' });
      this.flashList.push({ x: this.px(cx - 2), y: this.py(cy - 2), w: CELL * 5, h: CELL * 5, color: 0xff8030, life: 0.35, max: 0.35 });
      this.shockwave(x, y, { amplitude: 22, wavelength: 130, speed: 700 });
      this.shake(0.7);
      this.post.aberrate(0.6);
      this.flash(0xff6a2a, 0.2);
      this.floatText('¡BOOM!', x, y - 20, { color: 0xb4541a, size: 40 });
      this.floatText(`+${points.toLocaleString('es-ES')}`, x, y + 22, { size: 16, vy: -70 });
    });

    ev.on('prism', ({ removed, points, cells }) => {
      removed.forEach((r, i) => {
        const color = hsv((i * 0.07) % 1, 0.8, 1);
        this.particles.emit({ x: this.cx(r.x), y: this.cy(r.y), color, count: 7, speed: 420, life: 1.1, size: 8, gravity: -200, shape: 'square', jitter: 8 });
        this.flashList.push({ x: this.px(r.x), y: this.py(r.y), w: CELL, h: CELL, color, life: 0.5, max: 0.5 });
      });
      const [x, y] = cells[0];
      this.shockwave(this.cx(x), this.cy(y), { amplitude: 14, wavelength: 150, speed: 500 });
      this.flash(this.skin.ink, 0.3);
      this.shake(0.4);
      this.floatText(`PRISMA ×${removed.length}`, this.cx(x), this.cy(y) - 30, { color: 0xb8336a, size: 30 });
      this.floatText(`+${points.toLocaleString('es-ES')}`, this.cx(x), this.cy(y) + 10, { size: 16, vy: -70 });
    });

    ev.on('drill', ({ values }) => {
      const row = ROWS - 1;
      this.flashList.push({ x: BOARD_X - 20, y: this.py(row) + 4, w: BOARD_W + 40, h: CELL - 8, color: 0xffa13d, life: 0.45, max: 0.45 });
      values.forEach((v, x) => {
        if (!v) return;
        const color = isGold(v) ? GOLD_COLOR : colorOfId(cellType(v));
        this.particles.emit({ x: this.cx(x), y: this.cy(row), color, count: 6, speed: 380, angle: -Math.PI / 2, spread: 1.6, life: 0.8, size: 7, gravity: 900, shape: 'square' });
      });
      this.particles.emit({ x: BOARD_X, y: this.cy(row), color: 0xffa13d, count: 40, speed: 900, angle: 0, spread: 0.3, life: 0.4, size: 6, gravity: 0, shape: 'spark' });
      this.shake(0.2);
      this.floatText('TALADRO', BOARD_X + BOARD_W / 2, this.cy(row) - 30, { color: 0xb06a14, size: 20 });
    });

    ev.on('quake', ({ chain }) => {
      this.shake(0.9);
      this.shockwave(BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H, { amplitude: 20, wavelength: 160, speed: 500 });
      for (let x = 0; x < COLS; x++) this.particles.emit({ x: this.cx(x), y: BOARD_Y + BOARD_H, color: 0xff8a3d, count: 6, speed: 300, angle: -Math.PI / 2, spread: 1, life: 0.8, size: 8, gravity: 600 });
      this.floatText(chain > 1 ? `TERREMOTO ×${chain}` : 'TERREMOTO', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H - 80, { color: 0xb4541a, size: 30 });
    });

    // la caída tras una bomba o un prisma: un temblor corto para que el salto de bloques se note
    ev.on('settle', () => this.shake(0.25));

    ev.on('garbage', () => {
      this.kickY = -6;
      this.shake(0.1);
      this.flashList.push({ x: BOARD_X, y: BOARD_Y + BOARD_H - CELL, w: BOARD_W, h: CELL, color: 0xff3050, life: 0.3, max: 0.3 });
    });

    ev.on('levelup', ({ level }) => {
      this.accentTarget = accentFor(level);
      this.floatText(`NIVEL ${level}`, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2, { color: accentFor(level), size: 52, life: 1.6, vy: -15, delay: 0.35 });
      this.shockwave(BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2, { amplitude: 12, wavelength: 140, speed: 700 });
      this.flash(accentFor(level), 0.15);
      if (!REDUCED_MOTION) this.post.pixelate(14, 0.45);
      this.post.pulse(accentFor(level), 0.35);
    });

    ev.on('interest', ({ amount }) => {
      this.floatText(`INTERÉS +${amount.toLocaleString('es-ES')}`, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 50, { color: GOLD_TEXT, size: 18, delay: 0.3 });
    });

    ev.on('emptyOffer', ({ points }) => {
      this.floatText(`SIN CARTAS +${points.toLocaleString('es-ES')}`, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 50, { color: GOLD_TEXT, size: 16, delay: 0.3 });
    });

    ev.on('breather', ({ rows }) => {
      rows.forEach((values, i) => {
        const row = ROWS - 1 - i;
        this.flashList.push({ x: BOARD_X, y: this.py(row), w: BOARD_W, h: CELL, color: 0x2a6f8a, life: 0.5, max: 0.5 });
        values.forEach((v, x) => {
          if (!v) return;
          const color = isGold(v) ? GOLD_COLOR : colorOfId(cellType(v));
          this.particles.emit({ x: this.cx(x), y: this.cy(row), color, count: 4, speed: 260, angle: -Math.PI / 2, spread: 1.2, life: 0.7, size: 6, gravity: 600, shape: 'square' });
        });
      });
      this.floatText('RESPIRO', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H - 60, { color: 0x2a6f8a, size: 22, delay: 0.2 });
    });

    ev.on('lifeline', () => {
      this.floatText('SALVAVIDAS', BOARD_X + BOARD_W / 2, BOARD_Y + 120, { color: 0x2a6f8a, size: 24 });
    });

    ev.on('harvest', ({ rerolls }) => {
      this.floatText(`+${rerolls} REROLL`, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 80, { color: 0x4c7d1c, size: 18, delay: 0.2 });
    });

    ev.on('revive', () => {
      this.flash(this.skin.ink, 0.5);
      this.shake(0.6);
      this.shockwave(BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H - 80, { amplitude: 20, wavelength: 160 });
      this.floatText(this.game.mods.phoenix ? '¡FÉNIX!' : '¡SEGUNDA VIDA!', BOARD_X + BOARD_W / 2, BOARD_Y + 200, { color: 0xb83a2e, size: 34, life: 2 });
    });

    const mid = BOARD_X + BOARD_W / 2;
    ev.on('hyperPick', ({ hyper }) => {
      this.flash(HYPER_COLOR, 0.3);
      this.floatText(hyper.name.toUpperCase(), mid, BOARD_Y + 100, { color: HYPER_COLOR, size: 28, life: 1.6 });
    });

    ev.on('hyperReady', ({ hyper }) => {
      this.floatText(`${hyper.name.toUpperCase()} LISTA`, mid, BOARD_Y + BOARD_H / 2 + 110, { color: HYPER_COLOR, size: 18, delay: 0.25 });
    });

    ev.on('hyper', ({ hyper }) => {
      this.flash(HYPER_COLOR, 0.5);
      // el estallido lleva el color de la piel que pone la hiperperk
      this.ultiBurst((hyper.skin && SKINS[hyper.skin].burst) || HYPER_COLOR);
      this.shake(0.5);
      this.shockwave(mid, BOARD_Y + BOARD_H / 2, { amplitude: 24, wavelength: 170, speed: 650 });
      this.floatText(`¡${hyper.name.toUpperCase()}!`, mid, BOARD_Y + BOARD_H / 2 - 40, { color: HYPER_COLOR, size: 44, life: 1.6, vy: -20 });
    });

    ev.on('hyperEnd', ({ hyper }) => {
      this.floatText(`FIN DE ${hyper.name.toUpperCase()}`, mid, BOARD_Y + 120, { color: this.skin.ink, size: 16 });
    });

    ev.on('wipe', ({ removed, points }) => {
      for (const r of removed) {
        const color = isGold(r.v) ? GOLD_COLOR : colorOfId(cellType(r.v));
        this.particles.emit({ x: this.cx(r.x), y: this.cy(r.y), color, count: 3, speed: 420, angle: -Math.PI / 2, spread: 1.4, life: 0.9, size: 8, gravity: 700, shape: 'square', jitter: 8 });
      }
      this.flashList.push({ x: BOARD_X, y: BOARD_Y, w: BOARD_W, h: BOARD_H, color: HYPER_COLOR, life: 0.5, max: 0.5 });
      this.shake(0.8);
      this.floatText(`+${points.toLocaleString('es-ES')}`, mid, BOARD_Y + BOARD_H / 2 + 10, { size: 20, vy: -60 });
    });

    ev.on('gameover', () => {
      this.overT = 0;
      this.shake(0.5);
    });

    ev.on('perk', ({ perk }) => {
      this.flash(this.skin.ink, 0.25);
      this.floatText(perk.name.toUpperCase(), BOARD_X + BOARD_W / 2, BOARD_Y + 160, { color: this.accent, size: 26, life: 1.4 });
    });
  }

  // ───────────── dibujo por frame ─────────────

  render(dt: number) {
    const sec = dt / 1000;
    this.time += sec;
    const g = this.game;

    this.updateSkin();
    this.accent = lerpColor(this.accent, this.accentTarget, 1 - Math.exp(-sec * 3));

    this.updateBackground(sec);
    this.updatePanels();
    this.drawFrame();

    this.cells.begin();
    this.ghosts.begin();
    this.drawBoard(sec);
    this.drawActive(sec);
    this.drawSidePieces();
    this.cells.end();
    this.ghosts.end();

    this.updateFx(sec);
    this.updateFilters(sec);
    this.updatePost(sec, dt);
    this.syncFilters();
    this.particles.update(dt);
    this.updateTexts(sec);
    this.updateCamera(sec);

    // peligro / instinto
    const danger = g.state === 'playing' && g.inDanger();
    this.dangerAmt += ((danger ? 1 : 0) - this.dangerAmt) * (1 - Math.exp(-sec * 4));
    const instinct = g.mods.instinct && danger;
    this.vignette.tint = instinct ? 0x30a0ff : 0xff1e3c;
    this.vignette.alpha = this.dangerAmt * (0.35 + 0.15 * Math.sin(this.time * (instinct ? 2 : 6)));
    this.screenFlash.alpha *= Math.exp(-sec * 6);
  }

  private updateBackground(sec: number) {
    const lvl = this.game.level;
    this.blobs.forEach((b, i) => {
      b.ph += sec * b.sp;
      b.s.x = W / 2 + Math.cos(b.ph * 1.3 + i) * 380;
      b.s.y = H / 2 + Math.sin(b.ph + i * 2) * 260;
      b.s.tint = i % 2 === 0 ? this.accent : accentFor(lvl + 2);
    });
    const speedMul = 1 + Math.min(lvl, 20) * 0.15;
    for (const st of this.stars) {
      st.s.y -= st.speed * speedMul * sec;
      if (st.s.y < -5) {
        st.s.y = H + 5;
        st.s.x = Math.random() * W;
      }
    }
  }

  /** Casillas de la reserva (columna izquierda) y de la cola (columna derecha), según los perks. */
  private queueSlots() {
    const g = this.game;
    const top = 28; // bajo la etiqueta
    if (PORTRAIT) {
      // fila sobre el tablero: las casillas se reparten en horizontal
      const hs = g.mods.holdSlots > 1 ? 40 : 56;
      const hold: { x: number; y: number; s: number }[] = [];
      const hw = g.mods.holdSlots * hs + (g.mods.holdSlots - 1) * 8;
      let x = HOLD_X + (HOLD_W - hw) / 2;
      for (let i = 0; i < g.mods.holdSlots; i++, x += hs + 8) hold.push({ x, y: HOLD_Y + top, s: hs });
      const next: { x: number; y: number; s: number }[] = [];
      x = NEXT_X + 12;
      for (let i = 0; i < g.mods.preview; i++) {
        const s = i === 0 ? 56 : 40;
        if (x + s > NEXT_X + NEXT_W - 8) break;
        next.push({ x, y: NEXT_Y + top + (56 - s) / 2, s });
        x += s + 8;
      }
      const h = top + 56 + 8;
      return { hold, next, holdH: h, nextH: h };
    }
    const hs = g.mods.holdSlots > 1 ? 48 : 64;
    const hold: { x: number; y: number; s: number }[] = [];
    let y = HOLD_Y + top;
    for (let i = 0; i < g.mods.holdSlots; i++, y += hs + 8) hold.push({ x: HOLD_X + (HOLD_W - hs) / 2, y, s: hs });
    const holdH = y - HOLD_Y + 4;
    const next: { x: number; y: number; s: number }[] = [];
    y = NEXT_Y + top;
    for (let i = 0; i < g.mods.preview; i++) {
      const s = i === 0 ? 64 : 48;
      if (y + s > BOARD_Y + BOARD_H) break; // con muchas piezas en la cola, las que no caben no se dibujan
      next.push({ x: NEXT_X + (NEXT_W - s) / 2, y, s });
      y += s + 8;
    }
    const nextH = y - NEXT_Y + 4;
    return { hold, next, holdH, nextH };
  }

  private updatePanels() {
    const g = this.game;
    const key = `${g.mods.holdSlots}|${g.mods.preview}|${this.accent}|${this.skinId}`;
    if (key === this.panelKey) return;
    this.panelKey = key;
    const { hold, next, holdH, nextH } = this.queueSlots();
    const p = this.panels;
    p.clear();
    // marcos de 4 px como los paneles del HUD
    for (const [x, y, w, h] of [[HOLD_X, HOLD_Y, HOLD_W, holdH], [NEXT_X, NEXT_Y, NEXT_W, nextH]]) {
      p.rect(x, y, w, h).fill({ color: this.skin.panel, alpha: 1 });
      p.rect(x, y, w, h).stroke({ width: 4, color: this.skin.ink, alpha: 1 });
    }
    for (const sl of hold) p.rect(sl.x, sl.y, sl.s, sl.s).stroke({ width: 1, color: this.skin.ink, alpha: 0.35 });
    next.forEach((sl, i) => {
      p.rect(sl.x, sl.y, sl.s, sl.s).stroke({ width: i === 0 ? 2 : 1, color: i === 0 ? this.accent : this.skin.ink, alpha: i === 0 ? 1 : 0.35 });
    });
    // flecha hacia el tablero: la primera de la cola es la que entra
    if (!PORTRAIT) {
      const ax = NEXT_X - 10, ay = next[0].y + next[0].s / 2;
      p.poly([ax + 8, ay - 6, ax, ay, ax + 8, ay + 6]).fill({ color: this.accent, alpha: 1 });
    }

    if (!this.labels.length) {
      for (const txt of ['RESERVA', 'SIGUIENTES']) {
        const t = new Text({
          text: txt,
          style: { fontFamily: PIXEL_FONT, fontWeight: 'normal', fontSize: 9, fill: 0xffffff, letterSpacing: 0 },
          resolution: this.app.renderer.resolution,
        });
        t.anchor.set(0.5, 0.5);
        this.world.addChild(t);
        this.labels.push(t);
      }
    }
    this.labels[0].position.set(HOLD_X + HOLD_W / 2, HOLD_Y + 16);
    this.labels[1].position.set(NEXT_X + NEXT_W / 2, NEXT_Y + 16);
    for (const t of this.labels) t.tint = this.accent;
  }

  private drawFrame() {
    const g = this.game;
    const f = this.frame;
    f.clear();
    const dangerCol = lerpColor(this.skin.ink, 0xc0392b, this.dangerAmt * (0.6 + 0.4 * Math.sin(this.time * 8)));
    f.rect(BOARD_X - 4, BOARD_Y - 4, BOARD_W + 8, BOARD_H + 8).stroke({ width: 4, color: dangerCol, alpha: 1 });

    // medidor de basura
    const gp = g.garbageProgress();
    if (gp > 0) {
      const h = BOARD_H * Math.min(1, gp);
      const pulse = gp > 0.75 ? 0.6 + 0.4 * Math.sin(this.time * 14) : 0.85;
      f.rect(BOARD_X - 20, BOARD_Y + BOARD_H - h, 6, h).fill({ color: 0xff3050, alpha: pulse });
    }
    // hiperperk: barra a la derecha del tablero; se llena con líneas y se vacía mientras está activa
    if (g.hyper) {
      const active = g.hyperLeft > 0;
      const ready = g.hyperReady();
      const h = BOARD_H * g.hyperMeter();
      const alpha = ready && !REDUCED_MOTION ? 0.65 + 0.35 * Math.sin(this.time * 10) : 1;
      f.rect(BOARD_X + BOARD_W + 14, BOARD_Y, 6, BOARD_H).fill({ color: this.skin.ink, alpha: 0.12 });
      f.rect(BOARD_X + BOARD_W + 14, BOARD_Y + BOARD_H - h, 6, h).fill({ color: HYPER_COLOR, alpha });
      if (active) {
        const pulse = REDUCED_MOTION ? 0.8 : 0.55 + 0.45 * Math.sin(this.time * 9);
        f.rect(BOARD_X - 13, BOARD_Y - 13, BOARD_W + 26, BOARD_H + 26).stroke({ width: 3, color: HYPER_COLOR, alpha: pulse });
      }
    }
    // progreso de nivel (barra fina debajo del tablero)
    const lp = g.linesIntoLevel / g.linesNeeded();
    f.rect(BOARD_X, BOARD_Y + BOARD_H + 12, BOARD_W, 4).fill({ color: this.skin.ink, alpha: 0.15 });
    f.rect(BOARD_X, BOARD_Y + BOARD_H + 12, BOARD_W * lp, 4).fill({ color: this.accent, alpha: 1 });
  }

  private placeCell(pool: Pool, x: number, y: number, size: number, color: number, alpha = 1) {
    const s = pool.get();
    s.x = x;
    s.y = y;
    s.width = size;
    s.height = size;
    s.tint = color;
    s.alpha = alpha;
    return s;
  }

  private drawBoard(sec: number) {
    const g = this.game;
    const over = g.state === 'over';
    if (over) this.overT += sec;
    const grayRow = over ? ROWS - Math.floor(this.overT * 30) : ROWS + 1;
    for (let y = HIDDEN; y < ROWS; y++) {
      const row = g.board[y];
      for (let x = 0; x < COLS; x++) {
        const v = row[x];
        if (!v) continue;
        let color = colorOfId(cellType(v));
        if (isGold(v)) color = lerpColor(GOLD_COLOR, 0xffffff, 0.25 + 0.25 * Math.sin(this.time * 4 + x * 0.7 + y * 0.5));
        if (y >= grayRow) color = lerpColor(color, 0x30323c, 0.85);
        this.placeCell(this.cells, this.px(x), this.py(y), CELL, color);
      }
    }
  }

  private specColor(spec: PieceSpec, i: number): number {
    if (spec.bomb || spec.hyperBomb) return lerpColor(0xff2a2a, 0xffb020, 0.5 + 0.5 * Math.sin(this.time * 18));
    if (spec.prism) return hsv((this.time * 0.6 + i * 0.12) % 1, 0.75, 1);
    if (spec.gold) return lerpColor(GOLD_COLOR, 0xffffff, 0.2 + 0.2 * Math.sin(this.time * 5 + i));
    return spec.def.color;
  }

  private drawActive(sec: number) {
    const g = this.game;
    const a = g.active;
    if (!a || g.state === 'over') return;

    if (this.snapPiece) {
      this.visX = a.x;
      this.visY = a.y;
      this.snapPiece = false;
    }
    const pv = this.preview && !g.collides(a.def, this.preview.x, a.y, this.preview.rot) ? this.preview : null;
    const ax = pv ? pv.x : a.x;
    const arot = pv ? pv.rot : a.rot;
    const k = 1 - Math.exp(-sec * 45);
    // con la flecha abajo la pieza se dibuja con la fracción de celda que lleva: se ve bajar, no saltar
    const targetY = a.y + (g.softDropping ? g.dropFraction() : 0);
    this.visX += (ax - this.visX) * k;
    this.visY += (targetY - this.visY) * (g.softDropping ? 1 : k);
    if (Math.abs(ax - this.visX) > 3 || Math.abs(a.y - this.visY) > 4) {
      this.visX = ax;
      this.visY = targetY;
    }

    const shape = a.def.shapes[arot];
    // ghost
    let gy = a.y;
    while (!g.collides(a.def, ax, gy + 1, arot)) gy++;
    shape.forEach(([cx, cy], i) => {
      const y = gy + cy;
      if (y < HIDDEN) return;
      this.placeCell(this.ghosts, this.px(ax + cx), this.py(y), CELL, this.specColor(a, i), 0.7);
    });
    // pieza
    const lp = g.lockProgress();
    shape.forEach(([cx, cy], i) => {
      const y = this.visY + cy;
      if (y < HIDDEN - 0.99) return;
      const col = lerpColor(this.specColor(a, i), 0xffffff, lp * 0.45);
      const alpha = y < HIDDEN ? 0.5 : 1;
      this.placeCell(this.cells, BOARD_X + (this.visX + cx) * CELL, BOARD_Y + (y - HIDDEN) * CELL, CELL, col, alpha);
    });
    // mecha de la bomba / brillo del prisma
    if ((a.bomb || a.hyperBomb) && Math.random() < sec * 40) {
      const [cx, cy] = shape[0];
      this.particles.emit({ x: BOARD_X + (this.visX + cx + 0.5) * CELL, y: BOARD_Y + (this.visY + cy - HIDDEN) * CELL, color: 0xffb020, count: 1, speed: 120, angle: -Math.PI / 2, spread: 1.2, life: 0.4, size: 5, gravity: -100 });
    }
    if (a.prism && !a.hyperBomb && Math.random() < sec * 30) {
      const [cx, cy] = shape[Math.floor(Math.random() * shape.length)];
      this.particles.emit({ x: BOARD_X + (this.visX + cx + 0.5) * CELL, y: BOARD_Y + (this.visY + cy - HIDDEN + 0.5) * CELL, color: hsv(Math.random(), 0.7, 1), count: 1, speed: 60, life: 0.6, size: 6, gravity: -60 });
    }
  }

  private drawMini(spec: PieceSpec, centerX: number, centerY: number, cs: number, alpha = 1) {
    const def: PieceDef = spec.def;
    const cells = def.shapes[0];
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = (maxX - minX + 1) * cs, h = (maxY - minY + 1) * cs;
    const ox = centerX - w / 2 - minX * cs;
    const oy = centerY - h / 2 - minY * cs;
    cells.forEach(([x, y], i) => this.placeCell(this.cells, ox + x * cs, oy + y * cs, cs, this.specColor(spec, i), alpha));
  }

  private drawSidePieces() {
    const g = this.game;
    const { hold, next } = this.queueSlots();
    const holdLocked = g.holdUsed && !g.mods.infiniteHold;
    g.hold.forEach((spec, i) => {
      const sl = hold[i];
      if (sl) this.drawMini(spec, sl.x + sl.s / 2, sl.y + sl.s / 2, PORTRAIT && sl.s < 56 ? 10 : 14, holdLocked ? 0.3 : 1);
    });
    const n = Math.min(next.length, g.queue.length);
    for (let i = 0; i < n; i++) {
      const sl = next[i];
      this.drawMini(g.hyperActive('flood') ? { ...g.queue[i], def: PIECES.I } : g.queue[i], sl.x + sl.s / 2, sl.y + sl.s / 2, i === 0 ? 14 : 10, i === 0 ? 1 : 0.8);
    }
  }

  private updateFx(sec: number) {
    this.trails.begin();
    for (let i = this.trailList.length - 1; i >= 0; i--) {
      const t = this.trailList[i];
      t.life -= sec;
      if (t.life <= 0) { this.trailList.splice(i, 1); continue; }
      const k = t.life / t.max;
      const s = this.trails.get();
      s.x = t.x + CELL * 0.1 + (1 - k) * CELL * 0.15;
      s.width = CELL * 0.8 * (0.4 + 0.6 * k);
      s.y = t.y0;
      s.height = Math.max(1, t.y1 - t.y0);
      s.tint = t.color;
      s.alpha = k * 0.85;
    }
    this.trails.end();

    this.flashes.begin();
    this.glows.begin();
    for (let i = this.flashList.length - 1; i >= 0; i--) {
      const f = this.flashList[i];
      f.life -= sec;
      if (f.life <= 0) { this.flashList.splice(i, 1); continue; }
      const k = f.life / f.max;
      const s = this.flashes.get();
      const grow = (1 - k) * 6;
      s.x = f.x - grow;
      s.y = f.y - grow * 0.5;
      s.width = f.w + grow * 2;
      s.height = f.h + grow;
      s.tint = f.color;
      s.alpha = k * k * 0.65;
      if (f.w > CELL) {
        const gl = this.glows.get();
        gl.anchor.set(0.5);
        gl.x = f.x + f.w / 2;
        gl.y = f.y + f.h / 2;
        gl.width = f.w * 1.6;
        gl.height = f.h * 4;
        gl.tint = f.color;
        gl.alpha = k * 0.5;
      }
    }
    this.flashes.end();
    this.glows.end();
  }

  private updatePost(sec: number, dtMs: number) {
    if (!this.highQuality) return;
    this.post.aberrate(this.trauma * this.trauma * 0.5);
    const hy = this.game.hyperLeft > 0 ? 0.35 + (REDUCED_MOTION ? 0 : 0.08 * Math.sin(this.time * 9)) : 0;
    this.post.update(sec, !REDUCED_MOTION, hy, HYPER_COLOR);
    // si el equipo no da la talla (ratos de más de 34 ms por fotograma durante 3 s), los efectos se apagan solos
    this.slowT = dtMs > 34 && this.game.state === 'playing' ? this.slowT + sec : Math.max(0, this.slowT - sec);
    if (this.slowT > 3) {
      this.slowT = 0;
      this.highQuality = false;
      this.applyQuality();
      this.floatText('EFECTOS APAGADOS: EL EQUIPO VA LENTO', BOARD_X + BOARD_W / 2, BOARD_Y + 60, { size: 16, life: 3 });
      this.onAutoOff?.();
    }
  }

  private updateFilters(sec: number) {
    for (const s of this.shocks) {
      if (!s.f.enabled) continue;
      s.t += sec;
      s.f.time = s.t;
      if (s.t >= s.dur) s.f.enabled = false;
    }
  }

  private updateTexts(sec: number) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const ft = this.texts[i];
      ft.life -= sec;
      if (ft.life <= 0) {
        ft.t.destroy();
        this.texts.splice(i, 1);
        continue;
      }
      if (ft.life > ft.max) continue; // retardo
      const age = ft.max - ft.life;
      const pop = age < 0.12 ? 0.3 + (age / 0.12) * 0.95 : age < 0.25 ? 1.25 - ((age - 0.12) / 0.13) * 0.25 : 1;
      ft.t.scale.set(pop * ft.baseScale);
      ft.t.y += ft.vy * sec;
      ft.t.alpha = Math.min(1, ft.life / (ft.max * 0.35), age / 0.06);
    }
  }

  private updateCamera(sec: number) {
    this.trauma = Math.max(0, this.trauma - sec * 1.4);
    const s = this.trauma * this.trauma;
    const t = this.time * 40;
    const sx = 18 * s * (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 2.7) * 0.4);
    const sy = 14 * s * (Math.cos(t * 1.7) * 0.6 + Math.sin(t * 3.1) * 0.4);
    this.kickY *= Math.exp(-sec * 14);
    this.punch *= Math.exp(-sec * 8);
    this.world.position.set(W / 2 + sx, H / 2 + sy + this.kickY);
    this.world.rotation = 0.025 * s * Math.sin(t * 0.9);
    this.world.scale.set(1 + this.punch);
  }

  /** Coordenadas de pantalla (lógicas) del tablero, para la UI DOM. */
  static boardRect() {
    return { x: BOARD_X, y: BOARD_Y, w: BOARD_W, h: BOARD_H };
  }

  cellCenter(c: Cell) {
    return { x: this.cx(c[0]), y: this.cy(c[1]) };
  }
}
