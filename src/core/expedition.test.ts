import { describe, expect, it } from 'vitest';
import { buy, level, nextCost, shardsFor, UPGRADES, type ExpeditionSave } from './expedition';
import { Game } from './game';
import { runReplay } from './replay';
import { isRankedMode } from '../../server/validate';

const save = (shards: number): ExpeditionSave => ({ shards, owned: {}, runs: 0 });

describe('expedición', () => {
  it('comprar gasta fragmentos y sube un nivel; sin fragmentos no se puede', () => {
    expect(buy(save(10), 'reroll')).toBeNull();
    const s = buy(save(50), 'reroll')!;
    expect(s.shards).toBe(20);
    expect(level(s.owned, 'reroll')).toBe(1);
  });

  it('no se pasa del nivel máximo', () => {
    let s: ExpeditionSave | null = save(99999);
    for (let i = 0; i < 10; i++) s = buy(s!, 'vida') ?? s;
    expect(level(s!.owned, 'vida')).toBe(1);
    expect(nextCost(s!.owned, 'vida')).toBeNull();
  });

  it('los fragmentos suben con el nivel y las líneas', () => {
    expect(shardsFor(1, 0)).toBeLessThan(shardsFor(3, 0));
    expect(shardsFor(3, 0)).toBeLessThan(shardsFor(3, 10));
  });

  it('las mejoras cambian las reglas solo en la Expedición', () => {
    const owned = { reroll: 2, vista: 1, aguante: 1, calma: 1, ritmo: 1, vida: 1 } as const;
    const base = new Game();
    base.start(7, 'normal', { ...owned });
    expect(base.rerolls).toBe(1);
    expect(base.lives).toBe(0);
    expect(base.mods.preview).toBe(3);

    const exp = new Game();
    exp.start(7, 'expedition', { ...owned });
    expect(exp.rerolls).toBe(3);
    expect(exp.lives).toBe(1);
    expect(exp.mods.preview).toBe(4);
    expect(exp.mods.lockDelay).toBe(560);
    expect(exp.mods.linesReduction).toBe(1);
    expect(exp.mods.garbageDelay).toBe(1);
  });

  it('Buen arranque da una mejora al empezar', () => {
    const g = new Game();
    g.start(7, 'expedition', { arranque: 1 });
    expect(g.perkOrder.length).toBe(1);
  });

  it('el ranking y las repeticiones rechazan el modo', () => {
    expect(isRankedMode('expedition')).toBe(false);
    const g = new Game();
    g.start(7, 'expedition', {});
    expect(runReplay(g.replay()).ok).toBe(false);
  });

  it('todas las mejoras tienen coste', () => {
    for (const u of UPGRADES) expect(u.costs.length).toBeGreaterThan(0);
  });
});
