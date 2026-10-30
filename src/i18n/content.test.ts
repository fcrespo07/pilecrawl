// Contenido en inglés: cada mejora, maldición, hiperperk y jefe tiene texto, y las cifras coinciden con las del español.
import { describe, expect, it } from 'vitest';
import { BOSSES, bossForLevel } from '../core/bosses';
import { CHALLENGES, UPGRADES } from '../core/expedition';
import { HYPERS } from '../core/hypers';
import { PERKS, CURSES } from '../core/perks';
import { PRESSURE } from '../core/pressure';
import { BOSS_EN, EN, bossText, challengeText, perkCons, perkName, perkPros, pressureText, upgradeText } from './content';
import { current } from './index';

/** Números de un texto con marcado, escritos igual en los dos idiomas (1,5 y 1.5 cuentan igual). */
const numbers = (list: string[]) =>
  list
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .match(/\d+(\.\d+)?/g) ?? [];

const entries = [...PERKS, ...CURSES, ...HYPERS];

describe('contenido en inglés', () => {
  it('cada mejora, maldición e hiperperk tiene texto en inglés', () => {
    for (const p of entries) expect(EN[p.id], p.id).toBeDefined();
  });

  it('no sobran ids', () => {
    const ids = new Set(entries.map((p) => p.id));
    for (const id of Object.keys(EN)) expect(ids.has(id), id).toBe(true);
  });

  it('ventajas y contrapartidas: mismo número de líneas y las mismas cifras en cada nivel de acumulación', () => {
    for (const p of entries) {
      const max = Math.min('max' in p ? p.max : 1, 3);
      for (let s = 1; s <= max; s++) {
        current.lang = 'es';
        const prosEs = perkPros(p, s);
        const consEs = perkCons(p, s, false);
        current.lang = 'en';
        const prosEn = perkPros(p, s);
        const consEn = perkCons(p, s, false);
        expect(prosEn.length, `${p.id} ventajas`).toBe(prosEs.length);
        expect(consEn.length, `${p.id} contras`).toBe(consEs.length);
        expect(numbers(prosEn), `${p.id} ventajas x${s}`).toEqual(numbers(prosEs));
        expect(numbers(consEn), `${p.id} contras x${s}`).toEqual(numbers(consEs));
      }
    }
    current.lang = 'es';
  });

  it('los nombres cambian de idioma', () => {
    current.lang = 'es';
    expect(perkName(PERKS[0])).toBe(PERKS[0].name);
    current.lang = 'en';
    expect(perkName(PERKS[0])).toBe(EN[PERKS[0].id].name);
    current.lang = 'es';
  });

  it('jefes, mejoras permanentes, retos y presión tienen texto en inglés', () => {
    for (const b of BOSSES) expect(BOSS_EN[b.id], b.id).toBeDefined();
    current.lang = 'en';
    for (const u of UPGRADES) expect(upgradeText(u).name, u.id).not.toBe(u.name);
    for (const c of CHALLENGES) expect(challengeText(c), c.perk).not.toBe(c.text);
    for (const p of PRESSURE) expect(pressureText(p).name, p.id).not.toBe(p.name);
    // el Monolito junta las dos reglas que le tocan, con su nombre en inglés
    const mono = bossForLevel(24, 5)!;
    const txt = bossText(mono);
    expect(txt.rule).toContain(' Also: ');
    expect(txt.name).toBe('Monolith');
    current.lang = 'es';
  });
});
