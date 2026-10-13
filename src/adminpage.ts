// Página de administración del ranking (admin.html): borrar puntuaciones, ocultar jugadores y generar códigos de recuperación.
// No hay lógica de juego: todo lo hace el servidor con `ADMIN_TOKEN`.
import { MODES } from './core/modes';

interface Entry { playerId: string; nickname: string; hidden: number; score: number; level: number; lines: number; runId: number }
interface Player { id: string; nickname: string; hidden: number; bestLevel: number; createdAt: number; runs: number }
interface Run { id: number; mode: string; period: string; score: number; level: number; lines: number; createdAt: number; onBoard: number }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const RANKED = Object.keys(MODES).filter((m) => m !== 'tutorial' && m !== 'expedition');

$('mode').innerHTML = RANKED.map((m) => `<option value="${m}">${esc(MODES[m as keyof typeof MODES].name)}</option>`).join('');
try {
  $<HTMLInputElement>('token').value = sessionStorage.getItem('admin.token') ?? '';
} catch {
  /* sin almacenamiento */
}

const say = (err: string, msg = '') => {
  $('err').textContent = err;
  $('msg').textContent = msg;
};

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = $<HTMLInputElement>('token').value.trim();
  const res = await fetch(path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(res.status === 401 ? 'Clave incorrecta.' : res.status === 404 && !token ? 'Falta la clave.' : (data.error ?? `Error ${res.status}`));
  try {
    sessionStorage.setItem('admin.token', token);
  } catch {
    /* sin almacenamiento */
  }
  return data;
}

const run = (fn: () => Promise<void>) => fn().catch((e: Error) => say(e.message));

function table(head: string[], rows: string[][]) {
  if (!rows.length) return '<p class="note">Sin resultados.</p>';
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

const btn = (act: string, attrs: Record<string, string | number>, label: string, danger = false) =>
  `<button type="button" data-act="${act}" ${Object.entries(attrs).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}${danger ? ' class="danger"' : ''}>${label}</button>`;

async function loadBoard() {
  const q = new URLSearchParams({ mode: $<HTMLSelectElement>('mode').value, scope: $<HTMLSelectElement>('scope').value, q: $<HTMLInputElement>('bq').value });
  const date = $<HTMLInputElement>('date').value;
  if (date) q.set('date', date);
  const d = await api<{ scope: string; entries: Entry[] }>('GET', `/api/admin/board?${q}`);
  say('');
  $('board').innerHTML =
    `<p class="note">Tabla <code>${esc(d.scope)}</code>. Borrar una partida la quita de todas las tablas; si el jugador tenía otra anterior, esa pasa a ser su mejor.</p>` +
    table(
      ['#', 'Apodo', 'Puntos', 'Nivel', 'Líneas', 'Partida', ''],
      d.entries.map((e, i) => [
        String(i + 1),
        `<span class="l">${esc(e.nickname)}${e.hidden ? ' <span class="neg">(oculto)</span>' : ''}</span>`,
        String(e.score), String(e.level), String(e.lines), String(e.runId),
        `<span class="acts">${btn('del-run', { run: e.runId, nick: e.nickname }, 'Borrar puntuación', true)} ${btn('runs', { id: e.playerId }, 'Partidas')}</span>`,
      ]),
    );
}

async function loadPlayers(query: string) {
  const d = await api<{ players: Player[] }>('GET', `/api/admin/players?q=${encodeURIComponent(query)}`);
  say('');
  $('players').innerHTML = table(
    ['Apodo', 'Partidas', 'Mejor nivel', 'Alta', ''],
    d.players.map((p) => [
      `<span class="l">${esc(p.nickname)}${p.hidden ? ' <span class="neg">(oculto)</span>' : ''}</span>`,
      String(p.runs), String(p.bestLevel), new Date(p.createdAt).toISOString().slice(0, 10),
      `<span class="acts">${btn('runs', { id: p.id }, 'Partidas')} ${btn('hide', { id: p.id, hidden: p.hidden ? 0 : 1 }, p.hidden ? 'Mostrar' : 'Ocultar')} ${btn('code', { id: p.id, nick: p.nickname }, 'Código nuevo')} ${btn('del-all', { id: p.id, nick: p.nickname }, 'Borrar todas', true)}</span>`,
    ]),
  );
}

async function loadRuns(id: string) {
  const d = await api<{ runs: Run[] }>('GET', `/api/admin/players/${id}/runs`);
  $('runs').innerHTML =
    '<h2>Partidas del jugador</h2>' +
    table(
      ['Partida', 'Modo', 'Periodo', 'Puntos', 'Nivel', 'Líneas', 'En tabla', ''],
      d.runs.map((r) => [
        String(r.id), esc(r.mode), esc(r.period), String(r.score), String(r.level), String(r.lines), r.onBoard ? 'sí' : '',
        btn('del-run', { run: r.id, nick: `partida ${r.id}`, player: id }, 'Borrar', true),
      ]),
    );
}

$('board-f').addEventListener('submit', (e) => {
  e.preventDefault();
  void run(loadBoard);
});
$('players-f').addEventListener('submit', (e) => {
  e.preventDefault();
  void run(() => loadPlayers($<HTMLInputElement>('pq').value));
});
$('code-close').addEventListener('click', () => {
  $('code').style.display = 'none';
  $('code-val').textContent = '';
});
$('code-copy').addEventListener('click', () => {
  void navigator.clipboard?.writeText($('code-val').textContent ?? '');
});

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
  if (!b) return;
  const { act, id, run: runId, nick = '', hidden, player } = b.dataset;
  if (act === 'runs') void run(() => loadRuns(id!));
  else if (act === 'hide') {
    void run(async () => {
      await api('POST', `/api/admin/players/${id}/hide`, { hidden: hidden === '1' });
      await loadPlayers($<HTMLInputElement>('pq').value);
    });
  } else if (act === 'del-run') {
    if (!confirm(`¿Borrar ${nick}? No se puede deshacer.`)) return;
    void run(async () => {
      await api('DELETE', `/api/admin/runs/${runId}`);
      say('', 'Borrada.');
      if (player) await loadRuns(player);
      await loadBoard().catch(() => undefined);
    });
  } else if (act === 'del-all') {
    if (!confirm(`¿Borrar TODAS las puntuaciones de ${nick}? La cuenta se conserva. No se puede deshacer.`)) return;
    void run(async () => {
      const d = await api<{ deleted: number }>('DELETE', `/api/admin/players/${id}/scores`);
      say('', `Borradas ${d.deleted} partidas de ${nick}.`);
      await loadPlayers($<HTMLInputElement>('pq').value);
      await loadBoard().catch(() => undefined);
    });
  } else if (act === 'code') {
    if (!confirm(`¿Generar un código nuevo para ${nick}? El anterior dejará de funcionar en todos sus navegadores.`)) return;
    void run(async () => {
      const d = await api<{ token: string; nickname: string }>('POST', `/api/admin/players/${id}/recovery`);
      $('code-who').textContent = d.nickname;
      $('code-val').textContent = d.token;
      $('code').style.display = 'block';
      say('');
    });
  }
});
