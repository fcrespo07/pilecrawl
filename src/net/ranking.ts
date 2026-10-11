// Cliente del ranking en línea. Todo es opcional: sin `VITE_RANKING=1` o sin servidor, el juego sigue siendo local.
import type { Replay } from '../core/game';
import type { ModeId } from '../core/modes';

export const RANKING_ENABLED = import.meta.env.VITE_RANKING === '1';
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const PLAYER_KEY = 'blockrogue.player';

export interface Player {
  token: string;
  nickname: string;
}

export interface Entry {
  rank: number;
  nickname: string;
  score: number;
  level: number;
  lines: number;
  runId: number;
  me: boolean;
}

export interface Board {
  mode: ModeId;
  scope: string;
  total: number;
  entries: Entry[];
  me: { nickname: string; rank: number | null; best: number | null } | null;
}

export interface RankedStart {
  runId: string;
  seed: number;
  bestLevel: number;
}

export interface Published {
  score: number;
  rank: number | null;
  improved: boolean;
}

/** Error con el mensaje del servidor (ya en español) o el de la red. */
export class RankingError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

export function loadPlayer(): Player | null {
  try {
    const p = JSON.parse(localStorage.getItem(PLAYER_KEY) ?? 'null') as Partial<Player> | null;
    if (p && typeof p.token === 'string' && typeof p.nickname === 'string') return { token: p.token, nickname: p.nickname };
  } catch {
    /* sin almacenamiento o JSON roto: como si no hubiera jugador */
  }
  return null;
}

function savePlayer(p: Player | null) {
  try {
    if (p) localStorage.setItem(PLAYER_KEY, JSON.stringify(p));
    else localStorage.removeItem(PLAYER_KEY);
  } catch {
    /* el jugador dura lo que la pestaña */
  }
}

async function call<T>(method: string, path: string, body?: unknown, auth = false, timeoutMs = 8000): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth) {
    const p = loadPlayer();
    if (!p) throw new RankingError('Primero crea un apodo.', 401);
    headers.authorization = `Bearer ${p.token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new RankingError('No hay conexión con el servidor del ranking.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    // el servidor ya no reconoce al jugador (p. ej. borrado): olvidarlo para poder crear otro
    if (res.status === 401 && auth) savePlayer(null);
    throw new RankingError(data.error ?? `Error ${res.status}`, res.status);
  }
  return data;
}

export async function register(nickname: string): Promise<Player> {
  const r = await call<{ token: string; nickname: string }>('POST', '/api/players', { nickname });
  const p = { token: r.token, nickname: r.nickname };
  savePlayer(p);
  return p;
}

export async function rename(nickname: string): Promise<Player> {
  const p = loadPlayer();
  const r = await call<{ nickname: string }>('PATCH', '/api/players/me', { nickname }, true);
  const np = { token: p!.token, nickname: r.nickname };
  savePlayer(np);
  return np;
}

/** Recupera tu jugador en este navegador con el código que se ve en la ventana de rankings. */
export async function recover(code: string): Promise<Player> {
  const r = await call<{ token: string; nickname: string }>('POST', '/api/players/recover', { code });
  const p = { token: r.token, nickname: r.nickname };
  savePlayer(p);
  return p;
}

export async function deleteMe(): Promise<void> {
  await call('DELETE', '/api/players/me', undefined, true);
  savePlayer(null);
}

/** Pide al servidor una semilla para una partida con ranking. */
export function startRanked(mode: ModeId): Promise<RankedStart> {
  return call<RankedStart>('POST', '/api/runs/start', { mode }, true, 3000);
}

export function publish(replay: Replay, score: number, ids: { runId?: string; date?: string }): Promise<Published> {
  return call<Published>('POST', '/api/runs', { ...ids, score, replay }, true, 20000);
}

export function leaderboard(mode: ModeId, scope: 'daily' | 'weekly' | 'all', date?: string): Promise<Board> {
  const q = new URLSearchParams({ mode, scope });
  if (date) q.set('date', date);
  return call<Board>('GET', `/api/leaderboard?${q}`, undefined, loadPlayer() !== null);
}
