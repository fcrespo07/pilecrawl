import { describe, expect, it } from 'vitest';
import { baseMods } from './perks';
import { CURSES, isUnlocked, PERKS, PERK_BY_ID, rollOffer, rollPerks } from './perks';
import { makeRng } from './rng';
import { Game } from './game';

describe('perks', () => {
  it('los ids son únicos', () => {
    expect(new Set(PERKS.map((p) => p.id)).size).toBe(PERKS.length);
  });

  it('cada perk tiene al menos una ventaja', () => {
    for (const p of PERKS) expect(p.pros(1).length).toBeGreaterThan(0);
  });

  it('Pacto duplica la puntuación y acelera la caída', () => {
    const g = new Game();
    const m = baseMods();
    PERK_BY_ID.pact.apply(m, g);
    expect(m.scoreMult).toBe(2);
    expect(m.gravitySpeed).toBeCloseTo(1.35);
  });

  it('la elección saca tres mejoras distintas', () => {
    const picks = rollPerks(new Map(), 0);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.id)).size).toBe(3);
  });

  it('no ofrece mejoras que ya están al máximo', () => {
    const owned = new Map<string, number>();
    for (const p of PERKS) owned.set(p.id, p.max);
    const left = ['vision', 'feather', 'grip'];
    for (const id of left) owned.set(id, 0);
    const picks = rollPerks(owned, 0).map((p) => p.id).sort();
    expect(picks).toEqual([...left].sort());
  });

  it('la elección nunca se queda sin opciones', () => {
    // Dados es acumulable sin límite: la elección nunca puede quedarse sin opciones.
    const owned = new Map<string, number>();
    for (const p of PERKS) owned.set(p.id, p.max);
    owned.set('dice', 0);
    expect(rollPerks(owned, 0).length).toBeGreaterThanOrEqual(1);
    expect(PERK_BY_ID.dice.max).toBeGreaterThanOrEqual(99);
  });

  it('sin progreso solo salen perks comunes y raros', () => {
    for (let i = 0; i < 300; i++) {
      for (const p of rollPerks(new Map(), 0, 3, 0)) {
        expect(['common', 'rare']).toContain(p.rarity);
      }
    }
  });

  it('las rarezas se desbloquean por el mejor nivel', () => {
    const epic = PERK_BY_ID.cross;
    const legendary = PERK_BY_ID.quake;
    expect(isUnlocked(epic, 3)).toBe(false);
    expect(isUnlocked(epic, 4)).toBe(true);
    expect(isUnlocked(legendary, 6)).toBe(false);
    expect(isUnlocked(legendary, 7)).toBe(true);
  });
});

describe('ofertas', () => {
  it('las tres cartas de una oferta son de la misma rareza', () => {
    const r = makeRng(5);
    for (let i = 0; i < 300; i++) {
      const picks = rollOffer(new Map(), 0, 3, Infinity, r);
      expect(picks).toHaveLength(3);
      expect(new Set(picks.map((p) => p.rarity)).size).toBe(1);
      expect(new Set(picks.map((p) => p.id)).size).toBe(3);
    }
  });

  it('sin progreso solo salen ofertas comunes y raras', () => {
    const r = makeRng(6);
    for (let i = 0; i < 300; i++) for (const p of rollOffer(new Map(), 0, 3, 0, r)) expect(['common', 'rare']).toContain(p.rarity);
  });

  it('si no quedan bastantes de una rareza, se completa con otras', () => {
    const owned = new Map<string, number>();
    for (const p of PERKS) owned.set(p.id, p.max);
    for (const id of ['quake', 'vision', 'feather']) owned.set(id, 0);
    const picks = rollOffer(owned, 0, 3, Infinity, makeRng(1)).map((p) => p.id).sort();
    expect(picks).toEqual(['feather', 'quake', 'vision']);
  });

  it('las maldiciones solo tienen desventajas y no salen en las ofertas normales', () => {
    for (const c of CURSES) {
      expect(c.curse).toBe(true);
      expect(c.pros(1)).toHaveLength(0);
      expect(c.cons!(1).length).toBeGreaterThan(0);
    }
    const r = makeRng(9);
    for (let i = 0; i < 200; i++) for (const p of rollOffer(new Map(), 0, 3, Infinity, r)) expect(p.curse).toBeFalsy();
  });

  it('una partida tiene ofertas malditas desde el nivel 5 y nunca dos seguidas', () => {
    let cursed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = new Game();
      g.start(seed);
      let prev = false;
      for (let lvl = 0; lvl < 15; lvl++) {
        g['addLevelProgress'](g.linesNeeded());
        g['beginChoice']();
        // si la racha trae hiperperk, va antes que la oferta y no cuenta como una
        if (g.choosingHyper) g.choosePerk(0);
        if (g.cursedOffer) {
          cursed++;
          expect(g.offerLevel()).toBeGreaterThanOrEqual(5);
          expect(prev).toBe(false);
          expect(g.choices.every((p) => p.curse)).toBe(true);
        }
        // la oferta que sigue a una maldita es rara o mejor
        if (prev) expect(g.choices.every((p) => p.rarity !== 'common')).toBe(true);
        prev = g.cursedOffer;
        g.pendingLevelUps = 1;
        g.choosePerk(0);
      }
    }
    expect(cursed).toBeGreaterThan(0);
  });
});
