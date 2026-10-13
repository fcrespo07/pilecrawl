import { Game, RULES_VERSION, type Replay, type ReplayAction } from './game';
import type { Owned } from './expedition';
import { isModeId, MODES } from './modes';

export interface ReplayResult {
  game: Game;
  /** false si la repetición no cuadra: versión distinta, acciones imposibles o pasos de más. */
  ok: boolean;
  reason?: string;
}

const isStep = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

/**
 * Comprueba que una acción tiene la forma que produce el juego real. `move` solo mira la casilla
 * de destino, así que un `dx` de 3 atravesaría bloques: el servidor tiene que rechazarlo aquí.
 */
function validAction(a: unknown): a is ReplayAction {
  if (!Array.isArray(a) || !isStep(a[0])) return false;
  const [, op, arg] = a as [number, string, unknown];
  switch (op) {
    case 'move': return a.length === 3 && (arg === 1 || arg === -1);
    case 'rotate': return a.length === 3 && (arg === 1 || arg === -1 || arg === 2);
    case 'soft': return a.length === 3 && (arg === 0 || arg === 1);
    case 'pick': return a.length === 3 && (arg === 0 || arg === 1 || arg === 2 || arg === 3);
    case 'drop':
    case 'hold':
    case 'reroll':
    case 'hyper': return a.length === 2;
    default: return false;
  }
}

/** Comprueba la forma de una repetición (no su versión ni su modo). Devuelve el motivo si no vale. */
export function checkReplay(r: Replay): string | null {
  if (!Number.isInteger(r.seed) || r.seed < 0 || r.seed > 0xffffffff) return 'semilla no válida';
  if (typeof r.bestLevel !== 'number' || Number.isNaN(r.bestLevel)) return 'bestLevel no válido';
  if (!isStep(r.steps) || !Array.isArray(r.actions)) return 'formato no válido';
  if (!isModeId(r.mode ?? 'normal')) return 'modo no válido';
  return null;
}

/**
 * Vuelve a jugar `r` sobre `game` (sin avisar a nadie) y lo deja en el paso final. Antes hay que pasar `checkReplay`.
 * `upgrades` y `unlocked` solo importan en la Expedición: la repetición no los lleva, así que quien guarde
 * una partida de ese modo tiene que guardarlos aparte.
 */
export function replayInto(game: Game, r: Replay, upgrades: Owned = {}, unlocked: readonly string[] = []): { ok: boolean; reason?: string } {
  game.events.silent = true;
  try {
    game.bestLevel = r.bestLevel;
    game.start(r.seed, r.mode ?? 'normal', upgrades, unlocked);

    const advanceTo = (step: number): boolean => {
      while (game.steps < step) {
        // solo avanza jugando: si la partida espera una carta o ya acabó, las acciones no cuadran
        if (game.state !== 'playing') return false;
        game.step();
      }
      return game.steps === step;
    };

    for (const a of r.actions) {
      if (!validAction(a)) return { ok: false, reason: `acción no válida: ${JSON.stringify(a)}` };
      if (!advanceTo(a[0])) return { ok: false, reason: `no se llega al paso ${a[0]}` };
      switch (a[1]) {
        case 'move': game.move(a[2]); break;
        case 'rotate': game.rotate(a[2]); break;
        case 'drop': game.hardDrop(); break;
        case 'hold': game.holdPiece(); break;
        case 'soft': game.softDropping = a[2] === 1; break;
        case 'pick': game.choosePerk(a[2]); break;
        case 'reroll': game.reroll(); break;
        case 'hyper': game.activateHyper(); break;
      }
    }
    if (!advanceTo(r.steps)) return { ok: false, reason: `no se llega al paso final ${r.steps}` };
    return { ok: true };
  } finally {
    game.events.silent = false;
  }
}

/**
 * Vuelve a jugar una partida a partir de su semilla y sus acciones, sin render ni audio.
 * Es lo que hará el servidor para calcular la puntuación él mismo en vez de fiarse del cliente.
 */
export function runReplay(r: Replay): ReplayResult {
  const game = new Game();
  if (r.sandbox) return { game, ok: false, reason: 'partida de laboratorio' };
  if (r.version !== RULES_VERSION) return { game, ok: false, reason: `versión ${r.version} ≠ ${RULES_VERSION}` };
  const bad = checkReplay(r);
  if (bad) return { game, ok: false, reason: bad };
  const mode = r.mode ?? 'normal';
  // el tutorial (tablero precargado) no puntúa: que no se cuele en un ranking
  if (MODES[mode].tutorial) return { game, ok: false, reason: 'modo no puntuable' };
  // la Expedición depende de mejoras guardadas en el navegador, que la repetición no lleva: no se puede reproducir
  if (MODES[mode].expedition) return { game, ok: false, reason: 'modo no puntuable' };
  return { game, ...replayInto(game, r) };
}
