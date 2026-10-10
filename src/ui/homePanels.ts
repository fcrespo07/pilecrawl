// Paneles laterales de la portada. Hoy enseñan los récords locales; cuando exista el servidor
// de ranking, cada panel pasa a pintar la clasificación global con la misma caja.
import { dailyNumber, msToNextDaily, utcDate } from '../core/modes';
import { loadBest } from '../records';

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
const score = (n: number) => (n ? fmt(n) : '—');

function nextDailyLabel(): string {
  const min = Math.ceil(msToNextDaily() / 60_000);
  const h = Math.floor(min / 60);
  return `Nuevo en ${h ? `${h} h ` : ''}${min % 60} min`;
}

/** Pinta los dos paneles. Se llama al abrir la portada y al acabar una partida. */
export function renderHomePanels(left: HTMLElement, right: HTMLElement) {
  const date = utcDate();
  left.innerHTML = `<h2>Tus mejores</h2>
    <ol class="rank-list">
      <li><span>Partida</span><b>${score(loadBest('normal', date))}</b></li>
      <li><span>Contrarreloj</span><b>${score(loadBest('timed', date))}</b></li>
      <li><span>Diario de hoy</span><b>${score(loadBest('daily', date))}</b></li>
    </ol>
    <p class="rank-note">El ranking mundial llegará pronto.</p>`;
  right.innerHTML = `<h2>Diario <i>#${dailyNumber(date)}</i></h2>
    <p class="rank-big">${score(loadBest('daily', date))}</p>
    <p class="rank-note">Tu mejor de hoy. Mismas piezas y cartas para todos.</p>
    <p class="rank-note"><time data-next>${nextDailyLabel()}</time></p>`;
}
