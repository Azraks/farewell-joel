import { PublicError, type Backend, type Batch } from './handler.ts';
import type { UploadManifest } from './domain.ts';

/** Native HTTP calls keep the deployed function dependency-free. */
export function createBackend(projectUrl: string, serviceKey: string): Backend {
  async function call(path: string, method = 'GET', body?: unknown): Promise<any> {
    const response = await fetch(`${projectUrl}${path}`, {
      method,
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      // Only our known database business messages are safe to return to visitors.
      const result = await response.json().catch(() => ({}));
      const safeMessages = ['Submissions are closed', 'This upload session has expired',
        'Daily submission limit reached. Please contact the organiser',
        'Media storage is full. Please submit without attachments or use a video link'];
      if (safeMessages.includes(result.message)) throw new PublicError(result.message);
      throw new Error('Backend operation failed');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  return {
    rpc: (name, args = {}) => call(`/rest/v1/rpc/${name}`, 'POST', args),
    async getBatch(id) {
      const rows = await call(`/rest/v1/tribute_batches?id=eq.${encodeURIComponent(id)}&select=id,token_hash,manifest,state,expires_at`);
      return rows[0] ?? null;
    },
    async signUpload(path) {
      const result = await call(`/storage/v1/object/upload/sign/tributes/${path}`, 'POST', {});
      const signedUrl = new URL(`${projectUrl}/storage/v1${result.url}`);
      if (signedUrl.origin !== new URL(projectUrl).origin || !signedUrl.searchParams.has('token')) throw new Error('Invalid signed upload URL');
      return signedUrl.toString();
    },
    async listFiles(manifest: UploadManifest[]) {
      const prefixes = [...new Set(manifest.map((file) => file.path.slice(0, file.path.lastIndexOf('/'))))];
      const objects: Array<{ name: string; metadata?: { size?: number; mimetype?: string } }> = [];
      for (const prefix of prefixes) {
        const rows = await call('/storage/v1/object/list/tributes', 'POST', { prefix, limit: 10, offset: 0 });
        for (const row of rows) objects.push({ name: `${prefix}/${row.name}`, metadata: row.metadata });
      }
      return objects;
    },
    async removeFiles(paths) {
      if (paths.length) await call('/storage/v1/object/tributes', 'DELETE', { prefixes: paths });
    },
    async markCleaned(id) {
      // Remove the hidden message only after storage deletion succeeds.
      await call(`/rest/v1/tributes?id=eq.${id}&deleted_at=not.is.null`, 'DELETE');
      await call(`/rest/v1/tribute_batches?id=eq.${id}&state=eq.deleted`, 'PATCH', { state: 'cleaned', cleaned_at: new Date().toISOString() });
    },
    cleanupCandidates: () => call('/rest/v1/tribute_batches?state=eq.deleted&order=created_at.asc&limit=100') as Promise<Batch[]>,
  };
}
