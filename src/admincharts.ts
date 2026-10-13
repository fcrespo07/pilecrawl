// Gráficas SVG de la página de administración (admin.html). Dibujadas a mano: la página lleva una política de
// seguridad estricta y no carga nada de fuera. Cada función devuelve el SVG como texto; el texto libre va escapado.
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const C = { bar: '#4a6cf0', good: '#7fe0a0', bad: '#ff8f8f', warn: '#ffd36b', grid: '#2a3157', text: '#9aa3c7' } as const;

/** Número de eje redondeado hacia arriba a 1, 2 o 5 por una potencia de diez. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

export interface Bar { label: string; value: number; tip?: string; color?: string }

/** Barras verticales (partidas por día, niveles). `mark` pinta una raya en la barra de esa etiqueta. */
export function columns(bars: Bar[], opts: { height?: number; mark?: { label: string; text: string } } = {}): string {
  if (!bars.length) return '<p class="note">Sin datos.</p>';
  const H = opts.height ?? 180;
  const padL = 36;
  const padB = 22;
  const slot = Math.max(10, Math.min(36, Math.floor(900 / bars.length)));
  const W = padL + slot * bars.length + 8;
  const max = niceMax(Math.max(...bars.map((b) => b.value)));
  const y = (v: number) => 8 + (H - 8 - padB) * (1 - v / max);
  const every = Math.ceil(24 / slot);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" style="width:100%;max-width:${W * 1.6}px;height:auto" font-size="12" fill="${C.text}">`;
  for (const t of [0, 0.5, 1]) {
    const v = max * t;
    s += `<line x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/><text x="${padL - 4}" y="${y(v) + 3}" text-anchor="end">${Math.round(v)}</text>`;
  }
  bars.forEach((b, i) => {
    const x = padL + i * slot + 2;
    const top = y(b.value);
    s += `<rect x="${x}" y="${top}" width="${slot - 4}" height="${Math.max(0, H - padB - top)}" fill="${b.color ?? C.bar}"><title>${esc(b.tip ?? `${b.label}: ${b.value}`)}</title></rect>`;
    if (i % every === 0) s += `<text x="${x + (slot - 4) / 2}" y="${H - 6}" text-anchor="middle">${esc(b.label)}</text>`;
    if (opts.mark?.label === b.label) s += `<text x="${x + (slot - 4) / 2}" y="${Math.max(10, top - 4)}" text-anchor="middle" fill="${C.warn}">${esc(opts.mark.text)}</text>`;
  });
  return s + '</svg>';
}

export interface Row { label: string; value: number; text: string; tip?: string; color?: string }

/**
 * Barras horizontales con etiqueta a la izquierda y valor escrito a la derecha. Con `diverging` el cero va en el
 * centro y los valores negativos salen a la izquierda en rojo (diferencia de nivel de las cartas).
 */
export function rows(list: Row[], opts: { diverging?: boolean; labelW?: number } = {}): string {
  if (!list.length) return '<p class="note">Sin datos.</p>';
  const rowH = 20;
  const labelW = opts.labelW ?? 150;
  const plotW = 420;
  const W = labelW + plotW + 90;
  const H = list.length * rowH + 4;
  const max = niceMax(Math.max(...list.map((r) => Math.abs(r.value)), 0.0001));
  const zero = labelW + (opts.diverging ? plotW / 2 : 0);
  const scale = (opts.diverging ? plotW / 2 : plotW) / max;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" style="width:100%;max-width:${W * 1.4}px;height:auto" font-size="12" fill="${C.text}">`;
  s += `<line x1="${zero}" x2="${zero}" y1="0" y2="${H}" stroke="${C.grid}"/>`;
  list.forEach((r, i) => {
    const y = i * rowH + 2;
    const w = Math.abs(r.value) * scale;
    const neg = r.value < 0;
    const x = neg ? zero - w : zero;
    const color = r.color ?? (opts.diverging ? (neg ? C.bad : C.good) : C.bar);
    s += `<g><title>${esc(r.tip ?? `${r.label}: ${r.text}`)}</title><text x="${labelW - 6}" y="${y + 13}" text-anchor="end">${esc(r.label)}</text>`;
    s += `<rect x="${x}" y="${y + 2}" width="${Math.max(1, w)}" height="${rowH - 6}" fill="${color}"/>`;
    s += `<text x="${(neg ? zero + 6 : zero + w + 6)}" y="${y + 13}">${esc(r.text)}</text></g>`;
  });
  return s + '</svg>';
}

/** Una barra apilada al 100 % por fila (cómo acaban las partidas de cada modo). */
export function stacked(list: { label: string; parts: { name: string; value: number; color: string }[] }[]): string {
  if (!list.length) return '<p class="note">Sin datos.</p>';
  const labelW = 150;
  const plotW = 420;
  const rowH = 24;
  const W = labelW + plotW + 10;
  const H = list.length * rowH + 4;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" style="width:100%;max-width:${W * 1.4}px;height:auto" font-size="12" fill="${C.text}">`;
  list.forEach((r, i) => {
    const y = i * rowH + 2;
    const total = r.parts.reduce((a, p) => a + p.value, 0) || 1;
    s += `<text x="${labelW - 6}" y="${y + 14}" text-anchor="end">${esc(r.label)}</text>`;
    let x = labelW;
    for (const p of r.parts) {
      const w = (p.value / total) * plotW;
      if (w <= 0) continue;
      const pct = Math.round((p.value / total) * 100);
      s += `<rect x="${x}" y="${y + 2}" width="${w}" height="${rowH - 6}" fill="${p.color}"><title>${esc(`${r.label}: ${p.name} ${p.value} (${pct}%)`)}</title></rect>`;
      if (w > 34) s += `<text x="${x + w / 2}" y="${y + 15}" text-anchor="middle" fill="#101426">${pct}%</text>`;
      x += w;
    }
  });
  return s + '</svg>';
}

export const legend = (items: { name: string; color: string }[]) =>
  `<p class="note">${items.map((i) => `<span style="display:inline-block;width:10px;height:10px;background:${i.color};margin-right:4px"></span>${esc(i.name)}`).join(' &nbsp; ')}</p>`;
