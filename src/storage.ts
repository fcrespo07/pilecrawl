// Migra las partidas guardadas con el nombre anterior del juego a las claves nuevas.
// Se importa antes que nada en main.ts para que audio, meta y récord lean ya lo migrado.
const OLD_PREFIX = 'tetrogue.';
const NEW_PREFIX = 'derrumbe.';
const KEYS = ['best', 'audio', 'meta'];

try {
  for (const k of KEYS) {
    const old = localStorage.getItem(OLD_PREFIX + k);
    if (old === null) continue;
    if (localStorage.getItem(NEW_PREFIX + k) === null) localStorage.setItem(NEW_PREFIX + k, old);
    localStorage.removeItem(OLD_PREFIX + k);
  }
} catch {
  /* sin almacenamiento: no hay nada que migrar */
}
