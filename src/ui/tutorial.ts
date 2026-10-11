// Entrenador del tutorial: una partida real del modo `tutorial` (ver `modes.ts`) con un cuadro de
// consejos que avanza según lo que haces. No toca las reglas: solo escucha los eventos del juego.
import { Game, TUTORIAL_HYPER_CHARGE, TUTORIAL_LINES } from '../core/game';

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
  title: string;
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
}

const kbd = (s: string) => `<kbd>${s}</kbd>`;
const DESKTOP: Texts = {
  move: 'con ' + kbd('←') + kbd('→'),
  drop: kbd('Espacio'),
  turn: kbd('↑') + ' o ' + kbd('X'),
  turnBack: kbd('Z'),
  hold: kbd('C'),
  reroll: kbd('R'),
  hyper: kbd('D'),
};
const TOUCH: Texts = {
  move: 'arrastrando el dedo a los lados',
  drop: 'un tirón rápido hacia abajo (arrastrar despacio la baja poco a poco)',
  turn: 'un toque en el tablero',
  turnBack: '',
  hold: 'Desliza hacia arriba para guardar una pieza en la reserva (o toca la reserva).',
  reroll: 'Reroll',
  hyper: 'la tarjeta Hiper (tócala)',
};

const STEPS: Step[] = [
  {
    title: 'Mover',
    text: (t) => `Lleva la pieza al hueco de la derecha ${t.move}.`,
    done: (p) => p.moves >= 2 || p.levelups >= 1,
  },
  {
    title: 'Soltar',
    text: (t) => `Suéltala de golpe con ${t.drop}. Encaja justo: <b>dos líneas</b> a la vez.`,
    done: (p) => p.drops >= 1 || p.levelups >= 1,
  },
  {
    title: 'Girar',
    text: (t) => `Las demás piezas giran con ${t.turn}${t.turnBack ? ` (${t.turnBack} al revés)` : ''}. Gira esta y suéltala.`,
    done: (p) => p.rotates >= 1 || p.levelups >= 1,
  },
  {
    title: 'Líneas',
    text: (t, g) =>
      `Completa filas para subir de nivel: <b>${g.linesIntoLevel}/${TUTORIAL_LINES}</b>. Varias a la vez puntúan mucho más. ${t.hold === DESKTOP.hold ? `${t.hold} guarda una pieza en la reserva.` : t.hold}`,
    done: (p) => p.levelups >= 1,
  },
  {
    title: 'Mejoras',
    text: (t) =>
      `Eliges <b>1 de 3 mejoras</b>: verde es la ventaja y rojo, su precio. Se acumulan y se combinan. ${t.reroll} cambia las cartas (1 gratis).`,
    done: (p) => p.perks >= 1,
  },
  {
    title: 'Racha',
    text: (_t, g) =>
      `Mira la <b>Racha</b> (a la derecha): sube con varias líneas a la vez, combos y jugando rápido, y baja con cada pieza. Más racha, cartas más raras. Siguiente nivel: <b>${g.linesIntoLevel}/${TUTORIAL_LINES}</b>.`,
    done: (p) => p.levelups >= 2,
  },
  {
    title: 'Hiperperk',
    text: () =>
      `Una <b>hiperperk</b> es una habilidad activa, una por partida. Sale con suerte (más con racha) y seguro en el nivel 8; aquí te regalamos una.`,
    done: (p) => p.hyperPicked,
  },
  {
    title: 'Más mejoras',
    text: () =>
      `Ahora tu mejora normal. Desde el nivel 5 hay <b>ofertas malditas</b>: solo maldiciones, eliges la menos mala y la siguiente oferta es rara o mejor.`,
    done: (p) => p.perks >= 2,
  },
  {
    title: 'Carga',
    text: (_t, g) => `La hiperperk se carga limpiando líneas: <b>${g.hyperCharge}/${TUTORIAL_HYPER_CHARGE}</b> (en una partida normal piden entre 10 y 20).`,
    done: (p, g) => p.hyperUsed || g.hyperReady(),
  },
  {
    title: 'Soltarla',
    text: (t) => `¡Lista! Púlsala con ${t.hyper}. Tú decides cuándo: el truco es guardarla para un mal momento.`,
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
      title = 'Sin sitio';
      body = 'El tablero se ha llenado. Pasa en las partidas de verdad: aquí puedes repetir cuando quieras.';
      actions = '<button type="button" class="coach-btn" data-coach="retry">Repetir</button><button type="button" class="coach-btn ghost" data-coach="home">Inicio</button>';
    } else {
      const i = this.current();
      if (i >= STEPS.length) {
        state = 'end';
        title = '¡Listo!';
        body =
          'Ya sabes lo esencial: líneas, mejoras con precio, racha e hiperperk. Lo demás son combinaciones: se aprende jugando.';
        actions = '<button type="button" class="coach-btn" data-coach="play">Jugar partida</button><button type="button" class="coach-btn ghost" data-coach="home">Inicio</button>';
        if (!this.doneSent) {
          this.doneSent = true;
          this.hooks.onDone();
        }
      } else {
        const extraOffer = g.state === 'choosing' && i > OFFER2_STEP;
        title = `${i + 1}/${STEPS.length} · ${extraOffer ? 'Mejoras' : STEPS[i].title}`;
        body = extraOffer
          ? 'Otro nivel, otra mejora: cada elección cambia lo que te conviene después.'
          : STEPS[i].text(touch ? TOUCH : DESKTOP, g);
        actions = '<button type="button" class="coach-skip" data-coach="skip">Salir</button>';
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
      el.innerHTML = `<div class="coach-head">Tutorial <span>${title}</span></div><p class="coach-text">${body}</p><div class="coach-actions">${actions}</div>`;
    });
  }
}
