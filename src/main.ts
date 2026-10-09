import './style.css';
import { Game } from './core/game';
import { audio } from './fx/audio';
import { H, W } from './fx/layout';
import { Renderer } from './fx/renderer';
import { Input } from './input';
import { UI } from './ui/ui';

const game = new Game();
const renderer = new Renderer(game);
const input = new Input(game);
const ui = new UI(game);

const stage = document.getElementById('stage')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;

function fitScale() {
  return Math.min(window.innerWidth / W, window.innerHeight / H);
}

function renderResolution(scale: number) {
  return Math.min(3, (window.devicePixelRatio || 1) * scale);
}

function layout() {
  const s = fitScale();
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  return s;
}

let hitstop = 0;

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
  ev.on('quake', () => audio.quake());
  ev.on('garbage', () => audio.garbage());
  ev.on('levelup', ({ level }) => {
    setTimeout(() => audio.levelUp(), 120);
    audio.setIntensity(level);
  });
  ev.on('revive', () => audio.revive());
  ev.on('gameover', () => {
    audio.stopMusic();
    audio.gameOver();
    ui.showGameOver();
  });
}

function startRun() {
  audio.init();
  audio.setIntensity(1);
  audio.startMusic();
  input.releaseAll();
  hitstop = 0;
  renderer.reset();
  game.start();
  ui.startGame();
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
    if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
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
    else if (e.code === 'KeyR') ui.reroll();
    e.preventDefault();
    return;
  }

  if (st === 'playing' && input.keyDown(e)) e.preventDefault();
}

async function boot() {
  await Promise.allSettled([
    document.fonts.load('32px Bungee'),
    document.fonts.load('700 16px "Chakra Petch"'),
    document.fonts.load('400 16px "Chakra Petch"'),
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
  document.getElementById('start-btn')!.addEventListener('click', startRun);
  document.getElementById('retry-btn')!.addEventListener('click', startRun);

  wireAudioAndFeel();

  renderer.app.ticker.add((t) => {
    const dt = Math.min(t.deltaMS, 50);
    if (game.state === 'choosing' && !ui.isChoosing) {
      input.releaseAll();
      ui.openPerks();
    }
    input.update(dt);
    if (hitstop > 0) hitstop -= dt;
    else game.update(dt);
    renderer.render(dt);
    ui.update(dt);
  });

  document.body.classList.add('ready');

  if (import.meta.env.DEV) Object.assign(window, { __game: game, __renderer: renderer });
}

void boot();
