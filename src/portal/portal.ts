// Adaptador de portales de juegos (CrazyGames). Solo actúa si el build lleva VITE_PORTAL=crazygames.
// En pilecrawl.fun, y en cualquier build sin esa variable, todas las llamadas son no-op y no se carga ningún script externo.
// Los anuncios van apagados salvo VITE_PORTAL_ADS=1. Solo se usa la API de SDK v3; comprobar contra la documentación del portal y su entorno de pruebas antes de enviar.

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

interface CrazySdk {
  init(): Promise<void>;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
  };
  /** Guardado del portal: como localStorage pero síncrono y ligado a la cuenta (los invitados caen en localStorage). */
  data?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
  ad?: {
    requestAd(type: 'midgame' | 'rewarded', cb: { adStarted?: () => void; adFinished: () => void; adError: (err: unknown) => void }): void;
  };
}

const PORTAL_ID: string = import.meta.env.VITE_PORTAL ?? '';
const ACTIVE = PORTAL_ID === 'crazygames';
/** Portales que piden entrar a jugar a un clic (CrazyGames Full Launch, Poki, YouTube Playables). itch.io conserva la portada completa. */
const QUICK_PORTALS = ['crazygames', 'poki', 'youtube'];
const ADS = ACTIVE && import.meta.env.VITE_PORTAL_ADS === '1';

/** Claves del juego que el portal debe guardar (no incluye las del ranking, el consentimiento ni las estadísticas). */
const SAVE_KEYS = [
  'best', 'best.timed', 'best.exp', 'daily', 'mode', 'meta', 'exp', 'save', 'audio', 'fx', 'keys', 'handling', 'mouse', 'tutorial', 'played', 'lang',
].map((k) => `blockrogue.${k}`);

let sdk: CrazySdk | null = null;
let started: Promise<void> | null = null;
/** Para no avisar dos veces de «partida empezada» (el portal cuenta el tiempo de juego por ese aviso). */
let playing = false;

/** Carga el SDK del portal y lo inicia. Sin portal no hace nada y no pide ningún script. */
export function initPortal(): Promise<void> {
  if (!ACTIVE) return Promise.resolve();
  return (started ??= startSdk());
}

async function startSdk(): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('sdk'));
      document.head.appendChild(script);
      setTimeout(() => reject(new Error('sdk timeout')), 8000); // un SDK que no responde no puede dejar el juego sin arrancar
    });
    const cg = (window as unknown as { CrazyGames?: { SDK: CrazySdk } }).CrazyGames;
    if (!cg) return;
    await cg.SDK.init();
    sdk = cg.SDK;
  } catch {
    // sin SDK el juego sigue igual: el portal no recibe avisos, nada más
    sdk = null;
  }
}

/**
 * Guardado por el módulo de datos del portal. Copia a localStorage lo que el portal tenga guardado (la cuenta
 * del jugador) y desde entonces replica en el portal cada cambio de las claves del juego. El resto del código
 * sigue leyendo y escribiendo localStorage como siempre. Hay que llamarlo antes de que nada lea el guardado.
 */
function installSave() {
  const data = sdk?.data;
  if (!data) return;
  try {
    for (const k of SAVE_KEYS) {
      const v = data.getItem(k);
      if (v !== null) localStorage.setItem(k, v);
    }
    const keys = new Set(SAVE_KEYS);
    const proto = Storage.prototype;
    const set = proto.setItem;
    const remove = proto.removeItem;
    let inside = false; // el módulo de datos de invitados escribe en localStorage: sin esto se llamaría a sí mismo
    const mirror = (fn: () => void) => {
      if (inside) return;
      inside = true;
      try {
        fn();
      } catch {
        /* el portal no guarda: queda el local */
      } finally {
        inside = false;
      }
    };
    proto.setItem = function (this: Storage, key: string, value: string) {
      set.call(this, key, value);
      if (this === localStorage && keys.has(key)) mirror(() => data.setItem(key, value));
    };
    proto.removeItem = function (this: Storage, key: string) {
      remove.call(this, key);
      if (this === localStorage && keys.has(key)) mirror(() => data.removeItem(key));
    };
  } catch {
    /* sin almacenamiento: el juego ya sabe vivir sin él */
  }
}

/** Arranque con guardado del portal: lo usa `bootstrap.ts`, que se importa antes que el resto del juego. */
export async function initPortalSave(): Promise<void> {
  await initPortal();
  installSave();
}

export const portal = {
  /** Id del portal de este build ('' en pilecrawl.fun). */
  id: PORTAL_ID,
  /** Cualquier build de portal: sin enlaces a pilecrawl.fun, GitHub ni anuncios. */
  isPortalBuild: PORTAL_ID !== '',
  /** Portada de un clic: solo Jugar, Tutorial y Ajustes; sin selector de modos ni paneles. */
  quickStart: QUICK_PORTALS.includes(PORTAL_ID),
  /** CrazyGames prohíbe botones propios de pantalla completa (el portal ya trae el suyo). */
  allowsOwnFullscreen: !ACTIVE,
  /** Pantalla de carga lista: el portal puede quitar su pantalla. */
  loadingStop() {
    sdk?.game.loadingStop();
  },
  /** Empieza el tiempo de juego (partida nueva o reanudada). */
  gameplayStart() {
    if (!sdk || playing) return;
    playing = true;
    sdk.game.gameplayStart();
  },
  /** Para el tiempo de juego (pausa, fin de partida, volver a la portada). */
  gameplayStop() {
    if (!sdk || !playing) return;
    playing = false;
    sdk.game.gameplayStop();
  },
  /** Momento de celebración (subida de nivel): el portal puede mostrar un aviso sin cortar nada. */
  happytime() {
    sdk?.game.happytime();
  },
  /**
   * Anuncio entre partidas. Apagado por defecto: sin VITE_PORTAL_ADS=1 llama a `done` enseguida.
   * `done` se llama al terminar el anuncio o si falla, para que el juego nunca se quede esperando.
   */
  midgameAd(done: () => void) {
    if (!ADS || !sdk?.ad) return done();
    this.gameplayStop();
    sdk.ad.requestAd('midgame', { adFinished: done, adError: done });
  },
};
