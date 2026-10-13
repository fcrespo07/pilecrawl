// Catálogo: puntuación, todas las mejoras, maldiciones e hiperperks en una página aparte (se abre desde la portada).
import { HYPERS } from '../core/hypers';
import { LINE_SCORES, MINI_SCORES, SPIN_SCORES } from '../core/game';
import { CHALLENGES } from '../core/expedition';
import { UNLOCK_LEVEL } from '../core/meta';
import { CURSES, PERKS, type PerkDef, type Rarity } from '../core/perks';
import { effectsHTML, hyperFoot, rarityKey, rarityLabel } from './ui';
import { perkIcon } from './icons';

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const RARITY_PLURAL: Record<Rarity, string> = { common: 'Comunes', rare: 'Raras', epic: 'Épicas', legendary: 'Legendarias' };

function maxLabel(p: PerkDef): string {
  if (p.max === 1) return 'Única';
  if (p.max >= 99) return 'Acumulable';
  return `Hasta ×${p.max}`;
}

function perkItem(p: PerkDef): string {
  const lock = !p.curse && (p.unlock ?? UNLOCK_LEVEL[p.rarity]) > 0 ? `<span class="cat-lock">Se desbloquea llegando al nivel ${p.unlock ?? UNLOCK_LEVEL[p.rarity]}</span>` : '';
  const reto = CHALLENGES.find((c) => c.perk === p.id);
  const exp = reto ? `<span class="cat-lock cat-exp">Bloqueada en Expedición hasta: ${reto.text.charAt(0).toLowerCase()}${reto.text.slice(1)}</span>` : '';
  return `<article class="cat-item r-${rarityKey(p)}">
    <div class="b-ico">${perkIcon(p.id)}</div>
    <div class="cat-body">
      <div class="b-name">${p.name}<small>${rarityLabel(p)} · ${maxLabel(p)}</small></div>
      ${effectsHTML(p, 1)}${lock}${exp}
    </div>
  </article>`;
}

function section(title: string, note: string, items: string[]): string {
  return `<section class="home-card cat-section"><h2>${title} <small>${items.length}</small></h2><p class="home-note">${note}</p><div class="cat-grid">${items.join('')}</div></section>`;
}

/** Cifras de puntuación. Las de líneas, giros y mini salen de `game.ts`; el resto son las de sus `addScore`. */
const SCORE_ITEMS: { name: string; lines: string[] }[] = [
  {
    name: 'Líneas',
    lines: [
      `1 línea: <b>${LINE_SCORES[1]}</b>`,
      `2 líneas: <b>${LINE_SCORES[2]}</b>`,
      `3 líneas: <b>${LINE_SCORES[3]}</b>`,
      `Cuádruple (4 líneas): <b>${LINE_SCORES[4]}</b>`,
    ],
  },
  {
    name: 'Giros',
    lines: [
      `Giro sin líneas: <b>400</b> (completo) o <b>100</b> (mini)`,
      `Giro completo con 1, 2 o 3 líneas: <b>${SPIN_SCORES[1]}, ${SPIN_SCORES[2]} o ${SPIN_SCORES[3]}</b>`,
      `Giro mini (solo T) con 1, 2 o 3 líneas: <b>${MINI_SCORES[1]}, ${MINI_SCORES[2]} o ${MINI_SCORES[3]}</b>`,
    ],
  },
  {
    name: 'Combos',
    lines: [
      'Cada limpieza seguida suma <b>50 × nivel</b> por paso: la segunda <b>+50</b>, la tercera <b>+100</b>…',
      'Una pieza fijada que no limpia lo corta',
    ],
  },
  {
    name: 'Back-to-back',
    lines: [
      'Un cuádruple o un giro con líneas seguido de otro igual: su base sale <b>×1,5</b>',
      'Una limpieza normal lo corta; las piezas que no limpian no',
    ],
  },
  {
    name: 'Extras',
    lines: ['Bloque de <b>oro</b> limpiado: <b>+300 × nivel</b>', 'Tablero vacío tras limpiar: <b>+3500 × nivel</b>'],
  },
  {
    name: 'Bajar y soltar',
    lines: ['Soft drop (bajar a mano): <b>+1</b> por fila', 'Hard drop (soltar de golpe): <b>+2</b> por fila que cae'],
  },
  {
    name: 'Bombas, prismas y taladros',
    lines: [
      'Bomba: <b>40 × nivel</b> por bloque que destruye',
      'Prisma: <b>60 × nivel</b> por bloque que borra',
      'Taladro: <b>150 × nivel</b> por fila',
      'Tabla rasa (hiperperk): <b>40 × nivel</b> por bloque',
    ],
  },
  {
    name: 'Piezas especiales',
    lines: ['Sobre las líneas que completa: monominó <b>×0,5</b>, cruz <b>×3</b>, gancho <b>×2</b>'],
  },
  {
    name: 'Multiplicadores',
    lines: [
      'Casi todo se multiplica por el <b>MULT</b> del marcador, que suben las mejoras',
      'No se multiplican las caídas, lo que cuesta la reserva ni el interés de Interés compuesto',
    ],
  },
  {
    name: 'Niveles',
    lines: [
      'Subir de nivel no da puntos, pero cada nivel multiplica casi todo y acelera la caída',
      'Al principio hacen falta <b>8 líneas</b>; sube <b>+1 cada dos niveles</b>, hasta <b>16</b>',
    ],
  },
  {
    name: 'Racha',
    lines: ['No da puntos por sí sola: solo la usa Furia', 'Sube al limpiar bien y mejora las ofertas'],
  },
];

const SCORE_EXAMPLE = [
  'Sin mejoras, en nivel 2: un cuádruple da 800 × 2 = <b>1600</b>.',
  'Si el siguiente también es cuádruple, va con back-to-back: 800 × 2 × 1,5 = 2400, más el combo 50 × 1 × 2 = 100.',
  'El segundo cuádruple da <b>2500</b>.',
];

function scoreItem(it: { name: string; lines: string[] }): string {
  return `<article class="cat-item r-score">
    <div class="cat-body">
      <div class="b-name">${it.name}</div>
      <ul class="score-list">${it.lines.map((t) => `<li>${t}</li>`).join('')}</ul>
    </div>
  </article>`;
}

/** Pinta el catálogo entero una vez; los datos no cambian mientras se juega. */
export function renderCatalog(root: HTMLElement) {
  const score = `<section class="home-card cat-section"><h2>Puntuación</h2><p class="home-note">Casi todo se multiplica por el nivel: en nivel 3, cada cifra de abajo vale el triple. Las mejoras cambian estos números; el MULT del marcador es el multiplicador total.</p><div class="cat-grid">${SCORE_ITEMS.map(scoreItem).join('')}<article class="cat-item r-score cat-example"><div class="cat-body"><div class="b-name">Ejemplo</div><ul class="score-list">${SCORE_EXAMPLE.map((t) => `<li>${t}</li>`).join('')}</ul></div></article></div></section>`;
  const perks = RARITIES.map((r) =>
    section(
      RARITY_PLURAL[r],
      'Salen al subir de nivel. Las cifras son las de la primera copia; al acumularlas crecen.',
      PERKS.filter((p) => p.rarity === r).map(perkItem),
    ),
  );
  const curses = section('Maldiciones', 'Solo salen en las ofertas malditas (desde el nivel 5): no tienen ventaja, y la oferta siguiente es rara o mejor.', CURSES.map(perkItem));
  const hypers = section(
    'Hiperperks',
    'Habilidades activas, una por partida. Salen con la racha, seguras en el nivel 8. Se cargan limpiando líneas y se sueltan con su tecla (D por defecto).',
    HYPERS.map(
      (h) => `<article class="cat-item r-hyper">
        <div class="b-ico">${perkIcon(h.id)}</div>
        <div class="cat-body">
          <div class="b-name">${h.name}<small>Hiperperk · ${hyperFoot(h)}</small></div>
          ${effectsHTML(h, 1)}
        </div>
      </article>`,
    ),
  );
  root.querySelector('#catalog-body')!.innerHTML = [score, ...perks, curses, hypers].join('');
}
