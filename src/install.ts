/** «Instalar» en la portada: solo aparece si el navegador ofrece instalar la web (Chrome/Edge/Android). */
interface InstallEvent extends Event {
  prompt(): Promise<void>;
}

// El navegador puede disparar el evento antes de que arranque el juego (fuentes, Pixi): se guarda al importar el módulo.
let saved: InstallEvent | null = null;
let show: (() => void) | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  saved = e as InstallEvent;
  show?.();
});
window.addEventListener('appinstalled', () => {
  saved = null;
  show?.();
});

export function initInstall(btn: HTMLElement) {
  show = () => (btn.hidden = saved === null);
  show();
  btn.addEventListener('click', () => {
    const ev = saved;
    if (!ev) return;
    // el evento solo vale una vez; si se cierra el diálogo, el navegador lanza otro más tarde y el botón vuelve
    saved = null;
    show?.();
    void ev.prompt().catch(() => {});
  });
}
