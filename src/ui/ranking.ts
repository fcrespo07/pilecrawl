// Interfaz del ranking: la tabla de la portada y el botón de publicar al acabar la partida.
// No sabe de Pixi ni de las reglas: solo habla con `net/ranking.ts`.
import type { Replay } from '../core/game';
import { MODES, utcDate, type ModeId } from '../core/modes';
import * as net from '../net/ranking';

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Lo que hace falta para publicar la partida que acaba de terminar. */
export interface FinishedRun {
  replay: Replay;
  score: number;
  mode: ModeId;
  /** Desafío diario: fecha UTC en que empezó. */
  date: string;
  /** Partida libre: id que dio el servidor al empezar. Sin él no hay ranking. */
  runId?: string;
}

type Scope = 'daily' | 'weekly' | 'all';

export class RankingUI {
  private mode: ModeId = 'normal';
  private scope: Scope = 'weekly';
  private finished: FinishedRun | null = null;
  private publishing = false;

  constructor(private onClose: () => void) {
    const modal = $('ranking');
    $('ranking-close').addEventListener('click', () => this.close());
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
    modal.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-rmode], button[data-rscope]');
      if (!b) return;
      if (b.dataset.rmode) this.mode = b.dataset.rmode as ModeId;
      if (b.dataset.rscope) this.scope = b.dataset.rscope as Scope;
      this.normalizeScope();
      void this.load();
    });
    $('ranking-nick').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.createPlayer($('ranking-nick-input') as HTMLInputElement, $('ranking-nick-msg'), () => this.load());
    });
    $('ranking-delete').addEventListener('click', () => void this.deleteMe());
    $('publish-nick').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.createPlayer($('publish-nick-input') as HTMLInputElement, $('publish-msg'), () => this.refreshPublish());
    });
    $('publish-btn').addEventListener('click', () => void this.publish());
  }

  get isOpen() {
    return !$('ranking').hidden;
  }

  open() {
    $('ranking').hidden = false;
    this.normalizeScope();
    void this.load();
    ($('ranking-close') as HTMLButtonElement).focus();
  }

  close() {
    $('ranking').hidden = true;
    this.onClose();
  }

  private normalizeScope() {
    if (this.mode === 'daily') this.scope = 'daily';
    else if (this.scope === 'daily') this.scope = 'weekly';
  }

  private async load() {
    const list = $('ranking-list');
    const player = net.loadPlayer();
    document.querySelectorAll<HTMLButtonElement>('#ranking [data-rmode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rmode === this.mode)));
    document.querySelectorAll<HTMLButtonElement>('#ranking [data-rscope]').forEach((b) => {
      b.hidden = (b.dataset.rscope === 'daily') !== (this.mode === 'daily');
      b.setAttribute('aria-pressed', String(b.dataset.rscope === this.scope));
    });
    $('ranking-nick').hidden = player !== null;
    $('ranking-me').hidden = player === null;
    if (player) $('ranking-me-name').textContent = player.nickname;
    list.innerHTML = '<li class="rank-empty">Cargando…</li>';
    try {
      const b = await net.leaderboard(this.mode, this.scope, this.scope === 'daily' ? utcDate() : undefined);
      if (!b.entries.length) {
        list.innerHTML = '<li class="rank-empty">Todavía no hay puntuaciones. Sé el primero.</li>';
        return;
      }
      list.innerHTML = b.entries
        .map((e) => `<li class="${e.me ? 'me' : ''}"><span class="r">${e.rank}</span><span class="n">${esc(e.nickname)}</span><span class="s">${fmt(e.score)}</span><span class="l">Nv ${e.level}</span></li>`)
        .join('');
      if (b.me?.rank && b.me.rank > b.entries.length)
        list.insertAdjacentHTML('beforeend', `<li class="me gap"><span class="r">${b.me.rank}</span><span class="n">${esc(b.me.nickname)}</span><span class="s">${fmt(b.me.best ?? 0)}</span><span class="l"></span></li>`);
    } catch (e) {
      list.innerHTML = `<li class="rank-empty">${esc((e as Error).message)}</li>`;
    }
  }

  private async createPlayer(input: HTMLInputElement, msg: HTMLElement, then: () => void | Promise<void>) {
    msg.textContent = '';
    try {
      await net.register(input.value);
      input.value = '';
      await then();
    } catch (e) {
      msg.textContent = (e as Error).message;
    }
  }

  private async deleteMe() {
    if (!window.confirm('¿Borrar tu apodo y todas tus puntuaciones del ranking? No se puede deshacer.')) return;
    try {
      await net.deleteMe();
    } catch (e) {
      $('ranking-nick-msg').textContent = (e as Error).message;
      return;
    }
    void this.load();
  }

  // ───────────── publicar al acabar la partida ─────────────

  /** Llamar al terminar una partida. `run` es null si no se puede publicar (sin ranking o sin servidor). */
  offerPublish(run: FinishedRun | null) {
    this.finished = run;
    this.publishing = false;
    $('publish-msg').textContent = '';
    this.refreshPublish();
  }

  private refreshPublish() {
    const box = $('publish');
    const run = this.finished;
    box.hidden = !net.RANKING_ENABLED || run === null;
    if (box.hidden || !run) return;
    const player = net.loadPlayer();
    const btn = $('publish-btn') as HTMLButtonElement;
    $('publish-nick').hidden = player !== null;
    btn.hidden = player === null;
    btn.disabled = false;
    btn.querySelector('span')!.textContent = 'Publicar puntuación';
    if (!player && !$('publish-msg').textContent)
      $('publish-msg').textContent = run.mode === 'daily' ? 'Elige un apodo para publicar tu puntuación.' : '';
  }

  /** Para partidas libres sin servidor: avisa de por qué no hay botón. */
  offerUnavailable(text: string) {
    this.finished = null;
    $('publish').hidden = false;
    $('publish-nick').hidden = true;
    $('publish-btn').hidden = true;
    $('publish-msg').textContent = text;
  }

  private async publish() {
    const run = this.finished;
    if (!run || this.publishing) return;
    this.publishing = true;
    const btn = $('publish-btn') as HTMLButtonElement;
    btn.disabled = true;
    $('publish-msg').textContent = 'Enviando…';
    try {
      const r = await net.publish(run.replay, run.score, run.mode === 'daily' ? { date: run.date } : { runId: run.runId });
      const where = r.rank ? `Puesto ${r.rank} en ${MODES[run.mode].name.toLowerCase()}` : 'Publicada';
      $('publish-msg').textContent = r.improved ? `${where}.` : `${where}. No mejora tu mejor marca.`;
      btn.hidden = true;
      this.finished = null;
    } catch (e) {
      $('publish-msg').textContent = (e as Error).message;
      btn.disabled = false;
    } finally {
      this.publishing = false;
    }
  }
}
