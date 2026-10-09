// Coordenadas lógicas del escenario (se escala para encajar en la ventana).
import { COLS, VISIBLE } from '../core/game';

export const W = 960;
export const H = 720;
export const CELL = 30;
export const BOARD_X = 330;
export const BOARD_Y = 140;
export const BOARD_W = CELL * COLS;
export const BOARD_H = CELL * VISIBLE;

/** Barra de piezas encima del tablero: reserva a la izquierda y cola de siguientes a la derecha. */
export const QUEUE_X = 180;
export const QUEUE_Y = 34;
export const QUEUE_W = 610;
export const QUEUE_H = 96;

/** Paleta de acento: cambia con cada nivel. */
export const ACCENTS = [0xffd23f, 0x2fb4ff, 0x3ee06a, 0xff3b5c, 0x9a7bff, 0xff9a2e, 0xff7ac0, 0x5af0e0];
export const accentFor = (level: number) => ACCENTS[(level - 1) % ACCENTS.length];

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Tinta de las hiperperks (barra de carga, marco y textos). En CSS es `--hyper`. */
export const HYPER_COLOR = 0xb07aff;
