import { describe, expect, it } from 'vitest';
import { bestPlacement } from './bot';
import { Game, STEP_MS } from './game';
import { makeRng } from './rng';

/**
 * Bot de referencia para equilibrar. No juega bien: elige, para cada pieza, la colocación
 * con mejor puntuación heurística (altura, huecos, irregularidad y líneas), y elige perks al azar.
 * Sirve para comparar cambios de reglas entre sí, no para decidir si el juego es "difícil" para una persona.
 */

export interface GameResult {
  level: number;
  lines: number;
  pieces: number;
  perks: number;
  score: number;
  overByTopOut: boolean;
}

/** Juega una partida completa con el bot. Corta a `maxPieces` para no colgarse. */
export function playBot(seed: number, maxPieces = 1500, bestLevel = Infinity): GameResult {
  {
    const g = new Game();
    g.bestLevel = bestLevel;
    g.start(seed);
    const choicePicker = makeRng(seed + 1);
    let pieces = 0;
    let guard = 0;
    while (g.state !== 'over' && pieces < maxPieces && guard++ < maxPieces * 50) {
      if (g.state === 'choosing') {
        const n = g.choosingHyper ? g.hyperChoices.length : g.choices.length;
        g.choosePerk(Math.floor(choicePicker() * n));
        continue;
      }
      if (g.state !== 'playing' || !g.active) break;
      // la hiperperk se suelta en cuanto está cargada
      if (g.hyperReady()) g.activateHyper();
      const best = bestPlacement(g);
      const a = g.active;
      if (!best) {
        // ninguna colocación posible: la pieza no cabe y la partida acaba
        g.hardDrop();
        continue;
      }
      a.rot = best.rot;
      a.x = best.x;
      g.hardDrop();
      pieces++;
      // el bot no deja pasar el tiempo: se cuenta un segundo por pieza para que las hiperperks se acaben
      g.hyperLeft = Math.max(0, g.hyperLeft - Math.round(1000 / STEP_MS));
    }
    return {
      level: g.level,
      lines: g.lines,
      pieces,
      perks: g.perkOrder.length,
      score: g.score,
      overByTopOut: g.state === 'over',
    };
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

const summarize = (results: GameResult[]) => ({
  games: results.length,
  medianLevel: median(results.map((r) => r.level)),
  meanLevel: +mean(results.map((r) => r.level)).toFixed(2),
  medianLines: median(results.map((r) => r.lines)),
  meanPieces: Math.round(mean(results.map((r) => r.pieces))),
  meanPerks: +mean(results.map((r) => r.perks)).toFixed(2),
  topOuts: results.filter((r) => r.overByTopOut).length,
});

describe('bot de equilibrio', () => {
  const GAMES = 60;

  // El bot coloca con hard drop, así que la gravedad y el lock delay no le afectan:
  // estos números miden reglas de líneas, niveles, basura y perks, no el ritmo de caída.
  // Se juega con todos los perks desbloqueados (cota superior) y con la progresión de una primera partida.
  it('el bot sube de nivel y el juego no se bloquea', () => {
    const unlocked = Array.from({ length: GAMES }, (_, i) => playBot(1000 + i));
    const firstRun = Array.from({ length: GAMES }, (_, i) => playBot(1000 + i, 1500, 0));
    console.log('[balance] todo desbloqueado', JSON.stringify(summarize(unlocked)));
    console.log('[balance] primera partida  ', JSON.stringify(summarize(firstRun)));
    expect(median(unlocked.map((r) => r.level))).toBeGreaterThanOrEqual(2);
    expect(median(firstRun.map((r) => r.level))).toBeGreaterThanOrEqual(2);
  }, 120_000);

  // El nivel mediano satura por el tope de piezas, así que la dificultad se mide con las partidas
  // perdidas antes del tope. Con 30 partidas el ruido de las cartas al azar llenaba la banda entera
  // (una tanda de 150 daba 69 y 38 perdidas donde las 30 primeras daban 10 y 10), así que se juegan 60.
  // En 0.5.0 eran 28 y 16 de 60; con los once perks nuevos, 23 y 13; con las hiperperks (el bot las suelta en
  // cuanto se cargan), 15 y 12. Con la racha (mejores cartas y la hiperperk por suerte desde el nivel 3,
  // con la segura en el nivel 8), 17 y 11: la racha da más cartas raras, y Segunda vida es rara. La banda baja a 17-47% para ese cambio buscado.
  // v8 (legendarias de verdad: peso por rareza, calor por combos, desbloqueos en 3 y 5): subida de dificultad buscada, no una tolerancia.
  // Todo desbloqueado pierde 37 de 60 (antes ~17) porque el bot, que elige al azar, también coge Cruz, Terremoto o Eco: techo 40.
  // La primera partida (14) es la que nota un jugador nuevo y se mantiene por debajo de ~30%: techo 18. Segunda vida (legendaria) no se bloquea.
  // v13 (rework de perks, fase 1): las maldiciones Deriva y Ruleta mueven bloques que el bot no sabe leer y el bot coge maldiciones al azar:
  // la primera partida pasa de 14 a 21 perdidas de 60 (sin las maldiciones nuevas, 14). Es la subida buscada de las maldiciones: techo 22.
  // v14 (cada carta con su rareza): en la primera partida el bot ve más raras mezcladas con las comunes y pierde menos (8 de 60, antes 21); todo desbloqueado, 26. Suelo de la primera partida: 6.
  // Las partidas usan semillas fijas: si una regla cambia la dificultad de verdad, este test lo avisa.
  it('la proporción de partidas perdidas sigue en su banda', () => {
    const unlocked = Array.from({ length: GAMES }, (_, i) => playBot(1000 + i));
    const firstRun = Array.from({ length: GAMES }, (_, i) => playBot(1000 + i, 1500, 0));
    const lost = (rs: GameResult[]) => rs.filter((r) => r.overByTopOut).length;
    expect(lost(unlocked)).toBeGreaterThanOrEqual(10);
    expect(lost(unlocked)).toBeLessThanOrEqual(40);
    expect(lost(firstRun)).toBeGreaterThanOrEqual(6);
    expect(lost(firstRun)).toBeLessThanOrEqual(22);
  }, 120_000);
});
