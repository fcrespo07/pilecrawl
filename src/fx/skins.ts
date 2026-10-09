// Pieles de la interfaz. Son solo aspecto: las ponen algunos perks (`mods.skin`) y no tocan las reglas.

export type SkinId = 'papel' | 'apagon' | 'terminal' | 'neon' | 'plano';

export interface Skin {
  /** Degradado del fondo del lienzo, de arriba abajo. */
  bg0: number;
  bg1: number;
  /** Trazos, rejilla y texto. */
  ink: number;
  /** Contorno de los textos flotantes. */
  paper: number;
  /** Fondo del tablero y de la barra de piezas. */
  panel: number;
  /** Fondo oscuro: los colores de texto y acento se aclaran para que se lean. */
  dark: boolean;
}

export const SKINS: Record<SkinId, Skin> = {
  papel: { bg0: 0xe9e1cc, bg1: 0xe2d8bf, ink: 0x1b1a17, paper: 0xf3ecdc, panel: 0xfbf6ea, dark: false },
  apagon: { bg0: 0x14161f, bg1: 0x0c0d13, ink: 0xd9d4c4, paper: 0x14161f, panel: 0x1b1e29, dark: true },
  terminal: { bg0: 0x061209, bg1: 0x020803, ink: 0x6dff8e, paper: 0x061209, panel: 0x0a1a0e, dark: true },
  neon: { bg0: 0x0b0716, bg1: 0x05030b, ink: 0xf2e9ff, paper: 0x0b0716, panel: 0x120c22, dark: true },
  plano: { bg0: 0x1d4f86, bg1: 0x163f6d, ink: 0xeaf2ff, paper: 0x1d4f86, panel: 0x235b98, dark: true },
};

export const skinOf = (id: SkinId | null | undefined): Skin => SKINS[id ?? 'papel'];
