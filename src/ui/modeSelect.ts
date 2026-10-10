// Selector de modo de la portada: una opción por modo con su récord.
import { dailyNumber, PLAY_MODE_IDS, MODES, msToNextDaily, utcDate, type ModeId } from '../core/modes';
import { loadBest } from '../records';

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');

/** «Nuevo en 3 h 12 min»: cuándo empieza el próximo desafío diario. */
function nextDailyLabel(): string {
  const min = Math.ceil(msToNextDaily() / 60_000);
  const h = Math.floor(min / 60);
  return `Nuevo en ${h ? `${h} h ` : ''}${min % 60} min`;
}

export class ModeSelect {
  private _mode: ModeId;
  private date = '';

  constructor(private root: HTMLElement, initial: ModeId, private onChange: (m: ModeId) => void) {
    this._mode = initial;
    root.setAttribute('role', 'radiogroup');
    root.setAttribute('aria-label', 'Modo de juego');
    root.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.name !== 'mode') return;
      this._mode = input.value as ModeId;
      this.onChange(this._mode);
    });
    this.refresh();
    // la cuenta atrás del diario se actualiza sola; al cambiar de día se repinta entero
    window.setInterval(() => {
      if (utcDate() !== this.date) this.refresh();
      else this.root.querySelectorAll('[data-next]').forEach((el) => (el.textContent = nextDailyLabel()));
    }, 30_000);
  }

  get mode(): ModeId {
    return this._mode;
  }

  /** Vuelve a pintar las opciones: los récords y el número del diario cambian entre partidas. */
  refresh() {
    const date = (this.date = utcDate());
    this.root.innerHTML = PLAY_MODE_IDS.map((id) => {
      const m = MODES[id];
      const name = id === 'daily' ? `${m.name} <i>#${dailyNumber(date)}</i>` : m.name;
      const best = loadBest(id, date);
      const bestLabel = id === 'daily' ? 'Hoy' : 'Récord';
      return `<label class="mode-opt">
        <input type="radio" name="mode" value="${id}"${id === this._mode ? ' checked' : ''} />
        <b>${name}</b>
        <span>${m.desc}</span>
        <small>${bestLabel} <em>${best ? fmt(best) : '—'}</em>${id === 'daily' ? ` · <time data-next>${nextDailyLabel()}</time>` : ''}</small>
      </label>`;
    }).join('');
  }
}
