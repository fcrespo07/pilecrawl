// Validación de una partida enviada: se vuelve a jugar con el mismo motor del juego
// y la puntuación sale de ahí, nunca de lo que diga el cliente.
import { RULES_VERSION, type Replay } from '../src/core/game';
import { runReplay } from '../src/core/replay';
import { isModeId } from '../src/core/modes';

export const MAX_STEPS = 1_000_000;
export const MAX_ACTIONS = 100_000;

/** Claves que puede llevar una repetición. Cualquier otra (marcas de depuración, trucos) la rechaza. */
const ALLOWED_KEYS = new Set(['version', 'mode', 'seed', 'bestLevel', 'actions', 'steps']);

export interface Verified {
  replay: Replay;
  score: number;
  level: number;
  lines: number;
  steps: number;
}

/** Devuelve la partida verificada o el motivo (en texto) por el que no vale. */
export function verifyReplay(input: unknown): Verified | string {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return 'repetición no válida';
  const r = input as Record<string, unknown>;
  if (r.sandbox) return 'partida de laboratorio: no puntúa';
  for (const k of Object.keys(r)) if (!ALLOWED_KEYS.has(k)) return `campo no permitido: ${k}`;
  if (r.version !== RULES_VERSION) return `versión de reglas ${String(r.version)} ≠ ${RULES_VERSION}`;
  if (!isModeId(r.mode)) return 'modo no válido';
  if (!Number.isInteger(r.steps) || (r.steps as number) < 1 || (r.steps as number) > MAX_STEPS) return 'pasos fuera de rango';
  if (!Array.isArray(r.actions) || r.actions.length > MAX_ACTIONS) return 'demasiadas acciones';
  const replay = r as unknown as Replay;
  const res = runReplay(replay);
  if (!res.ok) return res.reason ?? 'la repetición no cuadra';
  const g = res.game;
  if (g.state !== 'over') return 'la partida no ha terminado';
  return { replay, score: g.score, level: g.level, lines: g.lines, steps: g.steps };
}
