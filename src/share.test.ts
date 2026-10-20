import { describe, expect, it } from 'vitest';
import { shareText, SHARE_URL } from './share';

describe('shareText', () => {
  it('incluye modo, puntos, nivel, líneas y enlace', () => {
    const t = shareText({ mode: 'Diario #12', score: 12345, level: 7, lines: 41 });
    expect(t).toContain('Diario #12');
    expect(t).toContain('nivel 7');
    expect(t).toContain('41 líneas');
    expect(t).toContain(SHARE_URL);
    expect(t).toMatch(/12\D?345 puntos/);
  });
});
