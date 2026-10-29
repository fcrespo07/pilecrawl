// Idioma de la interfaz: español e inglés. Por defecto sigue el idioma del navegador; se cambia en Ajustes.
// Solo cubre lo que pasa por `t()` o lleva `data-i18n*` en index.html. El resto (catálogo, expedición, partida) sigue en español.
import { en } from './en';
import { es, type Key } from './es';

export type Lang = 'es' | 'en';
export type LangSetting = Lang | 'auto';
export type { Key };

const KEY = 'blockrogue.lang';
const DICT: Record<Lang, Record<Key, string>> = { es, en };

/** Idioma del navegador: español si empieza por «es», inglés en el resto de casos. */
export function detectLang(): Lang {
  let tag = '';
  try {
    tag = navigator.languages?.[0] ?? navigator.language ?? '';
  } catch {
    /* sin navigator */
  }
  return tag.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function resolveLang(setting: LangSetting): Lang {
  return setting === 'auto' ? detectLang() : setting;
}

export function loadLangSetting(): LangSetting {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'es' || v === 'en') return v;
  } catch {
    /* sin almacenamiento: automático */
  }
  return 'auto';
}

function saveLangSetting(v: LangSetting) {
  try {
    if (v === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch {
    /* sin almacenamiento: la elección dura solo esta visita */
  }
}

/** Idioma en uso (objeto vivo: cambia con `setLangSetting`). */
export const current = { lang: resolveLang(loadLangSetting()) };

/** Texto de una clave en el idioma en uso. Si falta, cae al español. `{nombre}` se sustituye por `vars`. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[current.lang][key] ?? es[key];
  if (vars) for (const [name, value] of Object.entries(vars)) s = s.replaceAll(`{${name}}`, String(value));
  return s;
}

/** Locale para números y fechas. */
export function locale(): string {
  return current.lang === 'es' ? 'es-ES' : 'en-US';
}

/**
 * Pone los textos de la página:
 * - `data-i18n="clave"` → texto del elemento;
 * - `data-i18n-html="clave"` → HTML del elemento (solo para textos nuestros, con <kbd> etc.);
 * - `data-i18n-attr="aria-label=clave;title=clave2"` → atributos.
 */
export function applyLang(root: ParentNode = document) {
  document.documentElement.lang = current.lang;
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as Key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml as Key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr!.split(';')) {
      const [attr, key] = pair.split('=');
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim() as Key));
    }
  });
}

/** Cambia el idioma en vivo: guarda la elección, repinta los textos fijos y avisa (`langchange`) a quien pinta texto dinámico. */
export function setLangSetting(v: LangSetting) {
  saveLangSetting(v);
  current.lang = resolveLang(v);
  applyLang();
  window.dispatchEvent(new Event('langchange'));
}
