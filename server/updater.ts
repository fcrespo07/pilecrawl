// Actualizador automático para k3s: mira si la imagen publicada en el registro (el tag del Deployment,
// normalmente `latest`) ha cambiado y, si es así, reinicia el Deployment para que baje la nueva.
// Va en un CronJob dentro del clúster: es la Pi la que pregunta al registro, no hay que abrirle nada a GitHub.
// El digest visto se guarda en una anotación del Deployment, así que no depende de cómo lo cuente el nodo.

export const DIGEST_ANNOTATION = 'pilecrawl/image-digest';

export interface UpdaterDeps {
  fetch: typeof fetch;
  /** Token de la cuenta de servicio del pod. */
  token: string;
  namespace: string;
  deployment: string;
  api?: string;
  now?: () => Date;
  log?: (msg: string) => void;
}

export type UpdateResult = 'sin-cambios' | 'actualizado';

/** `ghcr.io/dueño/repo:tag` → registro, repositorio y tag (sin tag, `latest`). Un digest fijo (`@sha256:`) no se vigila. */
export function parseImage(image: string): { registry: string; repo: string; tag: string } | null {
  if (image.includes('@')) return null;
  const m = /^([^/]+\.[^/]+)\/([^:]+)(?::([^/]+))?$/.exec(image);
  return m ? { registry: m[1]!, repo: m[2]!, tag: m[3] ?? 'latest' } : null;
}

const MANIFEST_TYPES = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

/** Digest actual de un tag, con el flujo de token anónimo de los registros (el paquete tiene que ser público). */
export async function registryDigest(f: typeof fetch, registry: string, repo: string, tag: string): Promise<string> {
  const url = `https://${registry}/v2/${repo}/manifests/${tag}`;
  let res = await f(url, { method: 'HEAD', headers: { accept: MANIFEST_TYPES } });
  if (res.status === 401) {
    const challenge = /Bearer\s+(.*)/i.exec(res.headers.get('www-authenticate') ?? '')?.[1] ?? '';
    const p = Object.fromEntries([...challenge.matchAll(/(\w+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    if (!p.realm) throw new Error(`el registro pide credenciales sin decir cómo (¿paquete privado?)`);
    const tokenUrl = new URL(p.realm);
    if (p.service) tokenUrl.searchParams.set('service', p.service);
    tokenUrl.searchParams.set('scope', p.scope ?? `repository:${repo}:pull`);
    const tr = await f(tokenUrl);
    if (!tr.ok) throw new Error(`token del registro: HTTP ${tr.status} (¿el paquete es público?)`);
    const token = ((await tr.json()) as { token?: string; access_token?: string }).token ?? '';
    res = await f(url, { method: 'HEAD', headers: { accept: MANIFEST_TYPES, authorization: `Bearer ${token}` } });
  }
  const digest = res.headers.get('docker-content-digest');
  if (!res.ok || !digest) throw new Error(`manifiesto de ${repo}:${tag}: HTTP ${res.status}`);
  return digest;
}

export async function checkUpdate(d: UpdaterDeps): Promise<UpdateResult> {
  const log = d.log ?? (() => {});
  const api = d.api ?? 'https://kubernetes.default.svc';
  const path = `${api}/apis/apps/v1/namespaces/${d.namespace}/deployments/${d.deployment}`;
  const auth = { authorization: `Bearer ${d.token}` };

  const got = await d.fetch(path, { headers: auth });
  if (!got.ok) throw new Error(`leer el Deployment: HTTP ${got.status}`);
  const dep = (await got.json()) as {
    spec: { template: { metadata?: { annotations?: Record<string, string> }; spec: { containers: { image: string }[] } } };
  };
  const image = dep.spec.template.spec.containers[0]?.image ?? '';
  const ref = parseImage(image);
  if (!ref) {
    log(`imagen ${image}: no se vigila (sin registro o con digest fijo)`);
    return 'sin-cambios';
  }

  const digest = await registryDigest(d.fetch, ref.registry, ref.repo, ref.tag);
  const seen = dep.spec.template.metadata?.annotations?.[DIGEST_ANNOTATION];
  if (seen === digest) {
    log(`sin cambios (${digest.slice(0, 19)})`);
    return 'sin-cambios';
  }

  // cambiar la plantilla reinicia el Deployment (estrategia Recreate); imagePullPolicy Always baja la imagen nueva
  const patch = {
    spec: {
      template: {
        metadata: {
          annotations: {
            [DIGEST_ANNOTATION]: digest,
            'kubectl.kubernetes.io/restartedAt': (d.now?.() ?? new Date()).toISOString(),
          },
        },
      },
    },
  };
  const res = await d.fetch(path, {
    method: 'PATCH',
    headers: { ...auth, 'content-type': 'application/strategic-merge-patch+json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`reiniciar el Deployment: HTTP ${res.status} ${await res.text()}`);
  log(`imagen nueva (${seen ?? 'primera vez'} → ${digest}): Deployment reiniciado`);
  return 'actualizado';
}
