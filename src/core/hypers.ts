// Hiperperks: habilidades activas, una por partida. Se cargan limpiando líneas y el jugador
// decide cuándo soltarlas. Van aparte de los perks normales y a propósito están más rotas.
// La lógica de cada una vive en `game.ts` (leyendo `hyperActive`), aquí solo los datos.
// No hay una garantizada: salen al subir de nivel con una probabilidad que sube con la racha
// (`streak.ts`). Mientras están activas, la interfaz cambia de piel; al terminar vuelve la de base.

import type { SkinId } from '../fx/skins';

export type HyperId = 'slowmo' | 'frenzy' | 'sand' | 'barrage' | 'wipe' | 'flood' | 'shield' | 'gravity';

export interface HyperDef {
  id: HyperId;
  name: string;
  /** Líneas que hay que limpiar para cargarla. */
  charge: number;
  /** Cuánto dura activa, en ms de juego. 0 = efecto instantáneo. */
  durationMs: number;
  /** Piel de la interfaz mientras está activa (solo aspecto). Las instantáneas no tienen. */
  skin: SkinId | null;
  pros: () => string[];
  cons?: () => string[];
}

export const HYPERS: HyperDef[] = [
  {
    id: 'slowmo', name: 'Cámara lenta', charge: 10, durationMs: 12_000, skin: 'plano',
    pros: () => ['Durante <b>12 s</b> las piezas casi <b>no caen</b>', 'La basura <b>no avanza</b> mientras dura', 'La pantalla pasa a <b>papel de plano</b>'],
  },
  {
    id: 'frenzy', name: 'Frenesí', charge: 12, durationMs: 15_000, skin: 'neon',
    pros: () => ['Durante <b>15 s</b>, <b>×3</b> a toda la puntuación', 'El combo <b>no se rompe</b> mientras dura', 'La pantalla pasa a <b>neón</b>'],
  },
  {
    id: 'sand', name: 'Arena', charge: 14, durationMs: 5_000, skin: 'terminal',
    pros: () => ['Durante <b>5 s</b>, cada bloque que fijas cae hasta el <b>hueco libre más bajo</b> de su columna', 'Rellena <b>agujeros tapados</b>: caen aunque haya bloques encima', 'La pantalla pasa a <b>fósforo verde</b>'],
  },
  {
    id: 'barrage', name: 'Bombardeo', charge: 12, durationMs: 8_000, skin: 'apagon',
    pros: () => ['Durante <b>8 s</b>, <b>todas las piezas</b> son bombas', 'Cada una revienta un área de <b>5×5</b>', 'La pantalla pasa a <b>modo noche</b>'],
  },
  {
    id: 'flood', name: 'Diluvio', charge: 12, durationMs: 10_000, skin: 'hielo',
    pros: () => ['Durante <b>10 s</b>, <b>todas las piezas</b> son <b>barras I</b>', 'Ideal para cuádruples: apila y suelta', 'La pantalla pasa a <b>hielo</b>'],
  },
  {
    id: 'gravity', name: 'Gravedad', charge: 16, durationMs: 6_000, skin: 'magma',
    pros: () => ['Durante <b>6 s</b>, al fijar cada pieza <b>todo el tablero se compacta</b>', 'Los <b>huecos</b> se cierran y salen líneas solas', 'La pantalla pasa a <b>magma</b>'],
  },
  {
    id: 'shield', name: 'Escudo', charge: 14, durationMs: 10_000, skin: 'oro',
    pros: () => ['Durante <b>10 s</b> no puedes <b>perder</b>: si te desbordas, se vacía el tablero salvo <b>5 filas</b>', 'No gasta vidas extra', 'La pantalla pasa a <b>oro</b>'],
  },
  {
    id: 'wipe', name: 'Tabla rasa', charge: 20, durationMs: 0, skin: null,
    pros: () => ['Al activarla <b>vacía el tablero</b> entero', 'Cada bloque borrado da <b>40 × nivel</b> puntos'],
    cons: () => ['Es la que más tarda en <b>cargarse</b>'],
  },
];

export const HYPER_BY_ID: Record<HyperId, HyperDef> = Object.fromEntries(HYPERS.map((h) => [h.id, h])) as Record<HyperId, HyperDef>;

/** Saca `n` hiperperks distintas con el azar que se le pase (todas pesan lo mismo). */
export function rollHypers(n: number, rand: () => number): HyperDef[] {
  const pool = [...HYPERS];
  const picks: HyperDef[] = [];
  while (picks.length < n && pool.length) picks.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return picks;
}
