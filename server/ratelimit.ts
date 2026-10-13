// Límite de peticiones en memoria (ventana fija). Vale para una sola réplica, que es lo que corre aquí.

export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(private max: number, private windowMs: number) {}

  /** true si la petición puede pasar. */
  allow(key: string, now: number): boolean {
    const h = this.hits.get(key);
    if (!h || now >= h.reset) {
      this.hits.set(key, { n: 1, reset: now + this.windowMs });
      if (this.hits.size > 50_000) this.sweep(now);
      return true;
    }
    h.n++;
    return h.n <= this.max;
  }

  /** Cuántas peticiones lleva la clave en la ventana actual, sin contar una nueva. */
  count(key: string, now: number): number {
    const h = this.hits.get(key);
    return h && now < h.reset ? h.n : 0;
  }

  private sweep(now: number) {
    for (const [k, h] of this.hits) if (now >= h.reset) this.hits.delete(k);
  }
}
