// Hueco de anuncio de la portada. Es el único sitio que sabe de publicidad:
// el resto de la interfaz solo ve un contenedor que está plegado hasta que alguien lo rellene.
// Para un portal (p. ej. el SDK de CrazyGames) o una red propia, se llama a `mountAd`
// con una función que pinte el anuncio dentro del contenedor.

/** Pinta el anuncio en `host`. Devuelve una función para quitarlo, si hace falta. */
export type AdProvider = (host: HTMLElement) => void | (() => void);

let cleanup: void | (() => void);

export function mountAd(root: HTMLElement, provider: AdProvider | null) {
  if (typeof cleanup === 'function') cleanup();
  cleanup = undefined;
  root.replaceChildren();
  root.dataset.state = 'empty';
  if (!provider) return;
  try {
    cleanup = provider(root);
    root.dataset.state = 'filled';
  } catch {
    /* un anuncio roto nunca debe romper la portada */
    root.replaceChildren();
    root.dataset.state = 'empty';
  }
}
