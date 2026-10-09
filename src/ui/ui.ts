import { Game } from '../core/game';
import { RARITY_LABEL, type PerkDef, type Rarity } from '../core/perks';
import { audio } from '../fx/audio';
import { accentFor, hex } from '../fx/layout';
import { perkIcon, UI_ICONS } from './icons';
import { loadMeta, UNLOCK_LEVEL } from '../core/meta';

const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
const pad2 = (n: number) => String(n).padStart(2, '0');

function $(id: string) {
  return document.getElementById(id)!;
}

function loadBest(): number {
  try {
    return Number(localStorage.getItem('blockrogue.best') ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(v: number) {
  try {
    localStorage.setItem('blockrogue.best', String(v));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

/** Lista de ventajas (verde) y desventajas (rojo) de un perk. */
export function effectsHTML(p: PerkDef, stacks: number): string {
  const pros = p.pros(stacks).map((t) => `<li class="pro">${t}</li>`);
  const cons = (p.cons?.(stacks) ?? []).map((t) => `<li class="con">${t}</li>`);
  return `<ul class="fx">${pros.join('')}${cons.join('')}</ul>`;
}

function chipHTML(id: string, stacks: number): string {
  const p = Game.perkDef(id);
  return `<div class="chip-wrap r-${p.rarity}" data-perk="${id}"><div class="chip">${perkIcon(id)}</div>${stacks > 1 ? `<i>${stacks}</i>` : ''}</div>`;
}

export class UI {
  private shownScore = 0;
  private perksOpen = false;
  private picking = false;
  private choiceDelay = 0;
  private best = loadBest();
  private perkKey = '';
  private segsKey = '';
  private livesKey = -1;
  private overTimer = 0;

  constructor(private game: Game) {
    $('reroll').addEventListener('click', () => this.reroll());
    this.refreshBest();
    $('b2b-ico').innerHTML = UI_ICONS.flame;
    document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
      el.innerHTML = perkIcon(el.dataset.icon!);
    });
    this.bindTooltips($('perk-list'));
    this.bindTooltips($('over-perks'));
  }

  // ───────────── overlays ─────────────

  show(id: string) { $(id).classList.add('visible'); }
  hide(id: string) { $(id).classList.remove('visible'); }

  /** Refleja el récord en el inicio y en la portada. */
  refreshBest() {
    $('best-home').textContent = fmt(this.best);
  }

  startGame() {
    window.clearTimeout(this.overTimer);
    for (const id of ['over', 'pause', 'perks']) this.hide(id);
    this.perksOpen = false;
    this.picking = false;
    this.shownScore = 0;
    this.perkKey = '';
    this.segsKey = '';
    this.livesKey = -1;
    $('hud').classList.add('visible');
  }

  setPaused(p: boolean) {
    if (p) {
      this.renderBuild();
      this.show('pause');
    } else this.hide('pause');
  }

  get isChoosing() { return this.perksOpen; }

  private renderBuild() {
    const g = this.game;
    $('build-list').innerHTML = g.perkOrder.length
      ? g.perkOrder
          .map((id) => {
            const p = Game.perkDef(id);
            const n = g.perkStacks(id);
            return `<div class="build-row r-${p.rarity}">
              <div class="b-ico">${perkIcon(id)}</div>
              <div><div class="b-name">${p.name}${n > 1 ? `<small>×${n}</small>` : ''}</div>${effectsHTML(p, n)}</div>
            </div>`;
          })
          .join('')
      : '<div class="empty">Todavía no tienes mejoras. Sube de nivel para conseguirlas.</div>';
  }

  showGameOver() {
    const g = this.game;
    const isBest = g.score > this.best;
    if (isBest) {
      this.best = g.score;
      saveBest(this.best);
    }
    $('over-score').textContent = fmt(g.score);
    $('over-best').textContent = isBest ? '¡Nuevo récord!' : `Récord ${fmt(this.best)}`;
    $('over-best').classList.toggle('record', isBest);
    const stat = (label: string, v: string | number) => `<div><span>${label}</span><b>${v}</b></div>`;
    // rarezas que esta partida ha desbloqueado: su nivel está entre el mejor anterior y el actual
    const prevBest = Number.isFinite(g.bestLevel) ? g.bestLevel : Infinity;
    const unlocked = (Object.keys(UNLOCK_LEVEL) as Rarity[])
      .filter((r) => UNLOCK_LEVEL[r] > prevBest && UNLOCK_LEVEL[r] <= g.level)
      .map((r) => RARITY_LABEL[r]);
    $('over-stats').innerHTML =
      stat('Nivel', g.level) +
      stat('Líneas', g.lines) +
      stat('Cuádruples', g.quads) +
      stat('Combo máx.', Math.max(0, g.maxCombo)) +
      stat('Tiempo', clock(g.time)) +
      stat('Mejor nivel', loadMeta().bestLevel) +
      (unlocked.length ? stat('Desbloqueado', unlocked.join(', ')) : '');
    $('over-perks').innerHTML = g.perkOrder.map((id) => chipHTML(id, g.perkStacks(id))).join('');
    this.refreshBest();
    // si el jugador reinicia antes de que aparezca, no debe reaparecer sobre la nueva partida
    this.overTimer = window.setTimeout(() => this.show('over'), 900);
  }

  // ───────────── elección de perks ─────────────

  openPerks() {
    this.perksOpen = true;
    this.picking = false;
    this.choiceDelay = 380;
  }

  private renderCards() {
    const g = this.game;
    const shownLevel = g.level - g.pendingLevelUps + 1;
    $('perk-level').textContent = pad2(shownLevel);
    $('perks').style.setProperty('--level', hex(accentFor(shownLevel)));
    $('reroll-count').textContent = String(g.rerolls);
    ($('reroll') as HTMLButtonElement).disabled = g.rerolls <= 0;
    const box = $('cards');
    box.innerHTML = '';
    g.choices.forEach((p, i) => box.appendChild(this.makeCard(p, i)));
    // re-dispara la animación del título
    const title = document.querySelector<HTMLElement>('.perk-title')!;
    title.style.animation = 'none';
    void title.offsetWidth;
    title.style.animation = '';
  }

  private stackLabel(cur: number, max: number): string {
    if (max === 1) return 'Única';
    if (max >= 99) return cur > 0 ? `Tienes ${cur} · acumulable` : 'Acumulable';
    let pips = '';
    for (let k = 0; k < max; k++) pips += `<i class="pip ${k < cur ? 'on' : k === cur ? 'next' : ''}"></i>`;
    return `<span class="pips">${pips}</span>`;
  }

  private makeCard(p: PerkDef, i: number): HTMLElement {
    const cur = this.game.perkStacks(p.id);
    const el = document.createElement('div');
    el.className = `card r-${p.rarity}`;
    el.style.setProperty('--i', String(i));
    el.innerHTML = `
      <div class="card-tilt">
        <div class="card-glow"></div>
        <div class="card-flip">
          <div class="card-face card-back"><span>T</span></div>
          <div class="card-face card-front">
            <div class="card-band"><span>${RARITY_LABEL[p.rarity]}</span><kbd>${i + 1}</kbd></div>
            <div class="card-icon">${perkIcon(p.id)}</div>
            <div class="card-name">${p.name}</div>
            <div class="card-sep"></div>
            ${effectsHTML(p, cur + 1)}
            <div class="card-foot">${this.stackLabel(cur, p.max)}</div>
            <div class="card-shine"></div>
          </div>
        </div>
      </div>`;
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--rx', `${-dy * 12}deg`);
      el.style.setProperty('--ry', `${dx * 16}deg`);
      el.style.setProperty('--mx', `${(dx + 0.5) * 100}%`);
      el.style.setProperty('--my', `${(dy + 0.5) * 100}%`);
    });
    el.addEventListener('mouseenter', () => audio.hover());
    el.addEventListener('mouseleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
    el.addEventListener('click', () => this.pick(i));
    return el;
  }

  pick(i: number) {
    const g = this.game;
    if (!this.perksOpen || this.picking || this.choiceDelay > 0 || !g.choices[i]) return;
    this.picking = true;
    const perk = g.choices[i];
    audio.pick(RARITY_RANK[perk.rarity]);
    const cards = [...$('cards').children] as HTMLElement[];
    cards.forEach((c, j) => c.classList.add(j === i ? 'chosen' : 'discarded'));
    setTimeout(() => {
      g.choosePerk(i);
      this.picking = false;
      if (g.state === 'choosing') this.renderCards();
      else {
        this.perksOpen = false;
        this.hide('perks');
      }
    }, 520);
  }

  reroll() {
    if (!this.perksOpen || this.picking) return;
    if (this.game.reroll()) {
      audio.reroll();
      this.renderCards();
    }
  }

  // ───────────── tooltips ─────────────

  private bindTooltips(container: HTMLElement) {
    container.addEventListener('mouseover', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-perk]');
      if (!chip) return;
      const id = chip.dataset.perk!;
      const p = Game.perkDef(id);
      const n = Math.max(1, this.game.perkStacks(id));
      const tip = $('tooltip');
      tip.style.setProperty('--c', `var(--${p.rarity})`);
      tip.innerHTML = `<div class="tt-head"><span class="tt-name">${p.name}${n > 1 ? ` ×${n}` : ''}</span><span class="tt-rar">${RARITY_LABEL[p.rarity]}</span></div>${effectsHTML(p, n)}`;
      const r = chip.getBoundingClientRect();
      const stage = $('stage').getBoundingClientRect();
      const scale = stage.width / 960;
      tip.style.left = `${Math.min(700, (r.left - stage.left) / scale)}px`;
      tip.style.top = `${(r.top - stage.top) / scale - 8}px`;
      tip.classList.add('visible');
    });
    container.addEventListener('mouseout', (e) => {
      const to = (e as MouseEvent).relatedTarget as HTMLElement | null;
      if (!to || !to.closest('[data-perk]')) $('tooltip').classList.remove('visible');
    });
  }

  // ───────────── HUD ─────────────

  update(dt: number) {
    const g = this.game;

    if (this.perksOpen && this.choiceDelay > 0) {
      this.choiceDelay -= dt;
      if (this.choiceDelay <= 0) {
        this.renderCards();
        this.show('perks');
      }
    }

    const diff = g.score - this.shownScore;
    this.shownScore += diff * (1 - Math.exp(-dt / 90));
    if (Math.abs(diff) < 1) this.shownScore = g.score;
    $('score').textContent = fmt(this.shownScore);
    $('mult').textContent = `×${g.mods.scoreMult.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    $('level').textContent = pad2(g.level);
    $('lines').textContent = String(g.lines);
    $('combo').textContent = g.combo > 0 ? `×${g.combo}` : '—';
    $('b2b-box').classList.toggle('on', g.b2b);
    $('rerolls').textContent = String(g.rerolls);
    $('time').textContent = clock(g.time);
    document.documentElement.style.setProperty('--level', hex(accentFor(g.level)));

    const need = g.linesNeeded();
    $('lvl-progress').textContent = `${g.linesIntoLevel}/${need}`;
    const segsKey = `${need}|${g.linesIntoLevel}`;
    if (segsKey !== this.segsKey) {
      this.segsKey = segsKey;
      $('lvl-segs').innerHTML = Array.from({ length: need }, (_, k) => `<i class="${k < g.linesIntoLevel ? 'on' : ''}"></i>`).join('');
    }

    if (g.lives !== this.livesKey) {
      this.livesKey = g.lives;
      $('lives').innerHTML = g.lives > 0 ? UI_ICONS.heart.repeat(Math.min(g.lives, 4)) : '<span class="none">—</span>';
    }

    const key = g.perkOrder.map((id) => `${id}${g.perkStacks(id)}`).join(',');
    if (key !== this.perkKey) {
      this.perkKey = key;
      $('perk-count').textContent = String(g.perkOrder.length);
      $('perk-list').innerHTML = g.perkOrder.length
        ? g.perkOrder.map((id) => chipHTML(id, g.perkStacks(id))).join('')
        : '<div class="empty">Aún nada. Sube de nivel para elegir tu primera mejora.</div>';
    }
  }
}
