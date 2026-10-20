/** Texto corto para compartir una partida. Sin dependencias del juego: se prueba en Node. */
export interface ShareInfo {
  /** Nombre del modo, p. ej. «Diario #12». */
  mode: string;
  score: number;
  level: number;
  lines: number;
}

export const SHARE_URL = 'https://pilecrawl.fun';

export function shareText(i: ShareInfo): string {
  const pts = i.score.toLocaleString('es-ES');
  return `Pilecrawl · ${i.mode}\n${pts} puntos · nivel ${i.level} · ${i.lines} líneas\n¿Me superas? ${SHARE_URL}`;
}

/** Abre el menú de compartir del sistema si existe; si no, copia el texto. Devuelve lo que hizo. */
export async function shareRun(i: ShareInfo): Promise<'shared' | 'copied' | 'failed'> {
  const text = shareText(i);
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    // cancelar el menú de compartir no es un fallo
    if ((e as Error).name === 'AbortError') return 'shared';
    return 'failed';
  }
}
