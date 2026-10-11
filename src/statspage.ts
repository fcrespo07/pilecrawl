// Página de estadísticas anónimas (stats.html): pide la clave de administrador y pinta el resumen del servidor.
// Se queda con el texto que ya devuelve la API: aquí no hay lógica de juego.
import { MODE_IDS } from './core/modes';

interface Card { id: string; name: string; kind: string; shown: number; picked: number; pickRate: number | null; runsPicked: number; avgLevelPicked: number | null; runsPassed: number; avgLevelPassed: number | null; levelDelta: number | null }
interface ModeSum { runs: number; level: { avg: number | null; p25: number | null; median: number | null; p75: number | null; max: number }; score: { avg: number | null; median: number | null }; secs: { avg: number | null; median: number | null }; ends: Record<string, number>; levelHistogram: Record<string, number> }
interface Summary { runs: number; perkMode: string | null; byDay: Record<string, number>; byVersion: Record<string, number>; modes: Record<string, ModeSum>; cards: Card[]; hypers: Card[] }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const n = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '–' : String(Math.round(v * 10 ** d) / 10 ** d));
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);

$('mode').innerHTML = `<option value="normal">Cartas: Partida</option>${MODE_IDS.filter((m) => m !== 'normal').map((m) => `<option value="${m}">Cartas: ${m}</option>`).join('')}<option value="all">Cartas: todos</option>`;
try {
  $<HTMLInputElement>('token').value = sessionStorage.getItem('stats.token') ?? '';
} catch {
  /* sin almacenamiento */
}

function table(head: string[], rows: string[][]) {
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function cards(list: Card[]) {
  return table(
    ['Carta', 'Vista', 'Cogida', '% elección', 'Nivel final si la coges', 'Nivel final si la dejas', 'Diferencia'],
    list.map((c) => [
      esc(c.name) + (c.kind === 'c' ? ' (maldición)' : ''),
      String(c.shown),
      String(c.picked),
      pct(c.pickRate),
      `${n(c.avgLevelPicked)} (${c.runsPicked})`,
      `${n(c.avgLevelPassed)} (${c.runsPassed})`,
      c.levelDelta === null ? '–' : `<span class="${c.levelDelta >= 0 ? 'pos' : 'neg'}">${c.levelDelta > 0 ? '+' : ''}${n(c.levelDelta)}</span>`,
    ]),
  );
}

function render(s: Summary) {
  const modes = Object.entries(s.modes).sort((a, b) => b[1].runs - a[1].runs);
  let h = `<p><b>${s.runs}</b> partidas. Versiones: ${Object.entries(s.byVersion).map(([k, v]) => `${esc(k)}: ${v}`).join(' · ') || '–'}</p>`;
  h += '<h2>Por modo</h2>' + table(
    ['Modo', 'Partidas', 'Nivel medio', 'Mediana (p25–p75)', 'Máx.', 'Puntos (mediana)', 'Minutos (mediana)', 'Final'],
    modes.map(([m, x]) => [m, String(x.runs), n(x.level.avg), `${n(x.level.median, 0)} (${n(x.level.p25, 0)}–${n(x.level.p75, 0)})`, String(x.level.max), n(x.score.median, 0), n((x.secs.median ?? 0) / 60), Object.entries(x.ends).map(([k, v]) => `${k} ${v}`).join(', ')]),
  );
  const top = modes[0];
  if (top) {
    const hist = top[1].levelHistogram;
    const max = Math.max(...Object.values(hist));
    const lv = Object.keys(hist).map(Number).sort((a, b) => a - b);
    h += `<h2>En qué nivel acaban (${esc(top[0])})</h2>` + table(['Nivel', 'Partidas', ''], lv.map((l) => [String(l), String(hist[l]), `<span class="bar" style="width:${Math.round((hist[l] / max) * 300)}px"></span>`]));
  }
  h += `<h2>Cartas (${esc(s.perkMode ?? 'todos los modos')})</h2><p class="note">«Diferencia»: nivel final medio de quien la cogió menos el de quien la vio y la dejó pasar. Con pocas partidas es ruido; fíate de las diferencias solo con decenas de casos. Las cartas que se cambian con reroll cuentan como vistas.</p>` + cards(s.cards);
  h += '<h2>Hiperperks</h2>' + cards(s.hypers);
  h += '<h2>Partidas por día</h2>' + table(['Día', 'Partidas'], Object.entries(s.byDay).reverse().map(([d, c]) => [d, String(c)]));
  $('out').innerHTML = h;
}

$('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = $<HTMLInputElement>('token').value.trim();
  const q = new URLSearchParams({ days: $<HTMLSelectElement>('days').value, mode: $<HTMLSelectElement>('mode').value });
  const rules = $<HTMLInputElement>('rules').value;
  if (rules) q.set('rules', rules);
  $('err').textContent = '';
  try {
    const res = await fetch(`/api/admin/stats?${q}`, { headers: { authorization: `Bearer ${token}` } });
    const data = (await res.json()) as Summary & { error?: string };
    if (!res.ok) throw new Error(res.status === 401 ? 'Clave incorrecta.' : (data.error ?? `Error ${res.status}`));
    try {
      sessionStorage.setItem('stats.token', token);
    } catch {
      /* sin almacenamiento */
    }
    render(data);
  } catch (err) {
    $('err').textContent = (err as Error).message;
  }
});
