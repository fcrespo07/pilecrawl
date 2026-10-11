import { describe, expect, it } from 'vitest';
import { Game } from '../core/game';
import { PERKS } from '../core/perks';
import { StatsCollector, type RunStats } from './stats';

describe('StatsCollector', () => {
  it('anota ofertas y elecciones y envía una sola vez al acabar', () => {
    const sent: RunStats[] = [];
    const game = new Game();
    const c = new StatsCollector(game, (s) => sent.push(s));
    c.begin();
    game.start(123, 'normal');
    const [a, b] = PERKS;
    game.events.emit('offer', { kind: 'perk', ids: [a.id, b.id] });
    game.events.emit('offer', { kind: 'perk', ids: [b.id] }); // reroll: la primera queda sin elegir
    game.events.emit('perk', { perk: b, stacks: 1 });
    game.events.emit('gameover', { reason: 'topout' });
    c.finish('quit'); // ya enviada: no repite
    expect(sent).toHaveLength(1);
    expect(sent[0].end).toBe('topout');
    expect(sent[0].picks).toEqual([
      { k: 'p', s: [a.id, b.id], p: null },
      { k: 'p', s: [b.id], p: b.id },
    ]);
    expect(Object.keys(sent[0]).sort()).toEqual(['build', 'end', 'hyper', 'level', 'lines', 'mode', 'picks', 'revives', 'rules', 'score', 'secs'].sort());
  });

  it('abandonar al instante no envía nada y el laboratorio tampoco', () => {
    const sent: RunStats[] = [];
    const game = new Game();
    const c = new StatsCollector(game, (s) => sent.push(s));
    c.begin();
    game.start(1, 'normal');
    c.finish('quit');
    expect(sent).toHaveLength(0);
    c.begin();
    game.start(1, 'normal');
    game.sandbox = true;
    game.events.emit('gameover', { reason: 'topout' });
    expect(sent).toHaveLength(0);
  });
});
