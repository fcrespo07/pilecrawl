import { defineConfig, loadEnv, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const ADSENSE_CLIENT = /^ca-pub-\d{10,20}$/;

/**
 * Cosas de publicación que dependen de variables del build (VITE_*), sin identificadores en el código:
 * - `ads.txt` con la línea de AdSense (si hay VITE_AD_CLIENT válido);
 * - la etiqueta `google-adsense-account` en todas las páginas (sirve para verificar el sitio sin cargar el script);
 * - el nombre y el correo de contacto en las páginas legales (`{{OWNER}}`, `{{EMAIL}}`).
 */
function publishing(env: Record<string, string>): Plugin {
  const client = ADSENSE_CLIENT.test(env.VITE_AD_CLIENT ?? '') ? env.VITE_AD_CLIENT : '';
  const owner = env.VITE_SITE_OWNER || 'el responsable del sitio';
  const email = env.VITE_CONTACT_EMAIL || '';
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return {
    name: 'pilecrawl-publishing',
    transformIndexHtml(html) {
      const mail = email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '(correo de contacto sin configurar)';
      const out = html.replaceAll('{{OWNER}}', esc(owner)).replaceAll('{{EMAIL}}', mail);
      return client ? out.replace('</head>', `  <meta name="google-adsense-account" content="${client}" />\n  </head>`) : out;
    },
    generateBundle() {
      if (!client || env.VITE_AD_PROVIDER !== 'adsense') return;
      this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${client.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [publishing(loadEnv(mode, process.cwd(), 'VITE_'))],
  build: {
    rollupOptions: {
      // la web es la portada más dos páginas estáticas (necesarias para anuncios y para cumplir la ley)
      input: {
        main: resolve(__dirname, 'index.html'),
        privacidad: resolve(__dirname, 'privacidad.html'),
        acerca: resolve(__dirname, 'acerca.html'),
      },
    },
  },
}));
