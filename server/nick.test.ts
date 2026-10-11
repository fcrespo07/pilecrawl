import { describe, expect, it } from 'vitest';
import { NICK_CHARS, isBlockedNick, nickKey } from './nick';

describe('apodos', () => {
  it('suplantaciones comparten clave con el original', () => {
    for (const n of ['A.na', 'A na', 'Ana.', 'Ａna', '4na', 'ANA']) expect(nickKey(n), n).toBe(nickKey('Ana'));
    expect(NICK_CHARS.test('Anа')).toBe(false); // a cirílica
    expect(NICK_CHARS.test('𝐟𝐮𝐜𝐤'.normalize('NFKC'))).toBe(true); // tras NFKC pasa a «fuck»
  });

  it('filtra palabras con trucos y deja pasar nombres legítimos', () => {
    for (const n of ['fuuuck', 'ｆｕｃｋ', '𝐟𝐮𝐜𝐤', 'shiit', 'Admin', 'Hitler99', 'xfuckx', 'su nazi']) expect(isBlockedNick(n), n).toBe(true);
    for (const n of ['Ignazio', 'Ana Zimmer', 'Pollack', 'Scunthorpe', 'Fer']) expect(isBlockedNick(n), n).toBe(false);
    expect(isBlockedNick('MuyFeo', ['feo'])).toBe(true);
  });
});
