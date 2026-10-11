// API del ranking. Una función `(Request, ip) => Response`: sin sockets, así se prueba directamente.
import { NICK_CHARS, isBlockedNick, nickKey } from './nick';
import type { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { RULES_VERSION } from '../src/core/game';
import { dailyNumber, dailySeed, MODES, utcDate, type ModeId } from '../src/core/modes';
import type { Config } from './config';
import { RateLimiter } from './ratelimit';
import { isRankedMode, RANKED_MODES, verifyReplay } from './validate';

const DAY = 86_400_000;
/** Una partida iniciada vale 6 horas. */
const START_TTL = 6 * 3_600_000;
/** Primer día del desafío diario. */
const DAILY_FIRST = '2026-10-09';
const TOP = 50;
/** Puestos que se enseñan por encima y por debajo del jugador. */
const NEAR = 2;

interface PlayerRow {
  id: string;
  nickname: string;
  best_level: number;
  hidden: number;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Lunes (UTC) de la semana de una fecha AAAA-MM-DD. */
export function weekStart(date: string): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * DAY).toISOString().slice(0, 10);
}

const isDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && utcDate(new Date(`${s}T00:00:00Z`)) === s;

/** Rango de fechas (de `period`) que cubre un ámbito. */
function scopeRange(scope: string): [string, string] {
  if (scope === 'all') return ['0000-00-00', '9999-99-99'];
  const day = scope.slice(2);
  if (scope.startsWith('d:')) return [day, day];
  return [day, new Date(Date.parse(`${day}T00:00:00Z`) + 6 * DAY).toISOString().slice(0, 10)];
}

export function createApp(cfg: Config, db: DatabaseSync) {
  const general = new RateLimiter(240, 60_000);
  const createLimit = new RateLimiter(5, 3_600_000);
  const startLimit = new RateLimiter(120, 3_600_000);
  const runLimit = new RateLimiter(60, 3_600_000);
  /** Revalidar cuesta CPU en un único hilo: tope global, aunque falle el límite por IP. */
  const revalidations = new RateLimiter(30, 60_000);
  const adminFails = new RateLimiter(10, 600_000);
  const renameLimit = new RateLimiter(3, 86_400_000);
  const recoverLimit = new RateLimiter(10, 600_000);

  const q = {
    player: db.prepare('SELECT id, nickname, best_level, hidden FROM players WHERE id = ?'),
    playerSecret: db.prepare('SELECT secret_hash FROM players WHERE id = ?'),
    insertPlayer: db.prepare('INSERT INTO players (id, nickname, nick_key, secret_hash, created_at) VALUES (?, ?, ?, ?, ?)'),
    deletePlayer: db.prepare('DELETE FROM players WHERE id = ?'),
    renamePlayer: db.prepare('UPDATE players SET nickname = ?, nick_key = ? WHERE id = ?'),
    setSecret: db.prepare('UPDATE players SET secret_hash = ? WHERE id = ?'),
    setHidden: db.prepare('UPDATE players SET hidden = ? WHERE id = ?'),
    insertStart: db.prepare('INSERT INTO starts (id, player_id, mode, seed, best_level, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    getStart: db.prepare('SELECT * FROM starts WHERE id = ? AND player_id = ?'),
    useStart: db.prepare('UPDATE starts SET used = 1 WHERE id = ? AND used = 0'),
    oldStarts: db.prepare('DELETE FROM starts WHERE created_at < ?'),
    insertRun: db.prepare(
      'INSERT INTO runs (player_id, mode, period, seed, version, score, level, lines, steps, hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    getBest: db.prepare('SELECT score FROM bests WHERE player_id = ? AND mode = ? AND scope = ?'),
    upsertBest: db.prepare(
      `INSERT INTO bests (player_id, mode, scope, score, level, lines, run_id) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (player_id, mode, scope) DO UPDATE SET score = excluded.score, level = excluded.level, lines = excluded.lines, run_id = excluded.run_id`,
    ),
    insertReplay: db.prepare('INSERT OR REPLACE INTO replays (run_id, data) VALUES (?, ?)'),
    // repeticiones de periodos viejos: solo se conservan las de la mejor de cada tabla y las de «siempre»
    pruneOld: db.prepare(
      `DELETE FROM replays WHERE run_id IN (
         SELECT b.run_id FROM bests b
         WHERE b.scope != 'all' AND substr(b.scope, 3) < ?
           AND b.score < (SELECT MAX(x.score) FROM bests x WHERE x.mode = b.mode AND x.scope = b.scope)
           AND b.run_id NOT IN (SELECT run_id FROM bests WHERE scope = 'all'))`,
    ),
    pruneReplays: db.prepare('DELETE FROM replays WHERE run_id NOT IN (SELECT run_id FROM bests)'),
    bumpLevel: db.prepare('UPDATE players SET best_level = MAX(best_level, ?) WHERE id = ?'),
    top: db.prepare(
      `SELECT p.nickname, b.score, b.level, b.lines, b.run_id, p.id AS player_id
       FROM bests b JOIN players p ON p.id = b.player_id
       WHERE b.mode = ? AND b.scope = ? AND p.hidden = 0
       ORDER BY b.score DESC, b.run_id ASC LIMIT ?`,
    ),
    slice: db.prepare(
      `SELECT p.nickname, b.score, b.level, b.lines, b.run_id, p.id AS player_id
       FROM bests b JOIN players p ON p.id = b.player_id
       WHERE b.mode = ? AND b.scope = ? AND p.hidden = 0
       ORDER BY b.score DESC, b.run_id ASC LIMIT ? OFFSET ?`,
    ),
    mine: db.prepare('SELECT score, level, lines, run_id FROM bests WHERE player_id = ? AND mode = ? AND scope = ?'),
    above: db.prepare(
      `SELECT COUNT(*) AS n FROM bests b JOIN players p ON p.id = b.player_id
       WHERE b.mode = ? AND b.scope = ? AND p.hidden = 0 AND (b.score > ? OR (b.score = ? AND b.run_id < ?))`,
    ),
    total: db.prepare(
      'SELECT COUNT(*) AS n FROM bests b JOIN players p ON p.id = b.player_id WHERE b.mode = ? AND b.scope = ? AND p.hidden = 0',
    ),
    dupHash: db.prepare('SELECT 1 FROM runs WHERE mode = ? AND period = ? AND hash = ? LIMIT 1'),
    replayInfo: db.prepare('SELECT r.mode, r.period FROM runs r WHERE r.id = ?'),
    replayOf: db.prepare('SELECT data FROM replays WHERE run_id = ?'),
    deleteRun: db.prepare('DELETE FROM runs WHERE id = ?'),
    runOwner: db.prepare('SELECT player_id, mode, period FROM runs WHERE id = ?'),
    rebuildBest: db.prepare(
      `SELECT id, score, level, lines FROM runs WHERE player_id = ? AND mode = ? AND period BETWEEN ? AND ?
       ORDER BY score DESC, id ASC LIMIT 1`,
    ),
  };

  const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
    });

  const readJson = async (req: Request): Promise<Record<string, unknown>> => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, 'JSON no válido');
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new ApiError(400, 'se esperaba un objeto');
    return body as Record<string, unknown>;
  };

  /** Jugador de la cabecera `Authorization: Bearer <id>.<secreto>`, o null. */
  const authToken = (token: string): PlayerRow | null => {
    const m = /^([0-9a-f]{24})\.([A-Za-z0-9_-]{20,64})$/.exec(token);
    if (!m) return null;
    const row = q.playerSecret.get(m[1]) as { secret_hash: string } | undefined;
    if (!row || !safeEq(row.secret_hash, sha256(m[2]))) return null;
    return q.player.get(m[1]) as unknown as PlayerRow;
  };
  const auth = (req: Request): PlayerRow | null => authToken(/^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1] ?? '');
  const needPlayer = (req: Request): PlayerRow => {
    const p = auth(req);
    if (!p) throw new ApiError(401, 'jugador no identificado');
    return p;
  };

  const needAdmin = (req: Request, ip: string, now: number) => {
    if (!cfg.adminToken) throw new ApiError(404, 'no existe');
    if (!adminFails.allow(`a:${ip}`, now)) throw new ApiError(429, 'demasiados intentos');
    const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '');
    if (!m || !safeEq(m[1], cfg.adminToken)) throw new ApiError(401, 'sin permiso');
  };

  function cleanNickname(raw: unknown): string {
    if (typeof raw !== 'string') throw new ApiError(400, 'apodo no válido');
    const nick = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const len = [...nick].length;
    if (len < 3 || len > 16) throw new ApiError(400, 'el apodo tiene de 3 a 16 caracteres');
    if (!NICK_CHARS.test(nick)) throw new ApiError(400, 'el apodo solo admite letras latinas, números, espacio, punto, guion y guion bajo');
    if (nickKey(nick).length < 3) throw new ApiError(400, 'el apodo necesita al menos 3 letras o números');
    if (isBlockedNick(nick, cfg.nickBlocklist)) throw new ApiError(400, 'ese apodo no está permitido');
    return nick;
  }

  const scopesFor = (mode: ModeId, period: string): string[] =>
    mode === 'daily' ? [`d:${period}`] : ['all', `w:${weekStart(period)}`];

  function recordBestFor(playerId: string, mode: ModeId, scope: string, v: { score: number; level: number; lines: number }, runId: number) {
    const cur = q.getBest.get(playerId, mode, scope) as { score: number } | undefined;
    if (cur && cur.score >= v.score) return false;
    q.upsertBest.run(playerId, mode, scope, v.score, v.level, v.lines, runId);
    return true;
  }

  const route = async (req: Request, ip: string, now: number): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const today = utcDate(cfg.now());

    if (method === 'GET' && path === '/api/health') {
      db.prepare('SELECT 1').get();
      return json({ ok: true });
    }

    if (method === 'GET' && path === '/api/config') {
      return json({ rulesVersion: RULES_VERSION, now: cfg.now().getTime(), today, dailyNumber: dailyNumber(today), modes: RANKED_MODES });
    }

    if (method === 'POST' && path === '/api/players') {
      if (!createLimit.allow(`p:${ip}`, now)) throw new ApiError(429, 'demasiados jugadores nuevos desde tu red, prueba más tarde');
      const body = await readJson(req);
      const nick = cleanNickname(body.nickname);
      const id = randomBytes(12).toString('hex');
      const secret = randomBytes(24).toString('base64url');
      try {
        q.insertPlayer.run(id, nick, nickKey(nick), sha256(secret), now);
      } catch {
        throw new ApiError(409, 'ese apodo ya está cogido');
      }
      return json({ id, nickname: nick, secret, token: `${id}.${secret}` }, 201);
    }

    // Recuperar el jugador en otro navegador con el código (es el propio token: no hace falta nada nuevo en la base)
    if (method === 'POST' && path === '/api/players/recover') {
      if (!recoverLimit.allow(`c:${ip}`, now)) throw new ApiError(429, 'demasiados intentos, prueba más tarde');
      const code = String((await readJson(req)).code ?? '').trim();
      const p = authToken(code);
      if (!p) throw new ApiError(404, 'código no válido');
      return json({ id: p.id, nickname: p.nickname, token: code });
    }

    // Código nuevo: invalida el anterior en todos los navegadores
    if (method === 'POST' && path === '/api/players/me/rotate') {
      const me = needPlayer(req);
      const secret = randomBytes(24).toString('base64url');
      q.setSecret.run(sha256(secret), me.id);
      return json({ id: me.id, nickname: me.nickname, token: `${me.id}.${secret}` });
    }

    if (path === '/api/players/me') {
      const me = needPlayer(req);
      if (method === 'GET') return json({ id: me.id, nickname: me.nickname, bestLevel: me.best_level });
      if (method === 'PATCH') {
        const nick = cleanNickname((await readJson(req)).nickname);
        if (!renameLimit.allow(`n:${me.id}`, now)) throw new ApiError(429, 'solo puedes cambiar de apodo 3 veces al día');
        try {
          q.renamePlayer.run(nick, nickKey(nick), me.id);
        } catch {
          throw new ApiError(409, 'ese apodo ya está cogido');
        }
        return json({ id: me.id, nickname: nick });
      }
      if (method === 'DELETE') {
        q.deletePlayer.run(me.id);
        return json({ ok: true });
      }
    }

    if (method === 'POST' && path === '/api/runs/start') {
      const me = needPlayer(req);
      if (!startLimit.allow(`s:${me.id}`, now)) throw new ApiError(429, 'demasiadas partidas seguidas');
      const body = await readJson(req);
      const mode = body.mode;
      if (!isRankedMode(mode)) throw new ApiError(400, 'modo no válido');
      if (mode === 'daily') throw new ApiError(400, 'el desafío diario usa la semilla del día');
      q.oldStarts.run(now - START_TTL);
      const id = randomBytes(12).toString('hex');
      const seed = cfg.newSeed();
      q.insertStart.run(id, me.id, mode, seed, me.best_level, now);
      return json({ runId: id, mode, seed, bestLevel: me.best_level });
    }

    if (method === 'POST' && path === '/api/runs') {
      const me = needPlayer(req);
      if (!runLimit.allow(`r:${me.id}`, now)) throw new ApiError(429, 'demasiados envíos, prueba más tarde');
      if (!revalidations.allow('v', now)) throw new ApiError(429, 'el servidor está ocupado, prueba en un minuto');
      const body = await readJson(req);
      const v = verifyReplay(body.replay);
      if (typeof v === 'string') throw new ApiError(422, v);
      if (typeof body.score === 'number' && body.score !== v.score)
        throw new ApiError(422, `la puntuación declarada (${body.score}) no coincide con la repetición (${v.score})`);
      const mode = v.replay.mode as ModeId;

      let period: string;
      if (mode === 'daily') {
        const date = body.date;
        if (!isDate(date)) throw new ApiError(400, 'falta la fecha del desafío');
        // el cliente fija la fecha al empezar: una partida que cruza la medianoche cuenta para el día en que empezó
        const yesterday = utcDate(new Date(cfg.now().getTime() - DAY));
        if (date !== today && date !== yesterday) throw new ApiError(422, 'ese desafío ya no admite puntuaciones');
        if (date < DAILY_FIRST) throw new ApiError(422, 'fecha anterior al primer desafío');
        if (v.replay.seed !== dailySeed(date)) throw new ApiError(422, 'la semilla no es la del desafío');
        if (v.replay.bestLevel !== MODES.daily.fixedBestLevel) throw new ApiError(422, 'desbloqueos distintos a los del desafío');
        period = date;
      } else {
        const runId = body.runId;
        if (typeof runId !== 'string') throw new ApiError(400, 'falta runId: pide la partida al servidor antes de jugar');
        const st = q.getStart.get(runId, me.id) as
          | { mode: string; seed: number; best_level: number; created_at: number; used: number }
          | undefined;
        if (!st) throw new ApiError(422, 'esa partida no existe');
        if (st.used) throw new ApiError(409, 'esa partida ya se envió');
        if (now - st.created_at > START_TTL) throw new ApiError(422, 'la partida caducó');
        if (st.mode !== mode) throw new ApiError(422, 'el modo no es el de la partida iniciada');
        if (v.replay.seed !== st.seed) throw new ApiError(422, 'la semilla no es la que dio el servidor');
        if (v.replay.bestLevel !== st.best_level) throw new ApiError(422, 'desbloqueos distintos a los de la partida iniciada');
        if (q.useStart.run(runId).changes !== 1) throw new ApiError(409, 'esa partida ya se envió');
        period = utcDate(new Date(now));
      }

      // la misma repetición (mismas acciones) no vale dos veces en un periodo: así no se copia la de otro
      const hash = createHash('sha256').update(JSON.stringify([v.replay.seed, v.steps, v.replay.actions])).digest('hex');
      if (q.dupHash.get(mode, period, hash)) throw new ApiError(422, 'esa repetición ya se envió');

      let result: { runId: number; improved: string[] };
      db.exec('BEGIN');
      try {
        const info = q.insertRun.run(me.id, mode, period, v.replay.seed, v.replay.version, v.score, v.level, v.lines, v.steps, hash, now);
        const runId = Number(info.lastInsertRowid);
        const improved = scopesFor(mode, period).filter((s) => recordBestFor(me.id, mode, s, v, runId));
        if (improved.length) q.insertReplay.run(runId, gzipSync(JSON.stringify(v.replay)));
        q.pruneReplays.run();
        q.pruneOld.run(utcDate(new Date(now - 30 * DAY)));
        // lo desbloqueado en el ranking es lo que el servidor ha visto jugar
        q.bumpLevel.run(v.level, me.id);
        db.exec('COMMIT');
        result = { runId, improved };
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      const scope = scopesFor(mode, period)[0];
      return json({ ok: true, runId: result.runId, score: v.score, level: v.level, lines: v.lines, improved: result.improved.length > 0, ...rankOf(me.id, mode, scope) });
    }

    if (method === 'GET' && path === '/api/leaderboard') {
      const mode = url.searchParams.get('mode') ?? 'normal';
      if (!isRankedMode(mode)) throw new ApiError(400, 'modo no válido');
      const kind = url.searchParams.get('scope') ?? (mode === 'daily' ? 'daily' : 'weekly');
      const dateParam = url.searchParams.get('date') ?? today;
      if (!isDate(dateParam)) throw new ApiError(400, 'fecha no válida');
      let scope: string;
      if (mode === 'daily') {
        if (kind !== 'daily') throw new ApiError(400, 'el desafío diario solo tiene tabla del día');
        scope = `d:${dateParam}`;
      } else if (kind === 'weekly') scope = `w:${weekStart(dateParam)}`;
      else if (kind === 'all') scope = 'all';
      else throw new ApiError(400, 'ámbito no válido');
      const me = auth(req);
      const rows = q.top.all(mode, scope, TOP) as unknown as { nickname: string; score: number; level: number; lines: number; run_id: number; player_id: string }[];
      const total = (q.total.get(mode, scope) as { n: number }).n;
      const mine = me ? rankOf(me.id, mode, scope) : null;
      const toEntry = (r: (typeof rows)[number], rank: number) => ({ rank, nickname: r.nickname, score: r.score, level: r.level, lines: r.lines, runId: r.run_id, me: me?.id === r.player_id });
      // ventana alrededor del jugador (2 por encima y 2 por debajo) para la portada
      let near: ReturnType<typeof toEntry>[] = [];
      if (mine?.rank) {
        const from = Math.max(1, mine.rank - NEAR);
        near = (q.slice.all(mode, scope, NEAR * 2 + 1, from - 1) as unknown as typeof rows).map((r, i) => toEntry(r, from + i));
      }
      return json(
        {
          mode,
          scope,
          total,
          entries: rows.map((r, i) => toEntry(r, i + 1)),
          near,
          me: me && mine ? { nickname: me.nickname, ...mine } : null,
        },
        200,
        { 'cache-control': me ? 'private, no-store' : 'public, max-age=10' },
      );
    }

    const replayMatch = /^\/api\/runs\/(\d+)\/replay$/.exec(path);
    if (method === 'GET' && replayMatch) {
      // la repetición de un diario no se sirve hasta que se cierra su ventana de envío (D+2 UTC): antes se podría copiar
      const info = q.replayInfo.get(Number(replayMatch[1])) as { mode: ModeId; period: string } | undefined;
      if (info?.mode === 'daily' && today < new Date(Date.parse(`${info.period}T00:00:00Z`) + 2 * DAY).toISOString().slice(0, 10))
        throw new ApiError(403, 'la repetición del diario se publica cuando acaba el plazo de envío');
      const row = q.replayOf.get(Number(replayMatch[1])) as { data: Uint8Array } | undefined;
      if (!row) throw new ApiError(404, 'repetición no disponible');
      return new Response(gunzipSync(row.data), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
    }

    if (method === 'GET' && path === '/api/admin/players') {
      needAdmin(req, ip, now);
      const nick = url.searchParams.get('nickname') ?? '';
      const row = db.prepare('SELECT id, nickname, hidden, best_level FROM players WHERE nickname = ?').get(nick);
      if (!row) throw new ApiError(404, 'no existe');
      return json(row);
    }

    const hideMatch = /^\/api\/admin\/players\/([0-9a-f]{24})\/hide$/.exec(path);
    if (method === 'POST' && hideMatch) {
      needAdmin(req, ip, now);
      const body = await readJson(req);
      q.setHidden.run(body.hidden === false ? 0 : 1, hideMatch[1]);
      return json({ ok: true });
    }

    const delRun = /^\/api\/admin\/runs\/(\d+)$/.exec(path);
    if (method === 'DELETE' && delRun) {
      needAdmin(req, ip, now);
      const id = Number(delRun[1]);
      const own = q.runOwner.get(id) as { player_id: string; mode: ModeId; period: string } | undefined;
      if (!own) throw new ApiError(404, 'no existe');
      db.exec('BEGIN');
      try {
        q.deleteRun.run(id); // arrastra su mejor y su repetición
        // si era la mejor del jugador en algún ámbito, vuelve a su siguiente mejor partida
        for (const s of scopesFor(own.mode, own.period)) {
          if (q.getBest.get(own.player_id, own.mode, s)) continue;
          const [lo, hi] = scopeRange(s);
          const alt = q.rebuildBest.get(own.player_id, own.mode, lo, hi) as { id: number; score: number; level: number; lines: number } | undefined;
          if (alt) q.upsertBest.run(own.player_id, own.mode, s, alt.score, alt.level, alt.lines, alt.id);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      return json({ ok: true });
    }

    throw new ApiError(404, 'no existe');
  };

  /** Puesto y mejor puntuación de un jugador en un ámbito. */
  function rankOf(playerId: string, mode: ModeId, scope: string) {
    const m = q.mine.get(playerId, mode, scope) as { score: number; level: number; lines: number; run_id: number } | undefined;
    if (!m) return { rank: null as number | null, best: null as number | null };
    const above = (q.above.get(mode, scope, m.score, m.score, m.run_id) as { n: number }).n;
    return { rank: above + 1, best: m.score };
  }

  return async function handle(req: Request, ip: string): Promise<Response> {
    const now = cfg.now().getTime();
    try {
      if (!general.allow(`g:${ip}`, now)) throw new ApiError(429, 'demasiadas peticiones');
      return await route(req, ip, now);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message }, e.status);
      console.error('error interno', e);
      return json({ error: 'error interno' }, 500);
    }
  };
}
