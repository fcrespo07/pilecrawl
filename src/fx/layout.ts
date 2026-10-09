// Coordenadas lógicas del escenario (se escala para encajar en la ventana).
export const W = 960;
export const H = 720;
export const CELL = 30;
export const BOARD_X = 330;
export const BOARD_Y = 60;
export const BOARD_W = CELL * 10;
export const BOARD_H = CELL * 20;

export const HOLD_X = 180;
export const HOLD_Y = 60;
export const HOLD_W = 130;

export const NEXT_X = 650;
export const NEXT_Y = 60;
export const NEXT_W = 130;

/** Paleta de acento: cambia con cada nivel. */
export const ACCENTS = [0x2ef2ff, 0xff4dd2, 0x9dff4d, 0xffa13d, 0xa66bff, 0x4dffc3, 0xff5a5a, 0xffe14d];
export const accentFor = (level: number) => ACCENTS[(level - 1) % ACCENTS.length];

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
