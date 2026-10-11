// Estadísticas anónimas de partidas: validación de lo que manda el cliente y resumen para equilibrar el juego.
// Nada aquí identifica a nadie: no hay apodo, token, IP ni identificador, y de la fecha solo se guarda el día.
import { isModeId, type ModeId } from '../src/core/modes';
import { HYPER_BY_ID } from '../src/core/hypers';
import { PERK_BY_ID } from '../src/core/perks';

const ID = /^[a-z0-9_]{1,24}$/;
const ENDS = ['topout', 'time', 'quit'] as const;
const KINDS = ['p', 'c', 'h'] as const;
type End = (typeof ENDS)[number];
type Kind = (typeof KINDS)[number];

export interface StatsPick {
  k: Kind;
  s: string[];
  p: string | null;
}

export interface StatsRun {
  mode: ModeId;
  rules: number;
  build: string;
  end: End;
  level: number;
  score: number;
  lines: number;
  secs: number;
  revives: number;
  hyper: string | null;
  picks: StatsPick[];
}

const int = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Valida lo que manda el cliente. Devuelve la partida limpia (solo los campos conocidos) o null. */
export function parseStats(b: Record<string, unknown>): StatsRun | null {
  if (!isModeId(b.mode) || !ENDS.includes(b.end as End)) return null;
  if (!int(b.rules, 0, 1000) || typeof b.build !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(b.build)) return null;
  if (!int(b.level, 1, 9999) || !int(b.score, 0, 2_000_000_000) || !int(b.lines, 0, 100_000)) return null;
  if (!int(b.secs, 0, 86_400) || !int(b.revives, 0, 99)) return null;
  if (b.hyper !== null && !(typeof b.hyper === 'string' && ID.test(b.hyper))) return null;
  if (!Array.isArray(b.picks) || b.picks.length > 80) return null;
  const picks: StatsPick[] = [];
  for (const raw of b.picks as unknown[]) {
    if (typeof raw !== 'object' || raw === null) return null;
    const x = raw as Record<string, unknown>;
    if (!KINDS.includes(x.k as Kind) || !Array.isArray(x.s) || x.s.length > 8) return null;
    if (!x.s.every((i) => typeof i === 'string' && ID.test(i))) return null;
    if (x.p !== null && !(typeof x.p === 'string' && ID.test(x.p))) return null;
    picks.push({ k: x.k as Kind, s: x.s as string[], p: x.p as string | null });
  }
  return {
    mode: b.mode,
    rules: b.rules,
    build: b.build,
    end: b.end as End,
    level: b.level,
    score: b.score,
    lines: b.lines,
    secs: b.secs,
    revives: b.revives,
    hyper: b.hyper as string | null,
    picks,
  };
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);
const pct = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const rate = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 1000 : null);

export interface StatsRow extends Omit<StatsRun, 'picks'> {
  day: string;
  picks: StatsPick[];
}

/**
 * Resumen de las partidas de `rows`. `perkMode` limita el análisis de cartas a un solo modo (los niveles
 * de un contrarreloj no se pueden comparar con los de una partida). Pensado para pocas decenas de miles de filas.
 */
export function summarize(rows: StatsRow[], perkMode: ModeId | null) {
  const byMode: Record<string, StatsRow[]> = {};
  const byVersion: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const r of rows) {
    (byMode[r.mode] ??= []).push(r);
    const v = `${r.build} (reglas ${r.rules})`;
    byVersion[v] = (byVersion[v] ?? 0) + 1;
    byDay[r.day] = (byDay[r.day] ?? 0) + 1;
  }
  const modes = Object.fromEntries(
    Object.entries(byMode).map(([mode, rs]) => {
      const levels = rs.map((r) => r.level);
      const hist: Record<number, number> = {};
      for (const l of levels) hist[l] = (hist[l] ?? 0) + 1;
      const ends: Record<string, number> = {};
      for (const r of rs) ends[r.end] = (ends[r.end] ?? 0) + 1;
      return [
        mode,
        {
          runs: rs.length,
          level: { avg: avg(levels), p25: pct(levels, 0.25), median: pct(levels, 0.5), p75: pct(levels, 0.75), max: Math.max(...levels) },
          score: { avg: avg(rs.map((r) => r.score)), median: pct(rs.map((r) => r.score), 0.5) },
          secs: { avg: avg(rs.map((r) => r.secs)), median: pct(rs.map((r) => r.secs), 0.5) },
          ends,
          levelHistogram: hist,
        },
      ];
    }),
  );

  // cartas: por cada carta, cuántas veces se enseñó y se cogió, y el nivel final de quien la cogió
  // frente al de quien la vio y la dejó pasar (misma exposición, así la comparación es más justa)
  const scope = perkMode ? (byMode[perkMode] ?? []) : rows;
  interface Acc { shown: number; picked: number; pickedLevels: number[]; passedLevels: number[]; kind: Kind }
  const cards = new Map<string, Acc>();
  const hypers = new Map<string, Acc>();
  for (const r of scope) {
    const picked = new Set<string>();
    const shown = new Set<string>();
    for (const o of r.picks) {
      const table = o.k === 'h' ? hypers : cards;
      for (const id of o.s) {
        const a = table.get(id) ?? { shown: 0, picked: 0, pickedLevels: [], passedLevels: [], kind: o.k };
        a.shown++;
        table.set(id, a);
        shown.add(id);
      }
      if (o.p) {
        const a = table.get(o.p) ?? { shown: 0, picked: 0, pickedLevels: [], passedLevels: [], kind: o.k };
        a.picked++;
        table.set(o.p, a);
        picked.add(o.p);
      }
    }
    for (const id of new Set([...shown, ...picked])) {
      const a = cards.get(id) ?? hypers.get(id);
      if (!a) continue;
      if (picked.has(id)) a.pickedLevels.push(r.level);
      else a.passedLevels.push(r.level);
    }
  }
  const finish = (m: Map<string, Acc>, name: (id: string) => string | undefined) =>
    [...m.entries()]
      .map(([id, a]) => ({
        id,
        name: name(id) ?? id,
        kind: a.kind,
        shown: a.shown,
        picked: a.picked,
        pickRate: rate(a.picked, a.shown),
        runsPicked: a.pickedLevels.length,
        avgLevelPicked: avg(a.pickedLevels),
        runsPassed: a.passedLevels.length,
        avgLevelPassed: avg(a.passedLevels),
        levelDelta: a.pickedLevels.length && a.passedLevels.length ? Math.round(((avg(a.pickedLevels) as number) - (avg(a.passedLevels) as number)) * 100) / 100 : null,
      }))
      .sort((a, b) => b.shown - a.shown);

  return {
    runs: rows.length,
    perkMode,
    byDay: Object.fromEntries(Object.entries(byDay).sort()),
    byVersion,
    modes,
    cards: finish(cards, (id) => PERK_BY_ID[id]?.name),
    hypers: finish(hypers, (id) => (HYPER_BY_ID as Record<string, { name: string } | undefined>)[id]?.name),
  };
}
