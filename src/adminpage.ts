// Página de administración del ranking (admin.html): borrar puntuaciones, ocultar jugadores y generar códigos de recuperación.
// No hay lógica de juego: todo lo hace el servidor con `ADMIN_TOKEN`.
import { MODES, MODE_IDS } from './core/modes';
import { C, columns, legend, rows, stacked } from './admincharts';

interface Entry { playerId: string; nickname: string; hidden: number; score: number; level: number; lines: number; runId: number }
interface Player { id: string; nickname: string; hidden: number; bestLevel: number; createdAt: number; runs: number }
interface Run { id: number; mode: string; period: string; score: number; level: number; lines: number; createdAt: number; onBoard: number }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
interface Card { id: string; name: string; kind: string; shown: number; picked: number; pickRate: number | null; runsPicked: number; avgLevelPicked: number | null; runsPassed: number; avgLevelPassed: number | null; levelDelta: number | null }
interface ModeSum { runs: number; level: { avg: number | null; p25: number | null; median: number | null; p75: number | null; max: number }; score: { avg: number | null; median: number | null }; secs: { avg: number | null; median: number | null }; ends: Record<string, number>; levelHistogram: Record<string, number> }
interface Summary { runs: number; perkMode: string | null; byDay: Record<string, number>; byVersion: Record<string, number>; modes: Record<string, ModeSum>; cards: Card[]; hypers: Card[] }

const RANKED = Object.keys(MODES).filter((m) => m !== 'tutorial' && m !== 'expedition');

$('mode').innerHTML = RANKED.map((m) => `<option value="${m}">${esc(MODES[m as keyof typeof MODES].name)}</option>`).join('');
$('smode').innerHTML = `<option value="normal">Cartas: Partida</option>${MODE_IDS.filter((m) => m !== 'normal').map((m) => `<option value="${m}">Cartas: ${esc(m)}</option>`).join('')}<option value="all">Cartas: todos</option>`;
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

// ---- pestañas y estadísticas ----
document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((o) => o.classList.toggle('on', o === b));
    $('tab-ranking').hidden = b.dataset.tab !== 'ranking';
    $('tab-stats').hidden = b.dataset.tab !== 'stats';
  }),
);

const n = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '–' : String(Math.round(v * 10 ** d) / 10 ** d));
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);
/** Una carta solo entra en las gráficas con esta exposición mínima: con menos casos la diferencia es ruido. */
const MIN_SHOWN = 10;
/** Barras del histograma de niveles: de aquí en adelante van juntos. */
const LEVEL_CAP = 40;
const END_NAMES: Record<string, { name: string; color: string }> = {
  topout: { name: 'Pierde', color: C.bad },
  time: { name: 'Se acaba el tiempo', color: C.good },
  quit: { name: 'Abandona', color: C.warn },
};

function cardsTable(list: Card[]) {
  return table(
    ['Carta', 'Vista', 'Cogida', '% elección', 'Nivel final si la coges', 'Nivel final si la dejas', 'Diferencia'],
    list.map((c) => [
      `<span class="l">${esc(c.name)}${c.kind === 'c' ? ' (maldición)' : ''}</span>`,
      String(c.shown), String(c.picked), pct(c.pickRate),
      `${n(c.avgLevelPicked)} (${c.runsPicked})`, `${n(c.avgLevelPassed)} (${c.runsPassed})`,
      c.levelDelta === null ? '–' : `<span class="${c.levelDelta >= 0 ? 'pos' : 'neg'}">${c.levelDelta > 0 ? '+' : ''}${n(c.levelDelta)}</span>`,
    ]),
  );
}

/** Gráficas de cartas: cuánto se eligen y cuánto cambia el nivel final de quien las coge. */
function cardCharts(list: Card[]) {
  if (!list.length) return '<p class="note">Sin datos todavía.</p>';
  const seen = list.filter((c) => c.shown >= MIN_SHOWN);
  const label = (c: Card) => c.name + (c.kind === 'c' ? ' (maldición)' : '');
  const byRate = [...seen].filter((c) => c.pickRate !== null).sort((a, b) => (b.pickRate as number) - (a.pickRate as number));
  const byDelta = seen.filter((c) => c.levelDelta !== null).sort((a, b) => (b.levelDelta as number) - (a.levelDelta as number));
  const h = (t: string) => `<h3>${t}</h3>`;
  return (
    (seen.length ? '' : `<p class="note">Ninguna carta se ha visto ${MIN_SHOWN} veces todavía: las gráficas aparecen con más partidas.</p>`) +
    h('A cuántas la eligen cuando sale') +
    rows(byRate.map((c) => ({ label: label(c), value: c.pickRate as number, text: `${pct(c.pickRate)} (${c.picked}/${c.shown})` }))) +
    h('Nivel final: quien la coge menos quien la deja pasar') +
    '<p class="note">Con pocas partidas es ruido; fíate de las diferencias solo con decenas de casos.</p>' +
    rows(byDelta.map((c) => ({ label: label(c), value: c.levelDelta as number, text: `${(c.levelDelta as number) > 0 ? '+' : ''}${n(c.levelDelta)}` })), { diverging: true })
  );
}

function renderStats(s: Summary) {
  const modes = Object.entries(s.modes).sort((a, b) => b[1].runs - a[1].runs);
  let h = `<p><b>${s.runs}</b> partidas. Versiones: ${Object.entries(s.byVersion).map(([k, v]) => `${esc(k)}: ${v}`).join(' · ') || '–'}</p>`;

  h += '<h3>Partidas por día</h3>' + columns(Object.entries(s.byDay).map(([d, c]) => ({ label: d.slice(5), value: c, tip: `${d}: ${c} partidas` })));

  const top = modes[0];
  if (top) {
    // los niveles por encima de LEVEL_CAP (el cliente puede mandar hasta 9999) se juntan en la última barra
    const hist = top[1].levelHistogram;
    const cap = Math.min(top[1].level.max, LEVEL_CAP);
    const count = (l: number) => (l < LEVEL_CAP ? (hist[l] ?? 0) : Object.entries(hist).reduce((a, [k, v]) => a + (Number(k) >= LEVEL_CAP ? v : 0), 0));
    const med = Math.min(Math.round(top[1].level.median ?? 0), LEVEL_CAP);
    const bars = Array.from({ length: cap }, (_, i) => i + 1).map((l) => {
      const label = l === LEVEL_CAP ? `${l}+` : String(l);
      return { label, value: count(l), tip: `Nivel ${label}: ${count(l)} partidas` };
    });
    h += `<h3>En qué nivel acaban (${esc(top[0])})</h3>` + columns(bars, { mark: { label: bars[med - 1]?.label ?? '', text: 'mediana' } });
  }

  h += '<h3>Cómo acaban las partidas</h3>' + legend(Object.values(END_NAMES)) +
    stacked(modes.map(([m, x]) => ({ label: `${m} (${x.runs})`, parts: Object.entries(END_NAMES).map(([k, e]) => ({ name: e.name, value: x.ends[k] ?? 0, color: e.color })) })));

  h += `<h3>Por modo</h3>` + table(
    ['Modo', 'Partidas', 'Nivel medio', 'Mediana (p25–p75)', 'Máx.', 'Puntos (mediana)', 'Minutos (mediana)'],
    modes.map(([m, x]) => [esc(m), String(x.runs), n(x.level.avg), `${n(x.level.median, 0)} (${n(x.level.p25, 0)}–${n(x.level.p75, 0)})`, String(x.level.max), n(x.score.median, 0), n((x.secs.median ?? 0) / 60)]),
  );

  h += `<h2>Cartas (${esc(s.perkMode ?? 'todos los modos')})</h2>` + cardCharts(s.cards) +
    `<details><summary>Tabla completa de cartas</summary>${cardsTable(s.cards)}</details>`;
  h += '<h2>Hiperperks</h2>' + cardCharts(s.hypers) + `<details><summary>Tabla completa de hiperperks</summary>${cardsTable(s.hypers)}</details>`;
  $('stats-out').innerHTML = h;
}

$('stats-f').addEventListener('submit', (e) => {
  e.preventDefault();
  void run(async () => {
    const q = new URLSearchParams({ days: $<HTMLSelectElement>('days').value, mode: $<HTMLSelectElement>('smode').value });
    const rules = $<HTMLInputElement>('rules').value;
    if (rules) q.set('rules', rules);
    renderStats(await api<Summary>('GET', `/api/admin/stats?${q}`));
    say('');
  });
});
