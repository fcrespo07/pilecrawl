// Récords por modo en localStorage. Cada modo compite contra sí mismo:
// tres minutos de contrarreloj no se comparan con una partida sin límite.
import { isModeId, MODES, type ModeId } from './core/modes';

const BEST_KEY: Record<Exclude<ModeId, 'daily' | 'tutorial'>, string> = {
  normal: 'blockrogue.best',
  timed: 'blockrogue.best.timed',
  expedition: 'blockrogue.best.exp',
};
const DAILY_KEY = 'blockrogue.daily';
const MODE_KEY = 'blockrogue.mode';

interface DailyRecord {
  date: string;
  best: number;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: el récord dura lo que la pestaña */
  }
}

function loadDaily(): DailyRecord | null {
  try {
    const p = JSON.parse(read(DAILY_KEY) ?? 'null') as Partial<DailyRecord> | null;
    if (p && typeof p.date === 'string') return { date: p.date, best: Math.max(0, Number(p.best) || 0) };
  } catch {
    /* JSON roto: como si no hubiera */
  }
  return null;
}

/** Récord del modo. En el diario, solo cuenta el de `date` (el de otro día no vale). */
export function loadBest(mode: ModeId, date: string): number {
  if (mode === 'tutorial') return 0;
  if (mode === 'daily') {
    const d = loadDaily();
    return d && d.date === date ? d.best : 0;
  }
  return Number(read(BEST_KEY[mode]) ?? 0) || 0;
}

/** Guarda la puntuación si mejora el récord. Devuelve si lo ha mejorado. */
export function submitScore(mode: ModeId, date: string, score: number): boolean {
  if (mode === 'tutorial' || score <= loadBest(mode, date)) return false;
  if (mode === 'daily') write(DAILY_KEY, JSON.stringify({ date, best: score } satisfies DailyRecord));
  else write(BEST_KEY[mode], String(score));
  return true;
}

/** Último modo elegido en la portada, para dejarlo marcado la próxima vez. */
export function loadLastMode(): ModeId {
  const m = read(MODE_KEY);
  // el tutorial no se elige en la portada: no puede quedar como último modo
  return isModeId(m) && !MODES[m].tutorial && !MODES[m].expedition ? m : 'normal';
}

export function saveLastMode(mode: ModeId) {
  write(MODE_KEY, mode);
}

const TUTORIAL_KEY = 'blockrogue.tutorial';

/** El tutorial se ha terminado alguna vez: la portada deja de marcarlo como nuevo. */
export function loadTutorialDone(): boolean {
  return read(TUTORIAL_KEY) === '1';
}

export function saveTutorialDone() {
  write(TUTORIAL_KEY, '1');
}
