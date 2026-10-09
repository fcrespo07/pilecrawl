import type { Game } from './core/game';

export interface Handling {
  das: number; // ms hasta que empieza el autorepeat
  arr: number; // ms entre repeticiones (0 = instantáneo)
}

const LEFT = ['ArrowLeft'];
const RIGHT = ['ArrowRight'];
const DOWN = ['ArrowDown'];
const HARD = ['Space'];
const CW = ['ArrowUp', 'KeyX'];
const CCW = ['KeyZ', 'ControlLeft', 'ControlRight'];
const R180 = ['KeyA'];
const HOLD = ['KeyC', 'ShiftLeft', 'ShiftRight'];
const ALL = [...LEFT, ...RIGHT, ...DOWN, ...HARD, ...CW, ...CCW, ...R180, ...HOLD];

/** Acciones de juego que pueden venir de botones táctiles en pantalla. */
export type TouchAction = 'left' | 'right' | 'down' | 'hard' | 'cw' | 'ccw' | 'r180' | 'hold';

/** Tecla que representa cada acción táctil, para reutilizar la misma lógica que el teclado. */
const TOUCH_CODE: Record<TouchAction, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  down: 'ArrowDown',
  hard: 'Space',
  cw: 'ArrowUp',
  ccw: 'KeyZ',
  r180: 'KeyA',
  hold: 'KeyC',
};

/** Teclado y táctil con DAS/ARR estilo guideline. */
export class Input {
  handling: Handling = { das: 130, arr: 25 };
  private dir = 0;
  private dasTimer = 0;
  private arrTimer = 0;
  private leftHeld = false;
  private rightHeld = false;

  constructor(private game: Game) {}

  keyDown(e: KeyboardEvent): boolean {
    return this.press(e.code, e.repeat);
  }

  keyUp(e: KeyboardEvent) {
    this.release(e.code);
  }

  touchDown(action: TouchAction) {
    this.press(TOUCH_CODE[action], false);
  }

  touchUp(action: TouchAction) {
    this.release(TOUCH_CODE[action]);
  }

  /** Al pausar o abrir menús: olvida lo que estaba pulsado. */
  releaseAll() {
    this.leftHeld = this.rightHeld = false;
    this.dir = 0;
    this.game.softDropping = false;
  }

  private press(c: string, repeat: boolean): boolean {
    const g = this.game;
    if (g.state !== 'playing') return false;
    if (repeat) return ALL.includes(c);
    if (LEFT.includes(c)) {
      this.leftHeld = true;
      this.startDir(-1);
    } else if (RIGHT.includes(c)) {
      this.rightHeld = true;
      this.startDir(1);
    } else if (DOWN.includes(c)) g.softDropping = true;
    else if (HARD.includes(c)) g.hardDrop();
    else if (CW.includes(c)) g.rotate(1);
    else if (CCW.includes(c)) g.rotate(-1);
    else if (R180.includes(c)) g.rotate(2);
    else if (HOLD.includes(c)) g.holdPiece();
    else return false;
    return true;
  }

  private release(c: string) {
    if (LEFT.includes(c)) {
      this.leftHeld = false;
      if (this.dir === -1) this.rightHeld ? this.startDir(1) : (this.dir = 0);
    } else if (RIGHT.includes(c)) {
      this.rightHeld = false;
      if (this.dir === 1) this.leftHeld ? this.startDir(-1) : (this.dir = 0);
    } else if (DOWN.includes(c)) this.game.softDropping = false;
  }

  private startDir(d: number) {
    this.dir = d;
    this.dasTimer = 0;
    this.arrTimer = 0;
    this.game.move(d);
  }

  update(dt: number) {
    if (this.dir === 0 || this.game.state !== 'playing') return;
    this.dasTimer += dt;
    if (this.dasTimer < this.handling.das) return;
    if (this.handling.arr === 0) {
      while (this.game.move(this.dir));
      return;
    }
    this.arrTimer += dt;
    while (this.arrTimer >= this.handling.arr) {
      this.arrTimer -= this.handling.arr;
      if (!this.game.move(this.dir)) {
        this.arrTimer = 0;
        break;
      }
    }
  }
}
