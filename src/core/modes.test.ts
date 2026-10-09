import { describe, expect, it } from 'vitest';
import { Game, STEP_MS, type Replay } from './game';
import { dailyNumber, dailySeed, isModeId, MODES, utcDate } from './modes';
import { runReplay } from './replay';

/** Avanza la partida soltando una pieza de vez en cuando y eligiendo siempre la primera carta. */
function play(g: Game, steps: number) {
  for (let i = 0; i < steps && g.state !== 'over'; i++) {
    if (g.state === 'choosing') g.choosePerk(0);
    else if (i % 90 === 0) g.hardDrop();
    g.step();
  }
}

describe('modos', () => {
  it('reconoce solo los modos que existen', () => {
    expect(isModeId('daily')).toBe(true);
    expect(isModeId('toString')).toBe(false);
    expect(isModeId(3)).toBe(false);
  });

  it('el desafío diario da la misma semilla todo el día y otra al siguiente', () => {
    expect(dailySeed('2026-10-09')).toBe(dailySeed('2026-10-09'));
    expect(dailySeed('2026-10-09')).not.toBe(dailySeed('2026-10-10'));
    expect(dailyNumber('2026-10-09')).toBe(1);
    expect(dailyNumber('2027-10-09')).toBe(366);
    expect(utcDate(new Date(Date.UTC(2026, 11, 31, 23, 59)))).toBe('2026-12-31');
  });

  it('el desafío diario empieza con la misma mejora para todos y desbloqueos fijos', () => {
    const a = new Game();
    const b = new Game();
    a.bestLevel = 0;
    b.bestLevel = 50;
    a.start(dailySeed('2026-10-09'), 'daily');
    b.start(dailySeed('2026-10-09'), 'daily');
    expect(a.perkOrder).toHaveLength(1);
    expect(a.perkOrder).toEqual(b.perkOrder);
    expect(a.bestLevel).toBe(MODES.daily.fixedBestLevel);
    expect(a.queue.map((s) => s.def.name)).toEqual(b.queue.map((s) => s.def.name));
    const rarity = Game.perkDef(a.perkOrder[0]).rarity;
    expect(['common', 'rare']).toContain(rarity);
  });

  it('el contrarreloj termina justo al llegar al límite de tiempo', () => {
    const g = new Game();
    g.start(7, 'timed');
    const limit = g.timeLimitSteps();
    expect(limit).toBe(Math.round(MODES.timed.timeLimitMs / STEP_MS));
    expect(g.timeLeftMs()).toBeCloseTo(MODES.timed.timeLimitMs, 6);
    // la pausa y la elección de carta no gastan tiempo: solo cuentan los pasos jugados
    g.steps = limit - 2;
    g.step();
    expect(g.state).toBe('playing');
    g.step();
    expect(g.steps).toBe(limit);
    expect(g.timeLeftMs()).toBe(0);
    expect(g.state).toBe('over');
    expect(g.endReason).toBe('time');
    g.step();
    expect(g.steps).toBe(limit);
  });

  it('los modos sin límite no acaban por tiempo', () => {
    const g = new Game();
    g.start(7);
    expect(g.timeLimitSteps()).toBe(0);
    expect(g.timeLeftMs()).toBe(Infinity);
  });

  it('las repeticiones guardan el modo y se rejuegan igual', () => {
    for (const mode of ['daily', 'timed'] as const) {
      const g = new Game();
      g.bestLevel = 0;
      g.start(dailySeed('2026-10-09'), mode);
      play(g, 30_000);
      const r = JSON.parse(JSON.stringify(g.replay())) as Replay;
      expect(r.mode).toBe(mode);
      const res = runReplay(r);
      expect(res.ok, res.reason).toBe(true);
      expect(res.game.score).toBe(g.score);
      expect(res.game.state).toBe(g.state);
      expect(res.game.endReason).toBe(g.endReason);
      expect(res.game.perkOrder).toEqual(g.perkOrder);
    }
  });

  it('el diario ignora el nivel de desbloqueo que diga la repetición', () => {
    const g = new Game();
    g.start(99, 'daily');
    play(g, 2_000);
    const r = { ...g.replay(), bestLevel: 0 };
    const res = runReplay(r);
    expect(res.ok, res.reason).toBe(true);
    expect(res.game.bestLevel).toBe(MODES.daily.fixedBestLevel);
  });

  it('una repetición sin modo es una partida normal y una con modo inventado no vale', () => {
    const base: Replay = { version: 1, seed: 42, bestLevel: 0, steps: 1, actions: [] };
    const res = runReplay(base);
    expect(res.ok).toBe(true);
    expect(res.game.mode).toBe('normal');
    expect(runReplay({ ...base, mode: 'zen' as never }).ok).toBe(false);
  });
});
