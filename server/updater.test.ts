import { describe, expect, it } from 'vitest';
import { checkUpdate, DIGEST_ANNOTATION, parseImage, registryDigest } from './updater';

const D1 = 'sha256:' + 'a'.repeat(64);
const D2 = 'sha256:' + 'b'.repeat(64);
const IMAGE = 'ghcr.io/dueno/repo:latest';

/** Registro y API de Kubernetes falsos. */
function fakes(opts: { seen?: string; image?: string; registry: string; registryAuth?: boolean; patchStatus?: number }) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const f = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body as string | undefined });
    if (url.includes('/deployments/')) {
      if (method === 'PATCH') return new Response('{}', { status: opts.patchStatus ?? 200 });
      const annotations = opts.seen ? { [DIGEST_ANNOTATION]: opts.seen } : undefined;
      return Response.json({ spec: { template: { metadata: { annotations }, spec: { containers: [{ image: opts.image ?? IMAGE }] } } } });
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
    const { f, calls } = fakes({ seen: D1, registry: D1 });
    expect(await checkUpdate({ ...base, fetch: f })).toBe('sin-cambios');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('reinicia el Deployment cuando el digest cambia', async () => {
    const { f, calls } = fakes({ seen: D1, registry: D2, registryAuth: true });
    expect(await checkUpdate({ ...base, fetch: f, now: () => new Date('2026-10-11T12:00:00Z') })).toBe('actualizado');
    const patch = calls.find((c) => c.method === 'PATCH')!;
    const ann = JSON.parse(patch.body!).spec.template.metadata.annotations;
    expect(ann[DIGEST_ANNOTATION]).toBe(D2);
    expect(ann['kubectl.kubernetes.io/restartedAt']).toBe('2026-10-11T12:00:00.000Z');
  });

  it('la primera vez (sin anotación) también reinicia, una sola vez', async () => {
    const { f } = fakes({ registry: D1 });
    expect(await checkUpdate({ ...base, fetch: f })).toBe('actualizado');
  });

  it('no vigila una imagen local o con digest fijo', async () => {
    const { f, calls } = fakes({ image: 'blockrogue:local', registry: D1 });
    expect(await checkUpdate({ ...base, fetch: f })).toBe('sin-cambios');
    expect(calls).toHaveLength(1);
  });

  it('falla en voz alta si el registro o la API responden mal', async () => {
    const { f } = fakes({ seen: D1, registry: D2, patchStatus: 403 });
    await expect(checkUpdate({ ...base, fetch: f })).rejects.toThrow(/403/);
    const bad = (async () => new Response(null, { status: 404 })) as typeof fetch;
    await expect(registryDigest(bad, 'ghcr.io', 'dueno/repo', 'latest')).rejects.toThrow(/404/);
  });
});
