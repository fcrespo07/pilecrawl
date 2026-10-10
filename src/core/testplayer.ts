import { bestPlacement } from './bot';
import { Game } from './game';
import type { ModeId } from './modes';
import { makeRng } from './rng';

/**
 * Jugador de prueba: busca una buena colocación como el bot de equilibrio, pero llega a ella
 * con acciones normales (girar, mover, caída rápida, reserva) repartidas entre pasos de simulación,
 * y a veces deja que la pieza caiga sola. Así la partida sube de nivel, elige cartas y ve basura.
 */
export function playHuman(seed: number, maxSteps = 200_000, mode: ModeId = 'normal', bestLevel = seed % 2 ? Infinity : 0): Game {
  const g = new Game();
  g.bestLevel = bestLevel;
  g.start(seed, mode);
  const r = makeRng(seed * 7 + 3);
  let piece: unknown = null;
  let target: { rot: number; x: number } | null = null;
  let tries = 0;
  while (g.state !== 'over' && g.steps < maxSteps) {
    if (g.state === 'choosing') {
      // partida eterna que agota todas las cartas: no hay nada que elegir y la partida queda parada
      if (!g.choosingHyper && g.choices.length === 0) break;
      if (g.rerolls > 0 && r() < 0.3) g.reroll();
      else g.choosePerk(Math.floor(r() * (g.choosingHyper ? g.hyperChoices.length : g.choices.length)));
      continue;
    }
    // la hiperperk se suelta con algo de retraso, para que caiga en pasos distintos
    if (g.hyperReady() && r() < 0.01) g.activateHyper();
    const a = g.active!;
    if (a !== piece) {
      piece = a;
      tries = 0;
      if (r() < 0.05) g.holdPiece();
      target = g.active ? bestPlacement(g) : null;
    }
    const k = r();
    if (k < 0.5 && g.active && target) {
      const p = g.active;
      if (tries++ > 40) g.hardDrop();
      else if (p.rot !== target.rot) g.rotate(1);
      else if (p.x < target.x) g.move(1);
      else if (p.x > target.x) g.move(-1);
      else if (r() < 0.7) g.hardDrop();
      else g.softDropping = true;
    } else if (k < 0.52) g.softDropping = !g.softDropping;
    g.step();
  }
  return g;
}
