import { describe, expect, it } from 'vitest';
import { baseMods } from './perks';
import { isUnlocked, PERKS, PERK_BY_ID, rollPerks } from './perks';
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
