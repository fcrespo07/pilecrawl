import { rankPlacements } from './bot';
import { MIRROR_BURST, MIRROR_FLIPPED } from './bosses';
import { Game, STEP_MS } from './game';
import type { ModeId } from './modes';
import { makeRng } from './rng';

/**
 * Bot con tiempo de reacción humano, para medir la curva de la Expedición sin el bot perfecto.
 * Solo ve la pieza cuando la reacción ha pasado, pulsa como mucho una tecla cada `inputMs`
 * y a veces se equivoca (elige la segunda mejor colocación). No se usa en el juego.
 */
export interface HumanProfile {
  /** Tiempo desde que aparece una pieza hasta que el bot empieza a moverla. */
  reactionMs: number;
  /** Tiempo mínimo entre dos pulsaciones (rotar, mover o soltar). */
  inputMs: number;
  /** Probabilidad de elegir la segunda mejor colocación en vez de la mejor. */
  mistake: number;
}

export const HUMAN_PROFILES: Record<string, HumanProfile> = {
  rapido: { reactionMs: 250, inputMs: 40, mistake: 0.1 },
  normal: { reactionMs: 300, inputMs: 60, mistake: 0.2 },
};

export interface HumanResult {
  won: boolean;
  level: number;
  lines: number;
  steps: number;
  endReason: string | null;
}

/** Juega una partida completa con el bot humano. `maxSteps` corta las partidas eternas. */
export function playHumanLike(seed: number, profile: HumanProfile, mode: ModeId = 'expedition', maxSteps = 400_000): HumanResult {
  const g = new Game();
  g.start(seed, mode);
  const rng = makeRng(seed * 13 + 5);
  const reactSteps = Math.round(profile.reactionMs / STEP_MS);
  const inputSteps = Math.max(1, Math.round(profile.inputMs / STEP_MS));
  let piece: unknown = null;
  let wakeAt = 0;
  let nextInput = 0;
  let target: { rot: number; x: number } | null = null;
  let magnet = g.magnetCol;

  while (g.state !== 'over' && g.endReason === null && g.steps < maxSteps) {
    if (g.state === 'choosing') {
      if (!g.choosingHyper && g.choices.length === 0) break;
      const n = g.choosingHyper ? g.hyperChoices.length : g.choices.length;
      g.choosePerk(Math.floor(rng() * n));
      continue;
    }
    if (g.state !== 'playing' || !g.active) {
      g.step();
      continue;
    }
    if (g.hyperReady() && g.steps >= wakeAt && rng() < 0.05) g.activateHyper();

    const a = g.active;
    if (a !== piece) {
      piece = a;
      wakeAt = g.steps + reactSteps;
      nextInput = wakeAt;
      target = null;
    }
    // con Imán, si la columna prohibida cambia a mitad de caída, el jugador la vuelve a mirar
    if (g.magnetCol !== magnet) {
      magnet = g.magnetCol;
      target = null;
    }
    if (g.steps >= wakeAt && !target) {
      const ranked = rankPlacements(g);
      const pick = ranked.length > 1 && rng() < profile.mistake ? ranked[1] : ranked[0];
      target = pick ? { rot: pick.rot, x: pick.x } : null;
    }
    // con Espejo el jugador sabe que sus pulsaciones se invierten en las piezas marcadas
    const mirrored = g.bossHas('mirror') && g.piecesLocked % MIRROR_BURST < MIRROR_FLIPPED;
    if (target && g.steps >= nextInput) {
      if (a.rot !== target.rot) g.rotate(1);
      else if (a.x < target.x) g.move(mirrored ? -1 : 1);
      else if (a.x > target.x) g.move(mirrored ? 1 : -1);
      else g.hardDrop();
      nextInput = g.steps + inputSteps;
    }
    g.step();
  }

  return {
    won: g.endReason === 'victory',
    level: g.level,
    lines: g.lines,
    steps: g.steps,
    endReason: g.endReason,
  };
}
