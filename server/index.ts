// Servidor de Block Rogue: la API del ranking y, si hay `STATIC_DIR`, el propio juego.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { createApp } from './app';
import { loadConfig } from './config';
import { openDb } from './db';
import { clientIp } from './ip';

/** Por debajo de esto la clave de administrador se considera débil y se avisa en el arranque. */
const ADMIN_TOKEN_MIN = 24;
/** La página de admin guarda la clave en sessionStorage: sin scripts ajenos ni inline, ni conexiones a otros orígenes. */
const ADMIN_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const MAX_BODY = 512 * 1024;
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const cfg = loadConfig();
if (cfg.adminToken && cfg.adminToken.length < ADMIN_TOKEN_MIN)
  console.warn(`ADMIN_TOKEN mide menos de ${ADMIN_TOKEN_MIN} caracteres: es corta para una clave de administrador (openssl rand -base64 32).`);
const db = openDb(cfg.dbPath);
const api = createApp(cfg, db);

async function readBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && cfg.corsOrigins.includes(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-headers', 'content-type, authorization');
    res.setHeader('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('access-control-max-age', '600');
  }
}

function sendStatic(pathname: string, res: ServerResponse): boolean {
  if (!cfg.staticDir) return false;
  let rel: string;
  try {
    rel = normalize(decodeURIComponent(pathname));
  } catch {
    return false;
  }
  let file = join(cfg.staticDir, rel);
  if (!file.startsWith(cfg.staticDir + sep) && file !== cfg.staticDir) return false;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // la web es de una sola página: lo que no es un fichero vuelve a la portada
    if (extname(rel)) return false;
    file = join(cfg.staticDir, 'index.html');
    if (!existsSync(file)) return false;
  }
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    // los ficheros de /assets llevan el hash en el nombre: nunca cambian
    'cache-control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
    ...(file === join(cfg.staticDir, 'admin.html') ? { 'content-security-policy': ADMIN_CSP } : {}),
  });
  createReadStream(file).pipe(res);
  return true;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      cors(req, res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
      }
      let body: Buffer | null = Buffer.alloc(0);
      if (req.method !== 'GET' && req.method !== 'HEAD') body = await readBody(req);
      if (body === null) {
        res.writeHead(413, { 'content-type': 'application/json' }).end('{"error":"cuerpo demasiado grande"}');
        return;
      }
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      const init: RequestInit = { method: req.method, headers };
      if (body.length) init.body = new Uint8Array(body);
      const out = await api(new Request(url, init), clientIp(req, cfg));
      const buf = Buffer.from(await out.arrayBuffer());
      out.headers.forEach((v, k) => res.setHeader(k, v));
      res.setHeader('x-content-type-options', 'nosniff');
      res.writeHead(out.status).end(buf);
      return;
    }
    // las estadísticas viven ahora dentro de la página de administración
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/stats.html') {
      res.writeHead(301, { location: '/admin.html' }).end();
      return;
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && sendStatic(url.pathname, res)) return;
    res.writeHead(404, { 'content-type': 'text/plain' }).end('no existe');
  } catch (e) {
    console.error('error', e);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end();
  }
});

/** Copia diaria de la base de datos (VACUUM INTO) y borrado de las más viejas. */
function backup() {
  if (!cfg.backupDir) return;
  try {
    mkdirSync(cfg.backupDir, { recursive: true });
    const file = join(cfg.backupDir, `blockrogue-${cfg.now().toISOString().slice(0, 10)}.db`);
    if (!existsSync(file)) db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    const all = readdirSync(cfg.backupDir).filter((f) => /^blockrogue-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - cfg.backupKeep))) rmSync(join(cfg.backupDir, old));
  } catch (e) {
    console.error('copia de seguridad fallida', e);
  }
}
backup();
setInterval(backup, 6 * 3_600_000).unref();

server.listen(cfg.port, () => console.log(`Block Rogue escuchando en :${cfg.port} (db ${cfg.dbPath}${cfg.staticDir ? `, web ${cfg.staticDir}` : ''})`));

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
