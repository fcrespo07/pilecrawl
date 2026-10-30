import { describe, it } from 'vitest';
import { HUMAN_PROFILES, playHumanLike } from './humanbot';

/**
 * Medición de la Expedición con el bot humano. No es una prueba de regresión: solo corre si se
 * pide, y escribe el resumen en consola (con --silent=false).
 *   BOT_RUN=1 BOT_GAMES=30 BOT_PROFILE=rapido npx vitest run src/core/humanbot.test.ts --silent=false
 */
describe.skipIf(!import.meta.env.BOT_RUN)('bot humano de la Expedición', () => {
  it('mide victorias y niveles', { timeout: 60 * 60 * 1000 }, () => {
    const games = Number(import.meta.env.BOT_GAMES ?? 30);
    const profile = HUMAN_PROFILES[import.meta.env.BOT_PROFILE ?? 'rapido'];
    const seedBase = Number(import.meta.env.BOT_SEED ?? 2000);
    const results = [];
    for (let i = 0; i < games; i++) results.push(playHumanLike(seedBase + i, profile));
    const wins = results.filter((r) => r.won).length;
    const levels = results.map((r) => r.level).sort((a, b) => a - b);
    const median = levels[Math.floor(levels.length / 2)];
    const hist: Record<number, number> = {};
    for (const r of results) hist[r.level] = (hist[r.level] ?? 0) + 1;
    const lines = [
      `perfil=${import.meta.env.BOT_PROFILE ?? 'rapido'} victorias=${wins}/${games} mediana=${median} niveles=${levels.join(',')}`,
      `histograma=${JSON.stringify(hist)}`,
    ];
    console.log(lines.join('\n'));
  });
});
