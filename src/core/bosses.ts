// Jefes. El último nivel de cada tramo (3, 6, 9...) es un nivel jefe: una regla rara que dura
// todo el nivel. Al superarlo sale una oferta de rareza épica o mejor. Las reglas viven en
// `game.ts` (leyendo `bossNow()`); aquí solo están los datos y el orden.

export type BossId = 'drip' | 'gravity' | 'magnet';

export interface BossDef {
  id: BossId;
  name: string;
  /** Una línea para el cartel y la barra de tramo. */
  rule: string;
  /** El mismo aviso en dos líneas cortas para el cartel sobre el tablero. */
  tip: [string, string];
}

export const BOSSES: BossDef[] = [
  { id: 'drip', name: 'Gota', rule: 'Cada 6 piezas cae un bloque de basura suelto en una columna al azar.', tip: ['Cada 6 piezas cae', 'un bloque suelto'] },
  { id: 'gravity', name: 'Gravedad', rule: 'Las piezas caen el doble de rápido, pero las limpiezas de 2 o más líneas cuentan doble.', tip: ['Caen el doble de rápido;', '2+ líneas cuentan doble'] },
  { id: 'magnet', name: 'Imán', rule: 'Una columna queda prohibida (cuenta como llena) y cambia cada 8 piezas.', tip: ['Columna prohibida', 'Cambia cada 8 piezas'] },
];

/** Niveles por tramo: el último de cada uno es el jefe. */
export const STAGE_LEVELS = 3;
/** Piezas entre cada bloque de Gota. */
export const DRIP_EVERY = 6;
/** Piezas entre cada cambio de columna de Imán. */
export const MAGNET_EVERY = 8;
/** Columnas que Imán puede prohibir: fuera de donde aparecen las piezas (3 a 7). */
export const MAGNET_COLS = [0, 1, 2, 8, 9, 10];

/** Es nivel jefe: 3, 6, 9... */
export const isBossLevel = (level: number) => level >= STAGE_LEVELS && level % STAGE_LEVELS === 0;

/** Jefe de un nivel (null si no es nivel jefe). Rotan en orden. */
export function bossForLevel(level: number): BossDef | null {
  if (!isBossLevel(level)) return null;
  return BOSSES[(level / STAGE_LEVELS - 1) % BOSSES.length];
}

/** Tramo (1, 2, 3...) al que pertenece un nivel. */
export const stageOf = (level: number) => Math.ceil(level / STAGE_LEVELS);
