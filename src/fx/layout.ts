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
export const ACCENTS = [0x1f5fa8, 0xb8336a, 0x4c7d1c, 0xb06a14, 0x6a3fb0, 0x157a66, 0xb83a2e, 0x8a6d00];
export const accentFor = (level: number) => ACCENTS[(level - 1) % ACCENTS.length];

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
