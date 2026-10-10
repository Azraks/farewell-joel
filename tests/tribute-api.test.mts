import test from 'node:test';
import assert from 'node:assert/strict';
import { hashToken, validateMessage, validateUploads, verifyUploadedFiles, MAX_VIDEO_BYTES } from '../supabase/functions/tribute-api/domain.ts';
import { createHandler, type Backend, type Batch } from '../supabase/functions/tribute-api/handler.ts';
import { createBackend } from '../supabase/functions/tribute-api/backend.ts';

const id = 'eb1d7bcd-9404-42af-8dc2-50b4e536e89e';
const token = 'a'.repeat(64);
const message = { name: ' Joel’s colleague ', team: ' IT ', message: ' Thank you! ', video_link: null };
const origin = 'https://example.github.io';

async function fixture(options: { state?: Batch['state']; storageFailure?: boolean; expired?: boolean; missing?: boolean } = {}) {
  const manifest = validateUploads(id, [{ kind: 'photo', size: 123, type: 'image/jpeg' }]);
  const batch: Batch = { id, token_hash: await hashToken(token), manifest, state: options.state ?? 'uploading',
    expires_at: new Date(Date.now() + (options.expired ? -1000 : 3 * 3600_000)).toISOString() };
  const events: string[] = [];
  const backend: Backend = {
    async getBatch() { return options.missing ? null : structuredClone(batch); },
    async rpc(name) {
      events.push(name);
      if (name === 'withdraw_tribute_batch') { batch.state = 'deleted'; return true; }
      if (name === 'finish_tribute_batch') batch.state = 'submitted';
      return null;
    },
    async signUpload() { events.push('sign'); return 'https://storage.example/upload?token=private'; },
    async listFiles(files) { return files.map((file) => ({ name: file.path, metadata: { size: file.size, mimetype: file.type } })); },
    async removeFiles() { events.push('remove'); if (options.storageFailure) throw new Error('provider secret'); },
    async markCleaned() { events.push('cleaned'); batch.state = 'cleaned'; },
    async cleanupCandidates() { return [structuredClone(batch)]; },
  };
  const handler = createHandler(backend, [origin], 'scheduler-secret');
  async function request(action: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
    const response = await handler(new Request('https://service.example', { method: 'POST',
      headers: { origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action, id, token, ...extra }) }));
    return { response, body: await response.json() };
  }
  return { handler, request, batch, events, backend };
}

test('message validation trims text and rejects invalid URLs and oversized messages', () => {
  assert.deepEqual(validateMessage(message), { name: 'Joel’s colleague', team: 'IT', message: 'Thank you!', video_link: null, is_test: false });
  for (const video_link of ['javascript:alert(1)', 'https://', 'https://user:pass@example.com']) {
    assert.throws(() => validateMessage({ ...message, video_link }));
  }
  assert.throws(() => validateMessage({ ...message, message: 'x'.repeat(1501) }));
  assert.throws(() => validateMessage({ ...message, name: ' ' }));
});

test('manifest enforces count, type and size and generates server-controlled paths', () => {
  const video = { kind: 'video', size: MAX_VIDEO_BYTES, type: 'video/quicktime' };
  assert.equal(validateUploads(id, [video])[0].path, `${id}/videos/1.mov`);
  assert.throws(() => validateUploads(id, [video, video]));
  assert.throws(() => validateUploads(id, [{ ...video, size: MAX_VIDEO_BYTES + 1 }]));
  assert.throws(() => validateUploads(id, [{ kind: 'photo', size: 1, type: 'image/svg+xml' }]));
  assert.throws(() => validateUploads(id, Array(5).fill({ kind: 'photo', size: 1, type: 'image/jpeg' })));
  assert.throws(() => validateUploads(id, [{ ...video, size: -1 }]));
});

test('metadata must match both declared bytes and content type', () => {
  const files = validateUploads(id, [{ kind: 'photo', size: 10, type: 'image/jpeg' }]);
  assert.throws(() => verifyUploadedFiles(files, []));
  assert.throws(() => verifyUploadedFiles(files, [{ name: files[0].path, metadata: { size: 10, mimetype: 'video/mp4' } }]));
  assert.throws(() => verifyUploadedFiles(files, [{ name: files[0].path, metadata: { size: 11, mimetype: 'image/jpeg' } }]));
});

test('begin persists only a SHA-256 digest; plain token never reaches RPC', async () => {
  const f = await fixture();
  let args: Record<string, unknown> | undefined;
  f.backend.rpc = async (_name, input) => { args = input; };
  const { response } = await f.request('begin', { files: [] });
  assert.equal(response.status, 200);
  assert.equal(args?.p_hash, await hashToken(token));
  assert.ok(!JSON.stringify(args).includes(token));
});

test('opening deletion link inspects without mutating data', async () => {
  const f = await fixture({ state: 'submitted' });
  assert.equal((await f.request('inspect')).body.status, 'available');
  assert.deepEqual(f.events, []);
  const get = await f.handler(new Request('https://service.example', { method: 'GET' }));
  assert.equal(get.status, 405);
  assert.deepEqual(f.events, []);
});

test('wrong token cannot submit or delete or reveal existence', async () => {
  const f = await fixture({ state: 'submitted' });
  for (const action of ['inspect', 'delete', 'submit', 'upload']) {
    assert.equal((await f.request(action, { token: 'b'.repeat(64) })).body.status, 'unavailable');
  }
  assert.deepEqual(f.events, []);
});

test('missing record and malformed credentials fail safely', async () => {
  const f = await fixture({ missing: true });
  assert.equal((await f.request('delete')).body.status, 'unavailable');
  assert.equal((await f.request('delete', { token: '../../secret' })).response.status, 400);
  assert.deepEqual(f.events, []);
});

test('deletion hides message before removing files; storage failure remains retryable', async () => {
  const f = await fixture({ state: 'submitted', storageFailure: true });
  const { response, body } = await f.request('delete');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'deleted');
  assert.equal(body.cleanupPending, true);
  assert.deepEqual(f.events, ['withdraw_tribute_batch', 'remove']);
  assert.equal(f.batch.state, 'deleted');
  f.backend.removeFiles = async () => { f.events.push('retry-remove'); };
  assert.equal((await f.request('delete')).body.status, 'deleted');
});

test('valid upload tokens keep cleanup queued until expiry, then release reservation', async () => {
  const f = await fixture({ state: 'submitted' });
  await f.request('delete');
  assert.ok(!f.events.includes('cleaned'));
  f.batch.expires_at = new Date(Date.now() - 1000).toISOString();
  await f.request('cleanup', {}, { 'x-cleanup-secret': 'scheduler-secret' });
  assert.ok(f.events.includes('cleaned'));
  assert.equal(f.batch.state, 'cleaned');
  assert.equal((await f.request('delete')).body.status, 'deleted');
});

test('submit response lost: retry succeeds without a second database insert', async () => {
  const f = await fixture();
  assert.equal((await f.request('submit', { message })).body.status, 'submitted');
  // The browser retries from begin, before trying to re-upload any attachments.
  const resumed = await f.request('begin', { files: [{ kind: 'photo', size: 123, type: 'image/jpeg' }] });
  assert.equal(resumed.body.status, 'submitted');
  assert.equal((await f.request('submit', { message })).body.status, 'submitted');
  assert.equal(f.events.filter((event) => event === 'finish_tribute_batch').length, 1);
});

test('expired and withdrawn batches cannot be submitted', async () => {
  for (const options of [{ expired: true }, { state: 'deleted' as const }]) {
    const f = await fixture(options);
    assert.equal((await f.request('submit', { message })).response.status, 409);
    assert.ok(!f.events.includes('finish_tribute_batch'));
  }
});

test('upload retry recognises stored file; unrelated paths cannot be authorised', async () => {
  const f = await fixture();
  assert.equal((await f.request('upload', { path: f.batch.manifest[0].path })).body.status, 'uploaded');
  assert.equal((await f.request('upload', { path: 'another-person/videos/file.mp4' })).response.status, 400);
  assert.ok(!f.events.includes('sign'));
});

test('a new attachment receives a signed upload URL only after manifest ownership is checked', async () => {
  const f = await fixture();
  f.backend.listFiles = async () => [];
  const result = await f.request('upload', { path: f.batch.manifest[0].path });
  assert.equal(result.body.status, 'ready');
  assert.ok(result.body.signedUrl);
  assert.deepEqual(f.events, ['sign']);
  assert.equal((await f.request('submit', { message })).response.status, 400);
  assert.ok(!f.events.includes('finish_tribute_batch'));
});

test('signed upload URLs cannot be renewed too late for cleanup', async () => {
  const f = await fixture();
  f.batch.expires_at = new Date(Date.now() + 60 * 60_000).toISOString();
  assert.equal((await f.request('upload', { path: f.batch.manifest[0].path })).response.status, 409);
  assert.ok(!f.events.includes('sign'));
});

test('scheduler authentication and origin allowlist are enforced', async () => {
  const f = await fixture();
  assert.equal((await f.request('cleanup')).response.status, 401);
  assert.equal((await f.request('delete', {}, { origin: 'https://evil.example' })).response.status, 403);
  assert.deepEqual(f.events, []);
  const { response } = await f.request('inspect');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('malformed and oversized requests are rejected without backend calls', async () => {
  const f = await fixture();
  const malformed = await f.handler(new Request('https://service.example', { method: 'POST', body: '{' }));
  assert.equal(malformed.status, 400);
  const oversized = await f.handler(new Request('https://service.example', { method: 'POST', body: ' '.repeat(16_385) }));
  assert.equal(oversized.status, 413);
  assert.deepEqual(f.events, []);
});

test('REST adapter uses Supabase signed-upload, listing and removal contracts', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body: any }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.includes('/upload/sign/')) return Response.json({ url: '/object/upload/sign/tributes/file?token=secret' });
    if (url.includes('/object/list/')) return Response.json([{ name: '1.jpg', metadata: { size: 123, mimetype: 'image/jpeg' } }]);
    return Response.json([]);
  };
  try {
    const backend = createBackend('https://project.supabase.co', 'server-only');
    const manifest = validateUploads(id, [{ kind: 'photo', size: 123, type: 'image/jpeg' }]);
    const url = await backend.signUpload(manifest[0].path);
    assert.equal(url, 'https://project.supabase.co/storage/v1/object/upload/sign/tributes/file?token=secret');
    const objects = await backend.listFiles(manifest);
    verifyUploadedFiles(manifest, objects);
    await backend.removeFiles([manifest[0].path]);
    assert.equal(calls[2].method, 'DELETE');
    assert.deepEqual(calls[2].body, { prefixes: [manifest[0].path] });
  } finally { globalThis.fetch = originalFetch; }
});
