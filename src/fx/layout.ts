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
export const ACCENTS = [0x1f5fa8, 0xb8336a, 0x4c7d1c, 0xb06a14, 0x6a3fb0, 0x157a66, 0xb83a2e, 0x8a6d00];
export const accentFor = (level: number) => ACCENTS[(level - 1) % ACCENTS.length];

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
