import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { runReplay } from './replay';

function run() {
  const g = new Game();
  g.start(7);
  return g;
}

describe('laboratorio', () => {
  it('añadir y quitar mejoras recalcula los efectos y marca la partida', () => {
    const g = run();
    expect(g.sandbox).toBe(false);
    g.labAddPerk('calm');
    g.labAddPerk('calm');
    expect(g.sandbox).toBe(true);
    expect(g.perkStacks('calm')).toBe(2);
    expect(g.mods.gravitySpeed).toBeCloseTo(0.94 * 0.94);
    g.labRemovePerk('calm');
    expect(g.mods.gravitySpeed).toBeCloseTo(0.94);
    g.labRemovePerk('calm');
    expect(g.mods.gravitySpeed).toBe(1);
    expect(g.perkOrder).not.toContain('calm');
  });

  it('respeta el máximo de copias y no toca vidas ni rerolls al añadir o quitar', () => {
    const g = run();
    for (let i = 0; i < 20; i++) g.labAddPerk('calm');
    expect(g.perkStacks('calm')).toBe(3);
    g.labSet({ lives: 2, rerolls: 4 });
    g.labAddPerk('c_lead');
    g.labRemovePerk('calm');
    expect(g.lives).toBe(2);
    expect(g.rerolls).toBe(4);
  });

  it('la caída del laboratorio cambia la gravedad y labClearPerks lo deja limpio', () => {
    const g = run();
    const base = g.gravityMs();
    g.labSet({ gravity: 2 });
    expect(g.gravityMs()).toBeCloseTo(base / 2);
    g.labAddPerk('calm');
    g.labClearPerks();
    expect(g.perkOrder).toEqual([]);
    expect(g.mods.gravitySpeed).toBe(1);
  });

  it('la hiperperk del laboratorio sale cargada y se puede soltar', () => {
    const g = run();
    g.labSetHyper('frenzy');
    expect(g.hyperReady()).toBe(true);
    expect(g.activateHyper()).toBe(true);
    g.labSetHyper(null);
    expect(g.hyper).toBeNull();
  });

  it('la repetición de una partida de laboratorio se rechaza', () => {
    const g = run();
    g.labSet({ level: 5 });
    expect(g.replay().sandbox).toBe(true);
    const r = runReplay(g.replay());
    expect(r.ok).toBe(false);
    expect(run().replay().sandbox).toBeUndefined();
  });
});
