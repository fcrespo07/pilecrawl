import type { Game } from './game';
import { UNLOCK_LEVEL } from './meta';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Todo lo que los perks pueden tocar. La lógica del juego lee de aquí. */
export interface Mods {
  preview: number;
  holdSlots: number;
  /** Sin reserva (Presión): no se puede guardar ninguna pieza. */
  noHold: boolean;
  /** Nivel desde el que llega la basura (4 normal; 2 con Presión «Basura temprana»). */
  garbageFrom: number;
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
  /** líneas extra de la primera línea de cada nivel; al subir de nivel sube una fila de basura (Atajo) */
  shortcut: number;
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
  /** +puntuación por punto de racha, de 0 a 100 (Furia) */
  fury: number;
  /** multiplicador de lo que baja la racha con cada pieza (Furia) */
  streakDecayMult: number;
  /** las líneas cuentan además esta fracción extra para subir de nivel (Eco) */
  echo: number;
  /** rerolls que se ganan al subir de nivel (Casino) */
  rerollPerLevel: number;
  /** maldición: solo se ve la siguiente pieza (Cola ciega) */
  blindQueue: boolean;
  /** maldición: sin fantasma (Sin fantasma) */
  noGhost: boolean;
  /** maldición: cada tantas piezas llega una que cae al doble; 0 = no (Pieza pesada) */
  heavyEvery: number;
  /** maldición: cada tantas piezas el tablero se desplaza una columna; 0 = no (Deriva) */
  driftEvery: number;
  /** maldición: cada tantas piezas un bloque cambia de sitio; 0 = no (Ruleta) */
  rouletteEvery: number;
  /** habilidad activa de la partida ('' = ninguna): una vez por nivel, con la tecla de habilidad */
  skill: '' | 'tactic' | 'wild';
  /** al limpiar líneas desaparece además el bloque más alto (Erosión) */
  erosion: boolean;
  /** cada subida de nivel da una carta extra (Tahúr) */
  gambler: boolean;
  /** probabilidad extra (0 a 1) de que una subida de nivel traiga oferta maldita */
  curseChance: number;
}

export function baseMods(): Mods {
  return {
    preview: 3,
    holdSlots: 1,
    noHold: false,
    garbageFrom: 4,
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
    shortcut: 0,
    harvestEvery: 0,
    reflexPoints: 0,
    recycle: 0,
    vertigo: 0,
    lifeline: false,
    anchor: false,
    collector: 0,
    phoenix: false,
    fury: 0,
    streakDecayMult: 1,
    echo: 0,
    rerollPerLevel: 0,
    blindQueue: false,
    noGhost: false,
    heavyEvery: 0,
    driftEvery: 0,
    rouletteEvery: 0,
    skill: '',
    erosion: false,
    gambler: false,
    curseChance: 0,
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
  /** Nivel de mejor marca para que salga; por defecto el de su rareza (`UNLOCK_LEVEL`). */
  unlock?: number;
  /** Peso al sacar cartas dentro de su rareza (1 por defecto); menos de 1 la hace salir menos que sus hermanas. */
  weight?: number;
  /** Maldición: solo sale en las ofertas malditas y no tiene ventaja (sus efectos van en `cons`). */
  curse?: boolean;
  /** Habilidad activa: solo puedes tener una por partida (las demás dejan de salir en las ofertas). */
  skill?: boolean;
}

/** Peso por carta: solo lo usa `rollPerks` (la mejora inicial del diario, que no pasa de rara). */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 28, epic: 10, legendary: 3 };
/**
 * Peso de cada rareza en una oferta. Va por rareza, no por carta: con el peso por carta, las 24 comunes
 * se comían la oferta y una legendaria salía en menos de 1 de cada 200 (había 3 legendarias por 24 comunes).
 */
export const OFFER_WEIGHT: Record<Rarity, number> = { common: 52, rare: 30, epic: 13, legendary: 5 };

/** Calor por rareza (0 a 100): lo suben distintos tipos de limpieza y multiplica el peso de esa rareza. Ver `streak.ts`. */
export type Heat = Record<Exclude<Rarity, 'common'>, number>;
export const NO_HEAT: Heat = { rare: 0, epic: 0, legendary: 0 };
export const HEAT_MAX = 100;
/** Cuánto multiplica el peso a calor lleno: ×(1 + K). */
export const HEAT_BOOST: Heat = { rare: 1.2, epic: 4, legendary: 14 };
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
    id: 'calm', name: 'Pulso tranquilo', rarity: 'common', max: 3,
    pros: () => ['<b>+100 ms</b> de margen antes de que la pieza se fije', 'Las piezas caen un <b>6% más lento</b>'],
    apply: (m) => { m.lockDelay += 100; m.gravitySpeed *= 0.94; },
  },
  {
    // el comodín sin tope: la oferta nunca se queda sin cartas (ver perks.test.ts)
    id: 'dice', name: 'Dados', rarity: 'common', max: 99,
    pros: () => ['<b>+2 rerolls</b> al elegir mejoras'],
    apply: (_m, g) => { g.rerolls += 2; },
  },
  {
    id: 'greed', name: 'Codicia', rarity: 'common', max: 3,
    pros: () => ['<b>+30%</b> a toda la puntuación'],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.scoreMult *= 1.3; m.linesReduction -= 1; },
  },
  {
    id: 'shortcut', name: 'Atajo', rarity: 'common', max: 2,
    pros: (st) => [`La <b>primera línea</b> de cada nivel cuenta <b>×${1 + st * 2}</b> para subir de nivel`],
    cons: () => ['Cada vez que subes de nivel, la próxima fila de basura se acerca <b>3 piezas</b>'],
    apply: (m) => { m.shortcut += 1; },
  },
  {
    id: 'chain', name: 'Cadena', rarity: 'common', max: 5,
    pros: () => ['El bonus de combo sube un <b>60%</b>'],
    apply: (m) => { m.comboMult += 0.6; },
  },
  {
    id: 'dike', name: 'Dique', rarity: 'common', max: 3,
    pros: () => ['La basura tarda <b>3 piezas más</b> en subir'],
    apply: (m) => { m.garbageDelay += 3; },
  },
  {
    id: 'hammer', name: 'Martillo', rarity: 'common', max: 3,
    pros: (s) => [`El hard drop da <b>×${1 + s * 2}</b> de puntos por fila (${2 + s * 4} en vez de 2)`],
    cons: () => ['Bajar con soft drop <b>ya no suma puntos</b>'],
    apply: (m) => { m.hardDropMult += 2; m.softDropPoints = false; },
  },
  {
    id: 'harvest', name: 'Cosecha', rarity: 'common', max: 2,
    pros: (s) => [`Cada <b>${s > 1 ? 6 : 10} líneas</b> que limpias ganas <b>+1 reroll</b>`],
    apply: (m) => { m.harvestEvery = m.harvestEvery ? 6 : 10; },
  },
  {
    id: 'reflex', name: 'Reflejos', rarity: 'common', max: 3,
    pros: (s) => [`Si una pieza completa líneas <b>a menos de 1,5 s</b> de aparecer, cada línea da <b>+${s * 60} × nivel</b> más`],
    cons: () => ['Las piezas caen un <b>8% más rápido</b>'],
    apply: (m) => { m.reflexPoints += 60; m.gravitySpeed *= 1.08; },
  },
  {
    id: 'tactic', name: 'Pausa táctica', rarity: 'common', max: 1, skill: true,
    pros: () => ['Una vez por nivel, con la tecla de <b>habilidad</b>, la caída se <b>congela 3 s</b> (tampoco baja con la flecha)'],
    cons: () => ['Mientras dura <b>no puedes girar</b>', 'Solo puedes tener <b>una habilidad</b> por partida'],
    apply: (m) => { m.skill = 'tactic'; },
  },
  // ───────── Raras ─────────
  {
    id: 'wild', name: 'Comodín', rarity: 'rare', max: 1, skill: true,
    pros: () => ['Una vez por nivel, con la tecla de <b>habilidad</b>, <b>descartas la pieza actual</b>: llega la siguiente de la cola'],
    cons: () => ['Descartar te quita <b>25 de racha</b>', 'No vale con piezas <b>especiales</b> (bomba, prisma, oro, pesada)', 'Solo puedes tener <b>una habilidad</b> por partida'],
    apply: (m) => { m.skill = 'wild'; },
  },
  {
    id: 'clover', name: 'Trébol', rarity: 'rare', max: 3,
    pros: () => ['Las ofertas traen más mejoras <b>raras</b>, y más <b>épicas y legendarias</b> (si ya están desbloqueadas)'],
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
    pros: () => ['Puedes guardar la <b>misma pieza</b> en la reserva las veces que quieras'],
    cons: () => ['Cada vez que guardas una pieza pierdes <b>50 × nivel</b> puntos'],
    apply: (m) => { m.infiniteHold = true; m.holdCost = 50; },
  },
  {
    id: 'bomb', name: 'Bomba', rarity: 'rare', max: 3,
    pros: (s) => [`Cada <b>${[12, 9, 6][s - 1]} piezas</b> sale una bomba`, 'Al fijarse revienta un área de <b>5×5</b>'],
    apply: (m) => { m.bombEvery = m.bombEvery ? m.bombEvery - 3 : 12; },
  },
  {
    id: 'drill', name: 'Taladro', rarity: 'rare', max: 3,
    pros: (s) => [`Cada <b>${[14, 11, 8][s - 1]} piezas</b> sale un taladro que destruye la fila de abajo`, 'Cuenta como <b>línea</b>'],
    apply: (m) => { m.drillEvery = m.drillEvery ? m.drillEvery - 3 : 14; },
  },
  {
    id: 'gold', name: 'Fiebre del oro', rarity: 'rare', max: 3,
    pros: (s) => [`Un <b>${s * 12}%</b> de las piezas son de oro`, 'Cada bloque de oro en una línea: <b>+150 × nivel</b>'],
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
    id: 'exp', name: 'Experiencia', rarity: 'rare', max: 3,
    pros: () => ['Los cuádruples y los giros suman <b>2 líneas más</b> de progreso de nivel'],
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
    pros: (s) => [`Cada fila de basura que limpias cuenta <b>+${s} línea${s > 1 ? 's' : ''}</b> para subir de nivel`, `…y da <b>${s * 200} × nivel</b> puntos por fila`],
    cons: () => ['Las piezas caen un <b>10% más rápido</b>'],
    apply: (m) => { m.recycle += 1; m.gravitySpeed *= 1.1; },
  },
  {
    id: 'vertigo', name: 'Vértigo', rarity: 'rare', max: 2,
    pros: (s) => [`Si el montón pasa de la <b>mitad</b> del tablero, <b>×${1 + s * 0.5}</b> a toda la puntuación`],
    cons: () => ['Las piezas caen un <b>10% más rápido</b>'],
    apply: (m) => { m.vertigo += 0.5; m.gravitySpeed *= 1.1; },
  },
  {
    id: 'lifeline', name: 'Salvavidas', rarity: 'rare', max: 1,
    pros: () => ['Si el montón pasa del <b>70%</b>, la siguiente pieza es una <b>barra I</b>', 'Como mucho una vez cada <b>12 piezas</b>'],
    cons: () => ['<b>−10%</b> a toda la puntuación'],
    apply: (m) => { m.lifeline = true; m.scoreMult *= 0.9; },
  },
  {
    id: 'fan', name: 'Abanico', rarity: 'rare', max: 1,
    pros: () => ['Eliges entre <b>4 cartas</b> en vez de 3'],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.choices += 1; m.linesReduction -= 1; },
  },
  {
    id: 'breather', name: 'Respiro', rarity: 'rare', max: 2,
    pros: (s) => [`Al subir de nivel se quitan las <b>${s * 3} filas</b> de abajo del tablero`],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.levelClearRows += 3; m.linesReduction -= 1; },
  },
  {
    id: 'domino', name: 'Dominó', rarity: 'rare', max: 2,
    pros: (s) => [`Cada bolsa trae ${s > 1 ? '<b>2 dominós</b>' : 'un <b>dominó</b>'} (2 bloques)`],
    apply: (m) => { m.extraPieces.push('D2'); },
  },
  {
    id: 'shortbar', name: 'Barra corta', rarity: 'rare', max: 2,
    pros: (s) => [`Cada bolsa trae ${s > 1 ? '<b>2 barras cortas</b>' : 'una <b>barra corta</b>'} (3 bloques)`],
    apply: (m) => { m.extraPieces.push('I3'); },
  },
  // ───────── Épicas ─────────
  {
    id: 'erosion', name: 'Erosión', rarity: 'epic', max: 1,
    pros: () => ['Cada vez que limpias líneas desaparece además el <b>bloque más alto</b> del tablero'],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.erosion = true; m.linesReduction -= 1; },
  },
  {
    id: 'gambler', name: 'Tahúr', rarity: 'epic', max: 1,
    pros: () => ['Cada subida de nivel te da <b>una carta extra</b>: eliges dos veces'],
    cons: () => ['Necesitas <b>+3 líneas</b> para subir de nivel', 'Con más ofertas, hay más ocasiones de <b>maldición</b>', 'La carta extra <b>no se puede saltar</b>'],
    apply: (m) => { m.gambler = true; m.linesReduction -= 3; },
  },
  {
    id: 'allspin', name: 'Maestro del giro', rarity: 'epic', max: 1,
    pros: () => ['Cualquier pieza que no sea el cuadrado cuenta como <b>giro</b> si, tras girarla, no puede moverse a izquierda, derecha ni arriba, y puntúa como uno'],
    cons: () => ['Los cuádruples dan un <b>25% menos</b>'],
    apply: (m) => { m.allSpin = true; m.quadMult *= 0.75; },
  },
  {
    id: 'b2b', name: 'Fuego cruzado', rarity: 'epic', max: 2,
    pros: () => ['Encadenar cuádruples o giros (back-to-back) suma <b>+1</b> a su bonus por cada copia: de ×1,5 a ×2,5'],
    apply: (m) => { m.b2bMult += 1; },
  },
  {
    id: 'eternal', name: 'Combo eterno', rarity: 'epic', max: 2,
    pros: (s) => [`El combo sobrevive a <b>${s} pieza${s > 1 ? 's' : ''}</b> seguidas sin limpiar línea`],
    cons: () => ['Limpiar una sola línea da <b>la mitad</b> de puntos'],
    apply: (m) => { m.comboGrace += 1; m.singleMult = 0.5; },
  },
  {
    id: 'instinct', name: 'Instinto', rarity: 'epic', max: 1,
    pros: () => ['Si el montón pasa del <b>70%</b>, las piezas caen <b>unas tres veces más lento</b>'],
    cons: () => ['El resto del tiempo las piezas caen un <b>10% más rápido</b>'],
    apply: (m) => { m.instinct = true; },
  },
  {
    id: 'interest', name: 'Interés compuesto', rarity: 'epic', max: 3,
    pros: (s) => [`Al subir de nivel, la puntuación sube un <b>${pct(s * 0.1)}</b> (de lo que tengas en ese momento)`],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.interest += 0.1; m.linesReduction -= 1; },
  },
  {
    id: 'pact', name: 'Pacto', rarity: 'epic', max: 2,
    pros: () => ['<b>×2</b> a toda la puntuación'],
    cons: () => ['Las piezas caen un <b>35% más rápido</b>', 'Las ofertas malditas salen <b>10% más</b> a menudo'],
    apply: (m) => { m.scoreMult *= 2; m.gravitySpeed *= 1.35; m.curseChance += 0.1; },
  },
  {
    id: 'anchor', name: 'Ancla', rarity: 'epic', max: 1,
    pros: () => ['Mientras encadenas líneas <b>pieza tras pieza</b>, la basura <b>no avanza</b>'],
    cons: () => ['El bonus de combo es un <b>25% menor</b>'],
    apply: (m) => { m.anchor = true; m.comboMult = Math.max(0, m.comboMult - 0.25); },
  },
  {
    id: 'collector', name: 'Coleccionista', rarity: 'epic', max: 1,
    pros: () => ['<b>+8%</b> a toda la puntuación por cada <b>mejora distinta</b> que tengas'],
    cons: () => ['Necesitas <b>+1 línea</b> para subir de nivel'],
    apply: (m) => { m.collector += 0.08; m.linesReduction -= 1; },
  },
  {
    id: 'cross', name: 'Cruz', rarity: 'epic', max: 1,
    pros: () => ['Cada bolsa cambia la <b>T</b> por una <b>cruz</b> de 5 bloques', 'Las líneas que completa valen <b>×5</b>'],
    cons: () => ['Como no hay T, tampoco hay <b>giros de T</b>'],
    apply: (m) => { m.crossSwap = true; },
  },
  // ───────── Legendarias ─────────
  {
    id: 'life', name: 'Segunda vida', rarity: 'legendary', max: 2, unlock: 0, weight: 0.25, // la red de seguridad no se bloquea a quien empieza
    pros: () => ['<b>+1 vida</b>: al perder se vacía el tablero y sigues'],
    cons: () => ['<b>−15%</b> a toda la puntuación'],
    apply: (m, g) => { g.lives += 1; m.scoreMult *= 0.85; },
  },
  {
    id: 'fury', name: 'Furia', rarity: 'legendary', max: 1,
    pros: () => ['Cuanta más racha, más puntos: a racha llena, <b>×2</b> a toda la puntuación'],
    cons: () => ['La racha baja <b>una vez y media más rápido</b> con cada pieza fijada'],
    apply: (m) => { m.fury += 1; m.streakDecayMult *= 1.5; },
  },
  {
    id: 'echo', name: 'Eco', rarity: 'legendary', max: 1,
    pros: () => ['Cada línea cuenta <b>doble</b> para subir de nivel: subes más veces y recibes más cartas'],
    cons: () => ['La basura sube <b>2 piezas antes</b>', 'Las piezas caen un <b>10% más rápido</b>'],
    apply: (m) => { m.echo += 1; m.garbageDelay -= 2; m.gravitySpeed *= 1.1; },
  },
  {
    id: 'casino', name: 'Casino', rarity: 'legendary', max: 1,
    pros: () => ['<b>+4 rerolls</b> ahora y <b>+1</b> en cada subida de nivel', 'Cada reroll saca una oferta nueva, con su propia rareza'],
    cons: () => ['Eliges entre <b>una carta menos</b> (mínimo 2)'],
    apply: (m, g) => { g.rerolls += 4; m.rerollPerLevel += 1; m.choices -= 1; },
  },
  {
    id: 'quake', name: 'Terremoto', rarity: 'legendary', max: 1,
    pros: () => ['Tras un <b>cuádruple</b> o un giro de <b>2 líneas o más</b>, lo que queda <b>cae</b> y rellena los huecos', 'Las líneas que salen así <b>puntúan más</b> cuantas más encadenas'],
    cons: () => ['La basura sube <b>2 piezas antes</b>'],
    apply: (m) => { m.quake = true; m.garbageDelay -= 2; },
  },
  {
    id: 'prism', name: 'Prisma', rarity: 'legendary', max: 2,
    pros: (s) => [`Cada <b>${s > 1 ? 10 : 16} piezas</b> sale un prisma`, 'Al caer borra <b>todos los bloques</b> del color en que aterriza', 'Lo que queda encima <b>cae</b> a los huecos'],
    cons: () => ['Las piezas caen un <b>15% más rápido</b>', 'Las ofertas malditas salen <b>8% más</b> a menudo'],
    apply: (m) => { m.prismEvery = m.prismEvery ? 10 : 16; m.gravitySpeed *= 1.15; m.curseChance += 0.08; },
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
    pros: () => [], cons: () => ['<b>−120 ms</b> de margen antes de que la pieza se fije'],
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
  {
    id: 'c_blind', name: 'Cola ciega', rarity: 'common', max: 1, curse: true,
    pros: () => [], cons: () => ['Solo ves <b>la siguiente pieza</b> de la cola'],
    apply: (m) => { m.blindQueue = true; },
  },
  {
    id: 'c_ghost', name: 'Sin fantasma', rarity: 'common', max: 1, curse: true,
    pros: () => [], cons: () => ['<b>Desaparece el fantasma</b> que marca dónde caerá la pieza'],
    apply: (m) => { m.noGhost = true; },
  },
  {
    id: 'c_heavy', name: 'Pieza pesada', rarity: 'common', max: 2, curse: true,
    pros: () => [], cons: (s) => [`Cada <b>${s > 1 ? 5 : 7} piezas</b> llega una gris que cae al <b>doble de rápido</b>`],
    apply: (m) => { m.heavyEvery = m.heavyEvery ? 5 : 7; },
  },
  {
    id: 'c_drift', name: 'Deriva', rarity: 'common', max: 1, curse: true,
    pros: () => [], cons: () => ['Cada <b>8 piezas</b> el tablero entero se desplaza <b>una columna</b> a la derecha (lo que sale por un lado entra por el otro)'],
    apply: (m) => { m.driftEvery = 8; },
  },
  {
    id: 'c_roulette', name: 'Ruleta', rarity: 'common', max: 1, curse: true,
    pros: () => [], cons: () => ['Cada <b>5 piezas</b> el bloque más alto de una columna salta a otra al azar'],
    apply: (m) => { m.rouletteEvery = 5; },
  },
];

export const PERK_BY_ID: Record<string, PerkDef> = Object.fromEntries([...PERKS, ...CURSES].map((p) => [p.id, p]));

const NO_LOCKED: ReadonlySet<string> = new Set();

/** Una habilidad activa ya elegida deja fuera a las demás: solo hay una tecla de habilidad. */
function skillTaken(owned: Map<string, number>, p: PerkDef): boolean {
  if (!p.skill) return false;
  for (const [id, n] of owned) if (n > 0 && PERK_BY_ID[id]?.skill) return true;
  return false;
}

/** Un perk está disponible si su rareza ya se desbloqueó con el mejor nivel alcanzado. */
export function isUnlocked(p: PerkDef, bestLevel: number): boolean {
  return bestLevel >= (p.unlock ?? UNLOCK_LEVEL[p.rarity]);
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
  const pool = PERKS.filter((p) => (owned.get(p.id) ?? 0) < p.max && isUnlocked(p, bestLevel) && !locked.has(p.id) && !skillTaken(owned, p));
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

/** Peso de una rareza en una oferta, con la suerte de Trébol y el calor de los combos. */
function rarityWeight(r: Rarity, luck: number, heat: Heat, cards: PerkDef[]): number {
  // si las cartas disponibles de la rareza pesan menos que una normal (p. ej. solo Segunda vida), la rareza sale menos
  const base = OFFER_WEIGHT[r] * Math.min(1, cards.reduce((t, p) => t + (p.weight ?? 1), 0));
  if (r === 'common') return base;
  const lucky = 1 + luck * (r === 'rare' ? 0.35 : r === 'epic' ? 0.7 : 1);
  return base * lucky * (1 + (HEAT_BOOST[r] * Math.max(0, Math.min(HEAT_MAX, heat[r]))) / HEAT_MAX);
}

/** Saca `n` cartas distintas de `pool` sin reponer, con la probabilidad de su `weight` (1 por defecto). */
function drawUniform(pool: PerkDef[], n: number, rand: () => number): PerkDef[] {
  const left = [...pool];
  const out: PerkDef[] = [];
  while (out.length < n && left.length) {
    let x = rand() * left.reduce((t, p) => t + (p.weight ?? 1), 0);
    let i = 0;
    for (; i < left.length - 1; i++) {
      x -= left[i].weight ?? 1;
      if (x < 0) break;
    }
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

/** Rarezas que pueden salir en una oferta y su peso: por carta (con la suerte) × cartas disponibles. */
function offerRarities(owned: Map<string, number>, luck: number, bestLevel: number, blessed: boolean, locked: ReadonlySet<string>, heat: Heat, minRarity?: Rarity) {
  const avail = PERKS.filter((p) => (owned.get(p.id) ?? 0) < p.max && isUnlocked(p, bestLevel) && !locked.has(p.id) && !skillTaken(owned, p));
  const byRarity = (r: Rarity) => avail.filter((p) => p.rarity === r);
  let rarities = RARITIES.filter((r) => byRarity(r).length > 0);
  if (blessed && rarities.some((r) => r !== 'common')) rarities = rarities.filter((r) => r !== 'common');
  if (minRarity) {
    const floor = RARITIES.indexOf(minRarity);
    const high = rarities.filter((r) => RARITIES.indexOf(r) >= floor);
    if (high.length > 0) rarities = high;
  }
  const weights = rarities.map((r) => rarityWeight(r, luck, heat, byRarity(r)));
  return { rarities, weights, byRarity };
}

/** Probabilidad de que la oferta sea de cada rareza (lo que se enseña en la pantalla de cartas). */
export function offerOdds(
  owned: Map<string, number>,
  luck: number,
  bestLevel = Infinity,
  blessed = false,
  locked: ReadonlySet<string> = NO_LOCKED,
  heat: Heat = NO_HEAT,
): Record<Rarity, number> {
  const { rarities, weights } = offerRarities(owned, luck, bestLevel, blessed, locked, heat);
  const total = weights.reduce((s, w) => s + w, 0);
  const odds: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  rarities.forEach((r, i) => (odds[r] = total > 0 ? weights[i] / total : 0));
  return odds;
}

/**
 * Oferta de una subida de nivel: cada carta tiene su propia rareza. Para cada hueco se sortea una rareza
 * (con sus pesos, la suerte, el calor, los desbloqueos y cuántas cartas quedan de ella) y luego una carta de esa
 * rareza que no se haya sacado ya. Así una oferta puede mezclar comunes con una épica, y cada carta que se
 * da la vuelta puede sorprender.
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
  heat: Heat = NO_HEAT,
  /** Oferta de jefe: solo esta rareza o mejor (si hay alguna disponible). */
  minRarity?: Rarity,
): PerkDef[] {
  const { rarities, byRarity } = offerRarities(owned, luck, bestLevel, blessed, locked, heat, minRarity);
  const pools = new Map<Rarity, PerkDef[]>(rarities.map((r) => [r, [...byRarity(r)]]));
  const picks: PerkDef[] = [];
  while (picks.length < n) {
    const live = rarities.filter((r) => pools.get(r)!.length > 0);
    if (!live.length) break;
    const weights = live.map((r) => rarityWeight(r, luck, heat, pools.get(r)!));
    let x = rand() * weights.reduce((t, w) => t + w, 0);
    let idx = 0;
    for (; idx < live.length - 1; idx++) {
      x -= weights[idx];
      if (x <= 0) break;
    }
    const pool = pools.get(live[idx])!;
    const [card] = drawUniform(pool, 1, rand);
    pool.splice(pool.indexOf(card), 1);
    picks.push(card);
  }
  return picks;
}

/** Oferta maldita: `n` maldiciones distintas que aún no estén al máximo. */
export function rollCurses(owned: Map<string, number>, n = 3, rand: () => number = Math.random): PerkDef[] {
  return drawUniform(CURSES.filter((p) => (owned.get(p.id) ?? 0) < p.max), n, rand);
}
