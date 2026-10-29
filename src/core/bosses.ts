// Jefes de Expedición. El último nivel de cada tramo (3, 6, 9...) es un nivel jefe: una regla rara
// que dura todo el nivel. Al superarlo sale una oferta de rareza épica o mejor. Las reglas viven en
// `game.ts`, que pregunta `bossHas(regla)`; aquí están los datos, el orden y qué reglas lleva cada uno.
// El octavo jefe, el Monolito, mezcla dos de las siete primeras reglas, elegidas por la semilla.

export type RuleId = 'drip' | 'gravity' | 'magnet' | 'fog' | 'mirror' | 'alud' | 'countdown';
export type BossId = RuleId | 'monolith';

export interface BossDef {
  id: BossId;
  name: string;
  /** Una línea para el cartel y la barra de tramo. */
  rule: string;
  /** El mismo aviso en dos líneas cortas para el cartel sobre el tablero. */
  tip: [string, string];
  /** Reglas que lleva activas durante el nivel. */
  rules: RuleId[];
}

/** Las siete reglas simples, en el orden en que salen como jefes. */
const SIMPLE: BossDef[] = [
  { id: 'drip', name: 'Gota', rule: 'Cada 6 piezas cae un bloque de basura suelto en una columna al azar.', tip: ['Cada 6 piezas cae', 'un bloque suelto'], rules: ['drip'] },
  { id: 'gravity', name: 'Gravedad', rule: 'Las piezas caen el doble de rápido, pero las limpiezas de 2 o más líneas cuentan doble.', tip: ['Caen el doble de rápido;', '2+ líneas cuentan doble'], rules: ['gravity'] },
  { id: 'magnet', name: 'Imán', rule: 'Una columna queda prohibida (cuenta como llena) y cambia cada 8 piezas.', tip: ['Columna prohibida', 'Cambia cada 8 piezas'], rules: ['magnet'] },
  { id: 'fog', name: 'Niebla', rule: 'Solo ves la siguiente pieza y el fantasma está apagado.', tip: ['Solo ves la siguiente', 'y no hay fantasma'], rules: ['fog'] },
  { id: 'mirror', name: 'Espejo', rule: 'Los giros de izquierda y derecha se invierten en las 5 primeras piezas de cada tanda de 10.', tip: ['Izquierda y derecha', 'cambiadas 5 de cada 10'], rules: ['mirror'] },
  { id: 'alud', name: 'Alud', rule: 'Cada 4 piezas se desprende la fila más alta del montón.', tip: ['Cada 4 piezas se', 'desprende la fila alta'], rules: ['alud'] },
  { id: 'countdown', name: 'Cuenta atrás', rule: 'Cada 10 segundos de juego sube una fila de basura. La pausa no cuenta.', tip: ['Sube una fila', 'cada 10 segundos'], rules: ['countdown'] },
];

const MONOLITH: BossDef = {
  id: 'monolith',
  name: 'Monolito',
  rule: 'Dos reglas a la vez, elegidas por la semilla de la partida.',
  tip: ['Dos reglas', 'a la vez'],
  rules: [],
};

/** Orden fijo de los jefes: siete reglas simples y, al final, el Monolito. */
export const BOSSES: BossDef[] = [...SIMPLE, MONOLITH];

/** Niveles por tramo: el último de cada uno es el jefe. */
export const STAGE_LEVELS = 3;
/** Nivel del último jefe (el Monolito): al superarlo, victoria en Expedición. */
export const FINAL_BOSS_LEVEL = STAGE_LEVELS * BOSSES.length;
/** Piezas entre cada bloque de Gota. */
export const DRIP_EVERY = 6;
/** Piezas entre cada cambio de columna de Imán. */
export const MAGNET_EVERY = 8;
/** Columnas que Imán puede prohibir: fuera de donde aparecen las piezas (3 a 7). */
export const MAGNET_COLS = [0, 1, 2, 8, 9, 10];
/** Piezas entre cada desprendimiento de Alud. */
export const ALUD_EVERY = 4;
/** Piezas de cada tanda en la que Espejo invierte el lado (de cada 10). */
export const MIRROR_BURST = 10;
export const MIRROR_FLIPPED = 5;
/** Pasos (1/120 s) entre cada fila de Cuenta atrás: 10 segundos de juego. */
export const COUNTDOWN_STEPS = 1200;

/** Es nivel jefe: 3, 6, 9... */
export const isBossLevel = (level: number) => level >= STAGE_LEVELS && level % STAGE_LEVELS === 0;

/**
 * Jefe de un nivel (null si no es nivel jefe). Rotan en orden; el Monolito, el octavo, mezcla dos reglas
 * de las siete primeras según la semilla (siempre dos distintas, sin depender del orden de llamada).
 */
export function bossForLevel(level: number, seed: number): BossDef | null {
  if (!isBossLevel(level)) return null;
  const base = BOSSES[(level / STAGE_LEVELS - 1) % BOSSES.length];
  if (base.id !== 'monolith') return base;
  const a = SIMPLE[seed % SIMPLE.length];
  const b = SIMPLE[(seed % SIMPLE.length + 1 + (Math.floor(seed / SIMPLE.length) % (SIMPLE.length - 1))) % SIMPLE.length];
  return {
    ...MONOLITH,
    rule: `${a.rule} Además: ${b.rule}`,
    tip: [a.name, b.name],
    rules: [a.rules[0], b.rules[0]],
  };
}

/** Tramo (1, 2, 3...) al que pertenece un nivel. */
export const stageOf = (level: number) => Math.ceil(level / STAGE_LEVELS);
