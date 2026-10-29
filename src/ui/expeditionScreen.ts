// Pantalla de la Expedición: fragmentos, mejoras permanentes y el botón de jugar.
import { CHALLENGES, level, nextCost, perkName, UPGRADES } from '../core/expedition';
import { PRESSURE, PRESSURE_UNLOCK_LEVEL, pressureMult } from '../core/pressure';
import { buyUpgrade, loadExpedition, pressureAllowed, togglePressure } from '../expedition';

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
        : `<button type="button" class="home-btn small" data-buy="${u.id}"${save.shards < cost ? ' disabled' : ''}>Comprar · ${fmt(cost)} fragmentos</button>`;
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
  // Presión: las condiciones elegidas multiplican los fragmentos; cada una se abre al llegar a cierto nivel con la anterior
  const allowed = pressureAllowed(save);
  const chosen = save.pressure.length;
  const pressure = PRESSURE.map((p, i) => {
    const on = save.pressure.includes(p.id);
    const locked = i >= allowed;
    const hint = i === allowed ? `Se abre al llegar al nivel ${PRESSURE_UNLOCK_LEVEL} con ${i} ${i === 1 ? 'condición' : 'condiciones'}` : '';
    return `<button type="button" class="cat-item exp-item exp-press${on ? ' exp-on' : ''}${locked ? ' exp-locked' : ''}" data-press="${p.id}" aria-pressed="${on}"${locked ? ' disabled' : ''}>
      <div class="cat-body">
        <div class="b-name">${p.name}<small>${on ? 'Activa' : locked ? 'Bloqueada' : 'Inactiva'}</small></div>
        <p class="home-note">${p.desc}</p>
        ${hint ? `<span class="exp-max">${hint}</span>` : ''}
      </div>
    </button>`;
  }).join('');
  const mult = `×${pressureMult(chosen).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  root.querySelector('#exp-shards')!.textContent = fmt(save.shards);
  root.querySelector('#exp-runs')!.textContent = fmt(save.runs);
  root.querySelector('#exp-body')!.innerHTML =
    `<section class="home-card"><h2>Presión <small>${chosen}/${allowed} · fragmentos ${mult}</small></h2><p class="home-note">Antes de jugar puedes endurecer la partida. Cada condición activa vale 1 punto y cada punto suma un 25 % a los fragmentos que das. Solo afecta a la Expedición.</p><div class="cat-grid">${pressure}</div></section>` +
    `<section class="home-card"><h2>Mejoras permanentes</h2><div class="cat-grid">${items}</div></section>` +
    `<section class="home-card"><h2>Retos <small>${save.unlocked.length}/${CHALLENGES.length}</small></h2><p class="home-note">Cada reto abre un perk para las ofertas de la Expedición. Se cumplen dentro de una sola partida. En el arcade no hacen falta.</p><div class="cat-grid">${retos}</div></section>`;
}

/** Un solo escuchador para las compras; vuelve a pintar tras cada una. */
export function wireExpedition(root: HTMLElement) {
  root.addEventListener('click', (e) => {
    const press = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-press]');
    if (press) {
      if (togglePressure(press.dataset.press as never)) renderExpedition(root);
      return;
    }
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-buy]');
    if (!btn) return;
    if (buyUpgrade(btn.dataset.buy as never)) renderExpedition(root);
  });
}
