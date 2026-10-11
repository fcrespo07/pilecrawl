// Pantalla de la Expedición: fragmentos, mejoras permanentes y el botón de jugar.
import { CHALLENGES, level, nextCost, perkName, UPGRADES } from '../core/expedition';
import { buyUpgrade, loadExpedition } from '../expedition';

const fmt = (n: number) => n.toLocaleString('es-ES');

export function renderExpedition(root: HTMLElement) {
  const save = loadExpedition();
  const items = UPGRADES.map((u) => {
    const lvl = level(save.owned, u.id);
    const cost = nextCost(save.owned, u.id);
    const pips = u.costs.map((_, i) => `<i class="exp-pip${i < lvl ? ' on' : ''}"></i>`).join('');
    const action =
      cost === null
        ? '<span class="exp-max">Al máximo</span>'
        : `<button type="button" class="home-btn small" data-buy="${u.id}"${save.shards < cost ? ' disabled' : ''}>Comprar · ${fmt(cost)}</button>`;
    return `<article class="cat-item exp-item">
      <div class="cat-body">
        <div class="b-name">${u.name}<small>${pips}</small></div>
        <p class="home-note">${u.desc}</p>
        ${action}
      </div>
    </article>`;
  }).join('');
  const retos = CHALLENGES.map((c) => {
    const done = save.unlocked.includes(c.perk);
    return `<article class="cat-item exp-item${done ? ' exp-done' : ''}">
      <div class="cat-body">
        <div class="b-name">${perkName(c.perk)}<small>${done ? 'Abierto' : 'Bloqueado'}</small></div>
        <p class="home-note">${c.text}</p>
      </div>
    </article>`;
  }).join('');
  root.querySelector('#exp-shards')!.textContent = fmt(save.shards);
  root.querySelector('#exp-runs')!.textContent = fmt(save.runs);
  root.querySelector('#exp-body')!.innerHTML =
    `<section class="home-card"><h2>Mejoras permanentes</h2><div class="cat-grid">${items}</div></section>` +
    `<section class="home-card"><h2>Retos <small>${save.unlocked.length}/${CHALLENGES.length}</small></h2><p class="home-note">Cada reto abre un perk para las ofertas de la Expedición. Se cumplen dentro de una sola partida. En el arcade no hacen falta.</p><div class="cat-grid">${retos}</div></section>`;
}

/** Un solo escuchador para las compras; vuelve a pintar tras cada una. */
export function wireExpedition(root: HTMLElement) {
  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-buy]');
    if (!btn) return;
    if (buyUpgrade(btn.dataset.buy as never)) renderExpedition(root);
  });
}
