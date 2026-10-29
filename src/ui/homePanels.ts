// Paneles laterales de la portada: tus récords locales y el desafío del día. Con ranking en línea,
// cada uno añade la clasificación (los tres primeros y los puestos alrededor del jugador).
import { dailyNumber, msToNextDaily } from '../core/modes';
import * as net from '../net/ranking';
import { loadBest } from '../records';

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
const score = (n: number) => (n ? fmt(n) : '—');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function nextDailyLabel(): string {
  const min = Math.ceil(msToNextDaily(net.now()) / 60_000);
  const h = Math.floor(min / 60);
  return `Nuevo en ${h ? `${h} h ` : ''}${min % 60} min`;
}

/**
 * Los tres primeros y, si el jugador queda fuera, un hueco y su entorno.
 * Sin puntuación propia solo salen los tres primeros.
 */
export function boardRows(b: net.Board): { entry: net.Entry; gap: boolean }[] {
  const rows: { entry: net.Entry; gap: boolean }[] = [];
  const seen = new Set<number>();
  const add = (e: net.Entry, gap: boolean) => {
    if (seen.has(e.rank)) return;
    seen.add(e.rank);
    rows.push({ entry: e, gap });
  };
  const top = b.entries.slice(0, 3);
  top.forEach((e) => add(e, false));
  const last = top.length ? top[top.length - 1].rank : 0;
  b.near.forEach((e, i) => add(e, i === 0 && e.rank > last + 1));
  return rows;
}

function boardHtml(b: net.Board | null | 'error'): string {
  if (b === null) return '<p class="rank-note">Cargando la clasificación…</p>';
  if (b === 'error') return '<p class="rank-note">Sin conexión con el ranking.</p>';
  if (!b.entries.length) return '<p class="rank-note">Aún no hay puntuaciones. Sé el primero.</p>';
  const items = boardRows(b)
    .map(({ entry: e, gap }) => `<li class="${e.me ? 'me' : ''}${gap ? ' gap' : ''}"><span class="r">${e.rank}</span><span class="n">${esc(e.nickname)}</span><span class="s">${fmt(e.score)}</span></li>`)
    .join('');
  const hint = net.loadPlayer() ? (b.me?.rank ? '' : '<p class="rank-note">Juega para entrar en la tabla.</p>') : '<p class="rank-note">Crea un apodo en Rankings para aparecer.</p>';
  return `<ol class="home-rank">${items}</ol>${hint}`;
}

interface Boards {
  weekly: net.Board | null | 'error';
  daily: net.Board | null | 'error';
  /** Fecha del desafío con la que se pidió `daily`: si ya no es la de hoy, esa tabla no vale. */
  date: string;
  at: number;
}
let boards: Boards = { weekly: null, daily: null, date: '', at: 0 };
let loading = false;
let again = false;

const homeVisible = () => !document.hidden && !document.getElementById('home')?.classList.contains('hidden');

/**
 * Pide las tablas al servidor y repinta al llegar. Sin `force` solo si la portada se ve y han pasado
 * 30 s; con `force` (acabar o publicar una partida) siempre, y si había una carga en curso se repite al terminar.
 */
async function loadBoards(left: HTMLElement, right: HTMLElement, force: boolean) {
  if (!net.RANKING_ENABLED) return;
  if (loading) {
    if (force) again = true;
    return;
  }
  if (!force && (!homeVisible() || (Date.now() - boards.at < 30_000 && boards.date === net.dailyDate()))) return;
  loading = true;
  try {
    await net.serverDay();
    const date = net.dailyDate();
    const [weekly, daily] = await Promise.all([
      net.leaderboard('normal', 'weekly').catch(() => 'error' as const),
      net.leaderboard('daily', 'daily', date).catch(() => 'error' as const),
    ]);
    boards = { weekly, daily, date, at: Date.now() };
  } finally {
    loading = false;
  }
  renderHomePanels(left, right);
  if (again) {
    again = false;
    void loadBoards(left, right, true);
  }
}

/** Pinta los dos paneles. Se llama al abrir la portada y al acabar una partida. */
export function renderHomePanels(left: HTMLElement, right: HTMLElement, force = false) {
  const date = net.dailyDate();
  const online = net.RANKING_ENABLED;
  left.innerHTML = `<h2>Tus mejores</h2>
    <ol class="rank-list">
      <li><span>Partida</span><b>${score(loadBest('normal', date))}</b></li>
      <li><span>Contrarreloj</span><b>${score(loadBest('timed', date))}</b></li>
      <li><span>Diario de hoy</span><b>${score(loadBest('daily', date))}</b></li>
    </ol>
    ${online ? `<h2>Partida, semana</h2>${boardHtml(boards.weekly)}` : '<p class="rank-note">El ranking mundial no está disponible sin conexión.</p>'}`;
  right.innerHTML = `<h2>Diario <i>#${dailyNumber(date)}</i></h2>
    <p class="rank-big">${score(loadBest('daily', date))}</p>
    <p class="rank-note">Tu mejor de hoy. Mismas piezas y cartas para todos.</p>
    ${online ? boardHtml(boards.date === date ? boards.daily : null) : ''}
    <p class="rank-note"><time data-next>${nextDailyLabel()}</time></p>`;
  void loadBoards(left, right, force);
}
