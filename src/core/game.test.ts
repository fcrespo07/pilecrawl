import { describe, expect, it } from 'vitest';
import { COLS, Game, ROWS } from './game';
import { GARBAGE_ID, PIECES, type PieceDef } from './pieces';
import { PERK_BY_ID } from './perks';
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

  it('la I tiene 4 bloques y la O no rota (la T sí, como control)', () => {
    expect(PIECES.I.shapes[0]).toHaveLength(4);
    const g = playing();
    setActive(g, PIECES.O, 4, 5);
    expect(g.rotate(1)).toBe(false);
    expect(g.active!.rot).toBe(0);
    setActive(g, PIECES.T, 4, 5);
    expect(g.rotate(1)).toBe(true);
    expect(g.active!.rot).toBe(1);
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

describe('revivir con una vida', () => {
  it('reintenta la misma pieza en vez de sacar otra de la cola', () => {
    const g = playing();
    g.lives = 1;
    for (let y = 0; y < 3; y++) g.board[y].fill(PIECES.T.id);
    g.queue = [{ def: PIECES.I, bomb: false, prism: false, gold: false }];
    const t: PieceSpec = { def: PIECES.T, bomb: false, prism: false, gold: false };
    g['spawn'](t);
    expect(g.lives).toBe(0);
    expect(g.active?.def.name).toBe('T');
  });
});

describe('bloqueo fuera del tablero', () => {
  it('una pieza con algún bloque por encima del tablero oculto es game over', () => {
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

describe('cruz y prisma', () => {
  it('la cruz sustituye a la T en cada bolsa y no añade piezas', () => {
    const g = new Game();
    PERK_BY_ID.cross.apply(g.mods, g);
    g['fillQueue']();
    const firstBag = g.queue.slice(0, 7).map((s) => s.def.name);
    expect(firstBag.filter((n) => n === 'X')).toHaveLength(1);
    expect(firstBag).not.toContain('T');
    expect(new Set(firstBag).size).toBe(7);
  });

  it('el prisma hace caer los bloques de encima tras borrar un color', () => {
    const g = playing();
    g.board[21][5] = PIECES.O.id; // color que se borra
    g.board[20][5] = PIECES.T.id; // bloque de encima que debe caer
    g['prismBlast']([[5, 20]]);
    expect(g.board[21][5]).toBe(PIECES.T.id);
    expect(g.board[20][5]).toBe(0);
  });

  it('tras una bomba solo caen las columnas afectadas, no los huecos de las demás', () => {
    const g = playing();
    g.board[20][8] = PIECES.T.id; // bloque de encima en la misma columna: debe caer
    g.board[20][0] = PIECES.T.id; // columna 0 con un hueco debajo: no debe rellenarse
    g['settleAfterBlast']([{ x: 8, y: 21 }]); // la bomba ya ha vaciado (8,21)
    expect(g.board[21][8]).toBe(PIECES.T.id);
    expect(g.board[21][0]).toBe(0);
    expect(g.board[20][0]).toBe(PIECES.T.id);
  });

  it('las líneas tras una bomba no cuentan para el combo', () => {
    const g = playing();
    g.combo = 2;
    for (let x = 0; x < COLS; x++) g.board[21][x] = PIECES.O.id;
    g.board[21][0] = 0;
    g.board[20][0] = PIECES.T.id;
    g['settleAfterBlast']([{ x: 0, y: 21 }]);
    expect(g.combo).toBe(2);
  });
});
