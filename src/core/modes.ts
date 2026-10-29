// Modos de juego. Todos usan las mismas reglas de `game.ts`; cada modo solo cambia
// la semilla, los desbloqueos o cuándo termina la partida.

export type ModeId = 'normal' | 'daily' | 'timed' | 'tutorial' | 'expedition';

export interface ModeDef {
  id: ModeId;
  name: string;
  /** Una línea para el selector de la portada. */
  desc: string;
  /** Duración de la partida en ms de juego (no corre en pausa ni eligiendo mejora). 0 = sin límite. */
  timeLimitMs: number;
  /**
   * Nivel de desbloqueo fijo para todos, en vez del mejor nivel del jugador.
   * En el desafío diario todos tienen que poder sacar las mismas cartas.
   */
  fixedBestLevel?: number;
  /** Empieza con una mejora común o rara sacada de la semilla. */
  starterPerk: boolean;
  /** Tutorial guiado: sin récord ni ranking, y no sale en el selector de la portada. */
  tutorial?: boolean;
  /** Progresión entre partidas (`expedition.ts`): sin ranking ni récords del arcade, y no sale en el selector. */
  expedition?: boolean;
  /** Tiene niveles jefe (cada tercer nivel) y su oferta de recompensa. Solo Expedición: el arcade no los tiene. */
  bosses?: boolean;
  /** Nivel a partir del cual la velocidad ya no sube (curva propia del modo). */
  gravityCap?: number;
  /** Tope de líneas por nivel (curva propia del modo). */
  linesCap?: number;
}

export const MODES: Record<ModeId, ModeDef> = {
  normal: {
    id: 'normal',
    name: 'Partida',
    desc: 'Sube de nivel hasta que el tablero se llene.',
    timeLimitMs: 0,
    starterPerk: false,
  },
  daily: {
    id: 'daily',
    name: 'Desafío diario',
    desc: 'Las mismas piezas, cartas y mejora inicial para todos. Cambia a las 00:00 UTC.',
    timeLimitMs: 0,
    fixedBestLevel: 9999,
    starterPerk: true,
  },
  timed: {
    id: 'timed',
    name: 'Contrarreloj',
    desc: 'Tres minutos para hacer todos los puntos que puedas.',
    timeLimitMs: 3 * 60 * 1000,
    starterPerk: false,
  },
  tutorial: {
    id: 'tutorial',
    name: 'Tutorial',
    desc: 'Aprende los controles, las mejoras y la hiperperk en una partida corta.',
    timeLimitMs: 0,
    // solo salen comunes y raras: lo que se enseña no depende de lo que hayas desbloqueado
    fixedBestLevel: 0,
    starterPerk: false,
    tutorial: true,
  },
  expedition: {
    id: 'expedition',
    name: 'Expedición',
    desc: 'Cada partida da fragmentos para comprar mejoras permanentes. Sin ranking.',
    timeLimitMs: 0,
    starterPerk: false,
    expedition: true,
    bosses: true,
    // curva propia: la velocidad se planta en el nivel 12 y cada nivel pide como mucho 8 líneas
    gravityCap: 12,
    linesCap: 8,
  },
};

export const MODE_IDS = Object.keys(MODES) as ModeId[];
/** Los modos que se eligen en la portada (el tutorial tiene su propio botón). */
export const PLAY_MODE_IDS = MODE_IDS.filter((id) => !MODES[id].tutorial && !MODES[id].expedition);

export const isModeId = (v: unknown): v is ModeId => typeof v === 'string' && Object.hasOwn(MODES, v);

/** Fecha UTC en formato AAAA-MM-DD: el desafío cambia a la misma hora en todo el mundo. */
export function utcDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Milisegundos hasta el próximo desafío (medianoche UTC). */
export function msToNextDaily(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

/** Primer día del desafío: el número 1. */
const DAILY_EPOCH = Date.UTC(2026, 9, 9);

/** Número del desafío de una fecha (1 = 2026-10-09). */
export function dailyNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - DAILY_EPOCH) / 86_400_000) + 1;
}

/**
 * Semilla del desafío de una fecha (FNV-1a). Cuando haya ranking, la dará el servidor
 * con una clave secreta para que no se pueda jugar el de mañana por adelantado.
 */
export function dailySeed(date: string): number {
  let h = 0x811c9dc5;
  for (const ch of `blockrogue:${date}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
