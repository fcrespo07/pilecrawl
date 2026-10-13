// Ojos del marcianito del logo: las pupilas miran al cursor (o al último toque).
// El logo es un PNG de 256 px. Cada ojo es un cuadro blanco de 32×32 con una pupila
// negra de 16×16 dentro. Las pupilas se mueven en pasos de 8 px (3×3 posiciones),
// así que siguen siendo píxeles enteros. Se repinta solo al cambiar de posición.
// En reposo la pupila queda donde la tiene el logo original: abajo a la derecha.

const SIZE = 256;
const SCLERA = 32;
const PUPIL = 16;
const STEP = 8;
const EYE_X = [80, 144];
const EYE_Y = 64;
const WHITE = '#ffffff';
const BLACK = '#05060f';
// Zona muerta: el cursor tiene que salirse de la mitad central para que la pupila se desplace.
const DEAD = 0.12;
// Tras tocar, los ojos miran al toque un rato y luego vuelven a su posición de reposo.
const TOUCH_HOLD_MS = 1500;
const REST = 2;

export function initLogoEyes(canvas: HTMLCanvasElement, isShown: () => boolean): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = SIZE;
  canvas.height = SIZE;

  let ix = REST;
  let iy = REST;
  let touchTimer = 0;
  let ready = false;

  const paint = () => {
    if (!ready) return;
    ctx.fillStyle = WHITE;
    for (const ex of EYE_X) ctx.fillRect(ex, EYE_Y, SCLERA, SCLERA);
    ctx.fillStyle = BLACK;
    for (const ex of EYE_X) ctx.fillRect(ex + ix * STEP, EYE_Y + iy * STEP, PUPIL, PUPIL);
  };

  // Dirección de un punto de pantalla respecto al centro del logo, en 0, 1 o 2 por eje.
  const aim = (x: number, y: number) => {
    const r = canvas.getBoundingClientRect();
    const dx = (x - (r.left + r.width / 2)) / r.width;
    const dy = (y - (r.top + r.height / 2)) / r.height;
    const pick = (d: number) => (d < -DEAD ? 0 : d > DEAD ? 2 : 1);
    return [pick(dx), pick(dy)] as const;
  };

  const look = (x: number, y: number) => {
    // Con la portada oculta (partida, catálogo...) no hace nada: ni mide el logo ni repinta.
    if (!isShown()) return;
    const [nx, ny] = aim(x, y);
    if (nx === ix && ny === iy) return;
    ix = nx;
    iy = ny;
    paint();
  };

  const rest = () => {
    ix = REST;
    iy = REST;
    paint();
  };

  // Se dibuja el sprite una vez; después solo cambian los dos cuadros de cada ojo.
  const sprite = new Image();
  sprite.onload = () => {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, 0, 0, SIZE, SIZE);
    ready = true;
    paint();
  };
  sprite.src = canvas.dataset.src ?? '/logo.png';

  // Con movimiento reducido el logo se queda quieto en su posición de reposo.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    look(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    look(e.clientX, e.clientY);
    window.clearTimeout(touchTimer);
    touchTimer = window.setTimeout(rest, TOUCH_HOLD_MS);
  }, { passive: true });
}
