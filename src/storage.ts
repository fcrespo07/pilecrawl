// Migra las partidas guardadas con los nombres anteriores del juego (tetrogue, derrumbe) a las claves actuales.
// Se importa antes que nada en main.ts para que audio, meta y récord lean ya lo migrado.
const OLD_PREFIXES = ['tetrogue.', 'derrumbe.'];
const NEW_PREFIX = 'blockrogue.';
const KEYS = ['best', 'audio', 'meta'];

try {
  for (const k of KEYS) {
    for (const prefix of OLD_PREFIXES) {
      const old = localStorage.getItem(prefix + k);
      if (old === null) continue;
      if (localStorage.getItem(NEW_PREFIX + k) === null) localStorage.setItem(NEW_PREFIX + k, old);
      localStorage.removeItem(prefix + k);
    }
  }
} catch {
  /* sin almacenamiento: no hay nada que migrar */
}
