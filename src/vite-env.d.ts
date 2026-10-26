/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
/** Enlace al repositorio público (VITE_REPO_URL o el valor por defecto de vite.config.ts). */
declare const __REPO_URL__: string;

/** Variables públicas del build (`VITE_*`): acaban dentro del JavaScript, así que nada secreto. */
interface ImportMetaEnv {
  /** «1» activa el ranking en línea. Sin ello el juego es solo local. */
  readonly VITE_RANKING?: string;
  /** Dirección del servidor si no es el mismo dominio que el juego (p. ej. dentro de un portal). */
  readonly VITE_API_URL?: string;
  /** Proveedor de anuncios: «adsense» o vacío (sin anuncios). */
  readonly VITE_AD_PROVIDER?: string;
  readonly VITE_AD_CLIENT?: string;
  readonly VITE_AD_SLOT?: string;
  /** «none» desactiva el aviso de consentimiento propio (si ya usas el de Google u otro certificado). */
  readonly VITE_AD_CONSENT?: string;
  /** Página de privacidad. Obligatoria si hay ranking o anuncios. */
  readonly VITE_PRIVACY_URL?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_SITE_OWNER?: string;
}
