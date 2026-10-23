// Pasada final de pantalla: un solo shader que sirve a varios efectos, para no apilar filtros.
//  - (la rejilla de monitor fija ya no va aquí: es un Graphics estático del renderer, para que en reposo no haya pasada de pantalla)
//  - aberración cromática: se abre con las sacudidas y los golpes grandes
//  - pixelado: un estallido que se cierra solo (subida de nivel, hiperperk)
//  - tinte: un pulso de color de pantalla completa (hiperperk activa)
//  - ondulación: temblor horizontal del dibujo (Terremoto en todo, Furia en los márgenes, Fénix en las filas de abajo)
//  - barrido arcoíris: una franja diagonal que cruza la pantalla (Prisma, subida de nivel)
import { Filter, GlProgram, type UniformGroup } from 'pixi.js';
import { BOARD_H, BOARD_W, BOARD_X, BOARD_Y, CELL, H, W } from './layout';

const VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

const FRAGMENT = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uParams;  // x: rejilla, y: aberración, z: pixelado (px lógicos), w: fuerza del tinte
uniform vec3 uTint;
uniform vec2 uSize;    // tamaño lógico del escenario
uniform vec4 uWave;    // x: amplitud en todo, y: en los márgenes, z: en las filas de abajo (px lógicos), w: tiempo
uniform vec4 uBoard;   // tablero en uv: x0, x1, y de la franja de abajo, y inferior
uniform vec2 uPrism;   // x: posición del barrido (fuera de 0..1.6 = apagado), y: fuerza

void main(void) {
  vec2 uv = vTextureCoord;
  if (uParams.z > 0.5) {
    vec2 cell = uParams.z / uSize;
    uv = (floor(uv / cell) + 0.5) * cell;
  }
  if (uWave.x + uWave.y + uWave.z > 0.001) {
    bool inside = uv.x > uBoard.x && uv.x < uBoard.y;
    bool band = inside && uv.y > uBoard.z && uv.y < uBoard.w;
    float amp = uWave.x + (inside ? 0.0 : uWave.y) + (band ? uWave.z : 0.0);
    uv.x += sin(uv.y * 38.0 + uWave.w * 7.0) * amp / uSize.x;
  }
  vec2 d = uv - 0.5;
  vec2 off = d * uParams.y;
  vec4 c = vec4(texture(uTexture, uv + off).r, texture(uTexture, uv).g, texture(uTexture, uv - off).b, 1.0);

  // rejilla: una línea oscura cada 3 px lógicos
  float row = fract(vTextureCoord.y * uSize.y / 3.0);
  c.rgb *= 1.0 - uParams.x * smoothstep(0.55, 1.0, row);

  // tinte: más fuerte hacia los bordes, para que el tablero se siga leyendo
  float edge = smoothstep(0.1, 0.75, length(d));
  c.rgb = mix(c.rgb, c.rgb * (0.7 + uTint * 0.9) + uTint * 0.12, uParams.w * (0.35 + 0.65 * edge));
  if (uPrism.y > 0.001) {
    float diag = vTextureCoord.x + vTextureCoord.y * 0.6;
    float band = exp(-pow((diag - uPrism.x) * 5.0, 2.0));
    vec3 hue = 0.5 + 0.5 * cos(6.2831 * (diag * 2.0 + vec3(0.0, 0.33, 0.67)));
    c.rgb += hue * band * uPrism.y * 0.35;
  }
  finalColor = c;
}
`;

export class PostFx {
  readonly filter: Filter;
  private u: { uParams: Float32Array; uTint: Float32Array; uWave: Float32Array; uBoard: Float32Array; uPrism: Float32Array };
  private group: UniformGroup;

  /** True mientras algún efecto de evento sigue vivo: solo entonces el filtro entra en la cadena. */
  active = false;

  private ab = 0;
  private pix = 0;
  private pixMax = 0;
  private pixT = 0;
  private tint = 0;
  private tintCol: [number, number, number] = [1, 1, 1];

  private size = new Float32Array([W, H]);
  private shake = 0;      // ondulación en todo el dibujo, decae sola
  private prismT = -1;    // barrido arcoíris: segundos desde que salió (-1 = apagado)
  private prismK = 0;
  private time = 0;

  constructor() {
    this.u = { uParams: new Float32Array([0, 0, 0, 0]), uTint: new Float32Array([1, 1, 1]), uWave: new Float32Array(4), uBoard: new Float32Array(4), uPrism: new Float32Array([-1, 0]) };
    this.filter = new Filter({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: FRAGMENT, name: 'block-rogue-post' }),
      resources: {
        postUniforms: {
          uParams: { value: this.u.uParams, type: 'vec4<f32>' },
          uTint: { value: this.u.uTint, type: 'vec3<f32>' },
          uSize: { value: this.size, type: 'vec2<f32>' },
          uWave: { value: this.u.uWave, type: 'vec4<f32>' },
          uBoard: { value: this.u.uBoard, type: 'vec4<f32>' },
          uPrism: { value: this.u.uPrism, type: 'vec2<f32>' },
        },
      },
    });
    this.filter.resolution = 'inherit';
    this.group = this.filter.resources.postUniforms as UniformGroup;
  }

  /** Cambia el tamaño lógico del escenario (cambio de disposición). */
  resize(w: number, h: number) {
    this.size[0] = w;
    this.size[1] = h;
    this.group.update();
  }

  /** Abre la aberración: 1 es un golpe fuerte. */
  aberrate(k: number) { this.ab = Math.min(1.2, Math.max(this.ab, k)); }

  /** Pixelado que se cierra solo: `size` px lógicos de bloque al inicio, `dur` segundos. */
  pixelate(size: number, dur: number) {
    this.pixMax = size;
    this.pix = size;
    this.pixT = dur;
  }

  /** Pulso de color de pantalla completa que se apaga solo. */
  pulse(color: number, k: number) {
    this.tintCol = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
    this.tint = Math.min(1, Math.max(this.tint, k));
  }

  /** Temblor horizontal de toda la imagen que se apaga solo (px lógicos). */
  wobble(amp: number) { this.shake = Math.max(this.shake, amp); }

  /** Barrido arcoíris diagonal; `k` es la fuerza. */
  sweep(k: number) { this.prismT = 0; this.prismK = k; }

  clear() { this.ab = this.pix = this.tint = this.shake = 0; this.prismT = -1; this.active = false; }

  /**
   * `margin` y `low` son ondulaciones sostenidas (0 a 1): `margin` fuera del tablero (calor de Furia),
   * `low` en las tres filas de abajo (calor de Fénix). Sin movimiento no se aplican.
   */
  update(sec: number, motion: boolean, hyperGlow: number, hyperColor: number, margin = 0, low = 0) {
    this.time += sec;
    this.shake *= Math.exp(-sec * 2.5);
    if (this.shake < 0.02) this.shake = 0;
    let prism = 0, prismX = -1;
    if (this.prismT >= 0) {
      this.prismT += sec;
      if (this.prismT > 1) this.prismT = -1;
      else { prismX = -0.3 + this.prismT * 2.2; prism = this.prismK * Math.sin(Math.PI * this.prismT); }
    }
    const wave = this.u.uWave, bd = this.u.uBoard;
    wave[0] = motion ? this.shake : 0;
    wave[1] = motion ? margin * 2.2 : 0;
    wave[2] = motion ? low * 1.6 : 0;
    wave[3] = this.time;
    bd[0] = BOARD_X / this.size[0];
    bd[1] = (BOARD_X + BOARD_W) / this.size[0];
    bd[2] = (BOARD_Y + BOARD_H - CELL * 3) / this.size[1];
    bd[3] = (BOARD_Y + BOARD_H) / this.size[1];
    this.u.uPrism[0] = prismX;
    this.u.uPrism[1] = motion ? prism : prism * 0.5;
    this.ab *= Math.exp(-sec * 5);
    this.tint *= Math.exp(-sec * 3);
    if (this.pix > 0) {
      this.pix -= (this.pixMax / this.pixT) * sec;
      if (this.pix < 2) this.pix = 0;
    }
    const base = hyperGlow > 0 ? hyperGlow : 0;
    let tint = this.tint, col = this.tintCol;
    if (base > tint) {
      tint = base;
      col = [((hyperColor >> 16) & 255) / 255, ((hyperColor >> 8) & 255) / 255, (hyperColor & 255) / 255];
    }
    const p = this.u.uParams;
    p[0] = 0;
    p[1] = motion ? this.ab * 0.006 : 0;
    p[2] = motion ? Math.round(this.pix) : 0;
    p[3] = tint * (motion ? 1 : 0.5);
    this.active = this.ab > 0.01 || this.pix > 0 || tint > 0.01 || wave[0] + wave[1] + wave[2] > 0.001 || prism > 0.001;
    this.u.uTint.set(col);
    this.group.update();
  }
}
