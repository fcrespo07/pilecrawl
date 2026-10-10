// Proveedores de anuncios para el hueco de la portada (`ui/adSlot.ts`).
// No hay ningún identificador de cuenta en el código: salen de variables del build (VITE_AD_*).
// Sin ellas no se carga nada y el hueco queda plegado.
import type { AdProvider } from '../ui/adSlot';

const CONSENT_KEY = 'blockrogue.consent.ads';

type Consent = 'yes' | 'no' | null;

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'yes' || v === 'no' ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(v: Exclude<Consent, null>) {
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* sin almacenamiento: se vuelve a preguntar la próxima vez */
  }
}

/** Dominio del script y formato de un id de editor de AdSense: se valida para no inyectar nada raro en la página. */
const ADSENSE_CLIENT = /^ca-pub-\d{10,20}$/;
const ADSENSE_SLOT = /^\d{6,20}$/;

/** Anuncio de display de AdSense. Solo carga el script de Google si hay consentimiento. */
export function adsenseProvider(client: string, slot: string, consent: 'builtin' | 'none' = 'builtin'): AdProvider | null {
  if (!ADSENSE_CLIENT.test(client) || !ADSENSE_SLOT.test(slot)) return null;
  return (host, onFilled) => {
    let stopped = false;
    let observer: MutationObserver | undefined;

    const load = () => {
      if (stopped) return;
      host.replaceChildren();
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.dataset.adClient = client;
      ins.dataset.adSlot = slot;
      ins.dataset.adFormat = 'auto';
      ins.dataset.fullWidthResponsive = 'true';
      host.append(ins, script);
      // AdSense marca el hueco cuando de verdad hay anuncio; mientras no, la portada no reserva sitio
      observer = new MutationObserver(() => {
        if (ins.dataset.adStatus === 'filled') onFilled();
      });
      observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
      script.addEventListener('load', () => {
        try {
          ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ??= []).push({});
        } catch {
          /* bloqueador de anuncios u otro fallo: sin anuncio */
        }
      });
    };

    if (consent === 'none' || readConsent() === 'yes') load();
    else if (readConsent() === null) askConsent(host, onFilled, load);
    return () => {
      stopped = true;
      observer?.disconnect();
    };
  };
}

/** Aviso mínimo: los anuncios solo se cargan si el jugador acepta. Se recuerda la respuesta. */
function askConsent(host: HTMLElement, onFilled: () => void, accepted: () => void) {
  const box = document.createElement('div');
  box.className = 'ad-consent';
  box.innerHTML =
    '<p>Los anuncios ayudan a mantener el juego. Cargarlos usa cookies de terceros (Google). ¿Los activas?</p>' +
    '<div><button type="button" data-v="yes" class="home-btn small">Sí</button><button type="button" data-v="no" class="home-btn small">No</button></div>';
  box.addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>('button')?.dataset.v;
    if (v !== 'yes' && v !== 'no') return;
    writeConsent(v);
    if (v === 'yes') accepted();
    else {
      host.replaceChildren();
      host.dataset.state = 'empty';
    }
  });
  host.replaceChildren(box);
  onFilled();
}

/** ¿Hay aviso de consentimiento propio activo? Entonces la portada ofrece cambiar la respuesta. */
export function adConsentManaged(): boolean {
  const env = import.meta.env;
  return env.VITE_AD_PROVIDER === 'adsense' && env.VITE_AD_CONSENT !== 'none' && adProviderFromEnv() !== null;
}

/** Olvida la respuesta: la próxima carga vuelve a preguntar y, si había dicho «sí», ya no carga el script. */
export function resetAdConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* sin almacenamiento: no había respuesta guardada */
  }
}

/** Proveedor del build actual, o null (sin anuncios). */
export function adProviderFromEnv(): AdProvider | null {
  const env = import.meta.env;
  if (env.VITE_AD_PROVIDER === 'adsense') return adsenseProvider(env.VITE_AD_CLIENT ?? '', env.VITE_AD_SLOT ?? '', env.VITE_AD_CONSENT === 'none' ? 'none' : 'builtin');
  return null;
}
