import { describe, expect, it } from 'vitest';
import { Game, GRAVITY_MS, type Replay } from './game';
import { runReplay } from './replay';
import { bestPlacement } from './bot';
import { makeRng } from './rng';

/**
 * Jugador de prueba: busca una buena colocación como el bot de equilibrio, pero llega a ella
 * con acciones normales (girar, mover, caída rápida, reserva) repartidas entre pasos de simulación,
 * y a veces deja que la pieza caiga sola. Así la partida sube de nivel, elige cartas y ve basura.
 */
function playHuman(seed: number, maxSteps = 200_000): Game {
  const g = new Game();
  g.bestLevel = seed % 2 ? Infinity : 0;
  g.start(seed);
  const r = makeRng(seed * 7 + 3);
  let piece: unknown = null;
  let target: { rot: number; x: number } | null = null;
  let tries = 0;
  while (g.state !== 'over' && g.steps < maxSteps) {
    if (g.state === 'choosing') {
      if (g.rerolls > 0 && r() < 0.3) g.reroll();
      else g.choosePerk(Math.floor(r() * g.choices.length));
      continue;
    }
    const a = g.active!;
    if (a !== piece) {
      piece = a;
      tries = 0;
      if (r() < 0.05) g.holdPiece();
      target = g.active ? bestPlacement(g) : null;
    }
    const k = r();
    if (k < 0.5 && g.active && target) {
      const p = g.active;
      if (tries++ > 40) g.hardDrop();
      else if (p.rot !== target.rot) g.rotate(1);
      else if (p.x < target.x) g.move(1);
      else if (p.x > target.x) g.move(-1);
      else if (r() < 0.7) g.hardDrop();
      else g.softDropping = true;
    } else if (k < 0.52) g.softDropping = !g.softDropping;
    g.step();
  }
  return g;
}

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
    const base: Replay = { version: 1, seed: 42, bestLevel: 0, steps: 1, actions: [] };
    expect(runReplay(base).ok).toBe(true);
    const bad: unknown[] = [
      [0, 'move', 3],
      [0, 'move', 0.5],
      [0, 'rotate', 3],
      [0, 'soft', 2],
      [0, 'pick', 3],
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
