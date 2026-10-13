import { describe, expect, it } from 'vitest';
import { EndLock } from './endlock';

describe('EndLock', () => {
  it('no bloquea sin haber acabado la partida', () => {
    let t = 0;
    const lock = new EndLock(800, () => t);
    expect(lock.blocks()).toBe(false);
  });

  it('bloquea durante la ventana y deja pasar tras un rato sin pulsar', () => {
    let t = 1000;
    const lock = new EndLock(800, () => t);
    lock.arm();
    t = 1500;
    expect(lock.blocks()).toBe(true);
    t = 1800; // cada pulsación alarga la ventana: 1500 + 800 = 2300
    expect(lock.blocks()).toBe(true);
    t = 2299;
    expect(lock.blocks()).toBe(true);
    t = 3200; // 800 ms sin pulsar desde la última (2299 + 800 = 3099)
    expect(lock.blocks()).toBe(false);
  });

  it('una nueva partida no hereda el freno anterior tras la ventana', () => {
    let t = 0;
    const lock = new EndLock(800, () => t);
    lock.arm();
    t = 900;
    expect(lock.blocks()).toBe(false);
  });
});
