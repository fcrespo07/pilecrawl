import { Game, RULES_VERSION, type Replay } from './game';

export interface ReplayResult {
  game: Game;
  /** false si la repetición no cuadra: versión distinta, acciones imposibles o pasos de más. */
  ok: boolean;
  reason?: string;
}

/**
 * Vuelve a jugar una partida a partir de su semilla y sus acciones, sin render ni audio.
 * Es lo que hará el servidor para calcular la puntuación él mismo en vez de fiarse del cliente.
 */
export function runReplay(r: Replay): ReplayResult {
  const game = new Game();
  if (r.version !== RULES_VERSION) return { game, ok: false, reason: `versión ${r.version} ≠ ${RULES_VERSION}` };
  game.bestLevel = r.bestLevel;
  game.start(r.seed);

  const advanceTo = (step: number): boolean => {
    while (game.steps < step) {
      // solo avanza jugando: si la partida espera una carta o ya acabó, las acciones no cuadran
      if (game.state !== 'playing') return false;
      game.step();
    }
    return game.steps === step;
  };

  for (const a of r.actions) {
    if (!advanceTo(a[0])) return { game, ok: false, reason: `no se llega al paso ${a[0]}` };
    switch (a[1]) {
      case 'move': game.move(a[2]); break;
      case 'rotate': game.rotate(a[2]); break;
      case 'drop': game.hardDrop(); break;
      case 'hold': game.holdPiece(); break;
      case 'soft': game.softDropping = a[2] === 1; break;
      case 'pick': game.choosePerk(a[2]); break;
      case 'reroll': game.reroll(); break;
    }
  }
  if (!advanceTo(r.steps)) return { game, ok: false, reason: `no se llega al paso final ${r.steps}` };
  return { game, ok: true };
}
