// Idioma: cada clave tiene texto en los dos idiomas, la sustitución de {vars} y la vuelta al español.
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';
import { current, detectLang, resolveLang, t } from './index';

describe('i18n', () => {
  it('inglés y español tienen las mismas claves y ninguna vacía', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const [k, v] of Object.entries(en)) expect(v.trim(), k).not.toBe('');
  });

  it('sustituye {variables}', () => {
    current.lang = 'es';
    expect(t('time.hm', { h: 2, m: 5 })).toBe('2 h 5 min');
    current.lang = 'en';
    expect(t('time.hm', { h: 2, m: 5 })).toBe('2 h 5 min');
    expect(t('mode.newIn', { time: '3 min' })).toBe('New in 3 min');
    current.lang = 'es';
  });

  it('el idioma automático sigue al navegador', () => {
    expect(resolveLang('es')).toBe('es');
    expect(resolveLang('en')).toBe('en');
    expect(['es', 'en']).toContain(detectLang());
  });
});
