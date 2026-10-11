import { describe, expect, it } from 'vitest';
import { BAD_ANNOTATION, checkUpdate, DIGEST_ANNOTATION, GOOD_ANNOTATION, parseImage, registryDigest, TRACKED_ANNOTATION } from './updater';

const D1 = 'sha256:' + 'a'.repeat(64);
const D2 = 'sha256:' + 'b'.repeat(64);
const IMAGE = 'ghcr.io/dueno/repo:latest';

/** Registro y API de Kubernetes falsos. */
interface Fake {
  seen?: string; // digest anotado en la plantilla
  image?: string;
  registry: string;
  registryAuth?: boolean;
  patchStatus?: number;
  meta?: Record<string, string>; // anotaciones del Deployment
  status?: 'disponible' | 'fallido' | 'arrancando';
}

function fakes(opts: Fake) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const f = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body as string | undefined });
    if (url.includes('/deployments/')) {
      if (method === 'PATCH') return new Response('{}', { status: opts.patchStatus ?? 200 });
      const annotations = opts.seen ? { [DIGEST_ANNOTATION]: opts.seen } : undefined;
      const status =
        opts.status === 'fallido'
          ? { observedGeneration: 3, availableReplicas: 0, updatedReplicas: 1, conditions: [{ type: 'Progressing', status: 'False', reason: 'ProgressDeadlineExceeded' }] }
          : opts.status === 'arrancando'
            ? { observedGeneration: 3, availableReplicas: 0, updatedReplicas: 1, conditions: [{ type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' }] }
            : { observedGeneration: 3, availableReplicas: 1, updatedReplicas: 1, conditions: [{ type: 'Available', status: 'True' }] };
      return Response.json({
        metadata: { generation: 3, annotations: opts.meta },
        spec: { template: { metadata: { annotations }, spec: { containers: [{ name: 'blockrogue', image: opts.image ?? IMAGE }] } } },
        status,
      });
    }
    if (url.startsWith('https://ghcr.io/token')) return Response.json({ token: 't0k' });
    if (url.startsWith('https://ghcr.io/v2/')) {
      const bearer = (init?.headers as Record<string, string> | undefined)?.authorization;
      if (opts.registryAuth && !bearer) {
        return new Response(null, { status: 401, headers: { 'www-authenticate': 'Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:dueno/repo:pull"' } });
      }
      return new Response(null, { status: 200, headers: { 'docker-content-digest': opts.registry } });
    }
    return new Response('?', { status: 404 });
  }) as typeof fetch;
  return { f, calls };
}

const base = { token: 'sa', namespace: 'blockrogue', deployment: 'blockrogue', api: 'https://k8s' };

describe('actualizador', () => {
  it('lee el registro, el tag y los digests fijos', () => {
    expect(parseImage('ghcr.io/dueno/repo:latest')).toEqual({ registry: 'ghcr.io', repo: 'dueno/repo', tag: 'latest' });
    expect(parseImage('ghcr.io/dueno/repo')?.tag).toBe('latest');
    expect(parseImage(`ghcr.io/dueno/repo@${D1}`)).toBeNull();
    expect(parseImage('blockrogue:local')).toBeNull();
  });

  it('no hace nada si el digest es el que ya se desplegó', async () => {
    const { f, calls } = fakes({ seen: D1, registry: D1, meta: { [GOOD_ANNOTATION]: D1 } });
    expect(await checkUpdate({ ...base, fetch: f })).toBe('sin-cambios');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('reinicia el Deployment cuando el digest cambia', async () => {
    const { f, calls } = fakes({ seen: D1, registry: D2, registryAuth: true });
    expect(await checkUpdate({ ...base, fetch: f, now: () => new Date('2026-10-11T12:00:00Z') })).toBe('actualizado');
    const patch = calls.filter((c) => c.method === 'PATCH').at(-1)!;
    const body = JSON.parse(patch.body!);
    const ann = body.spec.template.metadata.annotations;
    expect(ann[DIGEST_ANNOTATION]).toBe(D2);
    expect(body.spec.template.spec.containers[0].image).toBe(IMAGE);
    expect(ann['kubectl.kubernetes.io/restartedAt']).toBe('2026-10-11T12:00:00.000Z');
  });

  it('la primera vez (sin anotación) también reinicia, una sola vez', async () => {
    const { f } = fakes({ registry: D1 });
    expect(await checkUpdate({ ...base, fetch: f })).toBe('actualizado');
  });

  it('marca como buena la imagen que ya está disponible, sin reiniciar', async () => {
    const { f, calls } = fakes({ seen: D1, registry: D1 });
    expect(await checkUpdate({ ...base, fetch: f })).toBe('sin-cambios');
    const patches = calls.filter((c) => c.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(JSON.parse(patches[0]!.body!)).toEqual({ metadata: { annotations: { [GOOD_ANNOTATION]: D1 } } });
  });

  it('no marca como buena una imagen que aún está arrancando', async () => {
    const { f, calls } = fakes({ seen: D2, registry: D2, status: 'arrancando', meta: { [GOOD_ANNOTATION]: D1 } });
    expect(await checkUpdate({ ...base, fetch: f })).toBe('sin-cambios');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('vuelve a la última buena si la nueva no arranca, y no la repite', async () => {
    const { f, calls } = fakes({ seen: D2, registry: D2, status: 'fallido', meta: { [GOOD_ANNOTATION]: D1 } });
    expect(await checkUpdate({ ...base, fetch: f, now: () => new Date('2026-10-11T12:00:00Z') })).toBe('revertido');
    const body = JSON.parse(calls.find((c) => c.method === 'PATCH')!.body!);
    expect(body.spec.template.spec.containers[0].image).toBe(`ghcr.io/dueno/repo@${D1}`);
    expect(body.spec.template.metadata.annotations[DIGEST_ANNOTATION]).toBe(D1);
    expect(body.metadata.annotations[BAD_ANNOTATION]).toBe(D2);
    expect(body.metadata.annotations[TRACKED_ANNOTATION]).toBe(IMAGE);

    // ya revertido: latest sigue siendo la mala → no se redespliega
    const after = fakes({ seen: D1, registry: D2, image: `ghcr.io/dueno/repo@${D1}`, meta: { [GOOD_ANNOTATION]: D1, [BAD_ANNOTATION]: D2, [TRACKED_ANNOTATION]: IMAGE } });
    expect(await checkUpdate({ ...base, fetch: after.f })).toBe('sin-cambios');
    expect(after.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('con otra imagen distinta de la mala, vuelve a vigilar :latest', async () => {
    const D3 = 'sha256:' + 'c'.repeat(64);
    const { f, calls } = fakes({ seen: D1, registry: D3, image: `ghcr.io/dueno/repo@${D1}`, meta: { [GOOD_ANNOTATION]: D1, [BAD_ANNOTATION]: D2, [TRACKED_ANNOTATION]: IMAGE } });
    expect(await checkUpdate({ ...base, fetch: f })).toBe('actualizado');
    const body = JSON.parse(calls.find((c) => c.method === 'PATCH')!.body!);
    expect(body.spec.template.spec.containers[0].image).toBe(IMAGE);
    expect(body.metadata.annotations[BAD_ANNOTATION]).toBeNull();
  });

  it('si falla y no hay imagen buena anterior, no hace nada raro', async () => {
    const { f, calls } = fakes({ seen: D2, registry: D2, status: 'fallido' });
    expect(await checkUpdate({ ...base, fetch: f })).toBe('sin-cambios');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('no vigila una imagen local o con digest fijo', async () => {
    const { f, calls } = fakes({ image: 'blockrogue:local', registry: D1 });
    expect(await checkUpdate({ ...base, fetch: f })).toBe('sin-cambios');
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
  });

  it('falla en voz alta si el registro o la API responden mal', async () => {
    const { f } = fakes({ seen: D1, registry: D2, patchStatus: 403 });
    await expect(checkUpdate({ ...base, fetch: f })).rejects.toThrow(/403/);
    const bad = (async () => new Response(null, { status: 404 })) as typeof fetch;
    await expect(registryDigest(bad, 'ghcr.io', 'dueno/repo', 'latest')).rejects.toThrow(/404/);
  });
});
