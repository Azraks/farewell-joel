export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 4;

export type UploadSpec = { kind: 'photo' | 'video'; size: number; type: string };
export type UploadManifest = UploadSpec & { path: string };
export type MessageInput = { name: string; team: string | null; message: string; video_link: string | null; is_test: boolean };

export class InputError extends Error {}

export function validateCredential(id: unknown, token: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    || typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
    throw new InputError('This deletion link is invalid.');
  }
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validateUploads(id: string, files: unknown): UploadManifest[] {
  if (!Array.isArray(files) || files.length > MAX_PHOTOS + 1) throw new InputError('Too many attachments.');
  let photos = 0;
  let videos = 0;
  return files.map((file) => {
    if (!file || !Number.isSafeInteger(file.size) || file.size <= 0) throw new InputError('An attachment is empty or invalid.');
    if (file.kind === 'photo' && file.type === 'image/jpeg' && file.size <= MAX_PHOTO_BYTES && ++photos <= MAX_PHOTOS) {
      return { kind: 'photo', type: file.type, size: file.size, path: `${id}/photos/${photos}.jpg` };
    }
    const extension: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
    if (file.kind === 'video' && extension[file.type] && file.size <= MAX_VIDEO_BYTES && ++videos === 1) {
      return { kind: 'video', type: file.type, size: file.size, path: `${id}/videos/1.${extension[file.type]}` };
    }
    throw new InputError('Use up to 4 JPEG photos (5 MB each) and one MP4, MOV or WebM video (20 MB).');
  });
}

export function validateMessage(input: unknown, hasUploadedMedia = false): MessageInput {
  if (!input || typeof input !== 'object') throw new InputError('Please enter your message.');
  const fields = input as Record<string, unknown>;
  function text(key: string, limit: number, required = false): string {
    const value = fields[key];
    if (value != null && typeof value !== 'string') throw new InputError(`Invalid ${key}.`);
    const result = ((value as string | undefined) ?? '').trim();
    if ((required && !result) || [...result].length > limit) throw new InputError(`Please check your ${key} (maximum ${limit} characters).`);
    return result;
  }
  const link = text('video_link', 2048);
  if (link) {
    try {
      const url = new URL(link);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    } catch { throw new InputError('Please use a valid HTTPS video link.'); }
  }
  const message = text('message', 1500);
  if (!message && !link && !hasUploadedMedia) throw new InputError('Please write a message or add a photo or video.');
  return { name: text('name', 80, true), team: text('team', 80) || null,
    message, video_link: link || null, is_test: fields.is_test === true };
}

/** Verify server-reported storage metadata rather than trusting the browser's declaration. */
export function verifyUploadedFiles(manifest: UploadManifest[], objects: Array<{ name: string; metadata?: { size?: number; mimetype?: string } }>): void {
  for (const expected of manifest) {
    const object = objects.find((item) => item.name === expected.path);
    if (!object || object.metadata?.size !== expected.size || object.metadata?.mimetype !== expected.type) {
      throw new InputError('An attachment is missing or does not match. Please retry the upload.');
    }
  }
}
