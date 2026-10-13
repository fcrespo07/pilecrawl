import { defineConfig, loadEnv, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const ADSENSE_CLIENT = /^ca-pub-\d{10,20}$/;

/** Repositorio público: enlace del formulario de bugs. Cambiar VITE_REPO_URL si se renombra. */
const REPO_URL_DEFAULT = 'https://github.com/fcrespo07/tetris-roguelite';

/**
 * Página de novedades: las versiones publicadas de CHANGELOG.md (de la más nueva a la más antigua).
 * La sección «Sin publicar» no sale. Se quita el número de PR, que a un jugador no le dice nada.
 */
function releaseNotesHtml(): string {
  const md = readFileSync(new URL('./CHANGELOG.md', import.meta.url), 'utf8');
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const releases: { version: string; date: string; items: string[] }[] = [];
  for (const line of md.split(/\r?\n/)) {
    const head = /^## (\d+\.\d+\.\d+) — (.+)$/.exec(line);
    if (head) releases.push({ version: head[1], date: head[2], items: [] });
    else if (/^## /.test(line)) releases.push({ version: '', date: '', items: [] }); // «Sin publicar» u otra sección: no sale
    else if (/^- /.test(line) && releases.length && !line.startsWith('- [interno] ')) releases[releases.length - 1].items.push(line.slice(2));
  }
  const shown = releases.filter((r) => r.version && r.items.length);
  if (!shown.length) {
    console.warn('[pilecrawl] CHANGELOG.md no tiene versiones publicadas reconocibles: la página de novedades saldría vacía.');
    return '<p class="note">Todavía no hay versiones publicadas.</p>';
  }
  return shown
    .map((r) => {
      const items = r.items.map((i) => `<li>${inline(i.replace(/\(#\d+\)\s*/g, ''))}</li>`).join('');
      return `<section class="release"><h2>${esc(r.version)} <span class="note">${esc(r.date)}</span></h2><ul>${items}</ul></section>`;
    })
    .join('\n');
}

/**
 * Cosas de publicación que dependen de variables del build (VITE_*), sin identificadores en el código:
 * - `ads.txt` con la línea de AdSense (si hay VITE_AD_CLIENT válido);
 * - la etiqueta `google-adsense-account` en todas las páginas (sirve para verificar el sitio sin cargar el script);
 * - el nombre y el correo de contacto en las páginas legales (`{{OWNER}}`, `{{EMAIL}}`).
 */
function publishing(env: Record<string, string>): Plugin {
  const repoUrl = env.VITE_REPO_URL || REPO_URL_DEFAULT;
  const client = ADSENSE_CLIENT.test(env.VITE_AD_CLIENT ?? '') ? env.VITE_AD_CLIENT : '';
  const owner = env.VITE_SITE_OWNER || 'el responsable del sitio';
  const email = env.VITE_CONTACT_EMAIL || '';
  if (env.VITE_AD_PROVIDER === 'adsense' && (!email || !env.VITE_SITE_OWNER)) {
    console.warn('[pilecrawl] Con anuncios activos faltan VITE_CONTACT_EMAIL o VITE_SITE_OWNER: las páginas legales saldrían incompletas.');
  }
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return {
    name: 'pilecrawl-publishing',
    transformIndexHtml(html) {
      const mail = email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '(correo de contacto sin configurar)';
      let out = html.replaceAll('{{OWNER}}', esc(owner)).replaceAll('{{EMAIL}}', mail).replaceAll('{{VERSION}}', pkg.version).replaceAll('{{REPO_URL}}', repoUrl);
      if (out.includes('{{NOVEDADES}}')) out = out.replaceAll('{{NOVEDADES}}', () => releaseNotesHtml());
      return client ? out.replace('</head>', `  <meta name="google-adsense-account" content="${client}" />\n  </head>`) : out;
    },
    generateBundle() {
      if (!client || env.VITE_AD_PROVIDER !== 'adsense') return;
      this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${client.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __REPO_URL__: JSON.stringify(env.VITE_REPO_URL || REPO_URL_DEFAULT) },
  plugins: [publishing(env)],
  build: {
    rollupOptions: {
      // la web es la portada más dos páginas estáticas (necesarias para anuncios y para cumplir la ley)
      input: {
        main: resolve(__dirname, 'index.html'),
        privacidad: resolve(__dirname, 'privacidad.html'),
        acerca: resolve(__dirname, 'acerca.html'),
        stats: resolve(__dirname, 'stats.html'),
        admin: resolve(__dirname, 'admin.html'),
        novedades: resolve(__dirname, 'novedades.html'),
        reportar: resolve(__dirname, 'reportar.html'),
      },
    },
  },
};
});
