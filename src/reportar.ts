// Enlace de reportar.html: abre la plantilla de GitHub con la versión y el navegador ya rellenos.
// Solo lee el navegador; no hace peticiones (la página no carga nada externo).
const BROWSERS: Record<string, string> = { Edg: 'Edge', OPR: 'Opera', Firefox: 'Firefox', Chrome: 'Chrome' };

function browserName(ua: string): string {
  const known = /(Edg|OPR|Firefox|Chrome)\/(\d+)/.exec(ua);
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

const params = new URLSearchParams({
  template: 'bug_report.yml',
  title: '[Bug] ',
  version,
  navegador,
  dispositivo,
});
link.href = `https://github.com/fcrespo07/tetris-roguelite/issues/new?${params.toString()}`;
info.textContent = `El formulario llevará: versión ${version}, navegador ${navegador}, sistema ${dispositivo}.`;
