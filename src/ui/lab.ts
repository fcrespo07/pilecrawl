// Laboratorio: pruebas desde la pausa (añadir y quitar mejoras, hiperperk, velocidad, nivel...).
// Solo existe en desarrollo o con `?lab` en la dirección; usarlo marca la partida como `sandbox`.
import { HYPERS, type HyperId } from '../core/hypers';
import { CURSES, PERKS, type PerkDef } from '../core/perks';
import type { Game } from '../core/game';
import { perkIcon } from './icons';
import { rarityKey, rarityLabel } from './ui';
import { perkName } from '../i18n/content';

export const LAB_ENABLED = import.meta.env.DEV || new URLSearchParams(location.search).has('lab');

const $ = (id: string) => document.getElementById(id)!;
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export class Lab {
  private filter = '';
  private listKey = '';

  constructor(private game: Game) {
    const root = $('lab');
    root.addEventListener('click', (e) => this.onClick(e.target as HTMLElement));
    ($('lab-search') as HTMLInputElement).addEventListener('input', (e) => {
      this.filter = norm((e.target as HTMLInputElement).value);
      this.renderList();
    });
    ($('lab-gravity') as HTMLInputElement).addEventListener('input', (e) => {
      this.game.labSet({ gravity: Number((e.target as HTMLInputElement).value) });
      this.renderControls();
    });
    $('lab-hyper').innerHTML =
      '<option value="">Sin hiperperk</option>' + HYPERS.map((h) => `<option value="${h.id}">${perkName(h)}</option>`).join('');
    $('lab-hyper').addEventListener('change', (e) => {
      this.game.labSetHyper(((e.target as HTMLSelectElement).value || null) as HyperId | null);
      this.renderControls();
    });
  }

  get isOpen() { return $('lab').classList.contains('visible'); }

  open() {
    this.render();
    $('lab').classList.add('visible');
  }

  close() {
    $('lab').classList.remove('visible');
    // el overlay solo se oculta con opacidad: sin esto el foco se queda en el buscador
    (document.activeElement as HTMLElement | null)?.blur();
  }

  private onClick(el: HTMLElement) {
    const btn = el.closest<HTMLElement>('[data-act]');
    if (!btn) return;
    const g = this.game;
    const id = btn.dataset.id!;
    switch (btn.dataset.act) {
      case 'add': g.labAddPerk(id); break;
      case 'del': g.labRemovePerk(id); break;
      case 'clear': g.labClearPerks(); break;
      case 'level': g.labSet({ level: g.level + Number(btn.dataset.d) }); break;
      case 'lives': g.labSet({ lives: g.lives + Number(btn.dataset.d) }); break;
      case 'rerolls': g.labSet({ rerolls: g.rerolls + Number(btn.dataset.d) }); break;
      case 'charge': g.labSetHyper(g.hyper?.id ?? null); break;
      case 'close': this.close(); return;
    }
    this.render();
  }

  private row(p: PerkDef): string {
    const n = this.game.perkStacks(p.id);
    return `<div class="lab-row r-${rarityKey(p)}${n ? ' on' : ''}">
      <div class="b-ico">${perkIcon(p.id)}</div>
      <div class="lab-name">${perkName(p)}<small>${rarityLabel(p)}</small></div>
      <button type="button" data-act="del" data-id="${p.id}" aria-label="Quitar ${perkName(p)}"${n ? '' : ' disabled'}>−</button>
      <b>${n}/${p.max >= 99 ? '∞' : p.max}</b>
      <button type="button" data-act="add" data-id="${p.id}" aria-label="Añadir ${perkName(p)}"${n >= p.max ? ' disabled' : ''}>+</button>
    </div>`;
  }

  private renderList() {
    const g = this.game;
    const match = (p: PerkDef) => !this.filter || (norm(p.name).includes(this.filter) || norm(perkName(p)).includes(this.filter));
    const key = `${this.filter}|${g.perkOrder.map((id) => `${id}${g.perkStacks(id)}`).join(',')}`;
    if (key === this.listKey) return;
    this.listKey = key;
    const perks = PERKS.filter(match).map((p) => this.row(p)).join('');
    const curses = CURSES.filter(match).map((p) => this.row(p)).join('');
    $('lab-list').innerHTML =
      (perks ? `<h3>Mejoras</h3>${perks}` : '') + (curses ? `<h3>Maldiciones</h3>${curses}` : '') ||
      '<p class="empty">Nada con ese nombre.</p>';
  }

  private renderControls() {
    const g = this.game;
    const num = (id: string, v: number | string) => { $(id).textContent = String(v); };
    num('lab-level', g.level);
    num('lab-lives', g.lives);
    num('lab-rerolls', g.rerolls);
    num('lab-gravity-n', `×${g.labGravity.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`);
    ($('lab-gravity') as HTMLInputElement).value = String(g.labGravity);
    ($('lab-hyper') as HTMLSelectElement).value = g.hyper?.id ?? '';
    ($('lab-charge') as HTMLButtonElement).disabled = !g.hyper;
  }

  private render() {
    this.listKey = '';
    this.renderList();
    this.renderControls();
  }
}
