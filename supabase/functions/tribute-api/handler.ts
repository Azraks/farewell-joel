import { hashToken, InputError, validateCredential, validateMessage, validateUploads, verifyUploadedFiles, type UploadManifest } from './domain.ts';

export interface Batch {
  id: string;
  token_hash: string;
  manifest: UploadManifest[];
  state: 'uploading' | 'submitted' | 'deleted' | 'cleaned';
  expires_at: string;
}
export interface Backend {
  rpc(name: string, args?: Record<string, unknown>): Promise<unknown>;
  getBatch(id: string): Promise<Batch | null>;
  signUpload(path: string): Promise<string>;
  listFiles(manifest: UploadManifest[]): Promise<Array<{ name: string; metadata?: { size?: number; mimetype?: string } }>>;
  removeFiles(paths: string[]): Promise<void>;
  markCleaned(id: string): Promise<void>;
  cleanupCandidates(): Promise<Batch[]>;
}

async function cleanBatch(backend: Backend, batch: Batch): Promise<boolean> {
  await backend.removeFiles(batch.manifest.map((file) => file.path));
  // A still-valid upload URL could recreate an object. Repeat cleanup after expiry.
  if (Date.parse(batch.expires_at) <= Date.now()) {
    await backend.markCleaned(batch.id);
    return true;
  }
  return false;
}

export function createHandler(backend: Backend, allowedOrigins: string[], cleanupSecret: string) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, apikey, x-cleanup-secret',
    };
    if (origin && allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowedOrigins.includes(origin)) return respond({ error: 'This site is not configured for submissions.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond({ error: 'Use POST.' }, 405);
    try {
      // Limit request bytes while reading, including callers using chunked transfer.
      const reader = request.body?.getReader();
      let bytes = 0;
      let text = '';
      const decoder = new TextDecoder();
      if (reader) {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 16_384) { await reader.cancel(); return respond({ error: 'Request too large.' }, 413); }
          text += decoder.decode(chunk.value, { stream: true });
        }
      }
      text += decoder.decode();
      let body;
      try { body = JSON.parse(text); } catch { return respond({ error: 'Invalid request.' }, 400); }
      if (!body || typeof body !== 'object') return respond({ error: 'Invalid request.' }, 400);
      if (body.action === 'cleanup') {
        if (!cleanupSecret || request.headers.get('x-cleanup-secret') !== cleanupSecret) return respond({ error: 'Unauthorised.' }, 401);
        await backend.rpc('expire_tribute_batches');
        const batches = await backend.cleanupCandidates();
        let completed = 0;
        let failed = 0;
        for (const batch of batches) {
          try { if (await cleanBatch(backend, batch)) completed++; } catch { failed++; }
        }
        return respond({ processed: batches.length, completed, failed }, failed ? 503 : 200);
      }
      validateCredential(body.id, body.token);
      const tokenHash = await hashToken(body.token);
      if (body.action === 'begin') {
        const manifest = validateUploads(body.id, body.files);
        await backend.rpc('begin_tribute_batch', { p_id: body.id, p_hash: tokenHash, p_manifest: manifest,
          p_bytes: manifest.reduce((sum, file) => sum + file.size, 0) });
        const current = await backend.getBatch(body.id);
        return respond({ id: body.id, status: current?.state === 'submitted' ? 'submitted' : 'uploading' });
      }
      const batch = await backend.getBatch(body.id);
      if (!batch || batch.token_hash !== tokenHash) return respond({ status: 'unavailable' });
      if (body.action === 'inspect') {
        return respond({ status: batch.state === 'submitted' ? 'available' : batch.state === 'uploading' ? 'uploading' : 'unavailable' });
      }
      if (body.action === 'delete') {
        const withdrawn = await backend.rpc('withdraw_tribute_batch', { p_id: body.id, p_hash: tokenHash });
        if (!withdrawn) return respond({ status: 'unavailable' });
        if (batch.state === 'cleaned') return respond({ status: 'deleted', cleanupPending: false });
        try {
          const complete = await cleanBatch(backend, batch);
          return respond({ status: 'deleted', cleanupPending: !complete });
        } catch {
          // The record is already hidden. A scheduled cleanup retries the storage operation.
          return respond({ status: 'deleted', cleanupPending: true });
        }
      }
      if (batch.state === 'submitted' && body.action === 'submit') return respond({ status: 'submitted' });
      if (batch.state !== 'uploading' || Date.parse(batch.expires_at) <= Date.now()) return respond({ error: 'This upload session has expired. Withdraw it and start again.' }, 409);
      if (body.action === 'upload') {
        const file = batch.manifest.find((item) => item.path === body.path);
        if (!file) return respond({ error: 'Invalid attachment.' }, 400);
        // Stop renewing two-hour signatures after the first 30 minutes. Cleanup waits three hours.
        if (Date.parse(batch.expires_at) - Date.now() < 150 * 60_000) return respond({ error: 'Upload link expired. Withdraw this attempt and start again.' }, 409);
        const existing = await backend.listFiles([file]);
        if (existing.some((item) => item.name === file.path)) {
          verifyUploadedFiles([file], existing);
          return respond({ status: 'uploaded' });
        }
        return respond({ status: 'ready', signedUrl: await backend.signUpload(file.path) });
      }
      if (body.action === 'submit') {
        const message = validateMessage(body.message, batch.manifest.length > 0);
        if (message.video_link && batch.manifest.some((file) => file.kind === 'video')) throw new InputError('Choose a video upload or a video link, not both.');
        verifyUploadedFiles(batch.manifest, await backend.listFiles(batch.manifest));
        await backend.rpc('finish_tribute_batch', { p_id: body.id, p_hash: tokenHash, p_message: message });
        return respond({ status: 'submitted' });
      }
      return respond({ error: 'Unknown action.' }, 400);
    } catch (error) {
      if (error instanceof InputError) return respond({ error: error.message }, 400);
      // Never log request bodies, deletion credentials, signed URLs or raw provider errors.
      return respond({ error: error instanceof PublicError ? error.message : 'The service is unavailable. Please retry.' }, 503);
    }
  };
}

export class PublicError extends Error {}
