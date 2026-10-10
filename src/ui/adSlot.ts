// Hueco de anuncio de la portada. Es el único sitio que sabe de publicidad:
// el resto de la interfaz solo ve un contenedor que está plegado hasta que alguien lo rellene.
// Para una red propia, se llama a `mountAd` con una función que pinte el anuncio dentro del
// contenedor y avise con `onFilled` cuando haya anuncio de verdad (las redes cargan tarde y
// a menudo no rellenan). Los portales como CrazyGames no permiten anuncios propios en su
// página: ahí se queda con `null` y usan su SDK.

/** Pinta el anuncio en `host`. Llama a `onFilled` cuando haya anuncio. Devuelve cómo quitarlo, si hace falta. */
export type AdProvider = (host: HTMLElement, onFilled: () => void) => void | (() => void);

let cleanup: void | (() => void);

export function mountAd(root: HTMLElement, provider: AdProvider | null) {
  if (typeof cleanup === 'function') cleanup();
  cleanup = undefined;
  root.replaceChildren();
  root.dataset.state = 'empty';
  if (!provider) return;
  try {
    cleanup = provider(root, () => (root.dataset.state = 'filled'));
  } catch {
    /* un anuncio roto nunca debe romper la portada */
    root.replaceChildren();
    root.dataset.state = 'empty';
  }
}
