// Casilla de privacidad.html para activar o apagar las estadísticas anónimas.
import { setStatsEnabled, statsEnabled } from './net/statsOptOut';

const box = document.getElementById('stats-optout') as HTMLInputElement;
box.checked = statsEnabled();
if (navigator.doNotTrack === '1') box.disabled = true;
box.addEventListener('change', () => setStatsEnabled(box.checked));
