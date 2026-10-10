import { isDemo, SUPABASE_KEY, SUPABASE_URL } from './environment';
import { validateUploads, MAX_VIDEO_BYTES, MAX_PHOTO_BYTES, MAX_PHOTOS, type UploadSpec, type UploadManifest, type MessageInput } from '../../supabase/functions/tribute-api/domain';

export { MAX_VIDEO_BYTES, MAX_PHOTO_BYTES, MAX_PHOTOS };
export interface Credential { id: string; token: string }
export interface UploadSession extends Credential { manifest: UploadManifest[] }
export interface ApiResult { status?: string; signedUrl?: string; cleanupPending?: boolean }

export function createCredential(): Credential {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return { id: crypto.randomUUID(), token: Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('') };
}

export function deletionLink(credential: Credential): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `delete=${credential.id}.${credential.token}`;
  return url.toString();
}

export function readDeletionCredential(): Credential | null {
  const fragment = window.location.hash;
  if (!fragment.startsWith('#delete=')) return null;
  // Remove the secret before rendering media or making any network requests.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  const match = fragment.match(/^#delete=([0-9a-f-]{36})\.([0-9a-f]{64})$/i);
  return match ? { id: match[1]!, token: match[2]! } : { id: '', token: '' };
}

export async function callApi(action: string, credential: Credential, extra: Record<string, unknown> = {}): Promise<ApiResult> {
  if (isDemo) {
    if (action === 'inspect') return { status: 'available' };
    if (action === 'begin') return { status: 'uploading' };
    return { status: action === 'delete' ? 'deleted' : 'submitted' };
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Submissions are unavailable until Supabase is configured.');
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/tribute-api`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY! },
      body: JSON.stringify({ action, ...credential, ...extra }), signal: AbortSignal.timeout(40_000),
    });
  } catch {
    throw new Error('The connection was interrupted. Please retry; your submission will not be duplicated.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The service is unavailable. Please retry.');
  if (result.status === 'unavailable' && !['inspect', 'delete'].includes(action)) throw new Error('This upload session is unavailable. Please withdraw this attempt and start again.');
  return result;
}

export function createUploadSession(files: UploadSpec[]): UploadSession {
  const credential = createCredential();
  return { ...credential, manifest: validateUploads(credential.id, files) };
}

export async function beginUpload(session: UploadSession): Promise<boolean> {
  const result = await callApi('begin', session, { files: session.manifest.map(({ kind, size, type }) => ({ kind, size, type })) });
  return result.status === 'submitted';
}

export async function finishUpload(session: UploadSession, message: MessageInput): Promise<void> {
  const result = await callApi('submit', session, { message });
  if (result.status !== 'submitted') throw new Error('Submission could not be confirmed. Please retry.');
}

/** Retries reuse the same path; the backend recognises an already-uploaded file. */
export async function uploadAttachment(session: UploadSession, index: number, file: Blob, onProgress: (fraction: number) => void): Promise<void> {
  if (isDemo) { onProgress(1); return; }
  const attachment = session.manifest[index]!;
  const result = await callApi('upload', session, { path: attachment.path });
  if (result.status === 'uploaded') { onProgress(1); return; }
  if (!result.signedUrl) throw new Error('Could not authorise the upload. Please retry.');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', result.signedUrl!);
    xhr.timeout = 5 * 60_000;
    const body = new FormData();
    body.append('cacheControl', '300');
    body.append('', file);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(1); resolve(); }
      else reject(new Error('Upload could not be confirmed. Retry to check and resume it.'));
    };
    xhr.onerror = () => reject(new Error('Network interrupted during upload. Please retry.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Please retry on a stable connection.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.send(body);
  });
}
