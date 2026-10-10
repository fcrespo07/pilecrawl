import { describe, expect, it } from 'vitest';
import { Game, GRAVITY_MS, RULES_VERSION, type Replay } from './game';
import { runReplay } from './replay';
import { playHuman } from './testplayer';

const snapshot = (g: Game) => ({
  score: g.score,
  level: g.level,
  lines: g.lines,
  state: g.state,
  perks: g.perkOrder.join(','),
  board: g.board.map((row) => row.join(',')).join('|'),
});

describe('repeticiones', () => {
  it('la misma semilla da la misma cola de piezas', () => {
    const a = new Game();
    const b = new Game();
    a.start(42);
    b.start(42);
    expect(a.queue.map((s) => s.def.name)).toEqual(b.queue.map((s) => s.def.name));
  });

  it('rejugar las acciones grabadas da exactamente la misma partida', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const g = playHuman(seed);
      const result = runReplay(g.replay());
      expect(result.ok, result.reason).toBe(true);
      expect(snapshot(result.game)).toEqual(snapshot(g));
    }
  }, 60_000);

  it('la repetición sobrevive a JSON, que es como viajará al servidor', () => {
    const g = playHuman(99);
    const wire = JSON.parse(JSON.stringify(g.replay())) as Replay;
    expect(snapshot(runReplay(wire).game)).toEqual(snapshot(g));
  });

  it('una puntuación inventada no cuadra: el servidor recalcula y sale otra', () => {
    const g = playHuman(7);
    const r = g.replay();
    // quitar una caída instantánea cambia el resto de la partida
    const i = r.actions.findIndex((a) => a[1] === 'drop');
    const tampered: Replay = { ...r, actions: r.actions.filter((_, j) => j !== i) };
    expect(snapshot(runReplay(tampered).game)).not.toEqual(snapshot(g));
  });

  it('rechaza repeticiones de otra versión de las reglas', () => {
    const r = playHuman(3).replay();
    expect(runReplay({ ...r, version: r.version + 1 }).ok).toBe(false);
  });

  it('rechaza acciones que el juego real no produce', () => {
    const base: Replay = { version: RULES_VERSION, seed: 42, bestLevel: 0, steps: 1, actions: [] };
    expect(runReplay(base).ok).toBe(true);
    const bad: unknown[] = [
      [0, 'move', 3],
      [0, 'move', 0.5],
      [0, 'rotate', 3],
      [0, 'soft', 2],
      [0, 'pick', 4],
      [0, 'drop', 1],
      [-1, 'drop'],
      [0.5, 'hold'],
      [0, 'teleport'],
      'move',
    ];
    for (const a of bad) {
      const r = runReplay({ ...base, actions: [a as Replay['actions'][number]] });
      expect(r.ok, JSON.stringify(a)).toBe(false);
    }
    // pasos que van hacia atrás
    expect(runReplay({ ...base, steps: 10, actions: [[5, 'drop'], [3, 'drop']] }).ok).toBe(false);
    expect(runReplay({ ...base, seed: -1 }).ok).toBe(false);
  });

  it('la tabla de gravedad es la curva de siempre', () => {
    GRAVITY_MS.forEach((ms, i) => {
      const gl = 1 + i * 0.8;
      expect(ms).toBeCloseTo(Math.pow(Math.max(0.05, 0.8 - (gl - 1) * 0.007), gl - 1) * 1000, 9);
    });
  });
});
