import type { IncomingMessage } from 'node:http';
import type { Config } from './config';

export function clientIp(req: IncomingMessage, c: Pick<Config, 'trustProxy'>): string {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[v.length - 1] : v)?.trim();
  if (c.trustProxy === 'cloudflare') {
    const cf = one(req.headers['cf-connecting-ip']);
    if (cf) return cf;
  }
  if (c.trustProxy !== 'none') {
    // el proxy añade la IP que ve al final: lo que haya antes lo escribió el cliente
    const last = one(req.headers['x-forwarded-for'])?.split(',').pop()?.trim();
    if (last) return last;
  }
  return req.socket.remoteAddress ?? 'desconocida';
}
