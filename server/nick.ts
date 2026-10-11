// Apodos: normalización para la unicidad (contra suplantaciones) y filtro de palabras.

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };

/** Palabras que nunca valen, aunque vayan pegadas a otras («fuckyou»). Con letras repetidas ya colapsadas. */
const BAD_SUBSTRINGS = ['hitler', 'mierda', 'cabron', 'gilipollas', 'follar', 'negrata', 'maricon', 'fuck', 'shit', 'niger', 'niga', 'faggot'];
/** Palabras que solo valen como palabra entera: dentro de otras salen nombres legítimos (Ignazio, Pollack, Scunthorpe). */
const BAD_WORDS = ['nazi', 'polla', 'cunt'];
/** Nombres que sugieren al servidor o a la moderación. */
const RESERVED = ['admin', 'moderador', 'moderator', 'pilecrawl', 'soporte', 'staff'];

const collapse = (s: string) => s.replace(/(.)\1+/g, '$1');

/** Letras del apodo ya en minúscula, sin acentos y con las cifras parecidas pasadas a letras. */
function fold(nick: string): string {
  return nick
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0-9]/g, (c) => LEET[c] ?? c);
}

/** Clave única: dos apodos con la misma clave se consideran el mismo. */
export function nickKey(nick: string): string {
  return fold(nick).replace(/[\s._-]+/g, '');
}

/** Solo escritura latina (tras NFKC), cifras ASCII y separadores: deja fuera cirílico, griego y letras matemáticas. */
export const NICK_CHARS = /^[\p{Script=Latin}0-9_ .-]+$/u;

/** true si el apodo contiene una palabra prohibida (las de `extra` llegan de `NICK_BLOCKLIST`). */
export function isBlockedNick(nick: string, extra: string[] = []): boolean {
  const key = collapse(nickKey(nick));
  const words = fold(nick).split(/[\s._-]+/).filter(Boolean).map(collapse);
  if (RESERVED.some((w) => key.includes(w))) return true;
  if ([...BAD_SUBSTRINGS, ...extra.map((w) => collapse(nickKey(w)))].some((w) => w && key.includes(collapse(w)))) return true;
  return BAD_WORDS.some((w) => words.includes(w));
}
