// Actualizador automático para k3s: mira si la imagen publicada en el registro (el tag del Deployment,
// normalmente `latest`) ha cambiado y, si es así, reinicia el Deployment para que baje la nueva.
// Va en un CronJob dentro del clúster: es la Pi la que pregunta al registro, no hay que abrirle nada a GitHub.
// El digest visto se guarda en anotaciones del Deployment, así que no depende de cómo lo cuente el nodo.
// Si la imagen nueva no arranca (el Deployment agota `progressDeadlineSeconds`), vuelve a la última buena
// y no vuelve a intentar ese digest hasta que salga otro.

/** En la plantilla del pod (cambiarla reinicia): digest que se desplegó. */
export const DIGEST_ANNOTATION = 'pilecrawl/image-digest';
/** En el Deployment (no reinicia): última imagen que llegó a estar disponible, la que falló y la referencia original. */
export const GOOD_ANNOTATION = 'pilecrawl/good-digest';
export const BAD_ANNOTATION = 'pilecrawl/bad-digest';
export const TRACKED_ANNOTATION = 'pilecrawl/tracked-image';

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

export type UpdateResult = 'sin-cambios' | 'actualizado' | 'revertido';

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

interface Condition {
  type: string;
  status: string;
  reason?: string;
}

interface DeploymentJson {
  metadata: { generation?: number; annotations?: Record<string, string> };
  spec: { template: { metadata?: { annotations?: Record<string, string> }; spec: { containers: { name: string; image: string }[] } } };
  status?: { observedGeneration?: number; availableReplicas?: number; updatedReplicas?: number; conditions?: Condition[] };
}

export async function checkUpdate(d: UpdaterDeps): Promise<UpdateResult> {
  const log = d.log ?? (() => {});
  const api = d.api ?? 'https://kubernetes.default.svc';
  const path = `${api}/apis/apps/v1/namespaces/${d.namespace}/deployments/${d.deployment}`;
  const auth = { authorization: `Bearer ${d.token}` };
  const patch = async (body: unknown) => {
    const res = await d.fetch(path, {
      method: 'PATCH',
      headers: { ...auth, 'content-type': 'application/strategic-merge-patch+json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`modificar el Deployment: HTTP ${res.status} ${await res.text()}`);
  };

  const got = await d.fetch(path, { headers: auth });
  if (!got.ok) throw new Error(`leer el Deployment: HTTP ${got.status}`);
  const dep = (await got.json()) as DeploymentJson;
  const container = dep.spec.template.spec.containers[0];
  const meta = dep.metadata.annotations ?? {};
  // la referencia que se vigila (`…:latest`) se recuerda aparte: tras un retroceso la imagen queda fijada a un digest
  const tracked = meta[TRACKED_ANNOTATION] ?? container?.image ?? '';
  const ref = parseImage(tracked);
  if (!container || !ref) {
    log(`imagen ${tracked}: no se vigila (sin registro o con digest fijo)`);
    return 'sin-cambios';
  }
  const deployed = dep.spec.template.metadata?.annotations?.[DIGEST_ANNOTATION];
  const good = meta[GOOD_ANNOTATION];
  const bad = meta[BAD_ANNOTATION];
  const now = (d.now?.() ?? new Date()).toISOString();

  // estado del último despliegue (solo vale si el controlador ya lo ha visto)
  const st = dep.status;
  const settled = st?.observedGeneration !== undefined && st.observedGeneration === dep.metadata.generation;
  const failed = settled && !!st?.conditions?.some((c) => c.type === 'Progressing' && c.status === 'False' && c.reason === 'ProgressDeadlineExceeded');
  const up = settled && (st?.availableReplicas ?? 0) >= 1 && (st?.updatedReplicas ?? 0) >= 1 && !failed;

  if (failed && deployed && good && good !== deployed) {
    await patch({
      metadata: { annotations: { [BAD_ANNOTATION]: deployed, [TRACKED_ANNOTATION]: tracked } },
      spec: {
        template: {
          metadata: { annotations: { [DIGEST_ANNOTATION]: good, 'kubectl.kubernetes.io/restartedAt': now } },
          spec: { containers: [{ name: container.name, image: `${ref.registry}/${ref.repo}@${good}` }] },
        },
      },
    });
    log(`la imagen ${deployed} no arrancó: vuelvo a ${good}`);
    return 'revertido';
  }
  if (failed) log(`la imagen ${deployed ?? '?'} no arrancó y no hay una buena anterior a la que volver`);
  if (up && deployed && good !== deployed) {
    await patch({ metadata: { annotations: { [GOOD_ANNOTATION]: deployed } } }); // no reinicia: es del Deployment, no de la plantilla
    log(`${deployed} marcada como buena`);
  }

  const latest = await registryDigest(d.fetch, ref.registry, ref.repo, ref.tag);
  if (latest === bad) {
    log(`sin cambios: ${latest.slice(0, 19)} ya falló, espero a una imagen distinta`);
    return 'sin-cambios';
  }
  if (latest === deployed && container.image === tracked) {
    log(`sin cambios (${latest.slice(0, 19)})`);
    return 'sin-cambios';
  }

  // cambiar la plantilla reinicia el Deployment (estrategia Recreate); imagePullPolicy Always baja la imagen nueva
  await patch({
    metadata: { annotations: { [TRACKED_ANNOTATION]: tracked, [BAD_ANNOTATION]: null } },
    spec: {
      template: {
        metadata: { annotations: { [DIGEST_ANNOTATION]: latest, 'kubectl.kubernetes.io/restartedAt': now } },
        spec: { containers: [{ name: container.name, image: tracked }] },
      },
    },
  });
  log(`imagen nueva (${deployed ?? 'primera vez'} → ${latest}): Deployment reiniciado`);
  return 'actualizado';
}
