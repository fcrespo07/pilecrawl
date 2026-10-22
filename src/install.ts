/** «Instalar» en la portada: solo aparece si el navegador ofrece instalar la web (Chrome/Edge/Android). */
interface InstallEvent extends Event {
  prompt(): Promise<void>;
}

export function initInstall(btn: HTMLElement) {
  let saved: InstallEvent | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    saved = e as InstallEvent;
    btn.hidden = false;
  });
  btn.addEventListener('click', () => {
    const ev = saved;
    if (!ev) return;
    saved = null;
    btn.hidden = true;
    void ev.prompt().catch(() => {});
  });
  window.addEventListener('appinstalled', () => (btn.hidden = true));
}
