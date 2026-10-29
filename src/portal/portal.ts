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
  ad?: {
    requestAd(type: 'midgame' | 'rewarded', cb: { adStarted?: () => void; adFinished: () => void; adError: (err: unknown) => void }): void;
  };
}

const ACTIVE = import.meta.env.VITE_PORTAL === 'crazygames';
const ADS = ACTIVE && import.meta.env.VITE_PORTAL_ADS === '1';

let sdk: CrazySdk | null = null;
/** Para no avisar dos veces de «partida empezada» (el portal cuenta el tiempo de juego por ese aviso). */
let playing = false;

/** Carga el SDK del portal y lo inicia. Sin portal no hace nada y no pide ningún script. */
export async function initPortal(): Promise<void> {
  if (!ACTIVE) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('sdk'));
      document.head.appendChild(script);
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

export const portal = {
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
