import type { Game } from './core/game';
import type { Input } from './input';

/** Lo que el controlador necesita saber del escenario para convertir píxeles de pantalla en celdas. */
export interface GestureView {
  /** Rectángulo del lienzo en pantalla. */
  rect(): DOMRect;
  /** Ancho lógico del escenario y tamaño de celda lógico. */
  logicalW(): number;
  cell(): number;
  /** Zona de la reserva (coordenadas lógicas): tocarla guarda la pieza. */
  holdBox(): { x: number; y: number; w: number; h: number };
}

/** Un dedo sobre el tablero (la pieza que cae) o fuera de él: sigue al dedo. */
interface Track {
  id: number;
  x0: number;
  y0: number;
  t0: number;
  anchorX: number;
  axis: '' | 'h' | 'v';
  samples: { y: number; t: number }[];
  soft: boolean;
}

const TAP_MOVE_PX = 10;
const TAP_MS = 300;
const AXIS_PX = 12;
/** Velocidad mínima (px/ms) al soltar para que un gesto hacia abajo sea un golpe y no una bajada lenta. */
const FLICK_SPEED = 0.9;
const SAMPLE_MS = 90;
/** Guardar: o un deslizamiento largo, o uno corto pero rápido (un reajuste lento del dedo no debe gastar la reserva). */
const HOLD_LONG_CELLS = 2.5;
const HOLD_SHORT_CELLS = 1.5;
const HOLD_SPEED = 0.5;

/**
 * Controles táctiles por gestos, como los de los Tetris de móvil: arrastrar a los lados mueve la pieza una
 * celda por cada celda de dedo, arrastrar despacio hacia abajo la baja, un tirón rápido hacia abajo la suelta,
 * deslizar hacia arriba la guarda y tocar la gira. Un segundo dedo que toca también gira (para girar sin soltar
 * el arrastre). Solo traduce a las mismas acciones que el teclado: no cambia reglas ni repeticiones.
 */
export class Gestures {
  private main: Track | null = null;

  constructor(private el: HTMLElement, private game: Game, private input: Input, private view: GestureView) {
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.cancel(e));
  }

  /** Al pausar, abrir menús o cambiar de pantalla: se olvida el gesto en curso. */
  reset() {
    if (this.main?.soft) this.input.softDrop(false);
    this.main = null;
  }

  private cellPx(): number {
    return (this.view.cell() * this.view.rect().width) / this.view.logicalW();
  }

  private down(e: PointerEvent) {
    if (e.pointerType === 'mouse' || this.game.state !== 'playing') return;
    e.preventDefault();
    if (this.main) {
      // segundo dedo: tocar gira sin interrumpir el arrastre
      this.second = { id: e.pointerId, t: e.timeStamp };
      this.el.setPointerCapture(e.pointerId);
      return;
    }
    this.el.setPointerCapture(e.pointerId);
    const now = e.timeStamp;
    this.main = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: now, anchorX: e.clientX, axis: '', samples: [{ y: e.clientY, t: now }], soft: false };
  }

  private second: { id: number; t: number } | null = null;

  private move(e: PointerEvent) {
    const m = this.main;
    if (!m || e.pointerId !== m.id || this.game.state !== 'playing') return;
    const now = e.timeStamp;
    m.samples.push({ y: e.clientY, t: now });
    while (m.samples.length > 2 && now - m.samples[0].t > SAMPLE_MS) m.samples.shift();
    const dx = e.clientX - m.x0;
    const dy = e.clientY - m.y0;
    if (!m.axis) {
      if (Math.hypot(dx, dy) < AXIS_PX) return;
      m.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    const cell = this.cellPx();
    if (m.axis === 'h') {
      // una celda por cada celda de dedo; el sobrante se arrastra al siguiente paso
      const steps = Math.trunc((e.clientX - m.anchorX) / cell);
      for (let i = 0; i < Math.abs(steps); i++) this.input.touchStep(Math.sign(steps));
      m.anchorX += steps * cell;
    } else {
      // la bajada suave solo con el dedo despacio: un tirón rápido va directo a soltar, sin registrar bajadas
      const first = m.samples[0];
      const vy = (e.clientY - first.y) / Math.max(1, now - first.t);
      const soft = dy > cell * 0.6 && vy < FLICK_SPEED * 0.6;
      if (soft !== m.soft) {
        m.soft = soft;
        this.input.softDrop(soft);
      }
    }
  }

  private up(e: PointerEvent) {
    if (this.second && e.pointerId === this.second.id) {
      if (e.timeStamp - this.second.t < TAP_MS && this.game.state === 'playing') this.input.touchDown('cw');
      this.second = null;
      return;
    }
    const m = this.main;
    if (!m || e.pointerId !== m.id) return;
    this.main = null;
    if (m.soft) this.input.softDrop(false);
    if (this.game.state !== 'playing') return;
    const now = e.timeStamp;
    const dx = e.clientX - m.x0;
    const dy = e.clientY - m.y0;
    const cell = this.cellPx();
    if (Math.hypot(dx, dy) < TAP_MOVE_PX && now - m.t0 < TAP_MS) {
      if (this.onHold(e)) this.input.touchDown('hold');
      else this.input.touchDown('cw');
      return;
    }
    if (m.axis !== 'v') return;
    const first = m.samples[0];
    const vy = (e.clientY - first.y) / Math.max(1, now - first.t);
    if (dy < -cell * HOLD_LONG_CELLS || (dy < -cell * HOLD_SHORT_CELLS && -vy >= HOLD_SPEED)) {
      this.input.touchDown('hold');
      return;
    }
    if (dy > cell * 2 && vy >= FLICK_SPEED) this.input.touchDown('hard');
  }

  private cancel(e: PointerEvent) {
    if (this.second && e.pointerId === this.second.id) this.second = null;
    if (this.main && e.pointerId === this.main.id) this.reset();
  }

  private onHold(e: PointerEvent): boolean {
    const r = this.view.rect();
    const lx = ((e.clientX - r.left) / r.width) * this.view.logicalW();
    const ly = ((e.clientY - r.top) / r.width) * this.view.logicalW();
    const b = this.view.holdBox();
    return lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h;
  }
}
