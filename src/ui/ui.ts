import { Game, STEP_MS } from '../core/game';
import { HEAT_MAX, RARITY_LABEL, type PerkDef, type Rarity } from '../core/perks';
import type { HyperDef } from '../core/hypers';
import { STREAK_MAX, STREAK_TIER_NAMES, streakTier } from '../core/streak';
import { audio } from '../fx/audio';
import { accentFor, hex } from '../fx/layout';
import { perkIcon, UI_ICONS } from './icons';
import { loadMeta, UNLOCK_LEVEL } from '../core/meta';
import { dailyNumber, MODES } from '../core/modes';
import { perkName } from '../core/expedition';
import { STAGE_LEVELS, stageOf } from '../core/bosses';
import { loadBest, submitScore } from '../records';
import { keyName } from '../settings';
import { shareRun, type ShareInfo } from '../share';

const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
/** Las maldiciones llevan su propio color y etiqueta en vez de la rareza. */
export const rarityKey = (p: PerkDef) => (p.curse ? 'curse' : p.rarity);
export const rarityLabel = (p: PerkDef) => (p.curse ? 'Maldición' : RARITY_LABEL[p.rarity]);
const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
const pad2 = (n: number) => String(n).padStart(2, '0');
const pctTxt = (x: number) => `${Math.round(x * 100)}%`;
/** Ms entre carta y carta al destapar una oferta nueva, y tras un reroll. */
const REVEAL_STEP_MS = 300;
const REVEAL_FAST_MS = 280;
/** Lo que tarda una carta en estar boca arriba desde que se pintan (su turno aparte): 150 ms de espera y 400 de vuelta. */
const REVEAL_FLIP_MS = 550;

function $(id: string) {
  return document.getElementById(id)!;
}

function clock(ms: number, up = false) {
  const s = up ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

/** Lista de ventajas (verde) y desventajas (rojo) de un perk. */
export function effectsHTML(p: Pick<PerkDef, 'pros' | 'cons'>, stacks: number): string {
  const pros = p.pros(stacks).map((t) => `<li class="pro">${t}</li>`);
  const cons = (p.cons?.(stacks) ?? []).map((t) => `<li class="con">${t}</li>`);
  return `<ul class="fx">${pros.join('')}${cons.join('')}</ul>`;
}

/** Lo que cuesta cargar una hiperperk y cuánto dura. */
export function hyperFoot(h: HyperDef): string {
  const dur = h.durationMs ? `dura ${h.durationMs / 1000} s` : 'al instante';
  return `${h.charge} líneas · ${dur}`;
}

function chipHTML(id: string, stacks: number): string {
  const p = Game.perkDef(id);
  return `<div class="chip-wrap r-${rarityKey(p)}" data-perk="${id}"><div class="chip">${perkIcon(id)}</div>${stacks > 1 ? `<i>${stacks}</i>` : ''}</div>`;
}

/** Fila del panel de mejoras: icono, nombre y nivel (veces cogida), con el color de su rareza. */
function perkRowHTML(id: string, stacks: number): string {
  const p = Game.perkDef(id);
  return `<div class="prow r-${rarityKey(p)}" data-perk="${id}"><span class="pi">${perkIcon(id)}</span><span class="pn">${p.name}</span><b>×${Math.max(1, stacks)}</b></div>`;
}

/** Marca del dorso de las cartas: una «P» de Pilecrawl hecha con bloques. */
const CARD_MARK = (() => {
  const rows = ['###.', '#..#', '###.', '#...', '#...'];
  const cells = rows.flatMap((r, y) => [...r].map((ch, x) => (ch === '#' ? `<rect x="${x * 10 + 1}" y="${y * 10 + 1}" width="8" height="8"/>` : '')));
  return `<svg class="card-mark" viewBox="0 0 40 50" aria-hidden="true">${cells.join('')}</svg>`;
})();

export class UI {
  private shownScore = 0;
  private perksOpen = false;
  private picking = false;
  private choiceDelay = 0;
  /** Cuándo se pintaron las cartas y cada cuánto se da la vuelta una (ms): no se puede elegir una carta aún boca abajo. */
  private revealStart = 0;
  private revealStep = REVEAL_STEP_MS;
  private revealGen = 0;
  /** Instante en que la última carta de la oferta termina de destaparse. */
  private revealEnd = 0;
  /** Fecha del desafío diario que se está jugando (AAAA-MM-DD, UTC). */
  private date = '';
  private timedKey = '';
  private perkKey = '';
  private segsKey = '';
  private livesKey = -1;
  private hyperKey = '';
  private skillKey = '';
  private streakKey = '';
  private overTimer = 0;
  private shareInfo: ShareInfo | null = null;

  constructor(private game: Game) {
    $('reroll').addEventListener('click', () => this.reroll());
    $('skip').addEventListener('click', () => this.skip());
    // con las cartas destapándose, un clic solo las muestra todas (no elige ni salta)
    $('perks').addEventListener('click', (e) => {
      if (!this.revealing) return;
      e.stopPropagation();
      e.preventDefault();
      this.revealAll();
    }, true);
    $('b2b-ico').innerHTML = UI_ICONS.flame;
    document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
      el.innerHTML = perkIcon(el.dataset.icon!);
    });
    this.bindTooltips($('perk-list'));
    this.bindTooltips($('over-perks'));
    $('share-btn').addEventListener('click', async () => {
      if (!this.shareInfo) return;
      const r = await shareRun(this.shareInfo);
      $('share-btn').querySelector('span')!.textContent =
        r === 'copied' ? 'Copiado' : r === 'failed' ? 'No se pudo compartir' : 'Compartir resultado';
    });
  }

  // ───────────── overlays ─────────────

  show(id: string) { $(id).classList.add('visible'); }
  hide(id: string) { $(id).classList.remove('visible'); }

  /** Nombre del modo para títulos; el diario lleva su número. */
  modeTitle(): string {
    const g = this.game;
    return g.mode === 'daily' ? `${MODES.daily.name} #${dailyNumber(this.date)}` : MODES[g.mode].name;
  }

  /** `date`: día del desafío diario, para guardar el récord en el día en que se empezó. */
  startGame(date: string) {
    this.date = date;
    this.timedKey = '';
    window.clearTimeout(this.overTimer);
    for (const id of ['over', 'pause', 'perks']) this.hide(id);
    this.perksOpen = false;
    this.picking = false;
    this.shownScore = 0;
    this.perkKey = '';
    this.segsKey = '';
    this.livesKey = -1;
    this.hyperKey = '';
    this.streakKey = '';
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
    const h = g.hyper;
    const hyperRow = h
      ? `<div class="build-row r-hyper">
          <div class="b-ico">${perkIcon(h.id)}</div>
          <div><div class="b-name">${h.name}<small>hiper</small></div>${effectsHTML(h, 1)}</div>
        </div>`
      : '';
    $('build-list').innerHTML = hyperRow + (g.perkOrder.length
      ? g.perkOrder
          .map((id) => {
            const p = Game.perkDef(id);
            const n = g.perkStacks(id);
            return `<div class="build-row r-${rarityKey(p)}">
              <div class="b-ico">${perkIcon(id)}</div>
              <div><div class="b-name">${p.name}${n > 1 ? `<small>×${n}</small>` : ''}</div>${effectsHTML(p, n)}</div>
            </div>`;
          })
          .join('')
      : '<div class="empty">Todavía no tienes mejoras. Sube de nivel para conseguirlas.</div>');
  }

  /** `prize`: fragmentos y perks abiertos si fue una Expedición; null en los demás modos. */
  showGameOver(prize: { shards: number; unlocked: string[] } | null = null) {
    const g = this.game;
    // el laboratorio falsea la partida: ni récord ni ranking
    const isBest = !g.sandbox && submitScore(g.mode, this.date, g.score);
    const best = loadBest(g.mode, this.date);
    const timeUp = g.endReason === 'time';
    $('over-mode').textContent = this.modeTitle();
    const title = $('over-title');
    title.textContent = timeUp ? 'TIEMPO' : 'FIN DE PARTIDA';
    title.dataset.text = title.textContent;
    $('over-score').textContent = fmt(g.score);
    const bestLabel = g.mode === 'daily' ? 'Récord de hoy' : 'Récord';
    $('over-best').textContent = g.sandbox ? 'Laboratorio: no puntúa' : isBest ? `¡Nuevo ${bestLabel.toLowerCase()}!` : `${bestLabel} ${fmt(best)}`;
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
      (unlocked.length ? stat('Desbloqueado', unlocked.join(', ')) : '') +
      (prize ? stat('Fragmentos', `+${fmt(prize.shards)}`) : '') +
      (prize?.unlocked.length ? stat('Perk abierto', prize.unlocked.map(perkName).join(', ')) : '');
    $('over-perks').innerHTML = g.perkOrder.map((id) => chipHTML(id, g.perkStacks(id))).join('');
    const share = $('share-btn');
    share.hidden = g.sandbox || g.mode === 'tutorial';
    share.querySelector('span')!.textContent = 'Compartir resultado';
    this.shareInfo = { mode: this.modeTitle(), score: g.score, level: g.level, lines: g.lines };
    // si el jugador reinicia antes de que aparezca, no debe reaparecer sobre la nueva partida
    this.overTimer = window.setTimeout(() => this.show('over'), 900);
  }

  // ───────────── elección de perks ─────────────

  openPerks() {
    this.perksOpen = true;
    this.picking = false;
    this.choiceDelay = 380;
  }

  /** Mientras las cartas se destapan una a una. Un clic o una tecla las muestra todas (ver `revealAll`). */
  get revealing() {
    return this.perksOpen && performance.now() < this.revealEnd;
  }

  /** Destapa todas las cartas de golpe; no elige nada. */
  revealAll() {
    if (!this.revealing) return;
    $('cards').classList.add('revealed');
    this.revealStart = -1e9;
    this.revealEnd = 0;
    // los tics que quedan de esta oferta ya no suenan
    this.revealGen++;
  }

  /** `fast`: tras un reroll las cartas se destapan deprisa; la primera vez, una a una para dar expectación. */
  private renderCards(fast = false) {
    const g = this.game;
    this.revealStep = fast ? REVEAL_FAST_MS : REVEAL_STEP_MS;
    this.revealStart = performance.now();
    $('cards').style.setProperty('--step', `${this.revealStep}ms`);
    $('cards').classList.remove('revealed');
    const shownLevel = g.offerLevel();
    $('perk-level').textContent = pad2(shownLevel);
    $('perks').style.setProperty('--level', this.levelColor(shownLevel));
    $('reroll-count').textContent = String(g.rerolls);
    ($('reroll') as HTMLButtonElement).disabled = g.rerolls <= 0;
    ($('skip') as HTMLButtonElement).hidden = !g.canSkip();
    const hyper = g.choosingHyper;
    this.renderShed();
    $('perks').classList.toggle('hyper', hyper);
    const box = $('cards');
    box.innerHTML = '';
    const n = hyper ? g.hyperChoices.length : g.choices.length;
    this.revealEnd = this.revealStart + REVEAL_FLIP_MS + (n - 1) * this.revealStep;
    // un tic al destapar cada carta; si una nueva oferta empieza antes, los tics viejos no suenan
    const gen = ++this.revealGen;
    for (let i = 0; i < n; i++)
      setTimeout(() => { if (gen === this.revealGen && this.perksOpen) audio.reveal(i); }, REVEAL_FLIP_MS + i * this.revealStep);
    box.classList.toggle('four', n > 3);
    $('key4').hidden = n < 4;
    if (hyper) g.hyperChoices.forEach((h, i) => box.appendChild(this.makeCard(h, i, 'r-hyper', 'Hiperperk', 0, '', hyperFoot(h))));
    else g.choices.forEach((p, i) => box.appendChild(this.makeCard(p, i, `r-${rarityKey(p)}`, rarityLabel(p), this.game.perkStacks(p.id), this.stackLabel(this.game.perkStacks(p.id), p.max), '')));
    // oferta maldita: aviso claro en el título y el color de las maldiciones
    const cursed = !hyper && g.cursedOffer;
    $('perks').classList.toggle('cursed', cursed);
    $('perk-stripe').textContent = hyper ? 'Hiperperk por racha' : cursed ? 'Oferta maldita' : g.bossOffer ? 'Jefe derrotado' : 'Subida de nivel';
    $('perk-sub').textContent = hyper
      ? 'Tu racha ha traído una hiperperk: elige una, solo hay una por partida'
      : cursed
        ? 'Todas son malas: elige la menos mala. El reroll saca otras maldiciones; la siguiente oferta será rara o mejor'
        : g.blessedOffer
          ? 'Recompensa por la maldición: rara o mejor'
          : g.bossOffer
            ? 'Recompensa del jefe: épica o mejor, y ganas un reroll'
            : 'Elige una mejora';
    $('perk-odds').innerHTML = cursed || hyper ? '' : this.oddsHTML();
    // re-dispara la animación del título
    const title = document.querySelector<HTMLElement>('.perk-title')!;
    title.style.animation = 'none';
    void title.offsetWidth;
    title.style.animation = '';
  }

  private stageKey = '';
  /** Tramo actual: tres puntos (el último es el jefe) y el nombre del jefe cuando toca. */
  private updateStage(g: Game) {
    const el = $('lvl-stage');
    const bosses = MODES[g.mode].bosses === true;
    el.hidden = !bosses;
    if (!bosses) return;
    const key = `${g.level}`;
    if (key === this.stageKey) return;
    this.stageKey = key;
    const pos = (g.level - 1) % STAGE_LEVELS; // 0..2
    const boss = g.bossNow();
    $('lvl-stage-name').textContent = boss ? boss.name.toUpperCase() : `TRAMO ${stageOf(g.level)}`;
    el.classList.toggle('boss', !!boss);
    el.title = boss ? boss.rule : 'El último nivel de cada tramo es un jefe con una regla rara. Superarlo da una oferta épica o mejor.';
    $('lvl-stage-pips').innerHTML = Array.from({ length: STAGE_LEVELS }, (_, i) => `<i class="${i < pos ? 'on' : i === pos ? 'cur' : ''} ${i === STAGE_LEVELS - 1 ? 'b' : ''}"></i>`).join('');
  }

  /** Racha y probabilidad de cada rareza: es lo que decide el reroll de esta oferta. */
  private oddsHTML(): string {
    const g = this.game;
    const odds = g.offerOdds();
    const parts = (Object.keys(odds) as Rarity[])
      .filter((r) => odds[r] > 0)
      .map((r) => `<span class="odd r-${r}"><i></i>${RARITY_LABEL[r]} <b>${pctTxt(odds[r])}</b></span>`);
    return `<span class="odd odd-streak">Racha <b>${Math.round(g.streak)}</b></span>${parts.join('')}`;
  }

  /** Marca de la carta junto a la rareza: única, acumulable (con las copias que tienes) o los usos posibles. */
  private stackLabel(cur: number, max: number): string {
    if (max === 1) return 'Única';
    if (max >= 99) return cur > 0 ? `×${cur}` : 'Acumulable';
    let pips = '';
    for (let k = 0; k < max; k++) pips += `<i class="pip ${k < cur ? 'on' : k === cur ? 'next' : ''}"></i>`;
    return `<span class="pips">${pips}</span>`;
  }

  /** Carta de mejora o de hiperperk: `cls` da el color, `band` la rareza, `tag` la marca junto a ella y `foot` el pie (si hay). */
  private makeCard(p: PerkDef | HyperDef, i: number, cls: string, band: string, cur: number, tag: string, foot: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `card ${cls}`;
    el.style.setProperty('--i', String(i));
    el.innerHTML = `
      <div class="card-tilt">
        <div class="card-glow"></div>
        <div class="card-flip">
          <div class="card-face card-back">${CARD_MARK}</div>
          <div class="card-face card-front">
            <div class="card-band"><span>${band}</span>${tag ? `<span class="card-tag">${tag}</span>` : ''}<kbd>${i + 1}</kbd></div>
            <div class="card-icon">${perkIcon(p.id)}</div>
            <div class="card-name">${p.name}</div>
            <div class="card-sep"></div>
            ${effectsHTML(p, cur + 1)}
            ${foot ? `<div class="card-foot">${foot}</div>` : ''}
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
    const hyper = g.choosingHyper;
    const choice = hyper ? g.hyperChoices[i] : g.choices[i];
    if (!this.perksOpen || this.picking || this.choiceDelay > 0 || !choice) return;
    // la carta tiene que estar ya boca arriba
    if (performance.now() - this.revealStart < REVEAL_FLIP_MS + i * this.revealStep) return;
    this.picking = true;
    const perk = choice as PerkDef;
    audio.pick(hyper ? 3 : perk.curse ? 0 : RARITY_RANK[perk.rarity]);
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

  /** Saltar la oferta: sin carta, +1 reroll. */
  skip() {
    if (!this.perksOpen || this.picking || this.choiceDelay > 0 || !this.game.canSkip()) return;
    // no se salta una oferta sin haberla visto entera (y así una pulsación suelta al subir de nivel no la salta)
    if (performance.now() - this.revealStart < REVEAL_FLIP_MS + (this.game.choices.length - 1) * this.revealStep) return;
    if (this.game.skipOffer()) {
      audio.reroll();
      if (this.game.state === 'choosing') this.renderCards();
      else {
        this.perksOpen = false;
        this.hide('perks');
      }
    }
  }

  /** Botones para sacrificar una maldición (1 reroll) mientras eliges carta. */
  private renderShed() {
    const g = this.game;
    const box = $('shed');
    box.innerHTML = '';
    if (g.choosingHyper || g.rerolls <= 0) return;
    g.ownedCurses().forEach((id, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost small';
      b.textContent = `Quitar ${Game.perkDef(id).name} (−1 reroll)`;
      b.addEventListener('click', () => {
        if (this.picking) return;
        if (g.shedCurse(i)) {
          audio.reroll();
          this.renderCards(true);
        }
      });
      box.appendChild(b);
    });
  }

  reroll() {
    if (!this.perksOpen || this.picking) return;
    if (this.game.reroll()) {
      audio.reroll();
      this.renderCards(true);
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
      tip.style.setProperty('--c', `var(--${rarityKey(p)})`);
      tip.innerHTML = `<div class="tt-head"><span class="tt-name">${p.name}${n > 1 ? ` ×${n}` : ''}</span><span class="tt-rar">${rarityLabel(p)}</span></div>${effectsHTML(p, n)}`;
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

  /** Color del nivel: los acentos ya están pensados para fondo oscuro. */
  private levelColor(level: number): string {
    return hex(accentFor(level));
  }

  /** Panel de la hiperperk: sin elegir, cargando, lista o activa. */
  private updateHyper() {
    const g = this.game;
    const h = g.hyper;
    const active = g.hyperLeft > 0;
    const ready = g.hyperReady();
    const state = !h ? 'none' : active ? 'active' : ready ? 'ready' : 'charging';
    const meter = g.hyperMeter();
    const text = !h
      ? 'Sale con la racha'
      : active
        ? `Activa · ${Math.ceil((g.hyperLeft * STEP_MS) / 1000)} s · ${window.matchMedia('(pointer: coarse)').matches ? 'tócala para cortar' : `${keyName('hyper')} corta`}`
        : ready
          ? (window.matchMedia('(pointer: coarse)').matches ? 'Lista: tócala' : `Lista: pulsa ${keyName('hyper')}`)
          : `${g.hyperCharge}/${h.charge} líneas`;
    const key = `${h?.id ?? ''}|${state}|${text}`;
    $('hyper-fill').style.transform = `scaleX(${meter})`;
    if (key === this.hyperKey) return;
    this.hyperKey = key;
    const box = $('hyper-box');
    box.dataset.state = state;
    $('hyper-name').textContent = h ? h.name : 'Hiperperk';
    $('hyper-ico').innerHTML = h ? perkIcon(h.id) : '';
    $('hyper-state').textContent = text;
  }

  /** Panel de la habilidad activa: solo se ve si has cogido Pausa táctica o Comodín. */
  private updateSkill() {
    const g = this.game;
    const skill = g.mods.skill;
    const active = g.skillLeft > 0;
    const state = !skill ? 'none' : active ? 'active' : g.skillUsedLevel === g.level ? 'used' : 'ready';
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const text = state === 'active' ? `Congelada · ${Math.ceil((g.skillLeft * STEP_MS) / 1000)} s` : state === 'used' ? 'Usada este nivel' : coarse ? 'Lista: tócala' : `Lista: ${keyName('skill')}`;
    const key = `${skill}|${state}|${text}`;
    if (key === this.skillKey) return;
    this.skillKey = key;
    const box = $('skill-box');
    box.hidden = !skill;
    box.dataset.state = state;
    const id = skill;
    $('skill-name').textContent = id ? Game.perkDef(id === 'tactic' ? 'tactic' : 'wild').name : '';
    $('skill-ico').innerHTML = id ? perkIcon(id) : '';
    $('skill-state').textContent = text;
  }

  /** Medidor de racha y calor por rareza: cada jugada calienta una rareza y se ve su probabilidad ahora. */
  private updateStreak() {
    const g = this.game;
    $('streak-fill').style.transform = `scaleX(${g.streak / STREAK_MAX})`;
    const odds = g.offerOdds();
    const hyper = g.hyperOfferChance();
    const rows = (['rare', 'epic', 'legendary'] as const).map((r) => ({ r, heat: Math.round(g.heat[r]), odd: pctTxt(odds[r]) }));
    const tier = streakTier(g.streak);
    const key = `${Math.round(g.streak)}|${g.streakChain}|${g.streakBest}|${pctTxt(hyper)}|${rows.map((x) => `${x.heat}.${x.odd}`).join(',')}`;
    if (key === this.streakKey) return;
    this.streakKey = key;
    $('streak-num').textContent = String(Math.round(g.streak));
    $('streak-box').dataset.tier = String(tier);
    $('streak-tier').textContent = STREAK_TIER_NAMES[tier];
    // cadena: limpiezas seguidas con buena racha; la mejor de la partida se enseña cuando ya no es la actual
    $('streak-chain').innerHTML =
      g.streakChain > 0
        ? `Seguidas <b>×${g.streakChain}</b>${g.streakBest > g.streakChain ? ` · mejor ×${g.streakBest}` : ''}`
        : g.streakBest > 0 ? `Mejor cadena ×${g.streakBest}` : 'Sube desde 20';
    $('streak-odds').innerHTML =
      rows
        .map(
          (x) =>
            `<div class="heat r-${x.r}"><span>${RARITY_LABEL[x.r]}</span><div class="hy-bar"><i style="transform:scaleX(${x.heat / HEAT_MAX})"></i></div><b>${x.odd}</b></div>`,
        )
        .join('') + (hyper > 0 ? `<span class="hy">Hiper <b>${pctTxt(hyper)}</b></span>` : '');
  }

  update(dt: number) {
    const skin = this.game.skinNow() ?? 'pixel';
    if (document.body.dataset.skin !== skin) document.body.dataset.skin = skin;
    const g = this.game;

    if (this.perksOpen && this.choiceDelay > 0) {
      this.choiceDelay -= dt;
      if (this.choiceDelay <= 0) {
        this.renderCards();
        this.show('perks');
      }
    }

    const badge = $('lab-badge');
    if (badge.hidden === g.sandbox) badge.hidden = !g.sandbox;

    const diff = g.score - this.shownScore;
    this.shownScore += diff * (1 - Math.exp(-dt / 90));
    if (Math.abs(diff) < 1) this.shownScore = g.score;
    $('score').textContent = fmt(this.shownScore);
    $('mult').textContent = `×${g.scoreMultNow().toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    $('level').textContent = pad2(g.level);
    $('combo').textContent = g.combo > 0 ? `×${g.combo}` : '—';
    $('b2b-box').classList.toggle('on', g.b2b);
    $('rerolls').textContent = String(g.rerolls);
    const left = g.timeLeftMs();
    const timed = Number.isFinite(left);
    const timedKey = timed ? `${Math.ceil(left / 1000)}` : '';
    if (timedKey !== this.timedKey || !timed) {
      this.timedKey = timedKey;
      $('time-label').textContent = timed ? 'Queda' : 'Tiempo';
      $('time').textContent = timed ? clock(left, true) : clock(g.time);
      $('time-box').classList.toggle('urgent', timed && left <= 10_000);
    }
    document.documentElement.style.setProperty('--level', this.levelColor(g.level));

    this.updateStage(g);
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

    this.updateHyper();
    this.updateSkill();
    this.updateStreak();

    const key = g.perkOrder.map((id) => `${id}${g.perkStacks(id)}`).join(',');
    if (key !== this.perkKey) {
      this.perkKey = key;
      $('perk-count').textContent = String(g.perkOrder.length);
      $('perk-list').classList.toggle('compact', g.perkOrder.length > 14);
      $('perk-list').innerHTML = g.perkOrder.length
        ? g.perkOrder.map((id) => perkRowHTML(id, g.perkStacks(id))).join('')
        : '<div class="empty">Aún nada. Sube de nivel para elegir tu primera mejora.</div>';
    }
  }
}
