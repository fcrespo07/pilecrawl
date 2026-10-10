import { randomInt } from 'node:crypto';

// Configuración del servidor, toda por variables de entorno (ver docs/despliegue.md).

export interface Config {
  port: number;
  /** Fichero SQLite. En Kubernetes vive en un volumen persistente. */
  dbPath: string;
  /** Carpeta del juego compilado (`dist`). Vacío = solo API. */
  staticDir: string;
  /** Orígenes que pueden llamar a la API desde otra web (portales). Vacío = solo el propio. */
  corsOrigins: string[];
  /**
   * De dónde sale la IP del cliente. `none`: la del socket. `proxy`: el último valor de `X-Forwarded-For`
   * (un solo proxy delante, p. ej. Traefik). `cloudflare`: `CF-Connecting-IP` (Cloudflare Tunnel).
   * El primer valor de `X-Forwarded-For` lo escribe el cliente: nunca se usa.
   */
  trustProxy: 'none' | 'proxy' | 'cloudflare';
  /** Clave para las rutas de moderación. Vacío = moderación desactivada. */
  adminToken: string;
  /** Palabras que no pueden aparecer en un apodo (minúsculas). */
  nickBlocklist: string[];
  /** Carpeta de copias diarias de la base de datos. Vacío = sin copias. */
  backupDir: string;
  /** Cuántas copias se conservan. */
  backupKeep: number;
  /** Reloj, para poder probar con otra fecha. */
  now: () => Date;
  /** Semilla de una partida nueva (32 bits). Aleatoria; las pruebas la fijan. */
  newSeed: () => number;
}

const list = (v: string | undefined) =>
  (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`PORT no válido: ${env.PORT}`);
  return {
    port,
    dbPath: env.DB_PATH ?? './data/blockrogue.db',
    staticDir: env.STATIC_DIR ?? '',
    corsOrigins: list(env.CORS_ORIGINS),
    trustProxy: env.TRUST_PROXY === 'cloudflare' ? 'cloudflare' : env.TRUST_PROXY === 'proxy' || env.TRUST_PROXY === '1' ? 'proxy' : 'none',
    adminToken: env.ADMIN_TOKEN ?? '',
    nickBlocklist: list(env.NICK_BLOCKLIST).map((s) => s.toLowerCase()),
    backupDir: env.BACKUP_DIR ?? '',
    backupKeep: Math.max(1, Number(env.BACKUP_KEEP ?? 7) || 7),
    now: () => new Date(),
    newSeed: () => randomInt(0, 0x100000000),
  };
}
