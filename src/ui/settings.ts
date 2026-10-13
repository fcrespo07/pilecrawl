// Pantalla de Ajustes: volúmenes, efectos, teclas y manejo. Se abre desde la portada y desde la pausa.
import { audio } from '../fx/audio';
import {
  ACTIONS, ACTION_LABEL, ARR_RANGE, DAS_RANGE, RESERVED, SLOTS, bindKey, handling, keyLabel, keyLabels, keymap, resetHandling, resetKeys, setHandling,
  type Action,
} from '../settings';

const $ = (id: string) => document.getElementById(id)!;

/** Pinta las teclas de cada `[data-keys]` con las asignadas ahora (listas de controles, hiperperk...). */
export function renderKeyHints(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-keys]').forEach((el) => {
    const max = Number(el.dataset.max ?? 1);
    const names = el.dataset.keys!.split(' ').flatMap((a) => keyLabels(a as Action, max));
    if (el.tagName === 'KBD') el.textContent = names[0] ?? '–';
    else el.innerHTML = names.map((n) => `<kbd>${n}</kbd>`).join('') || '<kbd>–</kbd>';
  });
}

export class SettingsUI {
  private capture: { action: Action; slot: number } | null = null;
  private opener: HTMLElement | null = null;

  /** `onKeys`: las teclas han cambiado; hay que repintar las listas y los textos que las nombran. */
  constructor(private onKeys: () => void) {
    $('settings-close').addEventListener('click', () => this.close());
    // clic fuera del panel
    $('settings').addEventListener('click', (e) => {
      if (e.target === $('settings')) this.close();
    });
    for (const kind of ['master', 'music', 'sfx'] as const) {
      const input = $(`vol-${kind}`) as HTMLInputElement;
      input.addEventListener('input', () => {
        audio.setVolume(kind, Number(input.value) / 100);
        this.renderVolumes();
      });
      // al soltar, un sonido de muestra para juzgar el volumen (la música ya suena sola en partida)
      input.addEventListener('change', () => {
        audio.init();
        if (kind !== 'music') audio.lock();
      });
    }
    $('set-music').addEventListener('click', () => {
      audio.toggleMusic();
      this.renderToggles();
    });
    $('set-mute').addEventListener('click', () => {
      audio.toggleMute();
      this.renderToggles();
    });
    const das = $('set-das') as HTMLInputElement;
    const arr = $('set-arr') as HTMLInputElement;
    for (const [el, r] of [[das, DAS_RANGE], [arr, ARR_RANGE]] as const) {
      el.min = String(r.min);
      el.max = String(r.max);
      el.step = String(r.step);
    }
    das.addEventListener('input', () => { setHandling('das', Number(das.value)); this.renderHandling(); });
    arr.addEventListener('input', () => { setHandling('arr', Number(arr.value)); this.renderHandling(); });
    $('set-keys-reset').addEventListener('click', () => {
      this.cancelCapture();
      resetKeys();
      resetHandling();
      this.say('Controles restablecidos.');
      this.renderKeys();
      this.renderHandling();
      this.onKeys();
    });
    $('set-keylist').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
      if (b) this.startCapture(b.dataset.action as Action, Number(b.dataset.slot));
    });
    // en fase de captura: la tecla pulsada no llega a ningún otro oyente (ni pausa, ni juego)
    window.addEventListener('keydown', (e) => this.onCaptureKey(e), true);
  }

  get isOpen() {
    return !$('settings').hidden;
  }

  open(opener?: HTMLElement | null) {
    this.opener = opener ?? null;
    this.renderVolumes();
    this.renderToggles();
    this.renderKeys();
    this.renderHandling();
    this.say('');
    $('settings').hidden = false;
    ($('settings-close') as HTMLButtonElement).focus();
  }

  close() {
    this.cancelCapture();
    $('settings').hidden = true;
    (document.activeElement as HTMLElement | null)?.blur();
    this.opener?.focus({ preventScroll: true });
    this.opener = null;
  }

  /** Esc: primero cancela la captura de tecla, si la hay; si no, cierra. Devuelve si hacía falta cerrar. */
  escape() {
    if (this.capture) this.cancelCapture();
    else this.close();
  }

  /** Para que el resto de la interfaz sepa que las teclas ahora son de los ajustes. */
  get capturing() {
    return this.capture !== null;
  }

  // ───────────── sonido ─────────────

  renderVolumes() {
    for (const kind of ['master', 'music', 'sfx'] as const) {
      const pct = Math.round(audio.volumes[kind] * 100);
      ($(`vol-${kind}`) as HTMLInputElement).value = String(pct);
      $(`vol-${kind}-n`).textContent = `${pct}%`;
    }
  }

  renderToggles() {
    $('set-music').setAttribute('aria-pressed', String(audio.musicOn));
    $('set-music').querySelector('span')!.textContent = audio.musicOn ? 'Música: sí' : 'Música: no';
    $('set-mute').setAttribute('aria-pressed', String(!audio.muted));
    $('set-mute').querySelector('span')!.textContent = audio.muted ? 'Sonido: no' : 'Sonido: sí';
  }

  // ───────────── teclas ─────────────

  private renderHandling() {
    ($('set-das') as HTMLInputElement).value = String(handling.das);
    ($('set-arr') as HTMLInputElement).value = String(handling.arr);
    $('set-das-n').textContent = `${handling.das} ms`;
    $('set-arr-n').textContent = handling.arr === 0 ? 'instantánea' : `${handling.arr} ms`;
  }

  private renderKeys() {
    const rows = ACTIONS.map((a) => {
      const slots = Array.from({ length: SLOTS }, (_, i) => {
        const code = keymap[a][i];
        const on = this.capture?.action === a && this.capture.slot === i;
        const text = on ? 'Pulsa una tecla' : code ? keyLabel(code) : '–';
        const label = `${ACTION_LABEL[a]}, hueco ${i + 1}: ${code ? keyLabel(code) : 'vacío'}`;
        return `<button type="button" class="set-key${on ? ' on' : ''}${code ? '' : ' empty'}" data-action="${a}" data-slot="${i}" aria-label="${label}">${text}</button>`;
      }).join('');
      return `<div class="set-keyrow"><span>${ACTION_LABEL[a]}</span><div>${slots}</div></div>`;
    });
    $('set-keylist').innerHTML = rows.join('');
  }

  private say(t: string) {
    $('set-keymsg').textContent = t;
  }

  private startCapture(action: Action, slot: number) {
    this.capture = { action, slot };
    this.say('Pulsa la tecla nueva. Esc cancela, Supr vacía el hueco.');
    this.renderKeys();
    ($('set-keylist').querySelector('.set-key.on') as HTMLElement | null)?.focus();
  }

  private cancelCapture() {
    if (!this.capture) return;
    this.capture = null;
    this.say('');
    this.renderKeys();
  }

  private onCaptureKey(e: KeyboardEvent) {
    const cap = this.capture;
    if (!cap) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (e.code === 'Escape') return this.cancelCapture();
    this.capture = null;
    if (e.code === 'Delete' || e.code === 'Backspace') {
      bindKey(cap.action, cap.slot, null);
      this.say('Hueco vacío.');
    } else if (RESERVED.has(e.code)) {
      this.say(`${keyLabel(e.code)} está reservada para el juego: elige otra.`);
    } else {
      const stolen = bindKey(cap.action, cap.slot, e.code);
      this.say(stolen ? `${keyLabel(e.code)} ya era de «${ACTION_LABEL[stolen]}»: ahora es de «${ACTION_LABEL[cap.action]}».` : '');
    }
    this.renderKeys();
    this.onKeys();
    ($('set-keylist').querySelector(`[data-action="${cap.action}"][data-slot="${cap.slot}"]`) as HTMLElement | null)?.focus();
  }
}
