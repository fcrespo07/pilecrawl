// Entrenador del tutorial: una partida real del modo `tutorial` (ver `modes.ts`) con un cuadro de
// consejos que avanza según lo que haces. No toca las reglas: solo escucha los eventos del juego.
import { Game, TUTORIAL_HYPER_CHARGE, TUTORIAL_LINES } from '../core/game';
import { keyLabels, type Action } from '../settings';
import { L } from '../i18n';

interface Progress {
  moves: number;
  drops: number;
  rotates: number;
  levelups: number;
  perks: number;
  hyperPicked: boolean;
  hyperUsed: boolean;
}

interface Step {
  /** Qué se enseña, para la cabecera del cuadro. */
  title: () => string;
  text: (t: Texts, g: Game) => string;
  /** Pasos ya cumplidos se saltan solos, así que cada uno comprueba su condición y no un contador. */
  done: (p: Progress, g: Game) => boolean;
}

/** Nombres de los controles según haya teclado o botones táctiles. */
interface Texts {
  move: string;
  drop: string;
  turn: string;
  turnBack: string;
  hold: string;
  reroll: string;
  hyper: string;
  /** `hold` es ya una frase entera (táctil) y no una tecla. */
  holdIsSentence?: boolean;
}

const kbd = (s: string) => `<kbd>${s}</kbd>`;
const k = (a: Action, max = 1) => keyLabels(a, max).map(kbd).join(L(' o ', ' or ')) || kbd('–');
/** Textos con las teclas que tenga el jugador ahora (se pueden cambiar en Ajustes). */
const desktop = (): Texts => ({
  move: L('con ', 'with ') + kbd(keyLabels('left')[0] ?? '–') + kbd(keyLabels('right')[0] ?? '–'),
  drop: k('hard'),
  turn: k('cw', 2),
  turnBack: k('ccw'),
  hold: k('hold'),
  reroll: kbd('R'),
  hyper: k('hyper'),
});
const touchTexts = (): Texts => ({
  move: L('arrastrando el dedo a los lados', 'dragging your finger sideways'),
  drop: L('un tirón rápido hacia abajo (arrastrar despacio la baja poco a poco)', 'a quick flick down (dragging slowly lowers it gradually)'),
  turn: L('un toque en el tablero', 'a tap on the board'),
  turnBack: '',
  hold: L('Desliza hacia arriba para guardar una pieza en la reserva (o toca la reserva).', 'Swipe up to put a piece in the hold (or tap the hold).'),
  reroll: 'Reroll',
  hyper: L('la tarjeta Hiper (tócala)', 'the Hyper card (tap it)'),
  holdIsSentence: true,
});

const STEPS: Step[] = [
  {
    title: () => L('Mover', 'Move'),
    text: (t) => L(`Lleva la pieza al hueco de la derecha ${t.move}.`, `Move the piece to the gap on the right ${t.move}.`),
    done: (p) => p.moves >= 2 || p.levelups >= 1,
  },
  {
    title: () => L('Soltar', 'Drop'),
    text: (t) => L(`Suéltala de golpe con ${t.drop}. Encaja justo: <b>dos líneas</b> a la vez.`, `Drop it at once with ${t.drop}. It fits exactly: <b>two lines</b> at the same time.`),
    done: (p) => p.drops >= 1 || p.levelups >= 1,
  },
  {
    title: () => L('Girar', 'Rotate'),
    text: (t) => L(`Las demás piezas giran con ${t.turn}${t.turnBack ? ` (${t.turnBack} al revés)` : ''}. Gira esta y suéltala.`, `The other pieces rotate with ${t.turn}${t.turnBack ? ` (${t.turnBack} the other way)` : ''}. Rotate this one and drop it.`),
    done: (p) => p.rotates >= 1 || p.levelups >= 1,
  },
  {
    title: () => L('Líneas', 'Lines'),
    text: (t, g) =>
      L(
        `Completa filas para subir de nivel: <b>${g.linesIntoLevel}/${TUTORIAL_LINES}</b>. Varias a la vez puntúan mucho más. ${t.holdIsSentence ? t.hold : `${t.hold} guarda una pieza en la reserva.`}`,
        `Complete rows to level up: <b>${g.linesIntoLevel}/${TUTORIAL_LINES}</b>. Several at once score much more. ${t.holdIsSentence ? t.hold : `${t.hold} puts a piece in the hold.`}`,
      ),
    done: (p) => p.levelups >= 1,
  },
  {
    title: () => L('Mejoras', 'Upgrades'),
    text: (t) =>
      L(
        `Eliges <b>1 de 3 mejoras</b>: verde es la ventaja y rojo, su precio. Se acumulan y se combinan. ${t.reroll} cambia las cartas (1 gratis, y otro más cada 5 niveles).`,
        `You pick <b>1 of 3 upgrades</b>: green is the benefit and red is its price. They stack and combine. ${t.reroll} swaps the cards (1 free, and one more every 5 levels).`,
      ),
    done: (p) => p.perks >= 1,
  },
  {
    title: () => L('Racha', 'Streak'),
    text: (_t, g) =>
      L(
        `Mira la <b>Racha</b> (a la derecha): sube con líneas seguidas y baja con cada pieza. Más racha, cartas más raras. Siguiente nivel: <b>${g.linesIntoLevel}/${TUTORIAL_LINES}</b>.`,
        `Look at the <b>Streak</b> (on the right): it rises with clears in a row and drops with each piece. More streak, rarer cards. Next level: <b>${g.linesIntoLevel}/${TUTORIAL_LINES}</b>.`,
      ),
    done: (p) => p.levelups >= 2,
  },
  {
    title: () => L('Hiperperk', 'Hyper perk'),
    text: () =>
      L(
        `Una <b>hiperperk</b> es una habilidad activa, una por partida. Sale con suerte (más con racha) y seguro en el nivel 8; aquí te regalamos una.`,
        `A <b>hyper perk</b> is an active ability, one per run. It comes up by luck (more with streak) and guaranteed at level 8; here we give you one.`,
      ),
    done: (p) => p.hyperPicked,
  },
  {
    title: () => L('Más mejoras', 'More upgrades'),
    text: () =>
      L(
        `Ahora tu mejora normal. Desde el nivel 5 hay <b>ofertas malditas</b>: solo maldiciones, eliges la menos mala y la siguiente oferta es rara o mejor.`,
        `Now your normal upgrade. From level 5 there are <b>cursed offers</b>: only curses, you pick the least bad and the next offer is rare or better.`,
      ),
    done: (p) => p.perks >= 2,
  },
  {
    title: () => L('Carga', 'Charge'),
    text: (_t, g) => L(`La hiperperk se carga limpiando líneas: <b>${g.hyperCharge}/${TUTORIAL_HYPER_CHARGE}</b> (en una partida normal piden entre 10 y 20).`, `The hyper perk charges by clearing lines: <b>${g.hyperCharge}/${TUTORIAL_HYPER_CHARGE}</b> (in a normal run it takes between 10 and 20).`),
    done: (p, g) => p.hyperUsed || g.hyperReady(),
  },
  {
    title: () => L('Soltarla', 'Fire it'),
    text: (t) => L(`¡Lista! Púlsala con ${t.hyper}. Tú decides cuándo: el truco es guardarla para un mal momento.`, `Ready! Fire it with ${t.hyper}. You decide when: the trick is to save it for a bad moment.`),
    done: (p) => p.hyperUsed,
  },
];

const OFFER_STEP = 4;
const HYPER_STEP = 6;
const OFFER2_STEP = 7;

const $ = (id: string) => document.getElementById(id)!;

export interface TutorialHooks {
  /** Empezar una partida normal. */
  onPlay: () => void;
  onRetry: () => void;
  onHome: () => void;
  /** El tutorial se ha completado (se guarda para dejar de recomendarlo). */
  onDone: () => void;
}

export class Tutorial {
  private active = false;
  private p: Progress = { moves: 0, drops: 0, rotates: 0, levelups: 0, perks: 0, hyperPicked: false, hyperUsed: false };
  private key = '';
  private doneSent = false;

  constructor(private game: Game, private hooks: TutorialHooks) {
    const ev = game.events;
    ev.on('move', () => this.active && this.p.moves++);
    ev.on('harddrop', () => this.active && this.p.drops++);
    ev.on('rotate', () => this.active && this.p.rotates++);
    ev.on('levelup', () => this.active && this.p.levelups++);
    ev.on('perk', () => this.active && this.p.perks++);
    ev.on('hyperPick', () => this.active && (this.p.hyperPicked = true));
    ev.on('hyper', () => this.active && (this.p.hyperUsed = true));
    document.querySelectorAll('.coach').forEach((el) => {
      el.addEventListener('click', (e) => {
        const act = (e.target as HTMLElement).closest<HTMLElement>('[data-coach]')?.dataset.coach;
        if (act === 'skip' || act === 'home') this.hooks.onHome();
        else if (act === 'play') this.hooks.onPlay();
        else if (act === 'retry') this.hooks.onRetry();
      });
    });
  }

  get isActive() {
    return this.active;
  }

  start() {
    this.active = true;
    this.doneSent = false;
    this.p = { moves: 0, drops: 0, rotates: 0, levelups: 0, perks: 0, hyperPicked: false, hyperUsed: false };
    this.key = '';
    this.setVisible(true);
  }

  stop() {
    this.active = false;
    this.setVisible(false);
  }

  private setVisible(v: boolean) {
    document.body.classList.toggle('tutorial', v);
    document.querySelectorAll<HTMLElement>('.coach').forEach((el) => (el.hidden = !v));
  }

  /** Paso que toca ahora. Con una elección de cartas abierta, manda la elección. */
  private current(): number {
    const g = this.game;
    let i = STEPS.findIndex((s) => !s.done(this.p, g));
    if (i < 0) return STEPS.length;
    // con las cartas abiertas manda la elección; si ya se vieron las dos de tutorial, es una más
    if (g.state === 'choosing') {
      if (g.choosingHyper) return HYPER_STEP;
      if (!this.p.hyperPicked) return OFFER_STEP;
      if (this.p.perks < 2) return OFFER2_STEP;
    }
    return i;
  }

  update() {
    if (!this.active) return;
    const g = this.game;
    const touch = getComputedStyle($('touch')).display !== 'none';
    let body: string;
    let title: string;
    let actions = '';
    let state = 'step';
    if (g.state === 'over') {
      state = 'fail';
      title = L('Sin sitio', 'No room');
      body = L('El tablero se ha llenado. Pasa en las partidas de verdad: aquí puedes repetir cuando quieras.', 'The board is full. It happens in real runs: here you can retry whenever you like.');
      actions = `<button type="button" class="coach-btn" data-coach="retry">${L('Repetir', 'Retry')}</button><button type="button" class="coach-btn ghost" data-coach="home">${L('Inicio', 'Home')}</button>`;
    } else {
      const i = this.current();
      if (i >= STEPS.length) {
        state = 'end';
        title = L('¡Listo!', 'Done!');
        body =
          L(
            'Ya sabes lo esencial: líneas, mejoras con precio, racha e hiperperk. Lo demás son combinaciones: se aprende jugando.',
            'You know the essentials: lines, upgrades with a price, streak and hyper perk. The rest is combinations: you learn by playing.',
          );
        actions = `<button type="button" class="coach-btn" data-coach="play">${L('Jugar partida', 'Play a run')}</button><button type="button" class="coach-btn ghost" data-coach="home">${L('Inicio', 'Home')}</button>`;
        if (!this.doneSent) {
          this.doneSent = true;
          this.hooks.onDone();
        }
      } else {
        const extraOffer = g.state === 'choosing' && i > OFFER2_STEP;
        title = `${i + 1}/${STEPS.length} · ${extraOffer ? L('Mejoras', 'Upgrades') : STEPS[i].title()}`;
        body = extraOffer
          ? L('Otro nivel, otra mejora: cada elección cambia lo que te conviene después.', 'Another level, another upgrade: each pick changes what suits you next.')
          : STEPS[i].text(touch ? touchTexts() : desktop(), g);
        actions = `<button type="button" class="coach-skip" data-coach="skip">${L('Salir', 'Exit')}</button>`;
      }
    }
    // con las cartas abiertas el cuadro se pone en una tira abajo para no tapar ninguna
    const wide = state === 'step' && g.state === 'choosing';
    const key = `${state}|${title}|${body}|${g.state === 'paused'}|${wide}`;
    if (key === this.key) return;
    this.key = key;
    document.querySelectorAll<HTMLElement>('.coach').forEach((el) => {
      el.dataset.state = state;
      el.classList.toggle('paused', g.state === 'paused');
      el.classList.toggle('wide', wide);
      el.innerHTML = `<div class="coach-head">${L('Tutorial', 'Tutorial')} <span>${title}</span></div><p class="coach-text">${body}</p><div class="coach-actions">${actions}</div>`;
    });
  }
}
