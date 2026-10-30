// Textos de contenido del juego (mejoras, maldiciones, hiperperks, jefes) en inglés.
// El español vive en `src/core/` (que comparte el servidor y no sabe de idiomas); aquí solo va el inglés,
// por id, y los ayudantes que eligen el texto según el idioma en uso. Un test (`content.test.ts`) comprueba que
// no falta ningún id y que las cifras de cada texto coinciden con las del español.
import { consOf, PERK_BY_ID, type PerkDef, type Rarity } from '../core/perks';
import type { BossDef, RuleId } from '../core/bosses';
import type { Challenge, UpgradeDef } from '../core/expedition';
import type { PressureDef } from '../core/pressure';
import { current, t } from './index';

export interface TextEntry {
  name: string;
  pros: (stacks: number) => string[];
  cons?: (stacks: number) => string[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export const EN: Record<string, TextEntry> = {
  // ───────── Comunes ─────────
  vision: { name: 'Vision', pros: () => ['You see <b>+1 piece</b> in the queue'], cons: () => ['Pieces lock <b>30 ms</b> sooner'] },
  calm: { name: 'Steady Pulse', pros: () => ['<b>+100 ms</b> of grace before the piece locks', 'Pieces fall <b>6% slower</b>'] },
  dice: { name: 'Dice', pros: () => ['<b>+2 rerolls</b> when picking upgrades'], cons: () => ['Each card reroll costs you <b>2 streak</b>'] },
  greed: { name: 'Greed', pros: () => ['<b>+30%</b> to your whole score'], cons: () => ['You need <b>+1 line</b> to level up'] },
  shortcut: {
    name: 'Shortcut',
    pros: (s) => [`The <b>first line</b> of each level counts <b>×${1 + s * 2}</b> toward leveling up`],
    cons: () => ['Each time you level up, the next garbage row moves <b>3 pieces</b> closer'],
  },
  chain: { name: 'Chain', pros: () => ['The combo bonus rises by <b>60%</b>'], cons: () => ['Pieces lock <b>20 ms</b> sooner'] },
  dike: { name: 'Dike', pros: () => ['Garbage takes <b>3 more pieces</b> to rise'], cons: () => ['You lose <b>up to 1 card reroll</b>'] },
  hammer: {
    name: 'Hammer',
    pros: (s) => [`Hard drop gives <b>×${1 + s * 2}</b> points per row (${2 + s * 4} instead of 2)`],
    cons: () => ['Soft dropping <b>no longer scores</b>'],
  },
  harvest: {
    name: 'Harvest',
    pros: (s) => [`Every <b>${s > 1 ? 6 : 10} lines</b> you clear you gain <b>+1 reroll</b>`],
    cons: () => ['Each card reroll brings garbage <b>1 piece</b> closer'],
  },
  reflex: {
    name: 'Reflexes',
    pros: (s) => [`If a piece clears lines <b>within 1.5 s</b> of appearing, each line gives <b>+${s * 60} × level</b> more`],
    cons: () => ['Pieces fall <b>8% faster</b>'],
  },
  tactic: {
    name: 'Tactical Pause',
    pros: () => ['Once per level, with the <b>skill</b> key, falling <b>freezes for 3 s</b> (soft drop stops too)'],
    cons: () => ['While it lasts you <b>cannot rotate</b>', 'You can only have <b>one skill</b> per run'],
  },
  // ───────── Raras ─────────
  wild: {
    name: 'Wild Card',
    pros: () => ['Once per level, with the <b>skill</b> key, you <b>discard the current piece</b>: the next one in the queue arrives'],
    cons: () => ['Discarding costs you <b>25 streak</b>', 'Does not work on <b>special</b> pieces (bomb, prism, gold, heavy)', 'You can only have <b>one skill</b> per run'],
  },
  clover: {
    name: 'Clover',
    pros: () => ['Offers bring more <b>rare</b> upgrades, and more <b>epic and legendary</b> ones (if already unlocked)'],
    cons: () => ['Each Clover removes <b>1 line</b> of advantage: leveling up needs 1 more'],
  },
  doublehold: { name: 'Double Pocket', pros: () => ['You hold <b>2 pieces</b> in reserve'], cons: () => ['You see <b>1 less piece</b> in the queue'] },
  freehold: {
    name: 'Free Hold',
    pros: () => ['You can hold the <b>same piece</b> in reserve as often as you like'],
    cons: () => ['Each time you hold a piece you lose <b>50 × level</b> points'],
  },
  bomb: {
    name: 'Bomb',
    pros: (s) => [`Every <b>${[12, 9, 6][s - 1]} pieces</b> a bomb appears`, 'On lock it blasts a <b>5×5</b> area'],
    cons: () => ['Each bomb that appears brings garbage <b>1 piece</b> closer'],
  },
  drill: {
    name: 'Drill',
    pros: (s) => [`Every <b>${[14, 11, 8][s - 1]} pieces</b> a drill appears that destroys the row below`, 'Counts as a <b>line</b>'],
    cons: () => ['You choose from <b>one card fewer</b> (minimum 2)'],
  },
  gold: {
    name: 'Gold Rush',
    pros: (s) => [`<b>${s * 12}%</b> of pieces are gold`, 'Each gold block in a line: <b>+150 × level</b>'],
    cons: () => ['Gold pieces fall <b>twice as fast</b>'],
  },
  irain: { name: 'I Rain', pros: () => ['Each bag brings <b>an extra I</b>'], cons: () => ['…and also <b>an extra S or Z</b>'] },
  exp: {
    name: 'Experience',
    pros: () => ['Quads and spins add <b>2 more lines</b> of level progress'],
    cons: () => ['Garbage rises <b>1 piece</b> sooner'],
  },
  mono: {
    name: 'Monomino',
    pros: (s) => [`Each bag brings ${s > 1 ? '<b>2 monominoes</b>' : 'a <b>monomino</b>'} (1 block)`],
    cons: () => ['Lines it completes give <b>half</b> the points'],
  },
  hook: {
    name: 'Hook',
    pros: () => ['Each bag brings a 5-block <b>hook</b>', 'Lines it completes are worth <b>×2</b>'],
    cons: () => ['It is an <b>awkward</b> piece to fit'],
  },
  recycle: {
    name: 'Recycling',
    pros: (s) => [`Each garbage row you clear counts <b>+${s} ${plural(s, 'line', 'lines')}</b> toward leveling up`, `…and gives <b>${s * 200} × level</b> points per row`],
    cons: () => ['Pieces fall <b>10% faster</b>'],
  },
  vertigo: {
    name: 'Vertigo',
    pros: (s) => [`If the stack passes <b>half</b> the board, <b>×${1 + s * 0.5}</b> to your whole score`],
    cons: () => ['Pieces fall <b>10% faster</b>'],
  },
  lifeline: {
    name: 'Lifeline',
    pros: () => ['If the stack passes <b>70%</b>, the next piece is an <b>I bar</b>', 'At most once every <b>12 pieces</b>'],
    cons: () => ['<b>−10%</b> to your whole score'],
  },
  fan: { name: 'Fan', pros: () => ['You choose from <b>4 cards</b> instead of 3'], cons: () => ['You need <b>+1 line</b> to level up'] },
  breather: {
    name: 'Breather',
    pros: (s) => [`When you level up, the bottom <b>${s * 3} rows</b> of the board are removed`],
    cons: () => ['You need <b>+1 line</b> to level up'],
  },
  domino: {
    name: 'Domino',
    pros: (s) => [`Each bag brings ${s > 1 ? '<b>2 dominoes</b>' : 'a <b>domino</b>'} (2 blocks)`],
    cons: () => ['You see <b>1 less piece</b> in the queue'],
  },
  shortbar: {
    name: 'Short Bar',
    pros: (s) => [`Each bag brings ${s > 1 ? '<b>2 short bars</b>' : 'a <b>short bar</b>'} (3 blocks)`],
    cons: () => ['Garbage rises <b>1 piece</b> sooner'],
  },
  // ───────── Épicas ─────────
  erosion: {
    name: 'Erosion',
    pros: () => ['Each time you clear lines, the <b>highest block</b> on the board also disappears'],
    cons: () => ['You need <b>+1 line</b> to level up'],
  },
  gambler: {
    name: 'Gambler',
    pros: () => ['Each level up gives you <b>an extra card</b>: you pick twice'],
    cons: () => ['You need <b>+3 lines</b> to level up', 'With more offers, there are more chances of a <b>curse</b>', 'The extra card <b>cannot be skipped</b>'],
  },
  allspin: {
    name: 'Spin Master',
    pros: () => ['Any piece other than the square counts as a <b>spin</b> if, after rotating, it cannot move left, right or up, and scores as one'],
    cons: () => ['Quads give <b>25% less</b>'],
  },
  b2b: {
    name: 'Crossfire',
    pros: () => ['Chaining quads or spins (back-to-back) adds <b>+1</b> to their bonus per copy: from ×1.5 to ×2.5'],
    cons: () => ['Holding a piece costs <b>10 points</b> per level'],
  },
  eternal: {
    name: 'Eternal Combo',
    pros: (s) => [`The combo survives <b>${s} ${plural(s, 'piece', 'pieces')}</b> in a row without clearing a line`],
    cons: () => ['Clearing a single line gives <b>half</b> the points'],
  },
  instinct: {
    name: 'Instinct',
    pros: () => ['If the stack passes <b>70%</b>, pieces fall <b>about three times slower</b>'],
    cons: () => ['The rest of the time pieces fall <b>10% faster</b>'],
  },
  interest: {
    name: 'Compound Interest',
    pros: (s) => [`When you level up, your score rises by <b>${pct(s * 0.1)}</b> (of whatever you have then)`],
    cons: () => ['You need <b>+1 line</b> to level up'],
  },
  pact: {
    name: 'Pact',
    pros: () => ['<b>×2</b> to your whole score'],
    cons: () => ['Pieces fall <b>35% faster</b>', 'Cursed offers appear <b>10% more</b> often'],
  },
  anchor: {
    name: 'Anchor',
    pros: () => ['While you chain lines <b>piece after piece</b>, garbage <b>does not advance</b>'],
    cons: () => ['The combo bonus is <b>25% lower</b>'],
  },
  collector: {
    name: 'Collector',
    pros: () => ['<b>+8%</b> to your whole score for each <b>different upgrade</b> you own'],
    cons: () => ['You need <b>+1 line</b> to level up'],
  },
  cross: {
    name: 'Cross',
    pros: () => ['Each bag swaps the <b>T</b> for a 5-block <b>cross</b>', 'Lines it completes are worth <b>×5</b>'],
    cons: () => ['With no T, there are no <b>spins with the T</b> either'],
  },
  // ───────── Legendarias ─────────
  life: {
    name: 'Second Life',
    pros: () => ['<b>+1 life</b>: when you lose, the board clears and you carry on'],
    cons: () => ['<b>−15%</b> to your whole score'],
  },
  fury: {
    name: 'Fury',
    pros: () => ['The more streak, the more points: at full streak, <b>×2</b> to your whole score'],
    cons: () => ['Streak drops <b>one and a half times faster</b> with each locked piece'],
  },
  echo: {
    name: 'Echo',
    pros: () => ['Each line counts <b>double</b> toward leveling up: you level up more and get more cards'],
    cons: () => ['Garbage rises <b>2 pieces</b> sooner', 'Pieces fall <b>10% faster</b>'],
  },
  casino: {
    name: 'Casino',
    pros: () => ['<b>+4 rerolls</b> now and <b>+1</b> on every level up', 'Each reroll draws a new offer, with its own rarity'],
    cons: () => ['You choose from <b>one card fewer</b> (minimum 2)'],
  },
  quake: {
    name: 'Earthquake',
    pros: () => [
      'After a <b>quad</b> or a spin of <b>2 or more lines</b>, what is left <b>falls</b> and fills the gaps',
      'Lines made this way <b>score more</b> the more you chain',
    ],
    cons: () => ['Garbage rises <b>2 pieces</b> sooner'],
  },
  prism: {
    name: 'Prism',
    pros: (s) => [`Every <b>${s > 1 ? 10 : 16} pieces</b> a prism appears`, 'When it lands it erases <b>all blocks</b> of the colour it lands on', 'What is left above <b>falls</b> into the gaps'],
    cons: () => ['Pieces fall <b>15% faster</b>', 'Cursed offers appear <b>8% more</b> often'],
  },
  phoenix: {
    name: 'Phoenix',
    pros: () => ['<b>+1 life</b>', 'When you revive, the board is left <b>completely empty</b>', 'Each time you revive, <b>+25%</b> to your whole score (cap <b>+50%</b>)'],
    cons: () => ['Pieces fall <b>15% faster</b>'],
  },
  // ───────── Maldiciones ─────────
  c_lead: { name: 'Lead', pros: () => [], cons: () => ['Pieces fall <b>10% faster</b>'] },
  c_fog: { name: 'Fog', pros: () => [], cons: () => ['You see <b>1 less piece</b> in the queue'] },
  c_rust: { name: 'Rust', pros: () => [], cons: () => ['<b>−120 ms</b> of grace before the piece locks'] },
  c_debt: { name: 'Debt', pros: () => [], cons: () => ['<b>−15%</b> to your whole score'] },
  c_tide: { name: 'Tide', pros: () => [], cons: () => ['Garbage rises <b>1 piece sooner</b>'] },
  c_slope: { name: 'Slope', pros: () => [], cons: () => ['You need <b>+1 line</b> to level up'] },
  c_crack: { name: 'Crack', pros: () => [], cons: () => ['You lose <b>1 reroll</b> (if you have none, nothing happens)'] },
  c_ballast: { name: 'Ballast', pros: () => [], cons: () => ['Each bag brings <b>an extra S or Z</b>'] },
  c_blind: { name: 'Blind Queue', pros: () => [], cons: () => ['You only see <b>the next piece</b> in the queue'] },
  c_ghost: { name: 'No Ghost', pros: () => [], cons: () => ['The <b>ghost piece disappears</b>, the one that shows where the piece will land'] },
  c_heavy: {
    name: 'Heavy Piece',
    pros: () => [],
    cons: (s) => [`Every <b>${s > 1 ? 5 : 7} pieces</b> a grey one arrives that falls <b>twice as fast</b>`],
  },
  c_drift: {
    name: 'Drift',
    pros: () => [],
    cons: () => ['Every <b>8 pieces</b> the whole board shifts <b>one column</b> to the right (what leaves one side enters the other)'],
  },
  c_roulette: { name: 'Roulette', pros: () => [], cons: () => ['Every <b>5 pieces</b> the top block of a column jumps to another at random'] },
  // ───────── Hiperperks ─────────
  slowmo: {
    name: 'Slow Motion',
    pros: () => ['For <b>12 s</b> pieces almost <b>do not fall</b>', 'Garbage <b>does not advance</b> while it lasts', 'The screen turns into <b>blueprint paper</b>'],
  },
  frenzy: {
    name: 'Frenzy',
    pros: () => ['For <b>15 s</b>, <b>×3</b> to your whole score', 'The combo <b>does not break</b> while it lasts', 'The screen turns <b>neon</b>'],
  },
  sand: {
    name: 'Sand',
    pros: () => [
      'For <b>5 s</b>, every block you lock falls to the <b>lowest free gap</b> in its column',
      'Fills <b>covered holes</b>: they fall even with blocks above',
      'The screen turns <b>green phosphor</b>',
    ],
  },
  barrage: {
    name: 'Barrage',
    pros: () => ['For <b>8 s</b>, <b>every piece</b> is a bomb', 'Each one blasts a <b>5×5</b> area', 'The screen switches to <b>night mode</b>'],
  },
  flood: {
    name: 'Flood',
    pros: () => ['For <b>10 s</b>, <b>every piece</b> is an <b>I bar</b>', 'Great for quads: stack and drop', 'The screen turns <b>ice</b>'],
  },
  gravity: {
    name: 'Gravity',
    pros: () => ['For <b>6 s</b>, each time a piece locks <b>the whole board compacts</b>', '<b>Gaps</b> close and lines clear on their own', 'The screen turns <b>magma</b>'],
  },
  shield: {
    name: 'Shield',
    pros: () => ['For <b>10 s</b> you cannot <b>lose</b>: if you overflow, the board clears except for <b>5 rows</b>', 'Costs no extra lives', 'The screen turns <b>gold</b>'],
  },
  wipe: {
    name: 'Clean Slate',
    pros: () => ['On activation it <b>empties the entire board</b>', 'Each block cleared gives <b>40 × level</b> points'],
    cons: () => ['It is the slowest to <b>charge</b>'],
  },
};

interface BossEntry {
  name: string;
  rule: string;
  tip: [string, string];
}

/** Jefes en inglés, por id (el Monolito compone sus dos reglas con `bossText`). */
export const BOSS_EN: Record<string, BossEntry> = {
  drip: { name: 'Drip', rule: 'Every 6 pieces a loose garbage block drops into a random column.', tip: ['Every 6 pieces', 'a loose block drops'] },
  gravity: {
    name: 'Gravity',
    rule: 'Pieces fall twice as fast, but clears of 2 or more lines count double.',
    tip: ['They fall twice as fast;', '2+ lines count double'],
  },
  magnet: { name: 'Magnet', rule: 'One column is forbidden (counts as full) and changes every 8 pieces.', tip: ['Forbidden column', 'Changes every 8 pieces'] },
  fog: { name: 'Fog', rule: 'You only see the next piece and the ghost is off.', tip: ['You only see the next', 'and there is no ghost'] },
  mirror: {
    name: 'Mirror',
    rule: 'Left and right moves are inverted on the first 5 pieces of every 10.',
    tip: ['Left and right', 'inverted 5 in 10'],
  },
  alud: { name: 'Landslide', rule: 'Every 4 pieces the highest row of the stack breaks off.', tip: ['Every 4 pieces the', 'top row breaks off'] },
  countdown: {
    name: 'Countdown',
    rule: 'Every 10 seconds of play a garbage row rises. Pause does not count.',
    tip: ['A row rises', 'every 10 seconds'],
  },
  monolith: { name: 'Monolith', rule: 'Two rules at once, chosen by the run seed.', tip: ['Two rules', 'at once'] },
};

const isEn = () => current.lang === 'en';

// ───────── Expedición ─────────
const UPGRADE_EN: Record<string, { name: string; desc: string }> = {
  reroll: { name: 'Spare', desc: '+1 card reroll at the start.' },
  vista: { name: 'Long Sight', desc: '+1 visible piece in the queue.' },
  aguante: { name: 'Endurance', desc: 'Pieces take 60 ms longer to lock.' },
  calma: { name: 'Calm', desc: 'Garbage rises 1 piece later.' },
  ritmo: { name: 'Pace', desc: 'Each level needs 1 line less.' },
  vida: { name: 'Spare Life', desc: 'You start with an extra life.' },
  arranque: { name: 'Good Start', desc: 'You start with a random common or rare upgrade.' },
  suerte: { name: 'Luck', desc: '+1 luck in offers: more rare and epic upgrades.' },
  reserva: { name: 'Extra Hold', desc: 'One more piece fits in the hold.' },
};

const CHALLENGE_EN: Record<string, string> = {
  erosion: 'Make 3 quads in one run',
  exp: 'Make 5 spins that clear lines in one run',
  gambler: 'Reach a combo of 6',
  doublehold: 'Reach level 6',
  bomb: 'Clear 30 lines in one run',
  prism: 'Clear 60 lines in one run',
  quake: 'Reach level 9',
  phoenix: 'Survive 10 minutes in one run',
};

const PRESSURE_EN: Record<string, { name: string; desc: string }> = {
  garbage: { name: 'Early Garbage', desc: 'Garbage starts at level 2, not 4.' },
  nohold: { name: 'No Hold', desc: 'No piece can be held.' },
  twochoices: { name: 'Two Cards', desc: 'Each level up offers 2 cards, not 3.' },
  onepiece: { name: 'Short Queue', desc: 'You only see the next piece.' },
};

export const upgradeText = (u: UpgradeDef) => (isEn() && UPGRADE_EN[u.id]) || { name: u.name, desc: u.desc };
export const challengeText = (c: Challenge) => (isEn() && CHALLENGE_EN[c.perk]) || c.text;
export const pressureText = (p: PressureDef) => (isEn() && PRESSURE_EN[p.id]) || { name: p.name, desc: p.desc };

type Named = { id: string; name: string };
type WithEffects = Named & { pros: (s: number) => string[]; cons?: (s: number) => string[]; expeditionCons?: (s: number) => string[] };

/** Nombre de una mejora, maldición o hiperperk en el idioma en uso. */
export function perkName(p: Named): string {
  return (isEn() && EN[p.id]?.name) || p.name;
}

/** Lo mismo, a partir del id. */
export function perkNameById(id: string): string {
  return (isEn() && EN[id]?.name) || PERK_BY_ID[id]?.name || id;
}

export function perkPros(p: WithEffects, stacks: number): string[] {
  return (isEn() && EN[p.id]?.pros(stacks)) || p.pros(stacks);
}

/** Contrapartidas que se muestran (en Expedición, `expeditionCons` si existe; son las mismas en los dos idiomas). */
export function perkCons(p: WithEffects, stacks: number, expedition: boolean): string[] {
  if (expedition && p.expeditionCons) return p.expeditionCons(stacks);
  const en = isEn() ? EN[p.id] : undefined;
  if (en) return en.cons?.(stacks) ?? [];
  return consOf(p as PerkDef, stacks, false);
}

/** Etiqueta de rareza en el idioma en uso. */
export function rarityName(r: Rarity): string {
  return t(`rarity.${r}`);
}

type BossLike = Pick<BossDef, 'id' | 'name' | 'rule' | 'tip' | 'rules'>;

/** Nombre, regla y aviso de un jefe en el idioma en uso. El Monolito junta las dos reglas que le tocan. */
export function bossText(b: BossLike): { name: string; rule: string; tip: [string, string] } {
  if (!isEn()) return { name: b.name, rule: b.rule, tip: b.tip };
  const own = BOSS_EN[b.id];
  if (b.id === 'monolith' && b.rules.length === 2) {
    const [x, y] = b.rules.map((r: RuleId) => BOSS_EN[r]);
    return { name: own.name, rule: `${x.rule} Also: ${y.rule}`, tip: [x.name, y.name] };
  }
  return own ?? { name: b.name, rule: b.rule, tip: b.tip };
}
