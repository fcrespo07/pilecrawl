import { Container, Sprite, type Texture } from 'pixi.js';

export interface EmitOpts {
  x: number;
  y: number;
  color: number;
  count?: number;
  speed?: number; // px/s
  spread?: number; // radianes alrededor de `angle`
  angle?: number;
  life?: number; // s
  size?: number; // px
  gravity?: number; // px/s²
  drag?: number;
  jitter?: number; // radio de aparición
  shape?: 'dot' | 'spark' | 'square';
  shrink?: boolean;
}

interface P {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  g: number;
  drag: number;
  spin: number;
  shrink: boolean;
  stretch: boolean;
}

/** Sistema de partículas simple con pool de sprites y blending aditivo. */
export class Particles {
  container = new Container();
  private live: P[] = [];
  private free: Sprite[] = [];
  private textures: Record<'dot' | 'spark' | 'square', Texture>;
  maxParticles = 2500;

  constructor(textures: Record<'dot' | 'spark' | 'square', Texture>) {
    this.textures = textures;
  }

  emit(o: EmitOpts) {
    const n = o.count ?? 10;
    for (let i = 0; i < n; i++) {
      if (this.live.length >= this.maxParticles) return;
      const shape = o.shape ?? 'dot';
      const s = this.free.pop() ?? new Sprite();
      s.texture = this.textures[shape];
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = o.color;
      s.alpha = 1;
      s.visible = true;
      s.rotation = 0;
      const ang = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const sp = (o.speed ?? 200) * (0.35 + Math.random() * 0.9);
      const jit = o.jitter ?? 0;
      s.x = o.x + (Math.random() - 0.5) * jit * 2;
      s.y = o.y + (Math.random() - 0.5) * jit * 2;
      const size = (o.size ?? 6) * (0.6 + Math.random() * 0.8);
      const max = (o.life ?? 0.7) * (0.6 + Math.random() * 0.7);
      if (!s.parent) this.container.addChild(s);
      this.live.push({
        s,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: max,
        max,
        size,
        g: o.gravity ?? 600,
        drag: o.drag ?? 1.5,
        spin: shape === 'square' ? (Math.random() - 0.5) * 12 : 0,
        shrink: o.shrink ?? true,
        stretch: shape === 'spark',
      });
    }
  }

  update(dt: number) {
    const sec = dt / 1000;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= sec;
      if (p.life <= 0) {
        p.s.visible = false;
        this.free.push(p.s);
        this.live[i] = this.live[this.live.length - 1];
        this.live.pop();
        continue;
      }
      const k = Math.exp(-p.drag * sec);
      p.vx *= k;
      p.vy = p.vy * k + p.g * sec;
      p.s.x += p.vx * sec;
      p.s.y += p.vy * sec;
      const t = p.life / p.max;
      p.s.alpha = Math.min(1, t * 1.6);
      const sz = p.shrink ? p.size * (0.3 + 0.7 * t) : p.size;
      if (p.stretch) {
        const v = Math.hypot(p.vx, p.vy);
        p.s.rotation = Math.atan2(p.vy, p.vx);
        p.s.width = sz + v * 0.04;
        p.s.height = sz * 0.45;
      } else {
        p.s.width = p.s.height = sz;
        p.s.rotation += p.spin * sec;
      }
    }
  }

  get count() {
    return this.live.length;
  }
}
