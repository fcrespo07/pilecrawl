import { describe, expect, it } from 'vitest';
import { shareText, SHARE_URL } from './share';
import { current } from './i18n';

describe('shareText', () => {
  it('incluye modo, puntos, nivel, líneas y enlace', () => {
    const prev = current.lang;
    current.lang = 'es';
    const t = shareText({ mode: 'Diario #12', score: 12345, level: 7, lines: 41 });
    expect(t).toContain('Diario #12');
    expect(t).toContain('nivel 7');
    expect(t).toContain('41 líneas');
    expect(t).toContain(SHARE_URL);
    expect(t).toMatch(/12\D?345 puntos/);
    current.lang = prev;
  });

  it('sale en inglés si el juego está en inglés', () => {
    const prev = current.lang;
    current.lang = 'en';
    const t = shareText({ mode: 'Daily #12', score: 12345, level: 7, lines: 41 });
    current.lang = prev;
    expect(t).toContain('level 7');
    expect(t).toContain('41 lines');
    expect(t).toMatch(/12\D?345 points/);
  });
});
