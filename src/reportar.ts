// Enlace de reportar.html: abre un correo con la versión y el navegador ya rellenos.
// Solo lee el navegador; no hace peticiones (la página no carga nada externo).
// En iOS, Chrome, Firefox y Edge usan otros nombres de marca en el navegador
const BROWSERS: Record<string, string> = { Edg: 'Edge', EdgiOS: 'Edge', OPR: 'Opera', Firefox: 'Firefox', FxiOS: 'Firefox', Chrome: 'Chrome', CriOS: 'Chrome' };

function browserName(ua: string): string {
  const known = /(Edg|EdgiOS|OPR|Firefox|FxiOS|Chrome|CriOS)\/(\d+)/.exec(ua);
  if (known) return `${BROWSERS[known[1]]} ${known[2]}`;
  if (/Safari\//.test(ua)) {
    const v = /Version\/(\d+)/.exec(ua);
    return v ? `Safari ${v[1]}` : 'Safari';
  }
  return 'desconocido';
}

function systemName(ua: string): string {
  return /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'desconocido';
}

const link = document.getElementById('bug-link') as HTMLAnchorElement;
const info = document.getElementById('bug-info') as HTMLParagraphElement;
const version = document.body.dataset.version ?? '';
const navegador = browserName(navigator.userAgent);
const dispositivo = systemName(navigator.userAgent);

const body = `Qué hice:\n\nQué esperaba:\n\nQué pasó:\n\n---\nVersión: ${version}\nNavegador: ${navegador}\nSistema: ${dispositivo}`;
const params = `subject=${encodeURIComponent('[Bug] Pilecrawl ' + version)}&body=${encodeURIComponent(body)}`;
// sin correo configurado (VITE_CONTACT_EMAIL) el enlace queda sin destinatario
if (link.getAttribute('href') === 'mailto:') link.removeAttribute('href');
else link.href = `${link.getAttribute('href')}?${params}`;
info.textContent = `El correo llevará: versión ${version}, navegador ${navegador}, sistema ${dispositivo}.`;
