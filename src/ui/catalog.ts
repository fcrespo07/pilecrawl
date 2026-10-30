// Catálogo: puntuación, todas las mejoras, maldiciones e hiperperks en una página aparte (se abre desde la portada).
import { HYPERS } from '../core/hypers';
import { LINE_SCORES, MINI_SCORES, SPIN_SCORES } from '../core/game';
import { CHALLENGES } from '../core/expedition';
import { UNLOCK_LEVEL } from '../core/meta';
import { CURSES, PERKS, type PerkDef, type Rarity } from '../core/perks';
import { L, t } from '../i18n';
import { challengeText, perkName } from '../i18n/content';
import { effectsHTML, hyperFoot, rarityKey, rarityLabel } from './ui';
import { perkIcon } from './icons';

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const rarityPlural = (r: Rarity) => {
  const es = { common: 'Comunes', rare: 'Raras', epic: 'Épicas', legendary: 'Legendarias' }[r];
  const en = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }[r];
  return L(es, en);
};

function maxLabel(p: PerkDef): string {
  if (p.max === 1) return t('card.unique');
  if (p.max >= 99) return t('card.stackable');
  return L(`Hasta ×${p.max}`, `Up to ×${p.max}`);
}

function perkItem(p: PerkDef): string {
  const need = p.unlock ?? UNLOCK_LEVEL[p.rarity];
  const lock = !p.curse && need > 0 ? `<span class="cat-lock">${L(`Se desbloquea llegando al nivel ${need}`, `Unlocks by reaching level ${need}`)}</span>` : '';
  const reto = CHALLENGES.find((c) => c.perk === p.id);
  const text = reto ? challengeText(reto) : '';
  const exp = reto
    ? `<span class="cat-lock cat-exp">${L('Bloqueada en Expedición hasta: ', 'Locked in Expedition until: ')}${text.charAt(0).toLowerCase()}${text.slice(1)}</span>`
    : '';
  return `<article class="cat-item r-${rarityKey(p)}">
    <div class="b-ico">${perkIcon(p.id)}</div>
    <div class="cat-body">
      <div class="b-name">${perkName(p)}<small>${rarityLabel(p)} · ${maxLabel(p)}</small></div>
      ${effectsHTML(p, 1)}${lock}${exp}
    </div>
  </article>`;
}

function section(title: string, note: string, items: string[]): string {
  return `<section class="home-card cat-section"><h2>${title} <small>${items.length}</small></h2><p class="home-note">${note}</p><div class="cat-grid">${items.join('')}</div></section>`;
}

/** Cifras de puntuación. Las de líneas, giros y mini salen de `game.ts`; el resto son las de sus `addScore`. */
const scoreItems = (): { name: string; lines: string[] }[] => [
  {
    name: L('Líneas', 'Lines'),
    lines: [
      L(`1 línea: <b>${LINE_SCORES[1]}</b>`, `1 line: <b>${LINE_SCORES[1]}</b>`),
      L(`2 líneas: <b>${LINE_SCORES[2]}</b>`, `2 lines: <b>${LINE_SCORES[2]}</b>`),
      L(`3 líneas: <b>${LINE_SCORES[3]}</b>`, `3 lines: <b>${LINE_SCORES[3]}</b>`),
      L(`Cuádruple (4 líneas): <b>${LINE_SCORES[4]}</b>`, `Quad (4 lines): <b>${LINE_SCORES[4]}</b>`),
    ],
  },
  {
    name: L('Giros', 'Spins'),
    lines: [
      L('Giro sin líneas: <b>400</b> (completo) o <b>100</b> (mini)', 'Spin with no lines: <b>400</b> (full) or <b>100</b> (mini)'),
      L(
        `Giro completo con 1, 2 o 3 líneas: <b>${SPIN_SCORES[1]}, ${SPIN_SCORES[2]} o ${SPIN_SCORES[3]}</b>`,
        `Full spin with 1, 2 or 3 lines: <b>${SPIN_SCORES[1]}, ${SPIN_SCORES[2]} or ${SPIN_SCORES[3]}</b>`,
      ),
      L(
        `Giro mini (solo T) con 1, 2 o 3 líneas: <b>${MINI_SCORES[1]}, ${MINI_SCORES[2]} o ${MINI_SCORES[3]}</b>`,
        `Mini spin (T piece only) with 1, 2 or 3 lines: <b>${MINI_SCORES[1]}, ${MINI_SCORES[2]} or ${MINI_SCORES[3]}</b>`,
      ),
    ],
  },
  {
    name: L('Combos', 'Combos'),
    lines: [
      L(
        'Cada limpieza seguida suma <b>50 × nivel</b> por paso: la segunda <b>+50</b>, la tercera <b>+100</b>…',
        'Each clear in a row adds <b>50 × level</b> per step: the second <b>+50</b>, the third <b>+100</b>…',
      ),
      L('Una pieza fijada que no limpia lo corta', 'A piece that locks without clearing breaks it'),
    ],
  },
  {
    name: 'Back-to-back',
    lines: [
      L(
        'Un cuádruple o un giro con líneas seguido de otro igual: su base sale <b>×1,5</b>',
        'A quad or a spin with lines followed by another one: its base is <b>×1.5</b>',
      ),
      L('Una limpieza normal lo corta; las piezas que no limpian no', 'A normal clear breaks it; pieces that clear nothing do not'),
    ],
  },
  {
    name: L('Extras', 'Extras'),
    lines: [
      L('Bloque de <b>oro</b> limpiado: <b>+150 × nivel</b>', 'Gold block cleared: <b>+150 × level</b>'),
      L('Tablero vacío tras limpiar: <b>+3500 × nivel</b>', 'Empty board after a clear: <b>+3500 × level</b>'),
    ],
  },
  {
    name: L('Bajar y soltar', 'Soft and hard drop'),
    lines: [
      L('Soft drop (bajar a mano): <b>+1</b> por fila', 'Soft drop (moving down by hand): <b>+1</b> per row'),
      L('Hard drop (soltar de golpe): <b>+2</b> por fila que cae', 'Hard drop (dropping at once): <b>+2</b> per row it falls'),
    ],
  },
  {
    name: L('Bombas, prismas y taladros', 'Bombs, prisms and drills'),
    lines: [
      L('Bomba: <b>40 × nivel</b> por bloque que destruye', 'Bomb: <b>40 × level</b> per block it destroys'),
      L('Prisma: <b>60 × nivel</b> por bloque que borra', 'Prism: <b>60 × level</b> per block it erases'),
      L('Taladro: <b>150 × nivel</b> por fila', 'Drill: <b>150 × level</b> per row'),
      L('Tabla rasa (hiperperk): <b>40 × nivel</b> por bloque', 'Clean Slate (hyper perk): <b>40 × level</b> per block'),
    ],
  },
  {
    name: L('Piezas especiales', 'Special pieces'),
    lines: [
      L(
        'Sobre las líneas que completa: monominó <b>×0,5</b>, cruz <b>×5</b>, gancho <b>×2</b>',
        'On the lines it completes: monomino <b>×0.5</b>, cross <b>×5</b>, hook <b>×2</b>',
      ),
    ],
  },
  {
    name: L('Multiplicadores', 'Multipliers'),
    lines: [
      L(
        'Casi todo se multiplica por el <b>MULT</b> del marcador, que suben las mejoras',
        'Almost everything is multiplied by the scoreboard <b>MULT</b>, which upgrades raise',
      ),
      L(
        'No se multiplican las caídas, lo que cuesta la reserva ni el interés de Interés compuesto',
        'Drops, the hold cost and the interest from Compound Interest are not multiplied',
      ),
    ],
  },
  {
    name: L('Niveles', 'Levels'),
    lines: [
      L(
        'Subir de nivel no da puntos, pero cada nivel multiplica casi todo y acelera la caída',
        'Leveling up gives no points, but each level multiplies almost everything and speeds up the fall',
      ),
      L(
        'Al principio hacen falta <b>8 líneas</b>; sube <b>+1 cada dos niveles</b>, hasta <b>16</b>',
        'At first you need <b>8 lines</b>; it rises <b>+1 every two levels</b>, up to <b>16</b>',
      ),
    ],
  },
  {
    name: L('Racha', 'Streak'),
    lines: [
      L('No da puntos por sí sola: solo la usa Furia', 'It gives no points by itself: only Fury uses it'),
      L('Sube al limpiar bien y mejora las ofertas', 'It rises when you clear well and improves offers'),
    ],
  },
];

const scoreExample = () => [
  L('Sin mejoras, en nivel 2: un cuádruple da 800 × 2 = <b>1600</b>.', 'With no upgrades, at level 2: a quad gives 800 × 2 = <b>1600</b>.'),
  L(
    'Si el siguiente también es cuádruple, va con back-to-back: 800 × 2 × 1,5 = 2400, más el combo 50 × 1 × 2 = 100.',
    'If the next one is also a quad, it counts as back-to-back: 800 × 2 × 1.5 = 2400, plus the combo 50 × 1 × 2 = 100.',
  ),
  L('El segundo cuádruple da <b>2500</b>.', 'The second quad gives <b>2500</b>.'),
];

function scoreItem(it: { name: string; lines: string[] }): string {
  return `<article class="cat-item r-score">
    <div class="cat-body">
      <div class="b-name">${it.name}</div>
      <ul class="score-list">${it.lines.map((t) => `<li>${t}</li>`).join('')}</ul>
    </div>
  </article>`;
}

/** Pinta el catálogo entero; se vuelve a pintar al cambiar de idioma. */
export function renderCatalog(root: HTMLElement) {
  const score = `<section class="home-card cat-section"><h2>${L('Puntuación', 'Scoring')}</h2><p class="home-note">${L(
    'Casi todo se multiplica por el nivel: en nivel 3, cada cifra de abajo vale el triple. Las mejoras cambian estos números; el MULT del marcador es el multiplicador total.',
    'Almost everything is multiplied by the level: at level 3, every figure below is worth triple. Upgrades change these numbers; the scoreboard MULT is the total multiplier.',
  )}</p><div class="cat-grid">${scoreItems().map(scoreItem).join('')}<article class="cat-item r-score cat-example"><div class="cat-body"><div class="b-name">${L('Ejemplo', 'Example')}</div><ul class="score-list">${scoreExample().map((x) => `<li>${x}</li>`).join('')}</ul></div></article></div></section>`;
  const perks = RARITIES.map((r) =>
    section(
      rarityPlural(r),
      L(
        'Salen al subir de nivel. Las cifras son las de la primera copia; al acumularlas crecen.',
        'They come up when you level up. The figures are for the first copy; they grow as you stack them.',
      ),
      PERKS.filter((p) => p.rarity === r).map(perkItem),
    ),
  );
  const curses = section(
    L('Maldiciones', 'Curses'),
    L(
      'Solo salen en las ofertas malditas (desde el nivel 5): no tienen ventaja, y la oferta siguiente es rara o mejor.',
      'They only come up in cursed offers (from level 5): they have no upside, and the next offer is rare or better.',
    ),
    CURSES.map(perkItem),
  );
  const hypers = section(
    L('Hiperperks', 'Hyper perks'),
    L(
      'Habilidades activas, una por partida. Salen con la racha, seguras en el nivel 8. Se cargan limpiando líneas y se sueltan con su tecla (D por defecto).',
      'Active abilities, one per run. They come up with your streak, guaranteed at level 8. They charge by clearing lines and fire with their key (D by default).',
    ),
    HYPERS.map(
      (h) => `<article class="cat-item r-hyper">
        <div class="b-ico">${perkIcon(h.id)}</div>
        <div class="cat-body">
          <div class="b-name">${perkName(h)}<small>${t('rarity.hyper')} · ${hyperFoot(h)}</small></div>
          ${effectsHTML(h, 1)}
        </div>
      </article>`,
    ),
  );
  root.querySelector('#catalog-body')!.innerHTML = [score, ...perks, curses, hypers].join('');
}
