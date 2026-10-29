// Partida guardada a medias, en el navegador. Como la partida es determinista, basta con su repetición
// (semilla + acciones + pasos): al reanudar se vuelve a simular hasta ese punto. Un solo hueco.
// Al reanudar se borra, para que nadie pueda recargar y repetir una mala decisión.
import { RULES_VERSION, type Replay } from './core/game';
import { checkReplay } from './core/replay';
import { isModeId, MODES, type ModeId } from './core/modes';
import type { Owned } from './core/expedition';
import type { PressureId } from './core/pressure';

const KEY = 'blockrogue.save';
/** El servidor da por caducada una partida con ranking a las 6 h de pedirla (server/app.ts, START_TTL). */
export const RUN_TTL_MS = 6 * 3_600_000;
/** Tope de pasos de una partida guardada, por si el JSON viene editado: re-simularlo bloquearía la pestaña. */
const MAX_STEPS = 2_000_000;

export interface SavedRun {
  /** Versión del formato de este guardado. */
  v: 1;
  rules: number;
  replay: Replay;
  /** Día del desafío diario que se jugaba (AAAA-MM-DD). */
  date: string;
  /** Partida con ranking pedida al servidor, si la había. */
  runId?: string;
  /** Mejoras de la Expedición con las que empezó la partida. */
  upgrades?: Owned;
  unlocked?: string[];
  /** Condiciones de Presión de la Expedición. */
  pressure?: PressureId[];
  /** Cuándo se pidió la partida al servidor (decide si su runId sigue valiendo). */
  startedAt: number;
  savedAt: number;
  /** Para enseñarlo en la portada sin re-simular. */
  score: number;
  level: number;
}

export interface Loaded {
  run: SavedRun | null;
  /** Aviso si había un guardado y se ha descartado (reglas nuevas, datos rotos). */
  discarded?: string;
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Guarda la partida. Devuelve false si el navegador no deja (sin espacio, modo privado...). */
export function writeSave(run: SavedRun): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
    return read() !== null;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: nada que borrar */
  }
}

export function hasSave(): boolean {
  return read() !== null;
}

/** Lee y valida el guardado. Si no sirve lo borra y dice por qué. */
export function loadSave(): Loaded {
  const raw = read();
  if (raw === null) return { run: null };
  const drop = (why: string): Loaded => {
    clearSave();
    return { run: null, discarded: why };
  };
  let s: SavedRun;
  try {
    s = JSON.parse(raw) as SavedRun;
  } catch {
    return drop('La partida guardada estaba dañada y se ha descartado.');
  }
  if (!s || typeof s !== 'object' || s.v !== 1 || !s.replay || typeof s.replay !== 'object') return drop('La partida guardada estaba dañada y se ha descartado.');
  // con otras reglas la simulación daría otra partida: no se puede reanudar
  if (s.rules !== RULES_VERSION || s.replay.version !== RULES_VERSION) {
    return drop('La partida guardada era de una versión anterior del juego, con otras reglas, y se ha descartado.');
  }
  const mode = s.replay.mode ?? 'normal';
  if (!isModeId(mode) || MODES[mode].tutorial || s.replay.sandbox || checkReplay(s.replay) || s.replay.steps > MAX_STEPS) {
    return drop('La partida guardada estaba dañada y se ha descartado.');
  }
  if (typeof s.date !== 'string' || typeof s.savedAt !== 'number' || typeof s.startedAt !== 'number') return drop('La partida guardada estaba dañada y se ha descartado.');
  return { run: s };
}

export function modeOf(run: SavedRun): ModeId {
  return run.replay.mode ?? 'normal';
}
