import { describe, expect, it } from 'vitest';
import { parseStats, summarize, type StatsRow } from './stats';
import { createApp } from './app';
import { loadConfig } from './config';
import { openDb } from './db';

const good = {
  mode: 'normal', rules: 7, build: '0.20.0', end: 'topout', level: 6, score: 12000, lines: 40, secs: 300, revives: 0, hyper: null,
  picks: [{ k: 'p', s: ['feather', 'grip'], p: 'feather' }],
};

describe('parseStats', () => {
  it('acepta una partida válida y descarta campos desconocidos', () => {
    const r = parseStats({ ...good, nickname: 'Fer', token: 'x' });
    expect(r).not.toBeNull();
    expect(Object.keys(r!)).not.toContain('nickname');
  });
  it('rechaza datos fuera de rango o con formato raro', () => {
    for (const bad of [
      { ...good, mode: 'otro' },
      { ...good, end: 'win' },
      { ...good, level: 0 },
      { ...good, score: -1 },
      { ...good, build: '1.0' },
      { ...good, hyper: 'A B' },
      { ...good, picks: Array(81).fill(good.picks[0]) },
      { ...good, picks: [{ k: 'x', s: [], p: null }] },
      { ...good, picks: [{ k: 'p', s: ['<script>'], p: null }] },
      { ...good, picks: [{ k: 'p', s: ['carta_inventada'], p: null }] },
      { ...good, picks: [{ k: 'h', s: ['feather'], p: null }] },
      { ...good, hyper: 'inventada' },
      { ...good, picks: [{ k: 'p', s: Array(9).fill('a'), p: null }] },
    ]) expect(parseStats(bad as never)).toBeNull();
  });
});

describe('summarize', () => {
  const row = (level: number, picks: StatsRow['picks']): StatsRow => ({ ...(good as object), day: '2026-10-14', level, picks }) as StatsRow;
  it('calcula tasas de elección y compara con quien la dejó pasar', () => {
    const rows = [
      row(10, [{ k: 'p', s: ['a', 'b'], p: 'a' }]),
      row(8, [{ k: 'p', s: ['a', 'b'], p: 'a' }]),
      row(4, [{ k: 'p', s: ['a', 'b'], p: 'b' }]),
      row(2, [{ k: 'p', s: ['a', 'c'], p: null }, { k: 'p', s: ['b', 'c'], p: 'c' }]),
    ];
    const s = summarize(rows, 'normal');
    const a = s.cards.find((c) => c.id === 'a')!;
    expect(a.shown).toBe(4);
    expect(a.picked).toBe(2);
    expect(a.pickRate).toBe(0.5);
    expect(a.avgLevelPicked).toBe(9);
    expect(a.avgLevelPassed).toBe(3); // niveles 4 y 2
    expect(a.levelDelta).toBe(6);
    expect(s.modes.normal.levelHistogram[10]).toBe(1);
  });
});

describe('API de estadísticas', () => {
  const setup = () => {
    const cfg = { ...loadConfig({}), adminToken: 'admin-secret-token' };
    const app = createApp(cfg, openDb(':memory:'));
    return (method: string, path: string, body?: unknown, token?: string, ip = '10.9.9.9') =>
      app(
        new Request(`http://x${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }),
        ip,
      ).then(async (r) => ({ status: r.status, body: (await r.json()) as any }));
  };

  it('guarda sin sesión y solo el administrador lee el resumen', async () => {
    const call = setup();
    expect((await call('POST', '/api/stats', good)).status).toBe(201);
    expect((await call('POST', '/api/stats', { ...good, level: 0 })).status).toBe(400);
    expect((await call('GET', '/api/admin/stats')).status).toBe(401);
    const r = await call('GET', '/api/admin/stats?days=7', undefined, 'admin-secret-token');
    expect(r.status).toBe(200);
    expect(r.body.runs).toBe(1);
    expect(r.body.cards[0].id).toBe('feather');
  });

  it('rechaza modos heredados en el resumen', async () => {
    const call = setup();
    expect((await call('GET', '/api/admin/stats?mode=constructor', undefined, 'admin-secret-token')).status).toBe(400);
  });

  it('limita por IP y se puede vaciar', async () => {
    const call = setup();
    for (let i = 0; i < 40; i++) expect((await call('POST', '/api/stats', good, undefined, '10.1.1.1')).status).toBe(201);
    expect((await call('POST', '/api/stats', good, undefined, '10.1.1.1')).status).toBe(429);
    expect((await call('POST', '/api/stats', good, undefined, '10.1.1.2')).status).toBe(201);
    const del = await call('DELETE', '/api/admin/stats?before=2999-01-01', undefined, 'admin-secret-token');
    expect(del.body.deleted).toBe(41);
  });
});
