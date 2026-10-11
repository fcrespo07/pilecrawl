// Catálogo: todas las mejoras, maldiciones e hiperperks en una página aparte (se abre desde la portada).
import { HYPERS } from '../core/hypers';
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
  const lock = !p.curse && UNLOCK_LEVEL[p.rarity] > 0 ? `<span class="cat-lock">Se desbloquea llegando al nivel ${UNLOCK_LEVEL[p.rarity]}</span>` : '';
  const reto = CHALLENGES.find((c) => c.perk === p.id);
  const exp = reto ? `<span class="cat-lock">En Expedición: ${reto.text.charAt(0).toLowerCase()}${reto.text.slice(1)}</span>` : '';
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

/** Pinta el catálogo entero una vez; los datos no cambian mientras se juega. */
export function renderCatalog(root: HTMLElement) {
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
    'Habilidades activas, una por partida. Salen con la racha, seguras en el nivel 8. Se cargan limpiando líneas y se sueltan con D.',
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
  root.querySelector('#catalog-body')!.innerHTML = [...perks, curses, hypers].join('');
}
