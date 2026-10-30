import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game, RULES_VERSION, type Replay } from './core/game';
import { checkReplay, replayInto } from './core/replay';
import { playHuman } from './core/testplayer';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const snapshot = (g: Game) => ({
  score: g.score,
  level: g.level,
  lines: g.lines,
  steps: g.steps,
  state: g.state,
  perks: g.perkOrder.join(','),
  piece: g.active ? `${g.active.def.name}@${g.active.x},${g.active.y},${g.active.rot}` : '',
  board: g.board.map((row) => row.join(',')).join('|'),
});

/** La partida de `seed` cortada justo después de una caída del medio, como si se hubiera pausado ahí. */
function midRun(seed: number): { full: Game; cut: Replay } {
  const full = playHuman(seed);
  const r = full.replay();
  const drops = r.actions.filter((a) => a[1] === 'drop');
  const at = drops[Math.floor(drops.length / 2)][0];
  return { full, cut: { ...r, actions: r.actions.filter((a) => a[0] <= at), steps: at } };
}

describe('reanudar una partida', () => {
  it('re-simular el guardado deja el juego donde estaba y sin avisar a nadie', () => {
    const { cut } = midRun(5);
    const g = new Game();
    let events = 0;
    for (const name of ['lock', 'clear', 'move', 'levelup', 'perk', 'offer', 'harddrop'] as const) g.events.on(name, () => events++);
    const res = replayInto(g, cut);
    expect(res.ok, res.reason).toBe(true);
    expect(events).toBe(0);
    expect(g.events.silent).toBe(false);
    expect(g.state).toBe('playing');
    expect(g.steps).toBe(cut.steps);
    // y las acciones vuelven a quedar grabadas: se puede guardar otra vez o publicar al acabar
    expect(g.replay().actions).toEqual(cut.actions);
  });

  it('la partida reanudada y la jugada sin parar son la misma', () => {
    for (const seed of [1, 2, 3]) {
      const { full, cut } = midRun(seed);
      const a = new Game();
      replayInto(a, cut);
      // sigue jugando con las acciones que quedaban
      const rest = full.replay().actions.filter((x) => x[0] > cut.steps);
      const b = new Game();
      replayInto(b, { ...cut, actions: [...cut.actions, ...rest], steps: full.steps });
      expect(snapshot(b)).toEqual(snapshot(full));
      expect(snapshot(a).steps).toBe(cut.steps);
    }
  }, 60_000);

  it('una repetición editada a mano no pasa la comprobación', () => {
    const { cut } = midRun(9);
    expect(checkReplay(cut)).toBeNull();
    expect(checkReplay({ ...cut, seed: -1 })).not.toBeNull();
    expect(checkReplay({ ...cut, steps: -5 })).not.toBeNull();
    expect(checkReplay({ ...cut, mode: 'nope' as never })).not.toBeNull();
  });
});

describe('guardado en el navegador', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.resetModules();
  });

  const sample = (replay: Replay) => ({
    v: 1 as const, rules: RULES_VERSION, replay, date: '2026-10-13', startedAt: 1, savedAt: 2, score: 10, level: 2,
  });

  it('guarda, lee y vuelve a leer lo mismo', async () => {
    const s = await import('./savedrun');
    const { cut } = midRun(4);
    expect(s.loadSave().run).toBeNull();
    expect(s.writeSave(sample(cut))).toBe(true);
    const l = s.loadSave();
    expect(l.run?.replay.steps).toBe(cut.steps);
    expect(l.discarded).toBeUndefined();
  });

  it('descarta con aviso un guardado de otras reglas y lo borra', async () => {
    const s = await import('./savedrun');
    const { cut } = midRun(4);
    s.writeSave({ ...sample(cut), rules: RULES_VERSION - 1 });
    const l = s.loadSave();
    expect(l.run).toBeNull();
    expect(l.discarded).toMatch(/versión anterior|older version/);
    expect(s.hasSave()).toBe(false);
  });

  it('descarta un guardado roto, del tutorial o de laboratorio', async () => {
    const s = await import('./savedrun');
    const { cut } = midRun(4);
    localStorage.setItem('blockrogue.save', '{no es json');
    expect(s.loadSave().discarded).toBeTruthy();
    s.writeSave(sample({ ...cut, mode: 'tutorial' }));
    expect(s.loadSave().run).toBeNull();
    s.writeSave(sample({ ...cut, sandbox: true }));
    expect(s.loadSave().run).toBeNull();
  });

  it('avisa si el navegador no deja guardar', async () => {
    const s = await import('./savedrun');
    const { cut } = midRun(4);
    vi.stubGlobal('localStorage', { ...memoryStorage(), setItem: () => { throw new Error('lleno'); } });
    expect(s.writeSave(sample(cut))).toBe(false);
  });
});
