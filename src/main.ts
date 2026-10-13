import './style.css';
import './storage';
import { Game, RULES_VERSION, STEP_MS } from './core/game';
import { audio } from './fx/audio';
import { BOARD_X, BOARD_Y, CELL, H, HOLD_W, HOLD_X, HOLD_Y, PORTRAIT, W, portraitHeight, setLayout } from './fx/layout';
import { Gestures } from './gestures';
import { Mouse } from './mouse';
import { Renderer } from './fx/renderer';
import { loadMeta, recordBestLevel } from './core/meta';
import { dailySeed, MODES, msToNextDaily, type ModeId } from './core/modes';
import { randomSeed } from './core/rng';
import { loadLastMode, loadTutorialDone, markPlayed, saveLastMode, saveTutorialDone } from './records';
import { ModeSelect } from './ui/modeSelect';
import { renderHomePanels } from './ui/homePanels';
import { mountAd } from './ui/adSlot';
import { adCmpManaged, adConsentManaged, adProviderFromEnv, openAdCmp, resetAdConsent } from './ads/providers';
import { Tutorial } from './ui/tutorial';
import { Input } from './input';
import { EndLock } from './endlock';
import { renderKeyHints, SettingsUI } from './ui/settings';
import { replayInto } from './core/replay';
import { clearSave, loadSave, modeOf, RUN_TTL_MS, writeSave, type SavedRun } from './savedrun';
import type { Owned } from './core/expedition';
import { UI } from './ui/ui';
import { RankingUI, type FinishedRun } from './ui/ranking';
import * as net from './net/ranking';
import { postStats, StatsCollector } from './net/stats';
import { renderCatalog } from './ui/catalog';
import { renderExpedition, wireExpedition } from './ui/expeditionScreen';
import { awardRun, loadExpedition } from './expedition';
import { Lab, LAB_ENABLED } from './ui/lab';
import { initLogoEyes } from './ui/eyes';

const game = new Game();
// estadísticas anónimas: solo si hay servidor (el mismo del ranking); ver privacidad.html
const stats = new StatsCollector(game, (s) => {
  if (net.RANKING_ENABLED) postStats(net.BASE, s);
});
addEventListener('pagehide', () => stats.finish('quit'));
const renderer = new Renderer(game);
const input = new Input(game);
/** Tras acabar una partida, las teclas y el botón de reintentar esperan un rato sin pulsar. */
const endLock = new EndLock(800);
let lockFade = 0;
/** Una pulsación que el freno ignora atenúa el botón de reintentar un momento, para que se vea por qué no responde. */
function endPressBlocked(): boolean {
  if (!endLock.blocks()) return false;
  const retry = document.getElementById('retry-btn')!;
  retry.classList.add('locked');
  clearTimeout(lockFade);
  lockFade = window.setTimeout(() => retry.classList.remove('locked'), 800);
  return true;
}
const ui = new UI(game);
const lab = new Lab(game);
const settingsUI = new SettingsUI(() => renderKeyHints());

const stage = document.getElementById('stage')!;
mountAd(document.getElementById('ad-slot')!, adProviderFromEnv());
if (adConsentManaged() || adCmpManaged()) {
  const prefs = document.getElementById('ad-prefs')!;
  prefs.hidden = false;
  prefs.addEventListener('click', () => {
    if (adCmpManaged()) return openAdCmp();
    resetAdConsent();
    location.reload();
  });
}
const rankingUI = new RankingUI(
  () => home.focus({ preventScroll: true }),
  () => refreshPanels(true),
);
const modeSelect = new ModeSelect(document.getElementById('mode-select')!, loadLastMode(), saveLastMode);
const tutorial = new Tutorial(game, {
  onPlay: () => void startRun(),
  onRetry: () => { if (!endPressBlocked()) void startRun('tutorial'); },
  onHome: () => {
    // salir a mitad: la partida del tutorial se descarta para que Enter pueda empezar otra
    game.reset();
    showHome(true);
  },
  onDone: saveTutorialDone,
});
const panelLeft = document.getElementById('panel-left')!;
const panelRight = document.getElementById('panel-right')!;
const refreshPanels = (force = false) => renderHomePanels(panelLeft, panelRight, force);
refreshPanels();
// la cuenta atrás y el número del diario cambian con la portada abierta
window.setInterval(() => refreshPanels(), 30_000);
// y justo al cambiar de día (medianoche UTC) se repinta sin esperar al ciclo
const atRollover = () =>
  window.setTimeout(() => {
    modeSelect.refresh();
    refreshPanels();
    atRollover();
  }, msToNextDaily(net.now()) + 500);
atRollover();
// con la hora del servidor el día del desafío puede cambiar respecto al reloj local
void net.serverDay().then((d) => {
  if (!d) return;
  modeSelect.refresh();
  refreshPanels();
});
const canvas = document.getElementById('game') as HTMLCanvasElement;

function renderResolution(scale: number) {
  return Math.min(3, (window.devicePixelRatio || 1) * scale);
}

const coarse = window.matchMedia('(pointer: coarse)');

/**
 * Encaja el escenario en la ventana. En un móvil de pie la disposición es vertical (más alta que ancha,
 * para que el tablero llene la pantalla); en el resto, la horizontal de siempre. Devuelve si cambió
 * la disposición, para que el renderer rehaga lo que depende del tamaño.
 */
function layout() {
  const portrait = coarse.matches && window.innerHeight > window.innerWidth;
  let wantH = portrait ? portraitHeight(window.innerHeight / window.innerWidth) : 720;
  // la barra de direcciones del móvil sube y baja: pequeñas variaciones de alto no recomponen el escenario
  if (portrait && PORTRAIT && Math.abs(wantH - H) < 120) wantH = H;
  const changed = portrait !== PORTRAIT || (portrait && wantH !== H);
  if (changed) {
    setLayout(portrait, wantH);
    stage.style.width = `${W}px`;
    stage.style.height = `${H}px`;
    document.body.classList.toggle('portrait', portrait);
  }
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.top = `${window.innerHeight / 2}px`;
  // el cuadro del tutorial en pantallas táctiles se coloca fuera del escenario y necesita su escala
  document.documentElement.style.setProperty('--s', String(s));
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  return { s, changed };
}

let hitstop = 0;
let stepAcc = 0;

function wireAudioAndFeel() {
  const ev = game.events;
  ev.on('move', () => audio.move());
  ev.on('rotate', ({ spin }) => audio.rotate(spin));
  ev.on('hold', () => audio.hold());
  ev.on('lock', () => audio.lock());
  ev.on('harddrop', ({ dist }) => audio.hardDrop(dist));
  ev.on('clear', (c) => {
    const big = c.lines >= 4 || c.spin !== null || c.perfect;
    audio.clear(c.lines, Math.max(0, c.combo) + c.cascade * 2, big);
    if (c.perfect) {
      audio.perfect();
      hitstop = Math.max(hitstop, 220);
    } else if (big) hitstop = Math.max(hitstop, 90);
  });
  ev.on('spinNoLines', () => audio.rotate(true));
  ev.on('bomb', () => { audio.bomb(); hitstop = Math.max(hitstop, 70); });
  ev.on('prism', () => audio.prism());
  ev.on('drill', () => audio.drill());
  ev.on('breather', () => audio.drill());
  ev.on('lifeline', () => audio.hold());
  ev.on('harvest', () => audio.reroll());
  ev.on('quake', () => audio.quake());
  ev.on('garbage', () => audio.garbage());
  ev.on('levelup', ({ level }) => {
    setTimeout(() => audio.levelUp(), 120);
    audio.setIntensity(level);
    // el tutorial y el laboratorio no cuentan para desbloquear rarezas
    // la Expedición (con mejoras permanentes) tampoco: desbloquearía rarezas del arcade sin merecerlo
    if (game.mode !== 'tutorial' && !MODES[game.mode].expedition && !game.sandbox) recordBestLevel(level);
  });
  ev.on('revive', () => audio.revive());
  ev.on('gameover', () => {
    endLock.arm();
    audio.stopMusic();
    audio.gameOver();
    // Expedición: los fragmentos se dan una sola vez, al acabar (el laboratorio no puntúa)
    const prize =
      game.mode === 'expedition' && !game.sandbox
        ? awardRun({ quads: game.quads, spins: game.spins, maxCombo: Math.max(0, game.maxCombo), level: game.level, lines: game.lines, timeMs: game.time })
        : null;
    if (game.mode !== 'tutorial') ui.showGameOver(prize);
    modeSelect.refresh();
    offerPublish();
    refreshPanels(true);
  });
}

/** Pausa y hiperperk táctiles: reutilizan la misma lógica que su tecla. El resto va por gestos sobre el tablero. */
let gestures: Gestures | null = null;
let mouse: Mouse | null = null;

function wireTouch() {
  const togglePause = () => {
    if (game.state === 'playing' || game.state === 'paused') {
      game.togglePause();
      input.releaseAll();
      gestures?.reset();
  mouse?.hide();
      setPaused(game.state === 'paused');
    }
  };
  document.getElementById('resume-btn')!.addEventListener('click', togglePause);
  document.querySelector<HTMLButtonElement>('[data-touch="pause"]')!.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    togglePause();
  });
  // la tarjeta de la hiperperk es también su botón táctil
  const hyper = document.getElementById('hyper-box')!;
  hyper.addEventListener('pointerdown', (e) => {
    if (!coarse.matches) return;
    e.preventDefault();
    input.touchDown('hyper');
  });
  const view = {
    rect: () => canvas.getBoundingClientRect(),
    logicalW: () => W,
    cell: () => CELL,
    // la reserva y un poco de margen alrededor
    holdBox: () => ({ x: HOLD_X - 12, y: HOLD_Y - 12, w: HOLD_W + 24, h: (PORTRAIT ? BOARD_Y - HOLD_Y : 140) + 12 }),
  };
  gestures = new Gestures(canvas, game, input, view);
  // el ratón solo en escritorio: en táctil mandan los gestos
  mouse = new Mouse(canvas, game, input, view, { boardX: () => BOARD_X });
}

const home = document.getElementById('home')!;
initLogoEyes(document.querySelector<HTMLCanvasElement>('.home-logo')!, () => !home.classList.contains('hidden'));
const TUTORIAL_SEED = 0x7a11;
const catalog = document.getElementById('catalog')!;

function showCatalog(on: boolean) {
  catalog.classList.toggle('hidden', !on);
  home.classList.toggle('hidden', on);
  (on ? catalog : home).scrollTop = 0;
  (on ? catalog : home).focus({ preventScroll: true });
}

const expScreen = document.getElementById('expedition')!;

function showExpedition(on: boolean) {
  if (on) renderExpedition(expScreen);
  expScreen.classList.toggle('hidden', !on);
  home.classList.toggle('hidden', on);
  (on ? expScreen : home).scrollTop = 0;
  (on ? expScreen : home).focus({ preventScroll: true });
}

function showHome(show: boolean) {
  expScreen.classList.add('hidden');
  home.classList.toggle('hidden', !show);
  if (show) {
    tutorial.stop();
    audio.stopMusic();
    document.querySelector<HTMLElement>('#home-tutorial .new-tag')!.hidden = loadTutorialDone();
  }
  // detrás de la portada nada debe recibir foco ni dibujarse
  stage.inert = show;
  if (show) {
    // la portada siempre con la piel de base: la de los perks es de la partida y el ticker (que la pone) se para
    document.body.dataset.skin = 'pixel';
    renderer.app.ticker.stop();
    modeSelect.refresh();
    refreshPanels();
    home.scrollTop = 0;
    home.focus({ preventScroll: true });
  } else renderer.app.ticker.start();
}

/** Partida en curso: lo que hace falta para publicarla al acabar. */
let currentRun: { mode: ModeId; date: string; runId?: string; startedAt: number; exp?: { owned: Owned; unlocked: string[] }; unranked?: string; noRank?: boolean } | null = null;
let starting = false;

function offerPublish() {
  const r = currentRun;
  // las partidas del laboratorio nunca puntúan (el servidor también las rechaza)
  const rankedMode = r?.mode === 'normal' || r?.mode === 'daily' || r?.mode === 'timed';
  if (!net.RANKING_ENABLED || !r || !rankedMode || game.sandbox) return rankingUI.offerPublish(null);
  if (r.noRank) return net.loadPlayer() ? rankingUI.offerUnavailable(r.unranked ?? '') : rankingUI.offerPublish(null);
  if (r.mode !== 'daily' && !r.runId) {
    // sin partida del servidor no hay ranking: avisa solo a quien ya tiene apodo (a los demás les sobra el aviso)
    return net.loadPlayer() ? rankingUI.offerUnavailable(r.unranked ?? 'Sin conexión al empezar: esta partida no cuenta para el ranking.') : rankingUI.offerPublish(null);
  }
  const done: FinishedRun = { replay: game.replay(), score: game.score, mode: r.mode, date: r.date, runId: r.runId };
  rankingUI.offerPublish(done);
}

const fmtNum = (n: number) => Math.round(n).toLocaleString('es-ES');
const pauseMsg = document.getElementById('pause-msg')!;
const saveExitBtn = document.getElementById('save-exit')!;
const quitBtn = document.getElementById('quit-btn')!;
const QUIT_LABEL = 'Salir sin guardar';
let quitTimer = 0;

function disarmQuit() {
  window.clearTimeout(quitTimer);
  quitBtn.querySelector('span')!.textContent = QUIT_LABEL;
  delete quitBtn.dataset.armed;
}

/** Se puede guardar y reanudar una partida normal, diaria, contrarreloj o de Expedición (no el tutorial ni el laboratorio). */
const canSave = () => currentRun !== null && !game.sandbox && game.mode !== 'tutorial';

function setPaused(p: boolean) {
  ui.setPaused(p);
  disarmQuit();
  pauseMsg.hidden = true;
  if (p) saveExitBtn.hidden = !canSave();
}

/** Partida guardada que espera en la portada (null si no hay). */
let saved: SavedRun | null = null;
const saveNote = document.getElementById('home-save-note')!;
const resumeBox = document.getElementById('home-resume-box')!;

function renderResume(note?: string) {
  resumeBox.hidden = !saved;
  if (saved) {
    document.getElementById('home-resume-text')!.innerHTML =
      `Continuar partida<small>${MODES[modeOf(saved)].name} · nivel ${saved.level} · ${fmtNum(saved.score)} puntos</small>`;
  }
  if (note !== undefined) {
    saveNote.textContent = note;
    saveNote.hidden = !note;
  }
}

function reloadSave() {
  const l = loadSave();
  saved = l.run;
  renderResume(l.discarded ?? '');
}

/** Pausa → guardar la partida y volver a la portada. */
function saveAndExit() {
  if (game.state !== 'paused' || !currentRun || !canSave()) return;
  const r = currentRun;
  const run: SavedRun = {
    v: 1,
    rules: RULES_VERSION,
    replay: game.replay(),
    date: r.date,
    runId: r.runId,
    upgrades: r.exp?.owned,
    unlocked: r.exp?.unlocked,
    startedAt: r.startedAt,
    savedAt: Date.now(),
    score: game.score,
    level: game.level,
  };
  if (!writeSave(run)) {
    pauseMsg.textContent = 'No se ha podido guardar: el navegador no deja escribir (¿sin espacio o en modo privado?). La partida sigue aquí.';
    pauseMsg.hidden = false;
    return;
  }
  // la partida sigue viva en el guardado: no cuenta como abandonada ni se envían sus estadísticas
  stats.discard();
  leaveRun();
  reloadSave();
}

/** Pausa → salir a la portada tirando la partida. */
function quitRun() {
  stats.finish('quit');
  leaveRun();
  renderResume();
}

function leaveRun() {
  settingsUI.close();
  game.reset();
  currentRun = null;
  input.releaseAll();
  gestures?.reset();
  mouse?.hide();
  ui.setPaused(false);
  disarmQuit();
  showHome(true);
}

/** Retoma la partida guardada: la vuelve a simular hasta donde se dejó y la deja en pausa. */
function resumeRun() {
  if (starting) return;
  // otra pestaña pudo cambiar o gastar el guardado
  const l = loadSave();
  saved = l.run;
  if (!l.run) return renderResume(l.discarded ?? 'Ya no hay partida guardada.');
  const run = l.run;
  lab.close();
  tutorial.stop();
  showHome(false);
  audio.init();
  input.releaseAll();
  gestures?.reset();
  mouse?.hide();
  hitstop = 0;
  stepAcc = 0;
  renderer.reset();
  stats.discard();
  ui.startGame(run.date);
  const res = replayInto(game, run.replay, run.upgrades ?? {}, run.unlocked ?? []);
  if (!res.ok) {
    clearSave();
    game.reset();
    showHome(true);
    saved = null;
    return renderResume(`No se ha podido reanudar la partida guardada (${res.reason}). Se ha descartado.`);
  }
  // se borra al reanudar: así no se puede recargar para deshacer una mala decisión
  clearSave();
  saved = null;
  // el servidor da por caducada una partida con ranking a las 6 h de pedirla (hasta el envío, no hasta reanudarla):
  // con menos de 1 h de margen no daría tiempo a jugar y publicar
  const stale = run.runId !== undefined && Date.now() - run.startedAt > RUN_TTL_MS - 3_600_000;
  // y el diario solo admite hoy y ayer
  const dayAge = (Date.parse(net.dailyDate()) - Date.parse(run.date)) / 86_400_000;
  const oldDaily = modeOf(run) === 'daily' && !(dayAge <= 1);
  const unranked = stale
    ? 'Esta partida se guardó hace demasiado tiempo: el servidor ya no la admite en el ranking.'
    : oldDaily
      ? 'El desafío diario de esta partida ya pasó: no cuenta para el ranking.'
      : undefined;
  currentRun = {
    mode: modeOf(run),
    date: run.date,
    runId: stale ? undefined : run.runId,
    startedAt: run.startedAt,
    exp: run.upgrades ? { owned: run.upgrades, unlocked: run.unlocked ?? [] } : undefined,
    unranked,
    noRank: oldDaily,
  };
  renderResume('');
  audio.setIntensity(game.level);
  audio.startMusic();
  game.togglePause();
  setPaused(true);
}

async function startRun(forced?: 'tutorial' | 'expedition') {
  if (starting) return;
  starting = true;
  const mode = forced ?? modeSelect.mode;
  // empezar cualquier partida (también el tutorial) cierra la primera visita: la portada vuelve a la de siempre
  markPlayed();
  // el diario se fija al empezar: si pasa la medianoche jugando, sigue siendo el mismo desafío
  // la fecha la da el servidor si responde (un reloj mal puesto no cambia el desafío); si no, la del reloj local
  if (mode === 'daily') await net.serverDay(1500);
  const date = net.dailyDate();
  // las partidas libres con ranking usan la semilla y los desbloqueos del servidor; si falla, se juega sin ranking
  let ranked: net.RankedStart | null = null;
  if (net.RANKING_ENABLED && (mode === 'normal' || mode === 'timed') && net.loadPlayer()) {
    try {
      ranked = await net.startRanked(mode);
    } catch {
      ranked = null;
    }
  }
  starting = false;
  lab.close();
  tutorial.stop();
  showHome(false);
  audio.init();
  audio.setIntensity(1);
  audio.startMusic();
  input.releaseAll();
  gestures?.reset();
  mouse?.hide();
  hitstop = 0;
  stepAcc = 0;
  renderer.reset();
  game.bestLevel = ranked ? ranked.bestLevel : loadMeta().bestLevel;
  // el tutorial siempre reparte igual: mismas piezas y mismas cartas
  const seed = mode === 'daily' ? dailySeed(date) : mode === 'tutorial' ? TUTORIAL_SEED : ranked ? ranked.seed : randomSeed();
  const exp = mode === 'expedition' ? loadExpedition() : null;
  stats.begin();
  game.start(seed, mode, exp?.owned ?? {}, exp?.unlocked ?? []);
  currentRun = { mode, date, runId: ranked?.runId, startedAt: Date.now(), exp: exp ? { owned: exp.owned, unlocked: [...exp.unlocked] } : undefined };
  ui.startGame(date);
  if (mode === 'tutorial') tutorial.start();
}

const fxToggle = document.getElementById('fx-toggle')!;

/** Efectos de pantalla (shaders): se guardan, y un equipo lento los apaga solo. */
function setEffects(on: boolean, save = true) {
  renderer.highQuality = on;
  renderer.applyQuality();
  fxToggle.setAttribute('aria-pressed', String(on));
  fxToggle.querySelector('span')!.textContent = on ? 'Efectos: sí' : 'Efectos: no';
  if (!save) return;
  try { localStorage.setItem('blockrogue.fx', on ? '1' : '0'); } catch { /* sin almacenamiento */ }
}

function onKeyDown(e: KeyboardEvent) {
  const st = game.state;

  // los ajustes abiertos se quedan con el teclado (las teclas del juego no cuentan); Esc los cierra
  if (settingsUI.isOpen) {
    if (e.code === 'Escape' && !e.repeat) settingsUI.escape();
    return;
  }

  // escribiendo en el buscador del laboratorio las teclas del juego no cuentan
  if (lab.isOpen && (e.target as HTMLElement | null)?.closest('input, select') && e.code !== 'Escape') return;

  // escribiendo el apodo, o con la tabla abierta: las teclas son de la interfaz, no del juego
  if (rankingUI.isOpen || (e.target as HTMLElement | null)?.closest?.('input, textarea, #publish')) return;

  // globales
  if (e.code === 'KeyM' && !e.repeat) { audio.toggleMusic(); return; }
  if (e.code === 'KeyN' && !e.repeat) { audio.toggleMute(); return; }
  if (e.code === 'KeyF' && !e.repeat) {
    setEffects(!renderer.highQuality);
    return;
  }

  if (st === 'ready' || st === 'over') {
    // en el catálogo no se arranca partida: Esc vuelve a la portada
    if (!catalog.classList.contains('hidden')) {
      if (e.code === 'Escape') showCatalog(false);
      return;
    }
    // la pantalla de la Expedición: Enter juega, Esc vuelve
    if (!expScreen.classList.contains('hidden')) {
      if (e.code === 'Escape') showExpedition(false);
      else if (e.code === 'Enter' && !e.repeat && !(e.target as HTMLElement | null)?.closest('button')) void startRun('expedition');
      return;
    }
    // con la portada visible, Espacio desplaza la página: solo Enter arranca
    const homeOpen = !home.classList.contains('hidden');
    if ((e.code === 'Enter' || (e.code === 'Space' && !homeOpen)) && !e.repeat) {
      e.preventDefault();
      if (st === 'over' && endPressBlocked()) return;
      // tras fallar el tutorial, Enter lo repite; el resto de veces, la partida elegida en la portada
      void startRun(st === 'over' && (game.mode === 'tutorial' || game.mode === 'expedition') ? game.mode : undefined);
    }
    return;
  }

  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
    if (lab.isOpen) { lab.close(); return; }
    if (st === 'playing' || st === 'paused') {
      game.togglePause();
      input.releaseAll();
      setPaused(game.state === 'paused');
    }
    return;
  }

  if (st === 'choosing') {
    if (e.repeat) return;
    if (e.code === 'Digit1' || e.code === 'Numpad1') ui.pick(0);
    else if (e.code === 'Digit2' || e.code === 'Numpad2') ui.pick(1);
    else if (e.code === 'Digit3' || e.code === 'Numpad3') ui.pick(2);
    else if (e.code === 'Digit4' || e.code === 'Numpad4') ui.pick(3);
    else if (e.code === 'KeyR') ui.reroll();
    e.preventDefault();
    return;
  }

  if (st === 'playing' && input.keyDown(e)) {
    mouse?.hide();
    e.preventDefault();
  }
}

async function boot() {
  await Promise.allSettled([
    document.fonts.load('16px "Press Start 2P"'),
    document.fonts.load('16px VT323'),
  ]);

  const { s: scale } = layout();
  await renderer.init(canvas, renderResolution(scale));

  window.addEventListener('resize', () => {
    // con el teclado del apodo abierto el alto se encoge: no se recompone hasta que se cierre
    if (document.activeElement?.matches('input, textarea')) return;
    const { s, changed } = layout();
    if (changed) renderer.relayout(renderResolution(s));
    else renderer.setResolution(renderResolution(s));
  });
  let fxOn = true;
  try { fxOn = localStorage.getItem('blockrogue.fx') !== '0'; } catch { /* sin almacenamiento */ }
  setEffects(fxOn, false);
  renderer.onAutoOff = () => setEffects(false, false);
  fxToggle.addEventListener('click', () => { setEffects(!renderer.highQuality); fxToggle.blur(); });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (e) => input.keyUp(e));
  window.addEventListener('blur', () => {
    input.releaseAll();
    if (game.state === 'playing') {
      game.togglePause();
      setPaused(true);
    }
  });
  renderCatalog(catalog);
  renderKeyHints();
  reloadSave();
  document.getElementById('settings-open')!.addEventListener('click', (e) => settingsUI.open(e.currentTarget as HTMLElement));
  document.getElementById('settings-open-home')!.addEventListener('click', (e) => settingsUI.open(e.currentTarget as HTMLElement));
  saveExitBtn.addEventListener('click', saveAndExit);
  quitBtn.addEventListener('click', () => {
    // dos pasos: tirar la partida no se puede deshacer
    if (quitBtn.dataset.armed) return quitRun();
    quitBtn.dataset.armed = '1';
    quitBtn.querySelector('span')!.textContent = '¿Seguro? Se pierde';
    quitTimer = window.setTimeout(disarmQuit, 4000);
  });
  document.getElementById('home-resume')!.addEventListener('click', resumeRun);
  const drop = document.getElementById('home-resume-drop')!;
  drop.addEventListener('click', () => {
    if (drop.dataset.armed) {
      clearSave();
      saved = null;
      delete drop.dataset.armed;
      drop.textContent = 'Descartar partida guardada';
      return renderResume('');
    }
    drop.dataset.armed = '1';
    drop.textContent = '¿Seguro? Pulsa otra vez para descartarla';
    window.setTimeout(() => {
      delete drop.dataset.armed;
      drop.textContent = 'Descartar partida guardada';
    }, 4000);
  });
  document.getElementById('catalog-open')!.addEventListener('click', () => showCatalog(true));
  document.getElementById('catalog-back')!.addEventListener('click', () => showCatalog(false));
  wireExpedition(expScreen);
  for (const id of ['home-exp', 'exp-open']) document.getElementById(id)!.addEventListener('click', () => showExpedition(true));
  document.getElementById('exp-back')!.addEventListener('click', () => showExpedition(false));
  document.getElementById('exp-play')!.addEventListener('click', () => void startRun('expedition'));
  const labBtn = document.getElementById('lab-open')!;
  labBtn.hidden = !LAB_ENABLED;
  labBtn.addEventListener('click', () => lab.open());
  document.getElementById('home-play')!.addEventListener('click', () => void startRun());
  document.getElementById('home-tutorial')!.addEventListener('click', () => void startRun('tutorial'));
  document.getElementById('home-more-link')!.addEventListener('click', () => {
    document.getElementById('home-more')!.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  if (net.RANKING_ENABLED) {
    const entry = document.getElementById('home-rank')!;
    entry.classList.remove('is-locked');
    entry.querySelector('.home-soon')!.remove();
    entry.querySelector('.lock-ico')?.remove();
    const open = document.getElementById('rank-open')!;
    open.hidden = false;
    open.addEventListener('click', () => rankingUI.open());
  }
  // la política de privacidad viene con el juego; VITE_PRIVACY_URL solo sirve para apuntar a otra
  const a = document.getElementById('privacy-link') as HTMLAnchorElement;
  a.href = import.meta.env.VITE_PRIVACY_URL || '/privacidad.html';
  a.hidden = false;
  document.getElementById('home-btn')!.addEventListener('click', () => showHome(true));
  document.getElementById('retry-btn')!.addEventListener('click', () => {
    if (endPressBlocked()) return;
    void startRun(game.mode === 'expedition' ? 'expedition' : undefined);
  });

  wireAudioAndFeel();
  wireTouch();
  showHome(true);

  renderer.app.ticker.add((t) => {
    const dt = Math.min(t.deltaMS, 50);
    if (game.state === 'choosing' && !ui.isChoosing) {
      input.releaseAll();
      gestures?.reset();
  mouse?.hide();
      ui.openPerks();
    }
    input.update(dt);
    mouse?.update();
    renderer.preview = mouse?.preview ?? null;
    if (hitstop > 0) hitstop -= dt;
    else {
      // la partida avanza a paso fijo para que se pueda rejugar igual en cualquier equipo
      stepAcc += dt;
      while (stepAcc >= STEP_MS) {
        stepAcc -= STEP_MS;
        game.step();
      }
    }
    renderer.render(dt);
    ui.update(dt);
    tutorial.update();
  });

  document.body.classList.add('ready');

  if (import.meta.env.DEV) Object.assign(window, { __game: game, __renderer: renderer });
}

void boot();

document.querySelectorAll('[data-version]').forEach((el) => (el.textContent = __APP_VERSION__));
