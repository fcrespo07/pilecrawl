import { describe, expect, it } from 'vitest';
import { COLS, Game } from './core/game';
import { runReplay } from './core/replay';
import { bestPlacement, commitPlacement, steer } from './mouse';

describe('ratón: colocación sugerida', () => {
  it('lo que se previsualiza es donde queda la pieza al hacer clic, y la repetición se verifica', () => {
    for (const seed of [1, 7, 99, 1234, 31337]) {
      const g = new Game();
      g.start(seed, 'normal');
      for (let n = 0; n < 60 && g.state === 'playing'; n++) {
        const forced = n % 3 === 0 ? n % 4 : null;
        const p = bestPlacement(g, (n * 5 + seed) % COLS, forced);
        if (!p) {
          g.hardDrop();
          continue;
        }
        steer(g, p);
        expect({ x: g.active!.x, rot: g.active!.rot }).toEqual({ x: p.x, rot: p.rot });
        g.hardDrop();
      }
      const r = runReplay(g.replay());
      expect(r.ok).toBe(true);
      expect(r.game.score).toBe(g.score);
    }
  });

  it('respeta el giro manual cuando es posible', () => {
    const g = new Game();
    g.start(1234, 'normal');
    const p = bestPlacement(g, 5, 2);
    if (p) expect(p.rot).toBe(2);
  });

  it('commitPlacement suelta la pieza', () => {
    const g = new Game();
    g.start(5, 'normal');
    const before = g.piecesLocked;
    commitPlacement(g, bestPlacement(g, 3, null)!);
    expect(g.piecesLocked).toBe(before + 1);
  });
});
