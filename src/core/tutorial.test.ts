import { describe, expect, it } from 'vitest';
import { COLS, Game, ROWS, TUTORIAL_HOLE, TUTORIAL_HYPER_CHARGE, TUTORIAL_LINES } from './game';
import { MODES, PLAY_MODE_IDS } from './modes';

/** Sube de nivel sumando las líneas que faltan (sin jugar piezas). */
function levelUp(g: Game) {
  (g as unknown as { addLevelProgress(n: number): void }).addLevelProgress(g.linesNeeded());
}

function tutorial() {
  const g = new Game();
  g.bestLevel = MODES.tutorial.fixedBestLevel!;
  g.start(0x7a11, 'tutorial');
  return g;
}

describe('tutorial', () => {
  it('no sale en el selector de la portada', () => {
    expect(PLAY_MODE_IDS).not.toContain('tutorial');
    expect(PLAY_MODE_IDS).toEqual(['normal', 'daily', 'timed']);
  });

  it('empieza con dos filas casi llenas y la pieza cuadrada primero', () => {
    const g = tutorial();
    for (const y of [ROWS - 2, ROWS - 1]) {
      const empty = g.board[y].flatMap((v, x) => (v === 0 ? [x] : []));
      expect(empty).toEqual([TUTORIAL_HOLE, TUTORIAL_HOLE + 1]);
    }
    expect(g.board[ROWS - 3].every((v) => v === 0)).toBe(true);
    expect(g.active!.def.name).toBe('O');
    expect(g.queue[0].def.name).toBe('T');
    // la O aparece en el centro, tres columnas a la izquierda del hueco: hay que moverla
    expect(g.active!.x).toBe(Math.floor((COLS - 2) / 2));
  });

  it('la primera pieza limpia dos líneas', () => {
    const g = tutorial();
    while (g.active!.x < TUTORIAL_HOLE) g.move(1);
    g.hardDrop();
    expect(g.lines).toBe(2);
    expect(g.linesIntoLevel).toBe(2);
    expect(g.linesNeeded()).toBe(TUTORIAL_LINES);
  });

  it('el primer nivel da una carta normal y el segundo, una hiperperk antes de la carta', () => {
    const g = tutorial();
    levelUp(g);
    expect(g.level).toBe(2);
    expect(g.hyperPending).toBe(false);
    // carta normal: solo comunes y raras
    (g as unknown as { beginChoice(): void }).beginChoice();
    expect(g.choosingHyper).toBe(false);
    expect(g.choices.every((p) => p.rarity === 'common' || p.rarity === 'rare')).toBe(true);
    g.choosePerk(0);
    expect(g.perkOrder.length).toBe(1);
    levelUp(g);
    expect(g.level).toBe(3);
    expect(g.hyperPending).toBe(true);
  });

  it('la hiperperk del tutorial se carga con pocas líneas, sin cambiar las del juego', () => {
    const g = tutorial();
    levelUp(g);
    (g as unknown as { beginChoice(): void }).beginChoice();
    g.choosePerk(0);
    levelUp(g);
    (g as unknown as { beginChoice(): void }).beginChoice();
    expect(g.choosingHyper).toBe(true);
    const original = g.hyperChoices[0];
    g.choosePerk(0);
    expect(g.hyper!.charge).toBe(TUTORIAL_HYPER_CHARGE);
    expect(original.charge).toBeGreaterThan(TUTORIAL_HYPER_CHARGE);
  });

  it('el modo normal no cambia: ni líneas ni hiperperk forzada', () => {
    const g = new Game();
    g.start(7);
    expect(g.linesNeeded()).toBe(8);
    expect(g.board[ROWS - 1].every((v) => v === 0)).toBe(true);
    levelUp(g);
    levelUp(g);
    expect(g.level).toBe(3);
    // en el nivel 3 sale con probabilidad, no seguro: con esta semilla no ha salido
    expect(g.hyperPending).toBe(false);
  });
});
