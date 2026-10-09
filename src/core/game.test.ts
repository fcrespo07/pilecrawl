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
  for (let x = 0; x < COLS - 4; x++) g.board[ROWS - 1][x] = PIECES.T.id;
  setActive(g, PIECES.I, COLS - 4, 0);
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
    // la O cae desde la fila 0 hasta las dos últimas filas: ROWS - 2 casillas
    expect(g.score - before).toBe((ROWS - 2) * 2);
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
    g.board[ROWS - 1][5] = PIECES.O.id; // color que se borra
    g.board[ROWS - 2][5] = PIECES.T.id; // bloque de encima que debe caer
    g['prismBlast']([[5, ROWS - 2]]);
    expect(g.board[ROWS - 1][5]).toBe(PIECES.T.id);
    expect(g.board[ROWS - 2][5]).toBe(0);
  });

  it('tras una bomba solo caen las columnas afectadas, no los huecos de las demás', () => {
    const g = playing();
    g.board[ROWS - 2][8] = PIECES.T.id; // bloque de encima en la misma columna: debe caer
    g.board[ROWS - 2][0] = PIECES.T.id; // columna 0 con un hueco debajo: no debe rellenarse
    g['settleAfterBlast']([{ x: 8, y: ROWS - 1 }]); // la bomba ya ha vaciado (8, fila de abajo)
    expect(g.board[ROWS - 1][8]).toBe(PIECES.T.id);
    expect(g.board[ROWS - 1][0]).toBe(0);
    expect(g.board[ROWS - 2][0]).toBe(PIECES.T.id);
  });

  it('las líneas tras una bomba no cuentan para el combo', () => {
    const g = playing();
    g.combo = 2;
    for (let x = 0; x < COLS; x++) g.board[ROWS - 1][x] = PIECES.O.id;
    g.board[ROWS - 1][0] = 0;
    g.board[ROWS - 2][0] = PIECES.T.id;
    g['settleAfterBlast']([{ x: 0, y: ROWS - 1 }]);
    expect(g.combo).toBe(2);
  });
});

describe('perks nuevos', () => {
  const take = (g: Game, id: string) => PERK_BY_ID[id].apply(g.mods, g);

  it('Respiro borra las filas de abajo al subir de nivel', () => {
    const g = playing();
    take(g, 'breather');
    for (let y = ROWS - 4; y < ROWS; y++) { g.board[y].fill(GARBAGE_ID); g.board[y][0] = 0; }
    g['addLevelProgress'](g.linesNeeded());
    g['afterLock']();
    expect(g.state).toBe('choosing');
    // se van las 3 filas de abajo y queda solo la cuarta
    expect(g.board.filter((r) => r.some((v) => v !== 0))).toHaveLength(1);
  });

  it('Abanico ofrece 4 cartas', () => {
    const g = playing();
    take(g, 'fan');
    g.linesIntoLevel = g.linesNeeded() - 1;
    clearBottomLineWithI(g);
    expect(g.choices).toHaveLength(4);
  });

  it('Reciclaje cuenta líneas extra por cada fila de basura', () => {
    const g = playing();
    take(g, 'recycle');
    for (let x = 0; x < COLS - 4; x++) g.board[ROWS - 1][x] = GARBAGE_ID;
    setActive(g, PIECES.I, COLS - 4, 0);
    g.hardDrop();
    expect(g.lines).toBe(1);
    expect(g.linesIntoLevel).toBe(2);
  });

  it('Cosecha da un reroll cada 10 líneas', () => {
    const g = playing();
    take(g, 'harvest');
    const before = g.rerolls;
    g['addLines'](9);
    expect(g.rerolls).toBe(before);
    g['addLines'](1);
    expect(g.rerolls).toBe(before + 1);
  });

  it('Ahorro y Coleccionista suben el multiplicador según el estado', () => {
    const g = playing();
    take(g, 'savings');
    g.rerolls = 3;
    expect(g.scoreMultNow()).toBeCloseTo(1.3);
    g.rerolls = 0;
    expect(g.scoreMultNow()).toBeCloseTo(1);
  });

  it('Vértigo solo multiplica con el montón por encima de la mitad', () => {
    const g = playing();
    take(g, 'vertigo');
    expect(g.scoreMultNow()).toBeCloseTo(1);
    g.board[ROWS - 10][0] = PIECES.T.id;
    expect(g.scoreMultNow()).toBeCloseTo(1.5);
  });

  it('Salvavidas cambia la siguiente pieza por una I con el montón alto, y espera para repetir', () => {
    const g = playing();
    take(g, 'lifeline');
    for (let y = ROWS - 14; y < ROWS; y++) { g.board[y].fill(GARBAGE_ID); g.board[y][0] = 0; }
    g.queue.unshift({ def: PIECES.O, bomb: false, prism: false, gold: false });
    g['spawn']();
    expect(g.active?.def.name).toBe('I');
    g.queue.unshift({ def: PIECES.O, bomb: false, prism: false, gold: false });
    g['spawn']();
    expect(g.active?.def.name).toBe('O');
  });

  it('Ancla para la basura mientras dura el combo', () => {
    const g = playing();
    take(g, 'anchor');
    g.level = 4;
    g.combo = 0;
    g.garbageCounter = 0;
    clearBottomLineWithI(g);
    expect(g.combo).toBe(1);
    expect(g.garbageCounter).toBe(0);
    // una pieza que no limpia corta el combo y la basura vuelve a avanzar
    setActive(g, PIECES.O, 0, 0);
    g.hardDrop();
    expect(g.garbageCounter).toBe(1);
  });

  it('Fénix vacía todo el tablero al revivir y sube la puntuación', () => {
    const g = playing();
    take(g, 'phoenix');
    for (let y = 0; y < ROWS; y++) { g.board[y].fill(GARBAGE_ID); g.board[y][0] = 0; }
    expect(g['topOut']()).toBe(true);
    expect(g.board.every((r) => r.every((v) => v === 0))).toBe(true);
    expect(g.scoreMultNow()).toBeCloseTo(1.25);
  });

  it('Reflejos solo premia las piezas rápidas que limpian línea', () => {
    const g = playing();
    take(g, 'reflex');
    setActive(g, PIECES.O, 0, ROWS - 2);
    let before = g.score;
    g.hardDrop();
    expect(g.score - before).toBe(0);
    const plain = playing();
    clearBottomLineWithI(plain);
    const g2 = playing();
    take(g2, 'reflex');
    before = g2.score;
    clearBottomLineWithI(g2);
    const plainGain = plain.score;
    expect(g2.score - before - plainGain).toBe(60);
  });

  it('Vértigo cuenta la altura de antes de limpiar', () => {
    const g = playing();
    take(g, 'vertigo');
    // montón justo en la mitad: al limpiar la fila de abajo baja de la mitad
    for (let y = ROWS - 9; y < ROWS - 1; y++) g.board[y][0] = PIECES.T.id;
    const plain = playing();
    for (let y = ROWS - 9; y < ROWS - 1; y++) plain.board[y][0] = PIECES.T.id;
    clearBottomLineWithI(plain);
    clearBottomLineWithI(g);
    // la línea simple (100) cobra ×1,5; los puntos de la caída no llevan multiplicador
    expect(g.score - plain.score).toBe(50);
  });

  it('Fénix tiene un tope de +50%', () => {
    const g = playing();
    take(g, 'phoenix');
    g.lives = 4;
    for (let i = 0; i < 4; i++) g['topOut']();
    expect(g.scoreMultNow()).toBeCloseTo(1.5);
  });
});

describe('perks con piel', () => {
  it('cada perk con piel la pone y una partida nueva la quita', () => {
    const g = playing();
    for (const [id, skin] of [['blueprint', 'plano'], ['blackout', 'apagon'], ['terminal', 'terminal'], ['neon', 'neon']] as const) {
      PERK_BY_ID[id].apply(g.mods, g);
      expect(g.mods.skin).toBe(skin);
    }
    g.start(1);
    expect(g.mods.skin).toBeNull();
  });

  it('la piel no cambia la partida: misma semilla y acciones, mismo resultado', () => {
    const play = (skin: boolean) => {
      const g = new Game();
      g.start(7);
      if (skin) g.mods.skin = 'neon';
      for (let i = 0; i < 30 && g.state === 'playing'; i++) {
        g.move(i % 3 - 1);
        g.hardDrop();
      }
      return [g.score, g.lines, g.board.map((r) => r.join('')).join('|')];
    };
    expect(play(true)).toEqual(play(false));
  });
});
