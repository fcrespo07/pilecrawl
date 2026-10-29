// Selector de modo de la portada: una opción por modo con su récord.
import { dailyNumber, PLAY_MODE_IDS, msToNextDaily, type ModeId } from '../core/modes';
import * as net from '../net/ranking';
import { isFirstVisit, loadBest } from '../records';
import { locale, t } from '../i18n';

const fmt = (n: number) => Math.round(n).toLocaleString(locale());

/** «Nuevo en 3 h 12 min»: cuándo empieza el próximo desafío diario. */
function nextDailyLabel(): string {
  const min = Math.ceil(msToNextDaily(net.now()) / 60_000);
  const h = Math.floor(min / 60);
  const time = h ? t('time.hm', { h, m: min % 60 }) : t('time.m', { m: min % 60 });
  return t('mode.newIn', { time });
}

export class ModeSelect {
  private _mode: ModeId;
  private date = '';

  constructor(private root: HTMLElement, initial: ModeId, private onChange: (m: ModeId) => void) {
    // primera visita: el tutorial es lo primero que se ve, marcado. Luego, el último modo elegido
    this._mode = isFirstVisit() ? 'tutorial' : initial;
    root.setAttribute('role', 'radiogroup');
    root.setAttribute('aria-label', t('mode.group'));
    root.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.name !== 'mode') return;
      this._mode = input.value as ModeId;
      this.onChange(this._mode);
    });
    this.refresh();
    // la cuenta atrás del diario se actualiza sola; al cambiar de día se repinta entero
    // al cambiar de idioma se repinta con los textos nuevos
    window.addEventListener('langchange', () => this.refresh());
    window.setInterval(() => {
      if (net.dailyDate() !== this.date) this.refresh();
      else this.root.querySelectorAll('[data-next]').forEach((el) => (el.textContent = nextDailyLabel()));
    }, 30_000);
  }

  get mode(): ModeId {
    return this._mode;
  }

  /** Vuelve a pintar las opciones: los récords y el número del diario cambian entre partidas. */
  refresh() {
    const date = (this.date = net.dailyDate());
    const first = isFirstVisit();
    // tras la primera partida el tutorial sale de la lista (su botón sigue en la fila de accesos)
    if (!first && this._mode === 'tutorial') this._mode = 'normal';
    const ids: ModeId[] = first ? ['tutorial', ...PLAY_MODE_IDS] : PLAY_MODE_IDS;
    this.root.innerHTML = ids.map((id) => {
      const name = id === 'daily' ? `${t(`mode.${id}.name`)} <i>#${dailyNumber(date)}</i>` : t(`mode.${id}.name`);
      const best = loadBest(id, date);
      const bestLabel = id === 'daily' ? t('mode.today') : t('mode.best');
      const small = id === 'tutorial' ? `<small>${t('mode.startHere')}</small>` : `<small>${bestLabel} <em>${best ? fmt(best) : '—'}</em>${id === 'daily' ? ` · <time data-next>${nextDailyLabel()}</time>` : ''}</small>`;
      return `<label class="mode-opt">
        <input type="radio" name="mode" value="${id}"${id === this._mode ? ' checked' : ''} />
        <b>${name}</b>
        <span>${t(`mode.${id}.desc`)}</span>
        ${small}
      </label>`;
    }).join('');
  }
}
