import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, weekStart } from './app';
import { loadConfig, type Config } from './config';
import { openDb } from './db';
import { dailySeed } from '../src/core/modes';
import { clientIp } from './ip';
import type { IncomingMessage } from 'node:http';
import { playHuman } from '../src/core/testplayer';

const NOW = Date.parse('2026-10-14T12:00:00Z'); // miércoles
let clock = NOW;
let n = 0;
// semillas cuyas partidas de prueba acaban pronto (una semilla al azar puede dar una partida de minutos)
const SEEDS = [778, 782, 783, 788, 794, 815];
let seedAt = 0;

function setup(extra: Partial<Config> = {}) {
  const cfg: Config = { ...loadConfig({}), nickBlocklist: ['feo'], adminToken: 'admin-secret-token', now: () => new Date(clock), newSeed: () => SEEDS[seedAt++ % SEEDS.length], ...extra };
  const db = openDb(':memory:');
  const app = createApp(cfg, db);
  // IP distinta por prueba para no tropezar con los límites
  const ip = `10.0.0.${++n}`;
  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await app(new Request(`http://x${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), ip);
    return { status: res.status, body: (await res.json()) as any };
  };
  const register = async (nickname: string) => (await call('POST', '/api/players', { nickname })).body.token as string;
  return { call, register, db };
}

beforeEach(() => {
  clock = NOW;
  seedAt = 0;
});

describe('jugadores', () => {
  it('valida el apodo y no deja repetirlo', async () => {
    const { call } = setup();
    expect((await call('POST', '/api/players', { nickname: 'ab' })).status).toBe(400);
    expect((await call('POST', '/api/players', { nickname: 'a<script>' })).status).toBe(400);
    expect((await call('POST', '/api/players', { nickname: 'MuyFeo' })).status).toBe(400);
    expect((await call('POST', '/api/players', { nickname: 'Fer' })).status).toBe(201);
    expect((await call('POST', '/api/players', { nickname: 'fer' })).status).toBe(409);
  });

  it('exige el secreto y permite borrarse', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    expect((await call('GET', '/api/players/me', undefined, token)).body.nickname).toBe('Fer');
    expect((await call('GET', '/api/players/me', undefined, `${token.slice(0, -1)}${token.endsWith('x') ? 'y' : 'x'}`)).status).toBe(401);
    expect((await call('GET', '/api/players/me')).status).toBe(401);
    expect((await call('DELETE', '/api/players/me', undefined, token)).status).toBe(200);
    expect((await call('GET', '/api/players/me', undefined, token)).status).toBe(401);
  });
});

describe('identidad', () => {
  it('cambia de apodo, filtra palabras y se recupera con el código', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    await register('Otro');
    expect((await call('PATCH', '/api/players/me', { nickname: 'otro' }, token)).status).toBe(409);
    expect((await call('PATCH', '/api/players/me', { nickname: 'Sh1t' }, token)).status).toBe(400);
    expect((await call('PATCH', '/api/players/me', { nickname: 'Ferran' }, token)).body.nickname).toBe('Ferran');
    expect((await call('GET', '/api/players/me', undefined, token)).body.nickname).toBe('Ferran');
    const rec = await call('POST', '/api/players/recover', { code: token });
    expect(rec.status).toBe(200);
    expect(rec.body).toMatchObject({ nickname: 'Ferran', token });
    expect((await call('POST', '/api/players/recover', { code: 'xx.yy' })).status).toBe(404);
    expect((await call('POST', '/api/players/recover', { code: '€uro' })).status).toBe(404);
    expect((await call('POST', '/api/players/recover', { code: 'a\nb' })).status).toBe(404);
    const rot = await call('POST', '/api/players/me/rotate', undefined, token);
    expect(rot.body.token).not.toBe(token);
    expect((await call('GET', '/api/players/me', undefined, token)).status).toBe(401);
    expect((await call('GET', '/api/players/me', undefined, rot.body.token)).status).toBe(200);
  });

  it('no deja suplantar apodos ni colar palabras, pero admite nombres legítimos', async () => {
    const { call } = setup();
    expect((await call('POST', '/api/players', { nickname: 'Ana' })).status).toBe(201);
    for (const n of ['Anа', 'A.na', '4na']) expect((await call('POST', '/api/players', { nickname: n })).status, n).toBeGreaterThanOrEqual(400);
  });
});

describe('partida libre', () => {
  it('acepta una partida legítima y la pone en la tabla', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    const start = (await call('POST', '/api/runs/start', { mode: 'normal' }, token)).body;
    const g = playHuman(start.seed, 400_000, 'normal', start.bestLevel);
    expect(g.state).toBe('over');
    const sent = await call('POST', '/api/runs', { runId: start.runId, score: g.score, replay: g.replay() }, token);
    expect(sent.status).toBe(200);
    expect(sent.body.score).toBe(g.score);
    expect(sent.body.rank).toBe(1);

    const board = (await call('GET', '/api/leaderboard?mode=normal&scope=all', undefined, token)).body;
    expect(board.entries).toHaveLength(1);
    expect(board.entries[0]).toMatchObject({ nickname: 'Fer', score: g.score, me: true });
    // la repetición del primero se puede pedir
    const rep = await call('GET', `/api/runs/${board.entries[0].runId}/replay`);
    expect(rep.body.seed).toBe(start.seed);
  });

  it('rechaza puntuación falsa, semilla ajena, campos extra y reutilizar la partida', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    const start = (await call('POST', '/api/runs/start', { mode: 'normal' }, token)).body;
    const g = playHuman(start.seed, 400_000, 'normal', start.bestLevel);
    const replay = g.replay();

    expect((await call('POST', '/api/runs', { runId: start.runId, score: g.score + 1, replay }, token)).status).toBe(422);
    expect((await call('POST', '/api/runs', { runId: start.runId, replay: { ...replay, debug: true } }, token)).status).toBe(422);
    expect((await call('POST', '/api/runs', { runId: start.runId, replay: { ...replay, bestLevel: 9999 } }, token)).status).toBe(422);
    const mine = playHuman(782, 400_000, 'normal', start.bestLevel);
    expect((await call('POST', '/api/runs', { runId: start.runId, replay: mine.replay() }, token)).status).toBe(422);
    expect((await call('POST', '/api/runs', { runId: 'nope', replay }, token)).status).toBe(422);
    expect((await call('POST', '/api/runs', { replay }, token)).status).toBe(400);
    // una repetición manipulada da otra partida, y su puntuación no es la declarada
    const bad = { ...replay, actions: replay.actions.slice(10) };
    expect((await call('POST', '/api/runs', { runId: start.runId, score: g.score, replay: bad }, token)).status).toBe(422);
    // el modo de pruebas marca sus repeticiones con `sandbox`: nunca puntúan
    expect((await call('POST', '/api/runs', { runId: start.runId, replay: { ...replay, sandbox: true } }, token)).status).toBe(422);

    expect((await call('POST', '/api/runs', { runId: start.runId, replay }, token)).status).toBe(200);
    expect((await call('POST', '/api/runs', { runId: start.runId, replay }, token)).status).toBe(409);
  });

  it('otro jugador no puede usar la partida de alguien', async () => {
    const { call, register } = setup();
    const a = await register('Ana');
    const b = await register('Beto');
    const start = (await call('POST', '/api/runs/start', { mode: 'normal' }, a)).body;
    const g = playHuman(start.seed, 400_000, 'normal', start.bestLevel);
    expect((await call('POST', '/api/runs', { runId: start.runId, replay: g.replay() }, b)).status).toBe(422);
  });

  it('caduca la partida iniciada', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    const start = (await call('POST', '/api/runs/start', { mode: 'normal' }, token)).body;
    const g = playHuman(start.seed, 400_000, 'normal', start.bestLevel);
    clock += 7 * 3_600_000;
    expect((await call('POST', '/api/runs', { runId: start.runId, replay: g.replay() }, token)).status).toBe(422);
  });
});

describe('desafío diario', () => {
  const play = (date: string) => playHuman(dailySeed(date), 400_000, 'daily', 9999);

  it('acepta la semilla del día y solo cuenta la mejor', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    const date = '2026-10-14';
    const g = play(date);
    const ok = await call('POST', '/api/runs', { date, replay: g.replay() }, token);
    expect(ok.status).toBe(200);
    expect(ok.body.rank).toBe(1);
    const board = (await call('GET', `/api/leaderboard?mode=daily&date=${date}`)).body;
    expect(board.entries.map((e: any) => e.nickname)).toEqual(['Fer']);
    expect(board.scope).toBe('d:2026-10-14');
  });

  it('la tabla incluye una ventana de 2 por encima y 2 por debajo del jugador', async () => {
    const { call, register, db } = setup();
    const date = '2026-10-14';
    const tokens: string[] = [];
    // 7 jugadores con puntuaciones 7000, 6000 ... 1000 (el 1.º es el de más puntos), metidos a mano
    for (let i = 0; i < 7; i++) {
      // el alta por la API tiene tope por IP: solo se registran los que luego preguntan
      if (i === 0 || i === 3 || i === 6) tokens[i] = await register(`Jugador ${i}`);
      else db.prepare("INSERT INTO players (id, nickname, secret_hash, created_at) VALUES (?, ?, 'x', 0)").run(`p${i}`, `Jugador ${i}`);
      const id = (db.prepare('SELECT id FROM players WHERE nickname = ?').get(`Jugador ${i}`) as { id: string }).id;
      const run = db
        .prepare("INSERT INTO runs (player_id, mode, period, seed, version, score, level, lines, steps, hash, created_at) VALUES (?, 'daily', ?, 1, 1, ?, 1, 1, 1, ?, 0)")
        .run(id, date, (7 - i) * 1000, `h${i}`);
      db.prepare("INSERT INTO bests (player_id, mode, scope, score, level, lines, run_id) VALUES (?, 'daily', ?, ?, 1, 1, ?)").run(id, `d:${date}`, (7 - i) * 1000, run.lastInsertRowid);
    }
    const near = async (i: number) => (await call('GET', `/api/leaderboard?mode=daily&date=${date}`, undefined, tokens[i])).body.near.map((e: any) => e.rank);
    expect(await near(3)).toEqual([2, 3, 4, 5, 6]);
    expect(await near(0)).toEqual([1, 2, 3, 4, 5]);
    expect(await near(6)).toEqual([5, 6, 7]);
    // sin identificar no hay ventana
    expect((await call('GET', `/api/leaderboard?mode=daily&date=${date}`)).body.near).toEqual([]);
  });

  it('rechaza semilla de otro día, fechas viejas o futuras', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    const g = play('2026-10-14');
    expect((await call('POST', '/api/runs', { date: '2026-10-13', replay: g.replay() }, token)).status).toBe(422); // semilla ≠
    expect((await call('POST', '/api/runs', { date: '2026-10-15', replay: g.replay() }, token)).status).toBe(422); // futuro
    const old = play('2026-10-10');
    expect((await call('POST', '/api/runs', { date: '2026-10-10', replay: old.replay() }, token)).status).toBe(422); // viejo
    expect((await call('POST', '/api/runs', { replay: g.replay() }, token)).status).toBe(400); // sin fecha
  });

  it('admite la partida que empezó ayer y cruzó la medianoche', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    const g = play('2026-10-13');
    expect((await call('POST', '/api/runs', { date: '2026-10-13', replay: g.replay() }, token)).status).toBe(200);
  });
});

describe('moderación', () => {
  it('ocultar un jugador lo quita de la tabla', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    const start = (await call('POST', '/api/runs/start', { mode: 'normal' }, token)).body;
    const g = playHuman(start.seed, 400_000, 'normal', start.bestLevel);
    await call('POST', '/api/runs', { runId: start.runId, replay: g.replay() }, token);
    const id = token.split('.')[0];
    expect((await call('GET', '/api/admin/players?nickname=fer', undefined, 'admin-secret-token')).body.id).toBe(id);
    expect((await call('POST', `/api/admin/players/${id}/hide`, {}, 'otra-clave')).status).toBe(401);
    expect((await call('POST', `/api/admin/players/${id}/hide`, {}, 'admin-secret-token')).status).toBe(200);
    expect((await call('GET', '/api/leaderboard?mode=normal&scope=all')).body.entries).toHaveLength(0);
  });

  it('sin ADMIN_TOKEN la moderación no existe', async () => {
    const { call } = setup({ adminToken: '' });
    expect((await call('POST', '/api/admin/players/aaaaaaaaaaaaaaaaaaaaaaaa/hide', {}, 'x')).status).toBe(404);
  });

  it('borrar una partida devuelve la anterior mejor', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    const runs: { id: number; score: number }[] = [];
    // algunas semillas dan una partida que el bot no pierde nunca y el servidor rechaza por larga: se prueba con otra
    for (let tries = 0; runs.length < 2 && tries < 8; tries++) {
      const start = (await call('POST', '/api/runs/start', { mode: 'normal' }, token)).body;
      const g = playHuman(start.seed, 120_000, 'normal', start.bestLevel);
      const r = await call('POST', '/api/runs', { runId: start.runId, replay: g.replay() }, token);
      if (r.status === 200) runs.push({ id: r.body.runId, score: r.body.score });
    }
    expect(runs).toHaveLength(2);
    const best = runs.reduce((a, b) => (b.score > a.score ? b : a));
    const other = runs.find((r) => r !== best)!;
    expect((await call('DELETE', `/api/admin/runs/${best.id}`, undefined, 'admin-secret-token')).status).toBe(200);
    const board = (await call('GET', '/api/leaderboard?mode=normal&scope=all')).body;
    expect(board.entries[0].score).toBe(other.score);
  });
});

describe('modos sin ranking', () => {
  it('rechaza modos que no son de arcade', async () => {
    const { call, register } = setup();
    const token = await register('Fer');
    expect((await call('POST', '/api/runs/start', { mode: 'tutorial' }, token)).status).toBe(400);
    expect((await call('GET', '/api/leaderboard?mode=tutorial')).status).toBe(400);
    const g = playHuman(788, 400_000, 'normal', 0);
    expect((await call('POST', '/api/runs', { runId: 'x', replay: { ...g.replay(), mode: 'tutorial' } }, token)).status).toBe(422);
  });
});

describe('IP del cliente', () => {
  const req = (headers: Record<string, string>) => ({ headers, socket: { remoteAddress: '10.9.9.9' } }) as unknown as IncomingMessage;
  it('no se fía de la cabecera sin proxy y usa el último valor detrás de uno', () => {
    const h = { 'x-forwarded-for': '6.6.6.6, 1.2.3.4', 'cf-connecting-ip': '5.5.5.5' };
    expect(clientIp(req(h), { trustProxy: 'none' })).toBe('10.9.9.9');
    expect(clientIp(req(h), { trustProxy: 'proxy' })).toBe('1.2.3.4');
    expect(clientIp(req(h), { trustProxy: 'cloudflare' })).toBe('5.5.5.5');
    expect(clientIp(req({}), { trustProxy: 'cloudflare' })).toBe('10.9.9.9');
  });
});

describe('copias del diario', () => {
  it('rechaza reenviar la misma repetición y no sirve la del día hasta que acaba el plazo', async () => {
    const { call, register } = setup();
    const a = await register('Ana');
    const b = await register('Beto');
    const date = '2026-10-14';
    const g = playHuman(dailySeed(date), 400_000, 'daily', 9999);
    const first = await call('POST', '/api/runs', { date, replay: g.replay() }, a);
    expect(first.status).toBe(200);
    expect((await call('POST', '/api/runs', { date, replay: g.replay() }, b)).status).toBe(422);
    expect((await call('GET', `/api/runs/${first.body.runId}/replay`)).status).toBe(403);
    clock += 2 * 86_400_000;
    expect((await call('GET', `/api/runs/${first.body.runId}/replay`)).status).toBe(200);
  });
});

describe('utilidades', () => {
  it('la semana empieza el lunes', () => {
    expect(weekStart('2026-10-14')).toBe('2026-10-12');
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(weekStart('2026-10-18')).toBe('2026-10-12');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
  });

  it('limita las peticiones por IP', async () => {
    const { call } = setup();
    let last = 200;
    for (let i = 0; i < 250; i++) last = (await call('GET', '/api/health')).status;
    expect(last).toBe(429);
  });
});
