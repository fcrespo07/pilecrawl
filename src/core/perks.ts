import type { Game } from './game';
import { UNLOCK_LEVEL } from './meta';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Todo lo que los perks pueden tocar. La lógica del juego lee de aquí. */
export interface Mods {
  preview: number;
  holdSlots: number;
  infiniteHold: boolean;
  holdCost: number; // puntos × nivel que cuesta cada hold
  gravitySpeed: number; // multiplicador de velocidad de caída (<1 = más lento)
  lockDelay: number; // ms
  scoreMult: number;
  comboMult: number;
  singleMult: number;
  quadMult: number;
  linesReduction: number; // puede ser negativo (= más líneas por nivel)
  garbageDelay: number; // piezas extra entre filas de basura (negativo = antes)
  hardDropMult: number;
  softDropPoints: boolean;
  bombEvery: number; // 0 = desactivado
  drillEvery: number;
  prismEvery: number;
  goldChance: number;
  /** piezas añadidas a cada bolsa; 'SZ' = una S o una Z al azar */
  extraPieces: string[];
  expBonus: number;
  allSpin: boolean;
  /** la cruz sustituye a la T en cada bolsa (no añade piezas) */
  crossSwap: boolean;
  b2bMult: number;
  comboGrace: number;
  instinct: boolean;
  interest: number;
  quake: boolean;
  luck: number;
  /** cartas que se ofrecen en cada elección */
  choices: number;
  /** filas de abajo que se borran al subir de nivel (Respiro) */
  levelClearRows: number;
  /** +puntuación por cada reroll guardado (Ahorro) */
  savings: number;
  /** líneas para ganar un reroll; 0 = desactivado (Cosecha) */
  harvestEvery: number;
  /** puntos × nivel por pieza fijada rápido (Reflejos) */
  reflexPoints: number;
  /** líneas de nivel extra y puntos por cada fila de basura limpiada (Reciclaje) */
  recycle: number;
  /** multiplicador extra con el montón por encima de la mitad (Vértigo) */
  vertigo: number;
  /** con el montón alto, la siguiente pieza es una I (Salvavidas) */
  lifeline: boolean;
  /** la basura no avanza mientras dure un combo (Ancla) */
  anchor: boolean;
  /** +puntuación por cada mejora distinta (Coleccionista) */
  collector: number;
  /** al revivir se vacía todo el tablero y la puntuación sube (Fénix) */
  phoenix: boolean;
}

export function baseMods(): Mods {
  return {
    preview: 3,
    holdSlots: 1,
    infiniteHold: false,
    holdCost: 0,
    gravitySpeed: 1,
    lockDelay: 500,
    scoreMult: 1,
    comboMult: 1,
    singleMult: 1,
    quadMult: 1,
    linesReduction: 0,
    garbageDelay: 0,
    hardDropMult: 1,
    softDropPoints: true,
    bombEvery: 0,
    drillEvery: 0,
    prismEvery: 0,
    goldChance: 0,
    extraPieces: [],
    expBonus: 0,
    allSpin: false,
    crossSwap: false,
    b2bMult: 1.5,
    comboGrace: 0,
    instinct: false,
    interest: 0,
    quake: false,
    luck: 0,
    choices: 3,
    levelClearRows: 0,
    savings: 0,
    harvestEvery: 0,
    reflexPoints: 0,
    recycle: 0,
    vertigo: 0,
    lifeline: false,
    anchor: false,
    collector: 0,
    phoenix: false,
  };
}

export interface PerkDef {
  id: string;
  name: string;
  rarity: Rarity;
  max: number;
  /** stacks = cuántos tendrás después de cogerlo */
  pros: (stacks: number) => string[];
  cons?: (stacks: number) => string[];
  apply: (m: Mods, g: Game) => void;
  /** Maldición: solo sale en las ofertas malditas y no tiene ventaja (sus efectos van en `cons`). */
  curse?: boolean;
}

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 28, epic: 10, legendary: 3 };
export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Común',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Legendaria',
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export const PERKS: PerkDef[] = [
  // ───────── Comunes ─────────
  {
    id: 'vision', name: 'Visión', rarity: 'common', max: 3,
    pros: () => ['Ves <b>+1 pieza</b> en la cola'],
    apply: (m) => { m.preview += 1; },
  },
  {
    id: 'feather', name: 'Pluma', rarity: 'common', max: 5,
    pros: () => ['Las piezas caen un <b>12% más lento</b>'],
    apply: (m) => { m.gravitySpeed *= 0.88; },
  },
  {
    id: 'grip', name: 'Pulso firme', rarity: 'common', max: 3,
    pros: () => ['<b>+150 ms</b> antes de que la pieza se fije'],
    apply: (m) => { m.lockDelay += 150; },
  },
  {
    id: 'greed', name: 'Codicia', rarity: 'common', max: 5,
    pros: () => ['<b>+30%</b> a toda la puntuación'],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.scoreMult *= 1.3; m.linesReduction -= 1; },
  },
  {
    id: 'shortcut', name: 'Atajo', rarity: 'common', max: 3,
    pros: () => ['Necesitas <b>2 líneas menos</b> para subir de nivel'],
    cons: () => ['Las piezas caen un <b>8% más rápido</b>'],
    apply: (m) => { m.linesReduction += 2; m.gravitySpeed *= 1.08; },
  },
  {
    id: 'chain', name: 'Cadena', rarity: 'common', max: 5,
    pros: () => ['Los combos dan un <b>+60%</b> de puntos'],
    apply: (m) => { m.comboMult += 0.6; },
  },
  {
    id: 'dike', name: 'Dique', rarity: 'common', max: 3,
    pros: () => ['La basura tarda <b>4 piezas más</b> en subir'],
    apply: (m) => { m.garbageDelay += 4; },
  },
  {
    id: 'dice', name: 'Dados', rarity: 'common', max: 99,
    pros: () => ['<b>+2 rerolls</b> al elegir mejoras'],
    apply: (_m, g) => { g.rerolls += 2; },
  },
  {
    id: 'hammer', name: 'Martillo', rarity: 'common', max: 3,
    pros: () => ['El hard drop da <b>×3 puntos</b> por casilla'],
    cons: () => ['El soft drop <b>ya no da puntos</b>'],
    apply: (m) => { m.hardDropMult *= 3; m.softDropPoints = false; },
  },
  {
    id: 'domino', name: 'Dominó', rarity: 'common', max: 2,
    pros: (s) => [`Cada bolsa trae ${s > 1 ? '<b>2 dominós</b>' : 'un <b>dominó</b>'} (2 bloques)`],
    apply: (m) => { m.extraPieces.push('D2'); },
  },
  {
    id: 'corner', name: 'Esquina', rarity: 'common', max: 2,
    pros: (s) => [`Cada bolsa trae ${s > 1 ? '<b>2 esquinas</b>' : 'una <b>esquina</b>'} (3 bloques en L)`],
    apply: (m) => { m.extraPieces.push('V3'); },
  },
  {
    id: 'shortbar', name: 'Barra corta', rarity: 'common', max: 2,
    pros: (s) => [`Cada bolsa trae ${s > 1 ? '<b>2 barras cortas</b>' : 'una <b>barra corta</b>'} (3 bloques)`],
    apply: (m) => { m.extraPieces.push('I3'); },
  },
  {
    id: 'breather', name: 'Respiro', rarity: 'common', max: 2,
    pros: (s) => [`Al subir de nivel se borran las <b>${s * 3} filas</b> de abajo`],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.levelClearRows += 3; m.linesReduction -= 1; },
  },
  {
    id: 'savings', name: 'Ahorro', rarity: 'common', max: 2,
    pros: (s) => [`Cada reroll que guardas da <b>+${s * 10}%</b> a toda la puntuación (hasta <b>5</b> rerolls)`],
    cons: () => ['Gastar un reroll <b>baja</b> ese extra'],
    apply: (m) => { m.savings += 0.1; },
  },
  {
    id: 'harvest', name: 'Cosecha', rarity: 'common', max: 2,
    pros: (s) => [`Cada <b>${s > 1 ? 6 : 10} líneas</b> ganas <b>+1 reroll</b>`],
    apply: (m) => { m.harvestEvery = m.harvestEvery ? 6 : 10; },
  },
  {
    id: 'reflex', name: 'Reflejos', rarity: 'common', max: 3,
    pros: (s) => [`Si una pieza limpia líneas en menos de <b>1,5 s</b> desde que aparece, cada línea da <b>+${s * 60} × nivel</b>`],
    cons: () => ['Las piezas caen un <b>8% más rápido</b>'],
    apply: (m) => { m.reflexPoints += 60; m.gravitySpeed *= 1.08; },
  },
  // ───────── Raras ─────────
  {
    id: 'clover', name: 'Trébol', rarity: 'rare', max: 3,
    pros: () => ['Salen más mejoras <b>raras</b>, y más <b>épicas y legendarias</b> si ya las has desbloqueado'],
    apply: (m) => { m.luck += 1; },
  },
  {
    id: 'doublehold', name: 'Bolsillo doble', rarity: 'rare', max: 1,
    pros: () => ['Guardas <b>2 piezas</b> en el hold'],
    cons: () => ['Ves <b>1 pieza menos</b> en la cola'],
    apply: (m) => { m.holdSlots = 2; m.preview = Math.max(1, m.preview - 1); },
  },
  {
    id: 'freehold', name: 'Hold libre', rarity: 'rare', max: 1,
    pros: () => ['Usa el hold <b>sin límite</b> con la misma pieza'],
    cons: () => ['Cada hold cuesta <b>50 × nivel</b> puntos'],
    apply: (m) => { m.infiniteHold = true; m.holdCost = 50; },
  },
  {
    id: 'bomb', name: 'Bomba', rarity: 'rare', max: 3,
    pros: (s) => [`Cada <b>${[12, 9, 6][s - 1]} piezas</b> sale una bomba`, 'Al caer revienta un área de <b>5×5</b>'],
    apply: (m) => { m.bombEvery = m.bombEvery ? m.bombEvery - 3 : 12; },
  },
  {
    id: 'drill', name: 'Taladro', rarity: 'rare', max: 3,
    pros: (s) => [`Cada <b>${[14, 11, 8][s - 1]} piezas</b> destruye la fila de abajo`, 'Cuenta como <b>línea</b>'],
    apply: (m) => { m.drillEvery = m.drillEvery ? m.drillEvery - 3 : 14; },
  },
  {
    id: 'gold', name: 'Fiebre del oro', rarity: 'rare', max: 4,
    pros: (s) => [`Un <b>${s * 12}%</b> de las piezas son de oro`, 'Cada bloque de oro en una línea: <b>+300 × nivel</b>'],
    cons: () => ['Las piezas de oro caen <b>el doble de rápido</b>'],
    apply: (m) => { m.goldChance += 0.12; },
  },
  {
    id: 'irain', name: 'Lluvia de I', rarity: 'rare', max: 2,
    pros: () => ['Cada bolsa trae <b>una I extra</b>'],
    cons: () => ['…y también <b>una S o Z extra</b>'],
    apply: (m) => { m.extraPieces.push('I', 'SZ'); },
  },
  {
    id: 'life', name: 'Segunda vida', rarity: 'rare', max: 3,
    pros: () => ['<b>+1 vida</b>: al perder se vacía el tablero y sigues'],
    cons: () => ['<b>−15%</b> a toda la puntuación'],
    apply: (m, g) => { g.lives += 1; m.scoreMult *= 0.85; },
  },
  {
    id: 'exp', name: 'Experiencia', rarity: 'rare', max: 3,
    pros: () => ['Los cuádruples y los giros cuentan <b>+2 líneas</b> para subir de nivel'],
    apply: (m) => { m.expBonus += 2; },
  },
  {
    id: 'mono', name: 'Monominó', rarity: 'rare', max: 2,
    pros: (s) => [`Cada bolsa trae ${s > 1 ? '<b>2 monominós</b>' : 'un <b>monominó</b>'} (1 bloque)`],
    cons: () => ['Las líneas que completa dan <b>la mitad</b> de puntos'],
    apply: (m) => { m.extraPieces.push('M1'); },
  },
  {
    id: 'hook', name: 'Gancho', rarity: 'rare', max: 1,
    pros: () => ['Cada bolsa trae un <b>gancho</b> de 5 bloques', 'Las líneas que completa valen <b>×2</b>'],
    cons: () => ['Es una pieza <b>torpe</b> de encajar'],
    apply: (m) => { m.extraPieces.push('P5'); },
  },
  {
    id: 'recycle', name: 'Reciclaje', rarity: 'rare', max: 2,
    pros: (s) => [`Cada fila de basura que limpias cuenta <b>+${s} línea${s > 1 ? 's' : ''}</b> para subir de nivel`, `…y da <b>${s * 200} × nivel</b> puntos`],
    cons: () => ['Las piezas caen un <b>10% más rápido</b>'],
    apply: (m) => { m.recycle += 1; m.gravitySpeed *= 1.1; },
  },
  {
    id: 'vertigo', name: 'Vértigo', rarity: 'rare', max: 2,
    pros: (s) => [`Con el montón por encima de la <b>mitad</b>, <b>×${1 + s * 0.5}</b> a toda la puntuación`],
    cons: () => ['Las piezas caen un <b>10% más rápido</b>'],
    apply: (m) => { m.vertigo += 0.5; m.gravitySpeed *= 1.1; },
  },
  {
    id: 'lifeline', name: 'Salvavidas', rarity: 'rare', max: 1,
    pros: () => ['Con el montón por encima del <b>70%</b>, la siguiente pieza es una <b>barra I</b>', 'Como mucho una vez cada <b>12 piezas</b>'],
    cons: () => ['<b>−10%</b> a toda la puntuación'],
    apply: (m) => { m.lifeline = true; m.scoreMult *= 0.9; },
  },
  {
    id: 'fan', name: 'Abanico', rarity: 'rare', max: 1,
    pros: () => ['Eliges entre <b>4 cartas</b> en vez de 3'],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.choices = 4; m.linesReduction -= 1; },
  },
  // ───────── Épicas ─────────
  {
    id: 'cross', name: 'Cruz', rarity: 'epic', max: 1,
    pros: () => ['Cada bolsa cambia la <b>T</b> por una <b>cruz</b> de 5 bloques', 'Las líneas que completa valen <b>×3</b>'],
    cons: () => ['Sin pieza <b>T</b> no hay <b>giros T</b>'],
    apply: (m) => { m.crossSwap = true; },
  },
  {
    id: 'allspin', name: 'Maestro del giro', rarity: 'epic', max: 1,
    pros: () => ['<b>Todas las piezas</b> hacen giros y puntúan como un giro T'],
    cons: () => ['Los cuádruples dan un <b>25% menos</b>'],
    apply: (m) => { m.allSpin = true; m.quadMult *= 0.75; },
  },
  {
    id: 'b2b', name: 'Fuego cruzado', rarity: 'epic', max: 2,
    pros: () => ['El bonus back-to-back sube <b>+×1</b>'],
    cons: () => ['Los combos dan un <b>30% menos</b>'],
    apply: (m) => { m.b2bMult += 1; m.comboMult = Math.max(0, m.comboMult - 0.3); },
  },
  {
    id: 'eternal', name: 'Combo eterno', rarity: 'epic', max: 2,
    pros: (s) => [`El combo aguanta <b>${s} pieza${s > 1 ? 's' : ''}</b> sin limpiar línea`],
    cons: () => ['Los singles dan <b>la mitad</b> de puntos'],
    apply: (m) => { m.comboGrace += 1; m.singleMult = 0.5; },
  },
  {
    id: 'instinct', name: 'Instinto', rarity: 'epic', max: 1,
    pros: () => ['Con el montón por encima del <b>70%</b>, el tiempo va <b>muy lento</b>'],
    cons: () => ['El resto del tiempo las piezas caen un <b>10% más rápido</b>'],
    apply: (m) => { m.instinct = true; },
  },
  {
    id: 'interest', name: 'Interés compuesto', rarity: 'epic', max: 3,
    pros: (s) => [`Al subir de nivel ganas un <b>${pct(s * 0.1)}</b> de tu puntuación`],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.interest += 0.1; m.linesReduction -= 1; },
  },
  {
    id: 'pact', name: 'Pacto', rarity: 'epic', max: 2,
    pros: () => ['<b>×2</b> a toda la puntuación'],
    cons: () => ['Las piezas caen un <b>35% más rápido</b>'],
    apply: (m) => { m.scoreMult *= 2; m.gravitySpeed *= 1.35; },
  },
  {
    id: 'anchor', name: 'Ancla', rarity: 'epic', max: 1,
    pros: () => ['Mientras encadenas líneas <b>pieza tras pieza</b>, la basura <b>no avanza</b>'],
    cons: () => ['Los combos dan un <b>25% menos</b>'],
    apply: (m) => { m.anchor = true; m.comboMult = Math.max(0, m.comboMult - 0.25); },
  },
  {
    id: 'collector', name: 'Coleccionista', rarity: 'epic', max: 1,
    pros: () => ['<b>+6%</b> a toda la puntuación por cada <b>mejora distinta</b> que tengas'],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.collector += 0.06; m.linesReduction -= 1; },
  },
  // ───────── Legendarias ─────────
  {
    id: 'quake', name: 'Terremoto', rarity: 'legendary', max: 1,
    pros: () => ['Tras un <b>cuádruple</b> o un <b>giro doble</b>, todo cae rellenando huecos', 'Las líneas nuevas se <b>encadenan</b> con multiplicador'],
    cons: () => ['La basura sube <b>3 piezas antes</b>'],
    apply: (m) => { m.quake = true; m.garbageDelay -= 3; },
  },
  {
    id: 'prism', name: 'Prisma', rarity: 'legendary', max: 2,
    pros: (s) => [`Cada <b>${s > 1 ? 10 : 16} piezas</b> sale un prisma`, 'Al caer borra <b>todos los bloques</b> del color en que aterriza', 'Lo que queda encima <b>cae</b> a los huecos'],
    cons: () => ['Las piezas caen un <b>15% más rápido</b>'],
    apply: (m) => { m.prismEvery = m.prismEvery ? 10 : 16; m.gravitySpeed *= 1.15; },
  },
  {
    id: 'phoenix', name: 'Fénix', rarity: 'legendary', max: 1,
    pros: () => ['<b>+1 vida</b>', 'Al revivir, el tablero queda <b>vacío del todo</b>', 'Cada vez que revives, <b>+25%</b> a toda la puntuación (tope <b>+50%</b>)'],
    cons: () => ['Las piezas caen un <b>15% más rápido</b>'],
    apply: (m, g) => { g.lives += 1; m.phoenix = true; m.gravitySpeed *= 1.15; },
  },
];

/**
 * Maldiciones: en una oferta maldita las tres cartas son malas y hay que quedarse con la menos mala.
 * Son de distinto tipo a propósito, para que la elección dependa de cómo juegas y de lo que ya tienes.
 */
export const CURSES: PerkDef[] = [
  {
    id: 'c_lead', name: 'Plomo', rarity: 'common', max: 3, curse: true,
    pros: () => [], cons: () => ['Las piezas caen un <b>10% más rápido</b>'],
    apply: (m) => { m.gravitySpeed *= 1.1; },
  },
  {
    id: 'c_fog', name: 'Niebla', rarity: 'common', max: 2, curse: true,
    pros: () => [], cons: () => ['Ves <b>1 pieza menos</b> en la cola'],
    apply: (m) => { m.preview = Math.max(1, m.preview - 1); },
  },
  {
    id: 'c_rust', name: 'Óxido', rarity: 'common', max: 2, curse: true,
    pros: () => [], cons: () => ['<b>−120 ms</b> antes de que la pieza se fije'],
    apply: (m) => { m.lockDelay = Math.max(150, m.lockDelay - 120); },
  },
  {
    id: 'c_debt', name: 'Deuda', rarity: 'common', max: 3, curse: true,
    pros: () => [], cons: () => ['<b>−15%</b> a toda la puntuación'],
    apply: (m) => { m.scoreMult *= 0.85; },
  },
  {
    id: 'c_tide', name: 'Marea', rarity: 'common', max: 2, curse: true,
    pros: () => [], cons: () => ['La basura sube <b>1 pieza antes</b>'],
    apply: (m) => { m.garbageDelay -= 1; },
  },
  {
    id: 'c_slope', name: 'Cuesta', rarity: 'common', max: 3, curse: true,
    pros: () => [], cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.linesReduction -= 1; },
  },
  {
    id: 'c_crack', name: 'Grieta', rarity: 'common', max: 3, curse: true,
    pros: () => [], cons: () => ['Pierdes <b>1 reroll</b> (si no tienes, no pasa nada)'],
    apply: (_m, g) => { g.rerolls = Math.max(0, g.rerolls - 1); },
  },
  {
    id: 'c_ballast', name: 'Lastre', rarity: 'common', max: 1, curse: true,
    pros: () => [], cons: () => ['Cada bolsa trae <b>una S o Z extra</b>'],
    apply: (m) => { m.extraPieces.push('SZ'); },
  },
];

export const PERK_BY_ID: Record<string, PerkDef> = Object.fromEntries([...PERKS, ...CURSES].map((p) => [p.id, p]));

const NO_LOCKED: ReadonlySet<string> = new Set();

/** Un perk está disponible si su rareza ya se desbloqueó con el mejor nivel alcanzado. */
export function isUnlocked(p: PerkDef, bestLevel: number): boolean {
  return bestLevel >= UNLOCK_LEVEL[p.rarity];
}

/** Saca `n` perks distintos ponderados por rareza (y suerte). `bestLevel` filtra por desbloqueos; `rand` permite usar una semilla. */
export function rollPerks(
  owned: Map<string, number>,
  luck: number,
  n = 3,
  bestLevel = Infinity,
  rand: () => number = Math.random,
  /** Perks bloqueados por retos (Expedición): no salen. */
  locked: ReadonlySet<string> = NO_LOCKED,
): PerkDef[] {
  const pool = PERKS.filter((p) => (owned.get(p.id) ?? 0) < p.max && isUnlocked(p, bestLevel) && !locked.has(p.id));
  const weight = (p: PerkDef) => {
    const base = RARITY_WEIGHT[p.rarity];
    if (p.rarity === 'common') return base;
    return base * (1 + luck * (p.rarity === 'rare' ? 0.35 : p.rarity === 'epic' ? 0.7 : 1));
  };
  const picks: PerkDef[] = [];
  while (picks.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + weight(p), 0);
    let r = rand() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= weight(pool[idx]);
      if (r <= 0) break;
    }
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picks;
}

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/** Peso de una rareza con la suerte de Trébol (lo mismo que usa `rollPerks` carta a carta). */
function rarityWeight(r: Rarity, luck: number): number {
  const base = RARITY_WEIGHT[r];
  if (r === 'common') return base;
  return base * (1 + luck * (r === 'rare' ? 0.35 : r === 'epic' ? 0.7 : 1));
}

/** Saca `n` cartas distintas de `pool` sin reponer, con igual probabilidad. */
function drawUniform(pool: PerkDef[], n: number, rand: () => number): PerkDef[] {
  const left = [...pool];
  const out: PerkDef[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rand() * left.length), 1)[0]);
  return out;
}

/** Rarezas que pueden salir en una oferta y su peso: por carta (con la suerte) × cartas disponibles. */
function offerRarities(owned: Map<string, number>, luck: number, bestLevel: number, blessed: boolean, locked: ReadonlySet<string>) {
  const avail = PERKS.filter((p) => (owned.get(p.id) ?? 0) < p.max && isUnlocked(p, bestLevel) && !locked.has(p.id));
  const byRarity = (r: Rarity) => avail.filter((p) => p.rarity === r);
  let rarities = RARITIES.filter((r) => byRarity(r).length > 0);
  if (blessed && rarities.some((r) => r !== 'common')) rarities = rarities.filter((r) => r !== 'common');
  // peso por carta × cartas disponibles: cada rareza sale tan a menudo como cuando se sorteaba carta a carta
  const weights = rarities.map((r) => rarityWeight(r, luck) * byRarity(r).length);
  return { rarities, weights, byRarity };
}

/** Probabilidad de que la oferta sea de cada rareza (lo que se enseña en la pantalla de cartas). */
export function offerOdds(
  owned: Map<string, number>,
  luck: number,
  bestLevel = Infinity,
  blessed = false,
  locked: ReadonlySet<string> = NO_LOCKED,
): Record<Rarity, number> {
  const { rarities, weights } = offerRarities(owned, luck, bestLevel, blessed, locked);
  const total = weights.reduce((s, w) => s + w, 0);
  const odds: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  rarities.forEach((r, i) => (odds[r] = total > 0 ? weights[i] / total : 0));
  return odds;
}

/**
 * Oferta de una subida de nivel: primero se sortea una rareza (con sus pesos, la suerte, los
 * desbloqueos y cuántas cartas quedan de ella) y las cartas son todas de esa rareza. Si no quedan bastantes, se completa con
 * las rarezas de al lado, empezando por las de abajo.
 */
export function rollOffer(
  owned: Map<string, number>,
  luck: number,
  n = 3,
  bestLevel = Infinity,
  rand: () => number = Math.random,
  /** Tras una oferta maldita la siguiente es rara o mejor (si hay alguna disponible). */
  blessed = false,
  locked: ReadonlySet<string> = NO_LOCKED,
): PerkDef[] {
  const { rarities, weights, byRarity } = offerRarities(owned, luck, bestLevel, blessed, locked);
  if (!rarities.length) return [];
  const total = weights.reduce((s, w) => s + w, 0);
  let x = rand() * total;
  let idx = 0;
  for (; idx < rarities.length - 1; idx++) {
    x -= weights[idx];
    if (x <= 0) break;
  }
  const picks = drawUniform(byRarity(rarities[idx]), n, rand);
  // relleno: primero las rarezas más bajas cercanas, luego las más altas
  const order = [...rarities.slice(0, idx).reverse(), ...rarities.slice(idx + 1)];
  for (const r of order) {
    if (picks.length >= n) break;
    picks.push(...drawUniform(byRarity(r), n - picks.length, rand));
  }
  return picks;
}

/** Oferta maldita: `n` maldiciones distintas que aún no estén al máximo. */
export function rollCurses(owned: Map<string, number>, n = 3, rand: () => number = Math.random): PerkDef[] {
  return drawUniform(CURSES.filter((p) => (owned.get(p.id) ?? 0) < p.max), n, rand);
}
