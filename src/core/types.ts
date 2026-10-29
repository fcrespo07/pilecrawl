// Tipos del núcleo: piezas, estados, eventos del juego y repeticiones. Salieron de `game.ts`
// sin cambios; `game.ts` los vuelve a exportar.
import type { BossDef } from './bosses';
import type { HyperDef } from './hypers';
import type { ModeId } from './modes';
import type { PerkDef } from './perks';
import type { PieceDef } from './pieces';

export interface PieceSpec {
  def: PieceDef;
  bomb: boolean;
  prism: boolean;
  gold: boolean;
  /** Pieza pesada (maldición): cae al doble de rápido. */
  heavy?: boolean;
  /** Bomba solo por Bombardeo: no pasa a la reserva y no borra si era prisma u oro. */
  hyperBomb?: boolean;
  /** Pieza que era antes de que Diluvio la volviera una I: es la que va a la reserva. */
  hyperFrom?: PieceDef;
}

export interface ActivePiece extends PieceSpec {
  x: number;
  y: number;
  rot: number;
}

export type SpinKind = 'full' | 'mini' | null;
export type Cell = [number, number];
export type GameState = 'ready' | 'playing' | 'choosing' | 'paused' | 'over';
/** Por qué terminó la partida: tablero lleno o fin del tiempo (contrarreloj). */
export type EndReason = 'topout' | 'time' | 'victory';

export interface ClearInfo {
  rows: number[];
  rowValues: number[][];
  lines: number;
  spin: SpinKind;
  spinName: string;
  combo: number;
  b2b: boolean;
  points: number;
  gold: number;
  perfect: boolean;
  cascade: number;
}

export interface GameEvents {
  move: void;
  rotate: { spin: boolean };
  hold: void;
  spawn: void;
  softdrop: void;
  harddrop: { from: Cell[]; to: Cell[]; color: number; dist: number };
  lock: { cells: Cell[]; color: number };
  clear: ClearInfo;
  spinNoLines: { spinName: string; points: number; cells: Cell[] };
  bomb: { cx: number; cy: number; removed: { x: number; y: number; v: number }[]; points: number };
  prism: { cells: Cell[]; removed: { x: number; y: number; v: number }[]; color: number; points: number };
  drill: { values: number[]; points: number };
  quake: { chain: number };
  settle: { columns: number };
  garbage: { hole: number };
  drift: void;
  roulette: { from: [number, number]; to: [number, number] };
  erode: { x: number; y: number; v: number };
  skill: { skill: 'tactic' | 'wild' };
  skip: { rerolls: number };
  shed: { perk: PerkDef };
  garbageWarn: { progress: number };
  levelup: { level: number };
  /** Empieza un nivel jefe (o termina: boss null). */
  boss: { boss: BossDef | null; level: number };
  /** Se supera un nivel jefe: recompensa en camino. */
  bossDown: { boss: BossDef; level: number };
  /** Gota deja caer un bloque suelto. */
  bossDrop: { x: number; y: number };
  /** Imán cambia la columna prohibida (-1: ninguna). */
  bossMagnet: { col: number };
  /** Una limpieza deja la racha en buena racha (tramo 1 o más). Solo informa: no cambia reglas. */
  streakUp: { streak: number; tier: number; tierUp: boolean; chain: number };
  /** La racha baja del primer tramo y la cadena se corta. */
  streakEnd: { chain: number };
  interest: { amount: number };
  /** Subida sin cartas que ofrecer: se resuelve sola con estos puntos. */
  emptyOffer: { points: number };
  breather: { rows: number[][] };
  lifeline: void;
  harvest: { rerolls: number };
  revive: { livesLeft: number };
  /** Hiperperk elegida, cargada del todo, activada o terminada. */
  hyperPick: { hyper: HyperDef };
  hyperReady: { hyper: HyperDef };
  hyper: { hyper: HyperDef };
  hyperEnd: { hyper: HyperDef };
  /** Tabla rasa: bloques borrados de golpe. */
  wipe: { removed: { x: number; y: number; v: number }[]; points: number };
  gameover: { reason: EndReason };
  perk: { perk: PerkDef; stacks: number };
  /** Cartas que se enseñan ahora (también tras cada reroll). Solo informa: no cambia reglas. */
  offer: { kind: 'perk' | 'curse' | 'hyper'; ids: string[] };
}

/** Acción del jugador grabada con el paso de simulación en que ocurrió. */
export type ReplayAction =
  | [step: number, op: 'move', dx: number]
  | [step: number, op: 'rotate', dir: 1 | -1 | 2]
  | [step: number, op: 'drop']
  | [step: number, op: 'hold']
  | [step: number, op: 'soft', on: 0 | 1]
  | [step: number, op: 'pick', index: number]
  | [step: number, op: 'reroll']
  | [step: number, op: 'hyper']
  | [step: number, op: 'skill']
  | [step: number, op: 'skip']
  | [step: number, op: 'shed', index: number];

/** Todo lo necesario para volver a jugar una partida idéntica (ver `replay.ts`). */
export interface Replay {
  version: number;
  /** Modo de juego. Las repeticiones anteriores a los modos no lo llevan: son `normal`. */
  mode?: ModeId;
  seed: number;
  bestLevel: number;
  actions: ReplayAction[];
  /** Pasos simulados al terminar la partida. */
  steps: number;
  /** Se usó el laboratorio: la partida no se puede reproducir ni cuenta para récords ni rankings. */
  sandbox?: true;
}
