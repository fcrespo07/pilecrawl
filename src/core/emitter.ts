type Handler<T> = (payload: T) => void;

export class Emitter<E extends object> {
  private handlers: { [K in keyof E]?: Handler<E[K]>[] } = {};

  on<K extends keyof E>(event: K, fn: Handler<E[K]>) {
    (this.handlers[event] ??= []).push(fn);
  }

  /** Mientras es true no se avisa a nadie: sirve para re-simular una partida guardada sin efectos ni sonido. */
  silent = false;

  emit<K extends keyof E>(event: K, payload: E[K]) {
    if (this.silent) return;
    for (const fn of this.handlers[event] ?? []) fn(payload);
  }
}
