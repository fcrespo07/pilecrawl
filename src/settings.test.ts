import { beforeEach, describe, expect, it, vi } from 'vitest';

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

async function fresh() {
  vi.resetModules();
  return import('./settings');
}

describe('ajustes de teclas', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('por defecto cada acción tiene sus teclas de siempre', async () => {
    const s = await fresh();
    expect(s.actionOf('Space')).toBe('hard');
    expect(s.actionOf('KeyX')).toBe('cw');
    expect(s.actionOf('ShiftRight')).toBe('hold');
    expect(s.actionOf('KeyD')).toBe('hyper');
    expect(s.actionOf('KeyQ')).toBeNull();
  });

  it('cambiar una tecla se guarda y sobrevive a recargar', async () => {
    let s = await fresh();
    s.bindKey('hyper', 0, 'KeyE');
    expect(s.actionOf('KeyD')).toBeNull();
    expect(s.actionOf('KeyE')).toBe('hyper');
    s = await fresh();
    expect(s.actionOf('KeyE')).toBe('hyper');
  });

  it('una tecla hace una sola cosa: asignarla a otra acción se la quita a la anterior', async () => {
    const s = await fresh();
    expect(s.bindKey('hold', 0, 'KeyX')).toBe('cw');
    expect(s.actionOf('KeyX')).toBe('hold');
    expect(s.keymap.cw).toEqual(['ArrowUp']);
  });

  it('mover una tecla a otro hueco de la misma acción no la duplica', async () => {
    const s = await fresh();
    s.bindKey('cw', 0, 'KeyX');
    expect(s.keymap.cw).toEqual(['KeyX']);
  });

  it('vaciar un hueco y restablecer', async () => {
    const s = await fresh();
    s.bindKey('cw', 1, null);
    expect(s.keymap.cw).toEqual(['ArrowUp']);
    s.resetKeys();
    expect(s.keymap.cw).toEqual(['ArrowUp', 'KeyX']);
  });

  it('un guardado roto o con teclas reservadas se ignora', async () => {
    localStorage.setItem('blockrogue.keys', JSON.stringify({ hard: ['Escape', 'KeyP', 'KeyQ'], left: 'no', hyper: [3] }));
    const s = await fresh();
    expect(s.keymap.hard).toEqual(['KeyQ']);
    expect(s.keymap.left).toEqual(['ArrowLeft']);
    localStorage.setItem('blockrogue.keys', '{roto');
    expect((await fresh()).keymap.hard).toEqual(['Space']);
  });

  it('DAS y ARR se limitan a su rango', async () => {
    const s = await fresh();
    s.setHandling('das', 9999);
    s.setHandling('arr', -4);
    expect(s.handling).toEqual({ das: 300, arr: 0 });
    const again = await fresh();
    expect(again.handling).toEqual({ das: 300, arr: 0 });
    again.resetHandling();
    expect(again.handling).toEqual({ das: 130, arr: 25 });
  });

  it('nombres cortos de tecla', async () => {
    const s = await fresh();
    expect(s.keyLabel('KeyZ')).toBe('Z');
    expect(s.keyLabel('ArrowLeft')).toBe('←');
    expect(s.keyLabels('hold', 2)).toEqual(['C', 'Mayús']);
  });
});
