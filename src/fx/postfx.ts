// Pasada final de pantalla: un solo shader que sirve a varios efectos, para no apilar filtros.
//  - (la rejilla de monitor fija ya no va aquí: es un Graphics estático del renderer, para que en reposo no haya pasada de pantalla)
//  - aberración cromática: se abre con las sacudidas y los golpes grandes
//  - pixelado: un estallido que se cierra solo (subida de nivel, ulti)
//  - tinte: un pulso de color de pantalla completa (hiperperk activa, ultis)
import { Filter, GlProgram, type UniformGroup } from 'pixi.js';
import { H, W } from './layout';

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

void main(void) {
  vec2 uv = vTextureCoord;
  if (uParams.z > 0.5) {
    vec2 cell = uParams.z / uSize;
    uv = (floor(uv / cell) + 0.5) * cell;
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
  finalColor = c;
}
`;

export class PostFx {
  readonly filter: Filter;
  private u: { uParams: Float32Array; uTint: Float32Array };
  private group: UniformGroup;

  /** True mientras algún efecto de evento sigue vivo: solo entonces el filtro entra en la cadena. */
  active = false;

  private ab = 0;
  private pix = 0;
  private pixMax = 0;
  private pixT = 0;
  private tint = 0;
  private tintCol: [number, number, number] = [1, 1, 1];

  constructor() {
    this.u = { uParams: new Float32Array([0, 0, 0, 0]), uTint: new Float32Array([1, 1, 1]) };
    this.filter = new Filter({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: FRAGMENT, name: 'block-rogue-post' }),
      resources: {
        postUniforms: {
          uParams: { value: this.u.uParams, type: 'vec4<f32>' },
          uTint: { value: this.u.uTint, type: 'vec3<f32>' },
          uSize: { value: new Float32Array([W, H]), type: 'vec2<f32>' },
        },
      },
    });
    this.filter.resolution = 'inherit';
    this.group = this.filter.resources.postUniforms as UniformGroup;
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

  clear() { this.ab = this.pix = this.tint = 0; this.active = false; }

  update(sec: number, motion: boolean, hyperGlow: number, hyperColor: number) {
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
    this.active = this.ab > 0.01 || this.pix > 0 || tint > 0.01;
    this.u.uTint.set(col);
    this.group.update();
  }
}
