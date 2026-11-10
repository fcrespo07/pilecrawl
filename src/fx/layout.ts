// Coordenadas lógicas del escenario (se escala para encajar en la ventana).
import { COLS, VISIBLE } from '../core/game';

/**
 * Coordenadas lógicas del escenario. Dos disposiciones: horizontal (bloque de 960×600 en un escenario que llena la
 * ventana; escritorio y móvil tumbado) y vertical (540 de ancho y alto según la pantalla, móvil de pie). Los valores se
 * reasignan en `setLayout`; los módulos que los importan los leen vivos.
 */
export let W = 960;
export let H = 600;
export let CELL = 30;
export let BOARD_X = 330;
export let BOARD_Y = 36;
export let BOARD_W = CELL * COLS;
export let BOARD_H = CELL * VISIBLE;

/** Cola de siguientes: columna a la derecha del tablero (la hiperperk tiene su barra pegada al tablero). */
export let NEXT_X = BOARD_X + BOARD_W + 32;
export let NEXT_Y = BOARD_Y - 4;
export let NEXT_W = 104;

/** Reserva: columna a la izquierda del tablero, en el hueco entre el HUD y el marco. */
export let HOLD_X = BOARD_X - 24 - 96;
export let HOLD_Y = BOARD_Y - 4;
export let HOLD_W = 96;

/** En vertical, reserva y cola van en una fila sobre el tablero y sus casillas se reparten en horizontal. */
export let PORTRAIT = false;

export const PORTRAIT_W = 540;
const PORTRAIT_TOP = 188; // HUD compacto + fila de reserva y cola
const PORTRAIT_BOTTOM = 182; // hiperperk, racha y mejoras bajo el tablero
export const PORTRAIT_MIN_H = 1000;
export const PORTRAIT_MAX_H = 1300;

/** Alto lógico del escenario vertical que llena una pantalla de `aspect` = alto/ancho. */
export function portraitHeight(aspect: number): number {
  const h = Math.round((PORTRAIT_W * aspect) / 20) * 20;
  return Math.max(PORTRAIT_MIN_H, Math.min(PORTRAIT_MAX_H, h));
}

/**
 * Horizontal: el diseño es un bloque de 960×600 (tablero, reserva, cola y HUD). El escenario se estira para
 * llenar la ventana: más ancho en 16:9 (hasta `LAND_MAX_W`) o más alto en 4:3 (hasta 720), con el bloque
 * centrado. Así el cielo llena el iframe del portal sin franjas y el juego sale un 20 % más grande que con
 * el 960×720 de antes, que dejaba 100 px vacíos sobre el tablero.
 */
export const LAND_W = 960;
export const LAND_H = 600;
const LAND_MAX_W = 1200;
const LAND_MAX_H = 720;
/** Desplazamiento del bloque de 960×600 dentro del escenario (el HUD del DOM se mueve con `--ox` y `--oy`). */
export let OX = 0;
export let OY = 0;

/** Tamaño lógico del escenario horizontal para una ventana de proporción `aspect` = ancho/alto. */
export function landscapeSize(aspect: number): { w: number; h: number } {
  const even = (n: number) => Math.round(n / 2) * 2;
  if (aspect >= LAND_W / LAND_H) return { w: even(Math.min(LAND_MAX_W, LAND_H * aspect)), h: LAND_H };
  return { w: LAND_W, h: even(Math.min(LAND_MAX_H, LAND_W / aspect)) };
}

export function setLayout(portrait: boolean, height = PORTRAIT_MIN_H, width = LAND_W) {
  PORTRAIT = portrait;
  if (!portrait) {
    W = width; H = height; CELL = 30;
    OX = Math.round((W - LAND_W) / 2);
    OY = Math.round((H - LAND_H) / 2);
    BOARD_X = 330 + OX; BOARD_Y = 36 + OY;
    NEXT_X = BOARD_X + COLS * CELL + 32; NEXT_Y = BOARD_Y - 4; NEXT_W = 104;
    HOLD_X = BOARD_X - 24 - 96; HOLD_Y = BOARD_Y - 4; HOLD_W = 96;
  } else {
    OX = 0; OY = 0;
    W = PORTRAIT_W; H = height;
    // la celda crece hasta llenar el ancho o el alto disponibles
    CELL = Math.max(24, Math.min(Math.floor((W - 40) / COLS), Math.floor((H - PORTRAIT_TOP - PORTRAIT_BOTTOM) / VISIBLE)));
    BOARD_X = Math.round((W - COLS * CELL) / 2);
    BOARD_Y = PORTRAIT_TOP + Math.round((H - PORTRAIT_TOP - PORTRAIT_BOTTOM - VISIBLE * CELL) / 2);
    HOLD_X = BOARD_X; HOLD_Y = BOARD_Y - 100; HOLD_W = 92;
    NEXT_X = BOARD_X + HOLD_W + 14; NEXT_Y = HOLD_Y; NEXT_W = COLS * CELL - HOLD_W - 14;
  }
  BOARD_W = CELL * COLS;
  BOARD_H = CELL * VISIBLE;
}

/** Paleta de acento: cambia con cada nivel. */
export const ACCENTS = [0xffd23f, 0x2fb4ff, 0x3ee06a, 0xff3b5c, 0x9a7bff, 0xff9a2e, 0xff7ac0, 0x5af0e0];
export const accentFor = (level: number) => ACCENTS[(level - 1) % ACCENTS.length];

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Tinta de las hiperperks (barra de carga, marco y textos). En CSS es `--hyper`. */
export const HYPER_COLOR = 0xb07aff;
