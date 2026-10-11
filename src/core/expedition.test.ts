import { describe, expect, it } from 'vitest';
import { buy, CHALLENGES, level, lockedPerks, newUnlocks, nextCost, shardsFor, UPGRADES, type ExpeditionSave, type RunStats } from './expedition';
import { PERK_BY_ID } from './perks';
import { Game } from './game';
import { runReplay } from './replay';
import { isRankedMode } from '../../server/validate';

const save = (shards: number): ExpeditionSave => ({ shards, owned: {}, unlocked: [], runs: 0 });
const stats = (o: Partial<RunStats> = {}): RunStats => ({ quads: 0, spins: 0, maxCombo: 0, level: 1, lines: 0, timeMs: 0, ...o });

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

  it('cada reto abre un perk que existe', () => {
    for (const c of CHALLENGES) expect(PERK_BY_ID[c.perk]).toBeDefined();
  });

  it('un reto se cumple y no se repite', () => {
    expect(newUnlocks([], stats({ quads: 3 }))).toEqual(['cross']);
    expect(newUnlocks(['cross'], stats({ quads: 3 }))).toEqual([]);
    expect(newUnlocks([], stats())).toEqual([]);
  });

  it('los perks bloqueados no salen en las ofertas de la Expedición y sí en el arcade', () => {
    const locked = lockedPerks([]);
    expect(locked.has('cross')).toBe(true);
    expect(lockedPerks(['cross']).has('cross')).toBe(false);
    for (let seed = 1; seed <= 40; seed++) {
      const g = new Game();
      g.start(seed, 'expedition', {}, []);
      g.bestLevel = 9999;
      g.pendingLevelUps = 1;
      g.rerolls = 999;
      (g as unknown as { beginChoice(): void }).beginChoice();
      for (let i = 0; i < 20; i++) {
        g.reroll();
        for (const c of g.choices) expect(locked.has(c.id)).toBe(false);
      }
    }
    const arcade = new Game();
    arcade.start(3, 'normal');
    expect(arcade.lockedPerks.size).toBe(0);
  });

  it('el arcade ignora los desbloqueos: mismas cartas con o sin ellos', () => {
    const offers = (unlocked: string[]) => {
      const g = new Game();
      g.start(7, 'normal', {}, unlocked);
      g.bestLevel = 9999;
      g.rerolls = 999;
      (g as unknown as { beginChoice(): void }).beginChoice();
      const out = [g.choices.map((c) => c.id)];
      for (let i = 0; i < 10; i++) {
        g.reroll();
        out.push(g.choices.map((c) => c.id));
      }
      return out;
    };
    expect(offers([])).toEqual(offers(['cross', 'bomb']));
  });
});
