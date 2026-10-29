import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { baseMods } from './perks';
import { allowedPoints, applyPressure, cleanPressure, pressureMult, PRESSURE } from './pressure';

describe('Presión: multiplicador y desbloqueo', () => {
  it('cada punto suma un 25 % a los fragmentos', () => {
    expect(pressureMult(0)).toBe(1);
    expect(pressureMult(1)).toBe(1.25);
    expect(pressureMult(PRESSURE.length)).toBe(2);
  });

  it('la Presión N solo se abre llegando al nivel 6 con la N-1', () => {
    expect(allowedPoints([])).toBe(0);
    expect(allowedPoints([5])).toBe(0);
    expect(allowedPoints([6])).toBe(1);
    expect(allowedPoints([6, 5, 9])).toBe(1);
    expect(allowedPoints([6, 6, 6])).toBe(3);
  });

  it('no pasa del número de condiciones que existen', () => {
    expect(allowedPoints([6, 6, 6, 6, 6, 6])).toBe(PRESSURE.length);
  });

  it('descarta ids que no existen y no repite', () => {
    expect(cleanPressure(['nohold', 'nope', 'nohold', 3, 'garbage'])).toEqual(['garbage', 'nohold']);
  });
});

describe('Presión: reglas', () => {
  it('cada condición cambia su regla', () => {
    const m = baseMods();
    applyPressure(m, ['garbage', 'nohold', 'twochoices', 'onepiece']);
    expect(m.garbageFrom).toBe(2);
    expect(m.noHold).toBe(true);
    expect(m.choices).toBe(2);
    expect(m.preview).toBe(1);
  });

  it('sin condiciones no cambia nada', () => {
    const m = baseMods();
    const before = JSON.stringify(m);
    applyPressure(m, []);
    expect(JSON.stringify(m)).toBe(before);
  });

  it('en la partida, Sin reserva impide guardar pieza', () => {
    const g = new Game();
    g.start(7, 'expedition', {}, [], ['nohold']);
    g.holdPiece();
    expect(g.hold.length).toBe(0);
    expect(g.holdUsed).toBe(false);
  });

  it('en la partida, Basura temprana cambia el nivel de inicio de la basura', () => {
    const g = new Game();
    g.start(7, 'expedition', {}, [], ['garbage']);
    expect(g.mods.garbageFrom).toBe(2);
    expect(g.pressure).toEqual(['garbage']);
  });

  it('fuera de Expedición la Presión no entra', () => {
    const g = new Game();
    g.start(7, 'normal', {}, [], ['nohold']);
    expect(g.mods.noHold).toBe(false);
    expect(g.pressure).toEqual([]);
  });
});
