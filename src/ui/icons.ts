import { PIECES } from '../core/pieces';

// Iconos de línea 32×32 dibujados a mano. Usan currentColor para teñirse con la rareza.
const B = (x: number, y: number, s = 6) =>
  `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="1" fill="currentColor" fill-opacity=".35"/>`;

const PATHS: Record<string, string> = {
  vision: `<path d="M3 16c3.5-6 8-9 13-9s9.5 3 13 9c-3.5 6-8 9-13 9S6.5 22 3 16z"/>${B(13, 13)}<rect x="13" y="13" width="6" height="6" rx="1"/>`,
  feather: `<path d="M26 4C15 5 8 13 7 25"/><path d="M26 4c2 10-6 17-15 16"/><path d="M7 25l-3 3"/><path d="M13 16l7-1.5M10.5 21l6-.5"/>`,
  grip: `<circle cx="16" cy="18" r="10"/><path d="M16 18v-6M12 3h8M16 3v5M25 8l2.5-2.5"/>${B(13, 20, 6)}`,
  greed: `<path d="M9 5h14l6 8-13 15L3 13z"/><path d="M3 13h26M12 5l-2 8 6 15 6-15-2-8"/>`,
  shortcut: `<path d="M3 7h6v6h6v6h6v6h8"/><path d="M27 3v11M23 10l4 4 4-4"/>`,
  chain: `<rect x="2" y="11" width="16" height="10" rx="5" transform="rotate(-35 10 16)"/><rect x="14" y="11" width="16" height="10" rx="5" transform="rotate(-35 22 16)"/>`,
  dike: `<rect x="4" y="6" width="24" height="20" rx="1"/><path d="M4 12.7h24M4 19.3h24M12 6v6.7M21 6v6.7M8 12.7v6.6M16.5 12.7v6.6M25 12.7v6.6M12 19.3V26M21 19.3V26"/>`,
  dice: `<rect x="5" y="5" width="22" height="22" rx="5"/><circle cx="11" cy="11" r="1.6" fill="currentColor"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/><circle cx="21" cy="21" r="1.6" fill="currentColor"/><circle cx="21" cy="11" r="1.6" fill="currentColor"/><circle cx="11" cy="21" r="1.6" fill="currentColor"/>`,
  hammer: `<path d="M4 11l7-7 7 7-7 7z" fill="currentColor" fill-opacity=".35"/><path d="M14.5 14.5L28 28"/>`,
  clover: `<path d="M16 16c-6-1-9-4-7-8s7-1 7 3c0-4 5-7 7-3s-1 7-7 8c6 1 9 4 7 8s-7 1-7-3c0 4-5 7-7 3s1-7 7-8z"/><path d="M16 16c4 5 8 8 12 12"/>`,
  doublehold: `<rect x="3" y="4" width="18" height="12" rx="2"/><rect x="11" y="16" width="18" height="12" rx="2"/>${B(9, 7, 6)}${B(17, 19, 6)}`,
  freehold: `<path d="M26 13A10 10 0 0 0 8 9"/><path d="M8 3v6h6"/><path d="M6 19a10 10 0 0 0 18 4"/><path d="M24 29v-6h-6"/>${B(13, 13)}`,
  bomb: `<circle cx="14" cy="19" r="9"/><path d="M20 12.5l3-3"/><path d="M23 9.5c.5-3 3.5-4 5.5-2.5"/><path d="M28 2v2.5M30.5 4.5l-2 1M25 3.5l1 1.5"/><path d="M9.5 16.5a5 5 0 0 1 4-3" stroke-opacity=".6"/>`,
  drill: `<path d="M3 16h7"/><path d="M10 10h7l11 6-11 6h-7z"/><path d="M17 10l-2 6 2 6M22 12.7l-1.5 3.3 1.5 3.3"/>`,
  gold: `<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="8" stroke-opacity=".5"/>${B(13, 13)}`,
  irain: `${B(5, 12, 4)}<rect x="5" y="4" width="4" height="22" rx="1"/><rect x="14" y="2" width="4" height="22" rx="1" fill="currentColor" fill-opacity=".35"/><rect x="23" y="8" width="4" height="22" rx="1"/>`,
  life: `<path d="M16 27S4 19.5 4 11.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 12 3.5C28 19.5 16 27 16 27z"/><path d="M16 12v8M12 16h8"/>`,
  exp: `<path d="M7 27l9-6 9 6"/><path d="M7 19l9-6 9 6" stroke-opacity=".75"/><path d="M7 11l9-6 9 6" stroke-opacity=".5"/>`,
  allspin: `<path d="M16 16m-1.5 0a1.5 1.5 0 1 0 3 0a3.5 3.5 0 1 0-7 0a5.5 5.5 0 1 0 11 0a7.5 7.5 0 1 0-15 0a9.5 9.5 0 1 0 19 0a11.5 11.5 0 1 0-23 0"/>`,
  b2b: `<path d="M16 29c-6 0-9.5-4-9.5-9 0-6 5.5-8 5.5-15 4 2.5 6.5 5.5 6.5 9.5 1-1.5 2-3 2-5.5 3.5 3 5.5 6.5 5.5 11 0 5-3.5 9-10 9z"/><path d="M16 29c-2.5 0-4-1.8-4-4 0-3 4-4.5 4-8 2.2 2 4 4.5 4 8 0 2.2-1.5 4-4 4z" fill="currentColor" fill-opacity=".35"/>`,
  eternal: `<path d="M16 16c-3-4-5.2-6-8.2-6a6 6 0 0 0 0 12c3 0 5.2-2 8.2-6s5.2-6 8.2-6a6 6 0 0 1 0 12c-3 0-5.2-2-8.2-6z"/>`,
  instinct: `<path d="M8 3h16M8 29h16"/><path d="M10 3c0 7 6 8.5 6 13s-6 6-6 13M22 3c0 7-6 8.5-6 13s6 6 6 13"/><path d="M12 27h8l-4-4.5z" fill="currentColor" fill-opacity=".6"/>`,
  interest: `<path d="M3 28h26"/><path d="M5 22l6.5-6.5 5 4L26 9"/><path d="M19.5 9H26v6.5"/>`,
  pact: `<path d="M6 3c-.5 6 2.5 10 7 11M26 3c.5 6-2.5 10-7 11"/><circle cx="16" cy="20" r="8.5"/><path d="M12 18.5l2.5 1.5M20 18.5l-2.5 1.5M12.5 24c2 1.3 5 1.3 7 0"/>`,
  quake: `<path d="M2 18h6l2.5-5 3.5 11 3.5-16 3.5 13 2.5-3H30"/><path d="M5 27h22" stroke-opacity=".5"/>`,
  breather: `<path d="M16 15V4M11 9l5-5 5 5"/><rect x="4" y="19" width="24" height="9" rx="1" stroke-dasharray="3 2.5"/>${B(7, 21, 5)}${B(13.5, 21, 5)}${B(20, 21, 5)}`,
  savings: `<path d="M6 13h20v14H6z"/><path d="M12 13V9a4 4 0 0 1 8 0v4"/>${B(13, 17, 6)}`,
  harvest: `<path d="M16 29V13"/><path d="M16 21c-5 0-8-3-9-8 5 0 8 3 9 8zM16 17c5 0 8-3 9-8-5 0-8 3-9 8z"/><path d="M16 13c-2-2-2-6 0-9 2 3 2 7 0 9z" fill="currentColor" fill-opacity=".35"/>`,
  reflex: `<path d="M18 3L7 18h8l-2 11 12-16h-8z"/>`,
  recycle: `<path d="M9 13l4-7h6l2.5 4.5"/><path d="M24 15l3 6-3 5h-5"/><path d="M14 26H8l-3-5 2.5-4.5"/><path d="M19.5 7.5l2 3 3-1.5M17 23.5l2 2.5-2 2.5M5.5 19l2-2.5 3 1"/>`,
  vertigo: `<path d="M5 29h22"/>${B(8, 23, 5)}${B(8, 17, 5)}${B(13, 11, 5)}${B(13, 5, 5)}<path d="M24 4v12M21 13l3 3 3-3" stroke-opacity=".6"/>`,
  lifeline: `<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="5"/><path d="M8.2 8.2l4.3 4.3M23.8 8.2l-4.3 4.3M8.2 23.8l4.3-4.3M23.8 23.8l-4.3-4.3"/>`,
  fan: `<rect x="3" y="9" width="8" height="12" rx="1.5" transform="rotate(-24 7 15)"/><rect x="10" y="6" width="8" height="12" rx="1.5" transform="rotate(-8 14 12)"/><rect x="16" y="6" width="8" height="12" rx="1.5" transform="rotate(8 20 12)"/><rect x="21" y="9" width="8" height="12" rx="1.5" transform="rotate(24 25 15)"/><path d="M16 29v-8"/>`,
  anchor: `<circle cx="16" cy="6" r="2.5"/><path d="M16 8.5V28M10 13h12"/><path d="M5 19c0 5 5 9 11 9s11-4 11-9"/><path d="M3 21l2-3 3 2M29 21l-2-3-3 2"/>`,
  collector: `<rect x="4" y="4" width="10" height="10" rx="2"/><rect x="18" y="4" width="10" height="10" rx="2" fill="currentColor" fill-opacity=".35"/><rect x="4" y="18" width="10" height="10" rx="2" fill="currentColor" fill-opacity=".35"/><rect x="18" y="18" width="10" height="10" rx="2" stroke-dasharray="3 2.5"/>`,
  phoenix: `<path d="M16 29c-5-3-6-8-4-13-4 1-7-2-9-6 4 0 7 1 9 3 0-4 2-7 4-10 2 3 4 6 4 10 2-2 5-3 9-3-2 4-5 7-9 6 2 5 1 10-4 13z"/><path d="M16 15v10" stroke-opacity=".6"/>`,
  blueprint: `<rect x="4" y="5" width="24" height="22" rx="1"/><path d="M4 11h24M10 5v22" stroke-opacity=".45"/><path d="M14 22l4-7 5 7z"/><circle cx="20" cy="11" r="1.4" fill="currentColor"/>`,
  blackout: `<path d="M24 20.5A10 10 0 0 1 11.5 8 10 10 0 1 0 24 20.5z"/><path d="M22 5v4M20 7h4M27 11v3M25.5 12.5h3" stroke-opacity=".6"/>`,
  terminal: `<rect x="3" y="5" width="26" height="19" rx="2"/><path d="M8 11l4 3-4 3M14 18h6"/><path d="M11 28h10M16 24v4"/>`,
  neon: `<path d="M5 25V8l10 17V8"/><path d="M20 8h7M20 16.5h6M20 25h7M20 8v17"/><path d="M5 25V8l10 17V8M20 8v17" stroke-opacity=".3" stroke-width="5"/>`,
  // hiperperks
  slowmo: `<circle cx="16" cy="17" r="11"/><path d="M16 10v7l4 3"/><path d="M12 3h8"/><path d="M5 9.5L3 7.5M27 9.5l2-2" stroke-opacity=".6"/>`,
  frenzy: `<path d="M5 25l6-9-6-9M14 25l6-9-6-9M23 25l6-9-6-9"/>`,
  sand: `<path d="M5 29h22"/>${B(5, 23, 5)}${B(11, 23, 5)}${B(22, 23, 5)}${B(5, 17, 5)}<rect x="16.5" y="23" width="5" height="5" rx="1" stroke-dasharray="2 1.5"/><path d="M19 4v13M15.5 13.5L19 17l3.5-3.5"/>`,
  barrage: `<circle cx="9" cy="21" r="6"/><circle cx="22" cy="12" r="6"/><path d="M13 16.5l2-2M26.5 7.5l2-2"/><path d="M27 22l2 2M24 26l1 3M20 24l-1 3" stroke-opacity=".6"/>`,
  wipe: `<path d="M4 28h24"/><path d="M8 22l12-14 6 5-12 14H9z"/><path d="M14 16l6 5" stroke-opacity=".6"/><path d="M4 8h5M3 13h4" stroke-opacity=".5"/>`,
  prism: `<path d="M15 5l10 18H5z"/><path d="M1 17.5l9.5-2"/><path d="M20 13.5l11-5M21.2 15.7H31M20.5 18l10.5 4.5" stroke-opacity=".75"/>`,
};

/** Perks de pieza: el icono es la propia pieza. */
const PIECE_PERKS: Record<string, string> = {
  domino: 'D2',
  corner: 'V3',
  shortbar: 'I3',
  mono: 'M1',
  hook: 'P5',
  cross: 'X5',
};

function pieceIcon(key: string): string {
  const cells = PIECES[key].shapes[0];
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const w = Math.max(...xs) - Math.min(...xs) + 1;
  const h = Math.max(...ys) - Math.min(...ys) + 1;
  const s = Math.min(24 / w, 24 / h, 13);
  const ox = 16 - (w * s) / 2 - Math.min(...xs) * s;
  const oy = 16 - (h * s) / 2 - Math.min(...ys) * s;
  return cells
    .map(([x, y]) => {
      const px = (ox + x * s + 0.75).toFixed(2);
      const py = (oy + y * s + 0.75).toFixed(2);
      const sz = (s - 1.5).toFixed(2);
      return `<rect x="${px}" y="${py}" width="${sz}" height="${sz}" rx="1" fill="currentColor" fill-opacity=".35"/>`;
    })
    .join('');
}

/** Sello de las maldiciones: un hexágono roto. */
const CURSE_ICON = `<path d="M16 3l11 6.5v13L16 29 5 22.5v-13z"/><path d="M15 3.6l2.5 7-4 4 4 5-2 9.6" stroke-opacity=".7"/>`;

export function perkIcon(id: string): string {
  const inner = PIECE_PERKS[id] ? pieceIcon(PIECE_PERKS[id]) : (PATHS[id] ?? (id.startsWith('c_') ? CURSE_ICON : ''));
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/** Iconos sueltos del HUD. */
export const UI_ICONS = {
  heart: perkIcon('life').replace('<path d="M16 12v8M12 16h8"/>', ''),
  die: perkIcon('dice'),
  flame: perkIcon('b2b'),
};
