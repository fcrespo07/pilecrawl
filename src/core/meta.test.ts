import { describe, expect, it } from 'vitest';
import { recordBestLevel, UNLOCK_LEVEL } from './meta';

describe('progresión', () => {
  it('comunes y raras están desbloqueadas desde el principio', () => {
    expect(UNLOCK_LEVEL.common).toBe(0);
    expect(UNLOCK_LEVEL.rare).toBe(0);
  });

  it('sin almacenamiento, anotar un nivel devuelve ese nivel', () => {
    expect(recordBestLevel(5)).toBe(5);
  });
});
