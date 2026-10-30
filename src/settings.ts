// Ajustes del jugador guardados en el navegador: teclas y manejo (DAS/ARR). El volumen vive en fx/audio.ts.
// Las teclas solo cambian qué tecla dispara cada acción: las acciones y las repeticiones son las de siempre.

import { current, t, type Key } from './i18n';

/** Acciones de juego que se pueden asignar a teclas (y que también disparan los gestos táctiles). */
export const ACTIONS = ['left', 'right', 'down', 'hard', 'cw', 'ccw', 'r180', 'hold', 'hyper', 'skill'] as const;
export type Action = (typeof ACTIONS)[number];

const ACTION_ES: Record<Action, string> = {
  left: 'Mover a la izquierda',
  right: 'Mover a la derecha',
  down: 'Bajar',
  hard: 'Soltar',
  cw: 'Girar',
  ccw: 'Girar al revés',
  r180: 'Girar 180°',
  hold: 'Reserva',
  hyper: 'Hiperperk',
  skill: 'Habilidad',
};

/** Nombre de una acción en el idioma en uso. */
export const actionLabel = (a: Action): string => t(`act.${a}` as Key);
export const ACTION_LABEL = ACTION_ES;

/** Teclas por acción (códigos físicos de `KeyboardEvent.code`). */
export type Keymap = Record<Action, string[]>;

export const DEFAULT_KEYS: Readonly<Keymap> = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  down: ['ArrowDown'],
  hard: ['Space'],
  cw: ['ArrowUp', 'KeyX'],
  ccw: ['KeyZ', 'ControlLeft', 'ControlRight'],
  r180: ['KeyA'],
  hold: ['KeyC', 'ShiftLeft', 'ShiftRight'],
  hyper: ['KeyD'],
  skill: ['KeyQ'],
};

/** Huecos de tecla por acción que enseña la pantalla de ajustes. */
export const SLOTS = 3;

/** Teclas que la interfaz ya usa y no se pueden asignar a una acción. */
export const RESERVED = new Set(['Escape', 'Enter', 'NumpadEnter', 'Tab', 'KeyP', 'KeyM', 'KeyN', 'KeyF']);

export interface Handling {
  das: number; // ms hasta que empieza el autorepeat
  arr: number; // ms entre repeticiones (0 = instantáneo)
}

export const DEFAULT_HANDLING: Readonly<Handling> = { das: 130, arr: 25 };
export const DAS_RANGE = { min: 50, max: 300, step: 5 };
export const ARR_RANGE = { min: 0, max: 80, step: 5 };

const KEYS_KEY = 'blockrogue.keys';
const HANDLING_KEY = 'blockrogue.handling';
const MOUSE_KEY = 'blockrogue.mouse';

/** Control con ratón en escritorio (objeto vivo; activado por defecto). */
export const mouseOn = { value: true };

export function setMouse(on: boolean) {
  mouseOn.value = on;
  write(MOUSE_KEY, on);
}


const copy = (k: Readonly<Keymap>): Keymap => Object.fromEntries(ACTIONS.map((a) => [a, [...k[a]]])) as Keymap;

/** Teclas en uso. Es un objeto vivo: `Input` lo lee en cada pulsación. */
export const keymap: Keymap = copy(DEFAULT_KEYS);
/** Manejo en uso (objeto vivo). */
export const handling: Handling = { ...DEFAULT_HANDLING };

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: el ajuste dura lo que la pestaña */
  }
}

/** Deja un valor numérico dentro de su rango y en su paso; si no es un número, el de por defecto. */
function clampTo(v: unknown, r: { min: number; max: number; step: number }, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(r.max, Math.max(r.min, Math.round(v / r.step) * r.step));
}

/** Lee lo guardado (con cuidado: el JSON puede venir roto o editado a mano). */
export function loadSettings() {
  const k = read(KEYS_KEY);
  const next = copy(DEFAULT_KEYS);
  if (k && typeof k === 'object') {
    const used = new Set<string>();
    for (const a of ACTIONS) {
      const list = (k as Record<string, unknown>)[a];
      if (!Array.isArray(list)) continue;
      const clean = list.filter((c): c is string => typeof c === 'string' && c.length > 0 && c.length < 24 && !RESERVED.has(c) && !used.has(c)).slice(0, SLOTS);
      clean.forEach((c) => used.add(c));
      next[a] = clean;
    }
    // las acciones que no estaban guardadas (nuevas desde entonces) no se quedan con una tecla que ya usa otra
    for (const a of ACTIONS) if (!Array.isArray((k as Record<string, unknown>)[a])) next[a] = DEFAULT_KEYS[a].filter((c) => !used.has(c));
  }
  for (const a of ACTIONS) keymap[a] = next[a];
  mouseOn.value = read(MOUSE_KEY) !== false;
  const h = read(HANDLING_KEY) as Partial<Handling> | null;
  handling.das = clampTo(h?.das, DAS_RANGE, DEFAULT_HANDLING.das);
  handling.arr = clampTo(h?.arr, ARR_RANGE, DEFAULT_HANDLING.arr);
}

/** Acción que dispara una tecla, o null si no tiene ninguna. */
export function actionOf(code: string): Action | null {
  for (const a of ACTIONS) if (keymap[a].includes(code)) return a;
  return null;
}

/**
 * Asigna una tecla a un hueco de una acción. Si otra acción la tenía, se la quita (cada tecla hace una sola cosa).
 * Devuelve el nombre de la acción a la que se la quitó, para avisar. `code` null vacía el hueco.
 */
export function bindKey(action: Action, slot: number, code: string | null): Action | null {
  let stolen: Action | null = null;
  if (code) {
    for (const a of ACTIONS) {
      const i = keymap[a].indexOf(code);
      if (i < 0 || (a === action && i === slot)) continue;
      keymap[a].splice(i, 1);
      if (a !== action) stolen = a;
      // quitar un hueco anterior desplaza los demás: el hueco pedido se recoloca
      if (a === action && i < slot) slot--;
    }
  }
  const list = keymap[action];
  if (code) list[Math.min(slot, list.length)] = code;
  else list.splice(slot, 1);
  write(KEYS_KEY, keymap);
  return stolen;
}

export function resetKeys() {
  for (const a of ACTIONS) keymap[a] = [...DEFAULT_KEYS[a]];
  write(KEYS_KEY, keymap);
}

export function setHandling(key: keyof Handling, v: number) {
  handling[key] = clampTo(v, key === 'das' ? DAS_RANGE : ARR_RANGE, DEFAULT_HANDLING[key]);
  write(HANDLING_KEY, handling);
}

export function resetHandling() {
  Object.assign(handling, DEFAULT_HANDLING);
  write(HANDLING_KEY, handling);
}

const NAMES: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'Espacio',
  ControlLeft: 'Ctrl izq',
  ControlRight: 'Ctrl der',
  ShiftLeft: 'Mayús izq',
  ShiftRight: 'Mayús der',
  AltLeft: 'Alt izq',
  AltRight: 'Alt der',
  Backspace: 'Retroceso',
  Delete: 'Supr',
  Insert: 'Ins',
  Home: 'Inicio',
  End: 'Fin',
  PageUp: 'Re Pág',
  PageDown: 'Av Pág',
  CapsLock: 'Bloq Mayús',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '<',
  NumpadAdd: 'Núm +',
  NumpadSubtract: 'Núm -',
  NumpadMultiply: 'Núm *',
  NumpadDivide: 'Núm /',
  NumpadDecimal: 'Núm .',
};

const NAMES_EN: Record<string, string> = {
  Space: 'Space',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  AltLeft: 'Left Alt',
  AltRight: 'Right Alt',
  Backspace: 'Backspace',
  Delete: 'Del',
  Insert: 'Ins',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  CapsLock: 'Caps Lock',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .',
};

/** Nombre corto de una tecla para enseñarlo en pantalla («KeyX» → «X», «ShiftLeft» → «Mayús»). */
export function keyLabel(code: string): string {
  if (current.lang === 'en' && NAMES_EN[code]) return NAMES_EN[code];
  if (NAMES[code]) return NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `${current.lang === 'en' ? 'Num' : 'Núm'} ${code.slice(6)}`;
  return code;
}

/** Hasta `max` nombres distintos de las teclas de una acción (Mayús izquierdo y derecho cuentan como uno). */
export function keyLabels(action: Action, max = 1): string[] {
  const out: string[] = [];
  for (const c of keymap[action]) {
    // en los textos cortos, izquierda y derecha son la misma tecla
    const l = keyLabel(c).replace(/ (izq|der)$/, '').replace(/^(Left|Right) /, '');
    if (!out.includes(l)) out.push(l);
    if (out.length >= max) break;
  }
  return out;
}

/** Primera tecla de una acción para textos sueltos («D»). Sin tecla asignada, un guion. */
export const keyName = (action: Action): string => keyLabels(action)[0] ?? '–';

loadSettings();
