// Pantalla de la Expedición: fragmentos, mejoras permanentes y el botón de jugar.
import { CHALLENGES, level, nextCost, UPGRADES } from '../core/expedition';
import { PRESSURE, pressureMult } from '../core/pressure';
import { buyUpgrade, loadExpedition, pressureAllowed, togglePressure } from '../expedition';
import { L, locale } from '../i18n';
import { challengeText, perkNameById, pressureText, upgradeText } from '../i18n/content';

const fmt = (n: number) => n.toLocaleString(locale());

export function renderExpedition(root: HTMLElement) {
  const save = loadExpedition();
  const items = UPGRADES.map((u) => {
    const lvl = level(save.owned, u.id);
    const cost = nextCost(save.owned, u.id);
    const pips = u.costs.map((_, i) => `<i class="exp-pip${i < lvl ? ' on' : ''}"></i>`).join('');
    const text = upgradeText(u);
    const action =
      cost === null
        ? `<span class="exp-max">${L('Al máximo', 'Maxed out')}</span>`
        : `<button type="button" class="home-btn small" data-buy="${u.id}"${save.shards < cost ? ' disabled' : ''}>${L('Comprar', 'Buy')} · ${fmt(cost)} ${L('fragmentos', 'shards')}</button>`;
    return `<article class="cat-item exp-item">
      <div class="cat-body">
        <div class="b-name">${text.name}<small>${pips}</small></div>
        <p class="home-note">${text.desc}</p>
        ${action}
      </div>
    </article>`;
  }).join('');
  const retos = CHALLENGES.map((c) => {
    const done = save.unlocked.includes(c.perk);
    return `<article class="cat-item exp-item${done ? ' exp-done' : ''}">
      <div class="cat-body">
        <div class="b-name">${perkNameById(c.perk)}<small>${done ? L('Abierto', 'Unlocked') : L('Bloqueado', 'Locked')}</small></div>
        <p class="home-note">${challengeText(c)}</p>
      </div>
    </article>`;
  }).join('');
  // Presión: las condiciones elegidas multiplican los fragmentos; cada una se abre al llegar a cierto nivel con la anterior
  const allowed = pressureAllowed(save);
  const chosen = save.pressure.length;
  const pressure = PRESSURE.map((p, i) => {
    const on = save.pressure.includes(p.id);
    const locked = i >= allowed;
    const hint =
      i === allowed
        ? i === 0
          ? L('Se abre al ganar una Expedición sin condiciones', 'Opens when you win an Expedition with no conditions')
          : L(`Se abre al ganar con ${i} ${i === 1 ? 'condición' : 'condiciones'}`, `Opens when you win with ${i} ${i === 1 ? 'condition' : 'conditions'}`)
        : '';
    const text = pressureText(p);
    const stateLabel = on ? L('Activa', 'Active') : locked ? L('Bloqueada', 'Locked') : L('Inactiva', 'Inactive');
    return `<button type="button" class="cat-item exp-item exp-press${on ? ' exp-on' : ''}${locked ? ' exp-locked' : ''}" data-press="${p.id}" aria-pressed="${on}"${locked ? ' disabled' : ''}>
      <div class="cat-body">
        <div class="b-name">${text.name}<small>${stateLabel}</small></div>
        <p class="home-note">${text.desc}</p>
        ${hint ? `<span class="exp-max">${hint}</span>` : ''}
      </div>
    </button>`;
  }).join('');
  const mult = `×${pressureMult(chosen).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  root.querySelector('#exp-shards')!.textContent = fmt(save.shards);
  root.querySelector('#exp-runs')!.textContent = fmt(save.runs);
  root.querySelector('#exp-best')!.textContent = String(save.bestLevel);
  root.querySelector('#exp-wins')!.textContent = fmt(save.wins);
  root.querySelector('#exp-body')!.innerHTML =
    `<section class="home-card"><h2>${L('Presión', 'Pressure')} <small>${chosen}/${allowed} · ${L('fragmentos', 'shards')} ${mult}</small></h2><p class="home-note">${L(
      'Antes de jugar puedes endurecer la partida. Cada condición activa vale 1 punto y cada punto suma un 25 % a los fragmentos que das. Ganar con unas condiciones abre la siguiente. Solo afecta a la Expedición.',
      'Before playing you can make the run harder. Each active condition is worth 1 point and each point adds 25% to the shards you earn. Winning with some conditions opens the next one. It only affects the Expedition.',
    )}</p><div class="cat-grid">${pressure}</div></section>` +
    `<section class="home-card"><h2>${L('Mejoras permanentes', 'Permanent upgrades')}</h2><div class="cat-grid">${items}</div></section>` +
    `<section class="home-card"><h2>${L('Retos', 'Challenges')} <small>${save.unlocked.length}/${CHALLENGES.length}</small></h2><p class="home-note">${L(
      'Cada reto abre un perk para las ofertas de la Expedición. Se cumplen dentro de una sola partida. En el arcade no hacen falta.',
      'Each challenge unlocks a perk for Expedition offers. They are completed within a single run. They are not needed in arcade modes.',
    )}</p><div class="cat-grid">${retos}</div></section>`;
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
