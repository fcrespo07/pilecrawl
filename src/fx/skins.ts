// Pieles de la interfaz. Son solo aspecto: las ponen las hiperperks mientras están activas y no tocan las reglas.
// La de base es Píxel; las de los perks cambian sus colores y mantienen los bloques de píxeles.

export type SkinId = 'pixel' | 'apagon' | 'terminal' | 'neon' | 'plano' | 'hielo' | 'magma' | 'oro';

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
  /** Cielo de estrellas y colinas de píxeles al fondo (solo la piel de base). */
  stars?: boolean;
  /** Color del estallido de pantalla al soltar la hiperperk que pone esta piel. */
  burst?: number;
}

export const SKINS: Record<SkinId, Skin> = {
  pixel: { bg0: 0x1d2142, bg1: 0x11132a, ink: 0xf4f0e6, paper: 0x11132a, panel: 0x14172f, dark: true, stars: true },
  // modo noche: mismo cielo de estrellas y colinas que la base, pero más oscuro
  apagon: { bg0: 0x161a3d, bg1: 0x0a0c20, ink: 0xd9d4c4, paper: 0x0e1128, panel: 0x1b1e29, dark: true, stars: true, burst: 0xffb13d },
  terminal: { bg0: 0x061209, bg1: 0x020803, ink: 0x6dff8e, paper: 0x061209, panel: 0x0a1a0e, dark: true, burst: 0x6dff8e },
  neon: { bg0: 0x0b0716, bg1: 0x05030b, ink: 0xf2e9ff, paper: 0x0b0716, panel: 0x120c22, dark: true, burst: 0xff4dd2 },
  // panel muy oscuro: las piezas azules tienen que destacar sobre el plano
  plano: { bg0: 0x1a426f, bg1: 0x133457, ink: 0xeaf2ff, paper: 0x0f2f55, panel: 0x0f2f55, dark: true, burst: 0x6fb6ff },
  hielo: { bg0: 0x0d3550, bg1: 0x08202f, ink: 0xe6faff, paper: 0x082436, panel: 0x0b2c42, dark: true, burst: 0x8fe8ff },
  magma: { bg0: 0x3a0f08, bg1: 0x1c0704, ink: 0xffd9b0, paper: 0x1c0704, panel: 0x2a0c06, dark: true, burst: 0xff6a2b },
  oro: { bg0: 0x3a2a08, bg1: 0x1f1604, ink: 0xfff0b8, paper: 0x1f1604, panel: 0x2b1f06, dark: true, burst: 0xffd23f },
};

export const skinOf = (id: SkinId | null | undefined): Skin => SKINS[id ?? 'pixel'];
