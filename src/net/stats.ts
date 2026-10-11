// Estadísticas anónimas de partidas, para equilibrar el juego con datos reales.
// No lleva apodo, token, identificador ni cookies; solo lo que pasó en la partida. Se puede apagar
// (privacidad.html) y se respeta «No rastrear». Solo escucha eventos del juego: no toca reglas ni repeticiones.
import { RULES_VERSION, type EndReason, type Game } from '../core/game';
import type { ModeId } from '../core/modes';
import { statsEnabled } from './statsOptOut';

/** Partidas más cortas que esto (pasos, ~10 s) no se envían si se abandonan: no dicen nada. */
const MIN_QUIT_STEPS = 1200;

export type StatsEnd = EndReason | 'quit';

/** Una oferta de cartas: qué se enseñó y qué se cogió (null = cambiada con reroll o sin elegir). */
export interface StatsPick {
  k: 'p' | 'c' | 'h';
  s: string[];
  p: string | null;
}

export interface RunStats {
  mode: ModeId;
  rules: number;
  build: string;
  end: StatsEnd;
  level: number;
  score: number;
  lines: number;
  secs: number;
  revives: number;
  hyper: string | null;
  picks: StatsPick[];
}

/** Recoge lo que ocurre en la partida en curso y la manda una sola vez al terminar. */
export class StatsCollector {
  private picks: StatsPick[] = [];
  private revives = 0;
  private open = false;

  constructor(private game: Game, private send: (s: RunStats) => void) {
    const ev = game.events;
    ev.on('offer', ({ kind, ids }) => {
      if (this.open) this.picks.push({ k: kind === 'curse' ? 'c' : kind === 'hyper' ? 'h' : 'p', s: ids, p: null });
    });
    ev.on('perk', ({ perk }) => {
      if (!this.open) return;
      // un perk sin oferta (la mejora inicial del diario) se anota sin cartas
      const last = this.picks.at(-1);
      if (last && last.p === null && last.s.includes(perk.id)) last.p = perk.id;
      else this.picks.push({ k: perk.curse ? 'c' : 'p', s: [], p: perk.id });
    });
    ev.on('hyperPick', ({ hyper }) => {
      const last = this.picks.at(-1);
      if (this.open && last && last.k === 'h') last.p = hyper.id;
    });
    ev.on('revive', () => void (this.revives++));
    ev.on('gameover', ({ reason }) => this.finish(reason));
  }

  /** Llamar justo antes de `game.start`. Si había una partida a medias, se da por abandonada. */
  begin() {
    this.finish('quit');
    this.picks = [];
    this.revives = 0;
    this.open = true;
  }

  /** Cierra la partida y la envía (una vez). `quit`: se dejó a medias. */
  finish(end: StatsEnd) {
    if (!this.open) return;
    this.open = false;
    const g = this.game;
    if (g.sandbox) return; // el laboratorio no cuenta
    if (end === 'quit' && g.steps < MIN_QUIT_STEPS) return;
    this.send({
      mode: g.mode,
      rules: RULES_VERSION,
      build: __APP_VERSION__,
      end,
      level: g.level,
      score: Math.round(g.score),
      lines: g.lines,
      secs: Math.round(g.time / 1000),
      revives: this.revives,
      hyper: g.hyper?.id ?? null,
      picks: this.picks,
    });
  }
}

/** Envío sin esperar respuesta ni molestar: si falla, se pierde esa partida y nada más. */
export function postStats(base: string, s: RunStats) {
  if (!statsEnabled()) return;
  try {
    void fetch(`${base}/api/stats`, {
      method: 'POST',
      // text/plain: petición «simple», sin comprobación previa que se pierda al cerrar la pestaña (el servidor lee JSON igual)
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify(s),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* sin red: no pasa nada */
  }
}
