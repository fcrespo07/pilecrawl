import type { Game } from './core/game';
import { actionOf, handling, type Action } from './settings';

/** Acciones de juego que pueden venir de botones táctiles en pantalla. */
export type TouchAction = Action;

/** Teclado y táctil con DAS/ARR estándar del género. */
export class Input {
  /** Manejo (DAS/ARR): el de los ajustes, que se cambia en vivo. */
  handling = handling;
  private dir = 0;
  private dasTimer = 0;
  private arrTimer = 0;
  private leftHeld = false;
  private rightHeld = false;

  constructor(private game: Game) {}

  keyDown(e: KeyboardEvent): boolean {
    const a = actionOf(e.code);
    return a !== null && this.press(a, e.repeat);
  }

  keyUp(e: KeyboardEvent) {
    const a = actionOf(e.code);
    if (a) this.release(a);
  }

  touchDown(action: TouchAction) {
    this.press(action, false);
  }

  touchUp(action: TouchAction) {
    this.release(action);
  }

  /** Arrastre lateral: un paso suelto, sin autorepetición (el dedo ya marca el ritmo). */
  touchStep(dir: number) {
    if (this.game.state === 'playing') this.game.move(dir);
  }

  /** Bajada suave mientras el dedo arrastra hacia abajo. */
  softDrop(on: boolean) {
    this.game.softDropping = on && this.game.state === 'playing';
  }

  /** Al pausar o abrir menús: olvida lo que estaba pulsado. */
  releaseAll() {
    this.leftHeld = this.rightHeld = false;
    this.dir = 0;
    this.game.softDropping = false;
  }

  private press(a: Action, repeat: boolean): boolean {
    const g = this.game;
    if (g.state !== 'playing') return false;
    if (repeat) return true;
    switch (a) {
      case 'left':
        this.leftHeld = true;
        this.startDir(-1);
        break;
      case 'right':
        this.rightHeld = true;
        this.startDir(1);
        break;
      case 'down': g.softDropping = true; break;
      case 'hard': g.hardDrop(); break;
      case 'cw': g.rotate(1); break;
      case 'ccw': g.rotate(-1); break;
      case 'r180': g.rotate(2); break;
      case 'hold': g.holdPiece(); break;
      case 'hyper': g.activateHyper(); break;
      case 'skill': g.useSkill(); break;
    }
    return true;
  }

  private release(a: Action) {
    if (a === 'left') {
      this.leftHeld = false;
      if (this.dir === -1) this.rightHeld ? this.startDir(1) : (this.dir = 0);
    } else if (a === 'right') {
      this.rightHeld = false;
      if (this.dir === 1) this.leftHeld ? this.startDir(-1) : (this.dir = 0);
    } else if (a === 'down') this.game.softDropping = false;
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
