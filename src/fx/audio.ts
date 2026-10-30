// Todo el sonido se sintetiza con Web Audio: sin ficheros.

const SCALE = [0, 2, 3, 5, 7, 8, 10]; // menor natural
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const noteInScale = (root: number, degree: number) =>
  root + SCALE[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);

const PREFS_KEY = 'blockrogue.audio';

/** Volúmenes de 0 a 1 que elige el jugador; 1 es el nivel de siempre. */
export interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

interface AudioPrefs extends Volumes {
  muted: boolean;
  musicOn: boolean;
}

const vol = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1);

/** Preferencias de sonido guardadas por el jugador. Sin almacenamiento disponible, valores por defecto. */
function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioPrefs>;
      return { muted: p.muted === true, musicOn: p.musicOn !== false, master: vol(p.master), music: vol(p.music), sfx: vol(p.sfx) };
    }
  } catch {
    /* sin almacenamiento o JSON roto: se usan los valores por defecto */
  }
  return { muted: false, musicOn: true, master: 1, music: 1, sfx: 1 };
}

function saveAudioPrefs(prefs: AudioPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* sin almacenamiento: la preferencia dura lo que la pestaña */
  }
}

export class SoundEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private echo!: DelayNode;
  private musicEcho!: DelayNode;
  private noiseBuf!: AudioBuffer;
  musicOn: boolean;
  muted: boolean;
  volumes: Volumes;

  // secuenciador
  private nextStepTime = 0;
  private step = 0;
  private tempo = 112;
  private intensity = 0;
  private timer: number | null = null;

  constructor() {
    const prefs = loadAudioPrefs();
    this.muted = prefs.muted;
    this.musicOn = prefs.musicOn;
    this.volumes = { master: prefs.master, music: prefs.music, sfx: prefs.sfx };
  }

  private save() {
    saveAudioPrefs({ muted: this.muted, musicOn: this.musicOn, ...this.volumes });
  }

  /** Ganancias de cada bus según silencio, música y volúmenes. Los máximos son los niveles de siempre. */
  private applyGains(tc = 0.05) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8 * this.volumes.master, ctx.currentTime, tc);
    this.sfxBus.gain.setTargetAtTime(0.9 * this.volumes.sfx, ctx.currentTime, tc);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.32 * this.volumes.music : 0, ctx.currentTime, 0.1);
  }

  setVolume(kind: keyof Volumes, v: number) {
    this.volumes[kind] = vol(v);
    this.save();
    this.applyGains();
  }

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8 * this.volumes.master;
    this.master.connect(comp);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9 * this.volumes.sfx;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.32 * this.volumes.music : 0;
    this.musicBus.connect(this.master);

    // eco suave: uno para los efectos y otro para la música, que sale por su bus
    // (así al silenciar la música no sigue sonando su cola)
    this.echo = this.makeEcho(ctx, this.master);
    // el bus de música baja a 0,32: el eco de la música compensa esa ganancia para sonar igual que antes
    this.musicEcho = this.makeEcho(ctx, this.musicBus, 0.35 / 0.32);

    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private makeEcho(ctx: AudioContext, out: AudioNode, gain = 0.35): DelayNode {
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.27;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const echoOut = ctx.createGain();
    echoOut.gain.value = gain;
    const echoLp = ctx.createBiquadFilter();
    echoLp.type = 'lowpass';
    echoLp.frequency.value = 2400;
    delay.connect(echoLp).connect(fb).connect(delay);
    echoLp.connect(echoOut).connect(out);
    return delay;
  }

  /** Para y reanuda el sonido sin tocar los ajustes (anuncios de portal). */
  suspendSound(on: boolean) {
    if (!this.ctx) return;
    void (on ? this.ctx.suspend() : this.ctx.resume());
  }

  toggleMute() {
    this.muted = !this.muted;
    this.save();
    this.applyGains();
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    this.save();
    this.applyGains();
  }

  // ───────────── primitivas ─────────────

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; at?: number; slide?: number; echo?: boolean; cutoff?: number; bus?: AudioNode; attack?: number } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.2;
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = osc;
    if (opts.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(opts.cutoff, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(200, opts.cutoff * 0.2), t + dur);
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(opts.bus ?? this.sfxBus);
    if (opts.echo) g.connect(opts.bus ? this.musicEcho : this.echo);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(
    dur: number,
    opts: { gain?: number; at?: number; from?: number; to?: number; type?: BiquadFilterType; q?: number; bus?: AudioNode } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.Q.value = opts.q ?? 1;
    f.frequency.setValueAtTime(opts.from ?? 2000, t);
    f.frequency.exponentialRampToValueAtTime(opts.to ?? 200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(opts.bus ?? this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ───────────── efectos ─────────────

  move() { this.tone(520, 0.04, { type: 'square', gain: 0.025, cutoff: 3000 }); }
  rotate(spin: boolean) {
    this.tone(spin ? 980 : 760, 0.06, { type: 'triangle', gain: 0.06, slide: 1.25 });
    if (spin) this.noise(0.18, { gain: 0.08, from: 1500, to: 6000, type: 'bandpass', q: 3 });
  }
  hold() {
    this.tone(440, 0.07, { gain: 0.08 });
    this.tone(660, 0.09, { gain: 0.08, at: 0.05 });
  }
  lock() { this.tone(150, 0.08, { type: 'sine', gain: 0.18, slide: 0.6 }); }
  hardDrop(dist: number) {
    const k = Math.min(1, 0.4 + dist / 20);
    this.tone(110, 0.22, { type: 'sine', gain: 0.45 * k, slide: 0.35 });
    this.noise(0.12, { gain: 0.25 * k, from: 3000, to: 300 });
  }

  clear(lines: number, combo: number, big: boolean) {
    const root = 57 + Math.min(combo, 12);
    const n = Math.max(2, lines + 1);
    // peso de 1 a 4 líneas: el golpe grave y el ruido crecen con cada línea
    const w = Math.min(4, Math.max(1, lines));
    this.tone(midi(root - 24), 0.16 + 0.06 * w, { type: 'sine', gain: 0.1 + 0.08 * w, slide: 0.55 });
    for (let i = 0; i < n; i++) {
      const note = noteInScale(root, i * 2);
      this.tone(midi(note), 0.35, { type: 'sawtooth', gain: 0.07, at: i * 0.045, cutoff: 3200, echo: true });
      this.tone(midi(note + 12), 0.25, { type: 'triangle', gain: 0.05, at: i * 0.045, echo: true });
    }
    // con tres líneas o más, una quinta encima para que se note
    if (w >= 3) [0, 4, 7].forEach((s) => this.tone(midi(root + s + 12), 0.5, { type: 'triangle', gain: 0.04, at: 0.02, echo: true }));
    this.noise(0.25, { gain: 0.08 + 0.04 * w, from: 800, to: 8000, type: 'bandpass', q: 1.5 });
    if (big) {
      [0, 4, 7, 11, 14].forEach((s, i) =>
        this.tone(midi(root + s), 1.1, { type: 'sawtooth', gain: 0.06, at: 0.08 + i * 0.02, cutoff: 5000, echo: true }),
      );
      this.tone(55, 0.6, { type: 'sine', gain: 0.5, slide: 0.5 });
      this.noise(0.9, { gain: 0.18, from: 400, to: 12000, type: 'bandpass', q: 0.8, at: 0.05 });
    }
  }

  perfect() {
    [0, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(midi(69 + s), 0.9, { type: 'triangle', gain: 0.1, at: i * 0.07, echo: true }));
  }

  bomb() {
    this.tone(70, 0.7, { type: 'sine', gain: 0.6, slide: 0.3 });
    this.noise(0.9, { gain: 0.5, from: 4000, to: 80 });
  }

  prism() {
    for (let i = 0; i < 10; i++) this.tone(midi(76 + SCALE[i % 7] + 12 * Math.floor(i / 7)), 0.4, { gain: 0.05, at: i * 0.03, echo: true, type: 'sine' });
    this.noise(0.6, { gain: 0.15, from: 9000, to: 1500, type: 'highpass' });
  }

  drill() {
    this.tone(90, 0.4, { type: 'sawtooth', gain: 0.12, slide: 2.5, cutoff: 1200 });
    this.noise(0.4, { gain: 0.2, from: 500, to: 5000, type: 'bandpass', q: 4 });
  }

  quake() {
    this.tone(40, 1.0, { type: 'sine', gain: 0.6, slide: 0.7 });
    this.noise(1.0, { gain: 0.35, from: 300, to: 60 });
  }

  garbage() {
    this.tone(80, 0.25, { type: 'square', gain: 0.07, cutoff: 600, slide: 0.8 });
  }

  levelUp() {
    // golpe grave al empezar, para que la subida de nivel pese
    this.tone(midi(40), 0.9, { type: 'sine', gain: 0.45, slide: 0.5 });
    this.noise(0.5, { gain: 0.14, from: 2000, to: 100 });
    [0, 4, 7, 12, 16, 19].forEach((s, i) =>
      this.tone(midi(64 + s), 0.5, { type: 'square', gain: 0.05, at: i * 0.06, cutoff: 4000, echo: true }),
    );
    this.noise(1.2, { gain: 0.15, from: 300, to: 10000, type: 'bandpass', q: 1 });
  }

  /** Sube de tramo de racha: arpegio ascendente que tiene una nota más por tramo. */
  streakTier(tier: number) {
    const top = Math.min(4, Math.max(1, tier));
    [0, 4, 7, 12, 16, 19, 24].slice(0, top + 3).forEach((s, i) =>
      this.tone(midi(60 + s), 0.3, { type: 'triangle', gain: 0.07, at: i * 0.05, echo: true }),
    );
    this.tone(midi(48), 0.4, { type: 'sine', gain: 0.2, slide: 1.2 });
    this.noise(0.15, { gain: 0.06, from: 9000, to: 5000, type: 'highpass' });
  }

  /** Hiperperk activada: barrido grave que sube y un acorde brillante encima. */
  hyperOn() {
    this.tone(90, 0.9, { type: 'sawtooth', gain: 0.1, slide: 6, cutoff: 3000, echo: true });
    [0, 4, 7, 12].forEach((s, i) => this.tone(midi(69 + s), 0.6, { type: 'triangle', gain: 0.07, at: 0.12 + i * 0.04, echo: true }));
    this.noise(0.5, { gain: 0.12, from: 300, to: 9000, type: 'bandpass', q: 1 });
  }

  /** Tic al destapar una carta; sube un poco con cada una. */
  reveal(i: number) { this.tone(1100 + i * 90, 0.04, { type: 'square', gain: 0.03, cutoff: 4000 }); }

  hover() { this.tone(1200, 0.03, { type: 'sine', gain: 0.03 }); }

  pick(rarity: number) {
    const base = 72 + rarity * 2;
    for (let i = 0; i < 5 + rarity * 2; i++)
      this.tone(midi(base + SCALE[(i * 2) % 7] + 12 * Math.floor((i * 2) / 7)), 0.5, { type: 'sine', gain: 0.07, at: i * 0.04, echo: true });
  }

  reroll() { this.noise(0.2, { gain: 0.15, from: 2000, to: 6000, type: 'bandpass', q: 5 }); }

  revive() {
    this.tone(220, 1.2, { type: 'sawtooth', gain: 0.1, slide: 4, cutoff: 6000, echo: true });
    this.noise(1.2, { gain: 0.2, from: 200, to: 9000, type: 'bandpass' });
  }

  gameOver() {
    [0, -2, -5, -9, -12].forEach((s, i) => this.tone(midi(57 + s), 0.6, { type: 'sawtooth', gain: 0.08, at: i * 0.18, cutoff: 2000, echo: true }));
  }

  // ───────────── música procedural ─────────────

  startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** 0..1, sube con el nivel: más tempo y más capas. */
  setIntensity(level: number) {
    this.intensity = Math.min(1, (level - 1) / 14);
    this.tempo = 112 + Math.min(level - 1, 16) * 3;
  }

  private schedule() {
    const ctx = this.ctx!;
    const stepDur = 60 / this.tempo / 4;
    while (this.nextStepTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextStepTime - ctx.currentTime, stepDur);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, at: number, stepDur: number) {
    // Am - F - C - G (grados en La menor)
    const chords = [0, 5, 2, 6];
    const chord = chords[Math.floor(step / 16)];
    const root = 45; // A2
    const s16 = step % 16;
    const bus = this.musicBus;

    // bajo en corcheas con octava
    if (s16 % 2 === 0) {
      const n = noteInScale(root, chord) + (s16 % 4 === 2 ? 12 : 0);
      this.tone(midi(n), stepDur * 1.8, { type: 'sawtooth', gain: 0.16, at, cutoff: 700 + this.intensity * 900, bus });
    }
    // arpegio
    const arpDeg = [0, 2, 4, 7, 4, 2, 4, 9][s16 % 8];
    const an = noteInScale(root + 24, chord + arpDeg);
    this.tone(midi(an), stepDur * 1.5, { type: 'square', gain: 0.045, at, cutoff: 2200 + this.intensity * 2500, bus, echo: true });
    // bombo
    if (s16 % 4 === 0) this.tone(120, 0.18, { type: 'sine', gain: 0.5, slide: 0.3, at, bus });
    // caja
    if (this.intensity > 0.15 && s16 % 8 === 4) this.noise(0.12, { gain: 0.2, from: 4000, to: 1200, type: 'bandpass', at, bus });
    // charles
    if (s16 % 2 === 1 || this.intensity > 0.5) this.noise(0.04, { gain: 0.06 + this.intensity * 0.04, from: 9000, to: 7000, type: 'highpass', at, bus });
    // pad de fondo al cambiar de acorde
    if (s16 === 0 && this.intensity > 0.3) {
      for (const d of [0, 2, 4]) this.tone(midi(noteInScale(root + 12, chord + d)), stepDur * 15, { type: 'sawtooth', gain: 0.025, at, cutoff: 1500, bus, attack: 0.3 });
    }
  }
}

export const audio = new SoundEngine();
