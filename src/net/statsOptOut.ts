// Preferencia de estadísticas anónimas (privacidad.html). Aparte de stats.ts para no cargar el juego en la página legal.
const OPT_OUT_KEY = 'blockrogue.stats';

export const statsEnabled = (): boolean => {
  try {
    if (localStorage.getItem(OPT_OUT_KEY) === '0') return false;
  } catch {
    /* sin almacenamiento: se queda como está */
  }
  return navigator.doNotTrack !== '1';
};

export function setStatsEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(OPT_OUT_KEY);
    else localStorage.setItem(OPT_OUT_KEY, '0');
  } catch {
    /* sin almacenamiento: no se puede recordar */
  }
}
