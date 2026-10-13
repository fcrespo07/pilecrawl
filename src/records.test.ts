import { beforeEach, describe, expect, it, vi } from 'vitest';

/** localStorage en memoria: los tests corren en Node, sin navegador. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

/** Simula abrir la página: la migración de `storage.ts` corre de nuevo y se leen los récords. */
async function reload() {
  vi.resetModules();
  await import('./storage');
  return import('./records');
}

describe('récords por modo', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  it('los récords de cada modo sobreviven a varias recargas', async () => {
    let r = await reload();
    expect(r.submitScore('normal', '2026-10-09', 1000)).toBe(true);
    expect(r.submitScore('timed', '2026-10-09', 500)).toBe(true);
    expect(r.submitScore('daily', '2026-10-09', 700)).toBe(true);
    r.saveLastMode('timed');
    for (let i = 0; i < 2; i++) {
      r = await reload();
      expect(r.loadBest('normal', '2026-10-09')).toBe(1000);
      expect(r.loadBest('timed', '2026-10-09')).toBe(500);
      expect(r.loadBest('daily', '2026-10-09')).toBe(700);
      expect(r.loadLastMode()).toBe('timed');
    }
  });

  it('el récord normal de antes del cambio de nombre se conserva', async () => {
    localStorage.setItem('derrumbe.best', '4200');
    const r = await reload();
    expect(r.loadBest('normal', '2026-10-09')).toBe(4200);
    expect((await reload()).loadBest('normal', '2026-10-09')).toBe(4200);
  });

  it('el récord del diario solo vale el día en que se jugó y no baja', async () => {
    const r = await reload();
    r.submitScore('daily', '2026-10-09', 700);
    expect(r.submitScore('daily', '2026-10-09', 600)).toBe(false);
    expect(r.loadBest('daily', '2026-10-10')).toBe(0);
    expect(r.submitScore('daily', '2026-10-10', 10)).toBe(true);
    expect(r.loadBest('daily', '2026-10-10')).toBe(10);
  });
});

describe('primera visita', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  it('sin datos es primera visita, y deja de serlo al empezar una partida', async () => {
    const r = await reload();
    expect(r.isFirstVisit()).toBe(true);
    r.markPlayed();
    expect(r.isFirstVisit()).toBe(false);
  });

  it('quien ya tiene récords guardados no vuelve a ver el tutorial de entrada', async () => {
    let r = await reload();
    r.submitScore('normal', '2026-10-13', 500);
    r = await reload();
    expect(r.isFirstVisit()).toBe(false);
  });
});
