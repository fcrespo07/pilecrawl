// Selector de modo de la portada: una opción por modo con su récord.
import { dailyNumber, MODE_IDS, MODES, utcDate, type ModeId } from '../core/modes';
import { loadBest } from '../records';

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');

export class ModeSelect {
  private _mode: ModeId;

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
  }

  get mode(): ModeId {
    return this._mode;
  }

  /** Vuelve a pintar las opciones: los récords y el número del diario cambian entre partidas. */
  refresh() {
    const date = utcDate();
    this.root.innerHTML = MODE_IDS.map((id) => {
      const m = MODES[id];
      const name = id === 'daily' ? `${m.name} <i>#${dailyNumber(date)}</i>` : m.name;
      const best = loadBest(id, date);
      const bestLabel = id === 'daily' ? 'Hoy' : 'Récord';
      return `<label class="mode-opt">
        <input type="radio" name="mode" value="${id}"${id === this._mode ? ' checked' : ''} />
        <b>${name}</b>
        <span>${m.desc}</span>
        <small>${bestLabel} <em>${best ? fmt(best) : '—'}</em></small>
      </label>`;
    }).join('');
  }
}
