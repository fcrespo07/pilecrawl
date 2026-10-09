import './style.css';
import './storage';
import { Game, STEP_MS } from './core/game';
import { audio } from './fx/audio';
import { H, W } from './fx/layout';
import { Renderer } from './fx/renderer';
import { loadMeta, recordBestLevel } from './core/meta';
import { dailySeed, utcDate } from './core/modes';
import { randomSeed } from './core/rng';
import { loadLastMode, saveLastMode } from './records';
import { ModeSelect } from './ui/modeSelect';
import { Input, type TouchAction } from './input';
import { UI } from './ui/ui';

const game = new Game();
const renderer = new Renderer(game);
const input = new Input(game);
const ui = new UI(game);

const stage = document.getElementById('stage')!;
const modeSelect = new ModeSelect(document.getElementById('mode-select')!, loadLastMode(), saveLastMode);
const canvas = document.getElementById('game') as HTMLCanvasElement;

/** Alto que ocupa la barra táctil cuando está visible; el escenario se encaja por encima de ella. */
function touchReserve(): number {
  const bar = document.getElementById('touch');
  return bar && getComputedStyle(bar).display !== 'none' ? bar.offsetHeight : 0;
}

function renderResolution(scale: number) {
  return Math.min(3, (window.devicePixelRatio || 1) * scale);
}

function layout() {
  const reserve = touchReserve();
  const avail = window.innerHeight - reserve;
  const s = Math.min(window.innerWidth / W, avail / H);
  stage.style.top = `${avail / 2}px`;
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  return s;
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
    recordBestLevel(level);
  });
  ev.on('revive', () => audio.revive());
  ev.on('gameover', () => {
    audio.stopMusic();
    audio.gameOver();
    ui.showGameOver();
    modeSelect.refresh();
  });
}

/** Botones táctiles: cada uno reutiliza la misma lógica que su tecla. */
function wireTouch() {
  document.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((btn) => {
    const action = btn.dataset.touch as TouchAction | 'pause';
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      if (action === 'pause') {
        if (game.state === 'playing' || game.state === 'paused') {
          game.togglePause();
          input.releaseAll();
          ui.setPaused(game.state === 'paused');
        }
        return;
      }
      input.touchDown(action);
    });
    if (action === 'pause') return;
    const up = () => input.touchUp(action);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
  });
}

const home = document.getElementById('home')!;

function showHome(show: boolean) {
  home.classList.toggle('hidden', !show);
  // detrás de la portada nada debe recibir foco ni dibujarse
  stage.inert = show;
  if (show) {
    // la portada siempre con la piel de base: la de los perks es de la partida y el ticker (que la pone) se para
    document.body.dataset.skin = 'pixel';
    renderer.app.ticker.stop();
    modeSelect.refresh();
    home.scrollTop = 0;
    home.focus({ preventScroll: true });
  } else renderer.app.ticker.start();
}

function startRun() {
  showHome(false);
  audio.init();
  audio.setIntensity(1);
  audio.startMusic();
  input.releaseAll();
  hitstop = 0;
  stepAcc = 0;
  renderer.reset();
  game.bestLevel = loadMeta().bestLevel;
  // el diario se fija al empezar: si pasa la medianoche jugando, sigue siendo el mismo desafío
  const mode = modeSelect.mode;
  const date = utcDate();
  game.start(mode === 'daily' ? dailySeed(date) : randomSeed(), mode);
  ui.startGame(date);
}

function onKeyDown(e: KeyboardEvent) {
  const st = game.state;

  // globales
  if (e.code === 'KeyM' && !e.repeat) { audio.toggleMusic(); return; }
  if (e.code === 'KeyN' && !e.repeat) { audio.toggleMute(); return; }
  if (e.code === 'KeyF' && !e.repeat) {
    renderer.highQuality = !renderer.highQuality;
    renderer.applyQuality();
    return;
  }

  if (st === 'ready' || st === 'over') {
    // con la portada visible, Espacio desplaza la página: solo Enter arranca
    const homeOpen = !home.classList.contains('hidden');
    if ((e.code === 'Enter' || (e.code === 'Space' && !homeOpen)) && !e.repeat) {
      e.preventDefault();
      startRun();
    }
    return;
  }

  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
    if (st === 'playing' || st === 'paused') {
      game.togglePause();
      input.releaseAll();
      ui.setPaused(game.state === 'paused');
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

  if (st === 'playing' && input.keyDown(e)) e.preventDefault();
}

async function boot() {
  await Promise.allSettled([
    document.fonts.load('16px "Press Start 2P"'),
    document.fonts.load('16px VT323'),
  ]);

  const scale = layout();
  await renderer.init(canvas, renderResolution(scale));

  window.addEventListener('resize', () => {
    const s = layout();
    renderer.setResolution(renderResolution(s));
  });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (e) => input.keyUp(e));
  window.addEventListener('blur', () => {
    input.releaseAll();
    if (game.state === 'playing') {
      game.togglePause();
      ui.setPaused(true);
    }
  });
  document.getElementById('home-play')!.addEventListener('click', startRun);
  document.getElementById('home-btn')!.addEventListener('click', () => showHome(true));
  document.getElementById('retry-btn')!.addEventListener('click', startRun);

  wireAudioAndFeel();
  wireTouch();
  showHome(true);

  renderer.app.ticker.add((t) => {
    const dt = Math.min(t.deltaMS, 50);
    if (game.state === 'choosing' && !ui.isChoosing) {
      input.releaseAll();
      ui.openPerks();
    }
    input.update(dt);
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
  });

  document.body.classList.add('ready');

  if (import.meta.env.DEV) Object.assign(window, { __game: game, __renderer: renderer });
}

void boot();

document.querySelectorAll('[data-version]').forEach((el) => (el.textContent = __APP_VERSION__));
