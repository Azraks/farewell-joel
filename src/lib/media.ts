/** Convert a shared video link into an embeddable iframe URL, if we recognise the host. */
export function embedUrl(link: string): string | null {
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1`;
    if (host === 'youtube.com') {
      const id = u.searchParams.get('v') ?? u.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.match(/\/(\d+)/)?.[1];
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
    if (host === 'drive.google.com') {
      const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? u.searchParams.get('id');
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
  } catch {
    /* invalid URL */
  }
  return null;
}

/** YouTube thumbnail for nicer video cards. */
export function youtubeThumb(link: string): string | null {
  const e = embedUrl(link);
  const id = e?.match(/youtube-nocookie\.com\/embed\/([^?]+)/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** Downscale + re-encode a photo to JPEG in the browser (saves storage, strips EXIF/GPS). */
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This image format is not supported by your browser. Please use JPG or PNG.');
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image compression failed'))), 'image/jpeg', quality),
  );
}

export function videoExt(file: File): string {
  if (file.type === 'video/quicktime') return 'mov';
  if (file.type === 'video/webm') return 'webm';
  return 'mp4';
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
