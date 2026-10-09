import { describe, expect, it } from 'vitest';
import { COLS, Game, ROWS } from './game';
import { GARBAGE_ID, PIECES, type PieceDef } from './pieces';
import type { PieceSpec } from './game';

/** Partida lista para jugar, sin azar en la cola inicial que moleste a los tests. */
function playing(): Game {
  const g = new Game();
  g.start();
  return g;
}

/** Coloca una pieza concreta como activa, sin pasar por la cola. */
function setActive(g: Game, def: PieceDef, x: number, y: number, rot = 0): void {
  const spec: PieceSpec & { x: number; y: number; rot: number } = {
    def, bomb: false, prism: false, gold: false, x, y, rot,
  };
  g.active = spec;
}

/** Deja la fila de abajo llena salvo cuatro huecos a la derecha y cae una I horizontal ahí. */
function clearBottomLineWithI(g: Game): void {
  for (let x = 0; x < 6; x++) g.board[ROWS - 1][x] = PIECES.T.id;
  setActive(g, PIECES.I, 6, 0);
  g.hardDrop();
}

describe('piezas', () => {
  it('cada pieza tiene 4 orientaciones con el mismo número de bloques', () => {
    for (const def of Object.values(PIECES)) {
      expect(def.shapes).toHaveLength(4);
      const counts = def.shapes.map((s) => s.length);
      expect(new Set(counts).size).toBe(1);
    }
  });

  it('la I tiene 4 bloques y la O no rota', () => {
    expect(PIECES.I.shapes[0]).toHaveLength(4);
    expect(PIECES.O.kicks).toBe('O');
    expect(new Game().rotate(1)).toBe(false);
  });
});

describe('niveles y gravedad', () => {
  it('se necesitan 8 líneas al empezar', () => {
    expect(new Game().linesNeeded()).toBe(8);
  });

  it('la reducción de líneas de los perks se resta, con mínimo 4', () => {
    const g = new Game();
    g.mods.linesReduction = 2;
    expect(g.linesNeeded()).toBe(6);
    g.mods.linesReduction = 20;
    expect(g.linesNeeded()).toBe(4);
  });

  it('la gravedad nunca sube al avanzar de nivel', () => {
    const g = new Game();
    let prev = Infinity;
    for (let lvl = 1; lvl <= 30; lvl++) {
      g.level = lvl;
      const ms = g.gravityMs();
      expect(ms).toBeLessThanOrEqual(prev);
      expect(ms).toBeGreaterThanOrEqual(1);
      prev = ms;
    }
  });
});

describe('colocación y líneas', () => {
  it('una I horizontal completa la fila de abajo y la limpia', () => {
    const g = playing();
    clearBottomLineWithI(g);
    expect(g.lines).toBe(1);
    expect(g.board[ROWS - 1].every((v) => v === 0)).toBe(true);
  });

  it('el hard drop suma 2 puntos por casilla recorrida', () => {
    const g = playing();
    g.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    setActive(g, PIECES.O, 0, 0);
    const before = g.score;
    g.hardDrop();
    // la O cae desde la fila 0 hasta las dos últimas filas: 20 casillas
    expect(g.score - before).toBe(20 * 2);
  });

  it('subir de nivel abre la elección de mejoras con 3 opciones', () => {
    const g = playing();
    g.linesIntoLevel = g.linesNeeded() - 1;
    clearBottomLineWithI(g);
    expect(g.level).toBe(2);
    expect(g.state).toBe('choosing');
    expect(g.choices).toHaveLength(3);
  });
});

describe('basura', () => {
  it('sin bloques en la fila de arriba, añade una fila de basura', () => {
    const g = playing();
    g.level = 4;
    g.garbageCounter = g.garbageInterval() - 1;
    setActive(g, PIECES.O, 0, 0);
    g.hardDrop();
    expect(g.state).toBe('playing');
    expect(g.board[ROWS - 1].filter((v) => v === GARBAGE_ID)).toHaveLength(COLS - 1);
  });

  it('si la basura empuja bloques fuera del tablero, es game over', () => {
    const g = playing();
    g.level = 4;
    g.board[0][5] = PIECES.T.id;
    g.garbageCounter = g.garbageInterval() - 1;
    setActive(g, PIECES.O, 0, 0);
    g.hardDrop();
    expect(g.state).toBe('over');
  });
});

describe('bloqueo fuera del tablero', () => {
  it('una pieza que se fija por completo encima del tablero es game over', () => {
    const g = playing();
    setActive(g, PIECES.I, 3, -2);
    g['lockPiece']();
    expect(g.state).toBe('over');
  });

  it('con una vida, un bloqueo fuera del tablero no termina la partida', () => {
    const g = playing();
    g.lives = 1;
    setActive(g, PIECES.I, 3, -2);
    g['lockPiece']();
    expect(g.state).toBe('playing');
    expect(g.lives).toBe(0);
  });
});
