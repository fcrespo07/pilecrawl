import { describe, expect, it } from 'vitest';
import { COLS, Game } from './core/game';
import { bestPlacement } from './mouse';

describe('ratón: colocación sugerida', () => {
  it('lleva la pieza a la columna pedida y cabe en el tablero', () => {
    const g = new Game();
    g.start(1234, 'normal');
    for (let col = 0; col < COLS; col++) {
      const p = bestPlacement(g, col, null)!;
      expect(p).not.toBeNull();
      expect(g.collides(g.active!.def, p.x, g.active!.y, p.rot)).toBe(false);
    }
  });

  it('respeta el giro manual', () => {
    const g = new Game();
    g.start(1234, 'normal');
    expect(bestPlacement(g, 5, 2)!.rot).toBe(2);
  });

  it('el clic usa las mismas acciones y la repetición se verifica', () => {
    const g = new Game();
    g.start(99, 'normal');
    const p = bestPlacement(g, 3, null)!;
    const a = g.active!;
    const diff = (p.rot - a.rot + 4) % 4;
    for (let i = 0; i < diff; i++) g.rotate(1);
    while (a.x !== p.x && g.move(Math.sign(p.x - a.x)));
    g.hardDrop();
    expect(g.actions.length).toBeGreaterThan(0);
    expect(g.actions.every((x) => ['move', 'rotate', 'drop'].includes(x[1] as string))).toBe(true);
  });
});
