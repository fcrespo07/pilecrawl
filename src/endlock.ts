/**
 * Freno tras acabar la partida: mientras se mantiene pulsado Espacio o Enter (o el botón de reintentar),
 * no arranca otra partida. Cada pulsación dentro de la ventana la alarga, así que solo arranca
 * una pulsación nueva tras un rato sin tocar nada. Las pulsaciones mantenidas no cuentan (llegan como repetición).
 */
export class EndLock {
  private until = 0;

  constructor(
    private readonly quietMs = 800,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** Abre la ventana al acabar la partida. */
  arm() {
    this.until = this.now() + this.quietMs;
  }

  /** true si la pulsación debe ignorarse; si cae dentro de la ventana, la alarga. */
  blocks(): boolean {
    const t = this.now();
    if (t >= this.until) return false;
    this.until = t + this.quietMs;
    return true;
  }
}
