type Handler<T> = (payload: T) => void;

export class Emitter<E extends object> {
  private handlers: { [K in keyof E]?: Handler<E[K]>[] } = {};

  on<K extends keyof E>(event: K, fn: Handler<E[K]>) {
    (this.handlers[event] ??= []).push(fn);
  }

  emit<K extends keyof E>(event: K, payload: E[K]) {
    for (const fn of this.handlers[event] ?? []) fn(payload);
  }
}
