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
export const ACCENTS = [0x2ef2ff, 0xff4dd2, 0x9dff4d, 0xffa13d, 0xa66bff, 0x4dffc3, 0xff5a5a, 0xffe14d];
export const accentFor = (level: number) => ACCENTS[(level - 1) % ACCENTS.length];

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
