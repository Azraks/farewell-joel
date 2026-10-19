/** Decode a single frame without playing or uploading the video. */
export function captureVideoThumbnail(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    let finished = false;
    const finish = (thumbnail: string | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      video.onloadedmetadata = video.onloadeddata = video.onseeked = video.onerror = null;
      video.removeAttribute('src');
      video.load();
      resolve(thumbnail);
    };
    const timeout = setTimeout(() => finish(null), 12000);
    const capture = () => {
      if (!video.videoWidth || !video.videoHeight) return finish(null);
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return finish(null);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        // Unsupported codecs and cross-origin restrictions must not break the card.
        finish(null);
      }
    };
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.min(1, video.duration / 2);
      } else {
        video.onloadeddata = capture;
        if (video.readyState >= 2) capture();
      }
    };
    video.onseeked = capture;
    video.src = url;
    video.load();
  });
}

const thumbnails = new Map<string, Promise<string | null>>();
let active = 0;
const pending: Array<() => void> = [];

function thumbnailFor(url: string): Promise<string | null> {
  const cached = thumbnails.get(url);
  if (cached) return cached;
  const result = new Promise<string | null>(resolve => {
    pending.push(() => {
      active++;
      void captureVideoThumbnail(url).then(resolve).finally(() => {
        active--;
        runNext();
      });
    });
  });
  // Bound memory while sharing work between message cards and gallery picks.
  if (thumbnails.size >= 60) thumbnails.delete(thumbnails.keys().next().value!);
  thumbnails.set(url, result);
  runNext();
  return result;
}

function runNext() {
  while (active < 2 && pending.length) pending.shift()!();
}

export function applyVideoThumbnail(element: HTMLElement, thumbnail: string) {
  if (element.tagName === 'VIDEO') {
    // Preserve the native player, its controls and current playback state.
    (element as HTMLVideoElement).poster = thumbnail;
    return;
  }
  const image = document.createElement('img');
  image.src = thumbnail;
  image.alt = '';
  element.replaceWith(image);
}

export function setupVideoThumbnails(root: HTMLElement) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const placeholder = entry.target as HTMLElement;
      observer.unobserve(placeholder);
      void thumbnailFor(placeholder.dataset.videoThumbnail!).then(thumbnail => {
        if (!thumbnail || !placeholder.isConnected) return;
        applyVideoThumbnail(placeholder, thumbnail);
      });
    }
  }, { rootMargin: '200px' });
  root.querySelectorAll<HTMLElement>('[data-video-thumbnail]').forEach(element => observer.observe(element));
  return () => observer.disconnect();
}
