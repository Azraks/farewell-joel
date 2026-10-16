/** A top-layer viewer that also works while the slideshow is browser-fullscreen. */
export function createSlideshowMediaViewer(
  root: HTMLElement,
  pause: () => void,
  playbackChanged: () => void,
) {
  const dialog = document.createElement('dialog');
  dialog.className = 'ss-media-viewer';
  dialog.setAttribute('aria-label', 'Media viewer');
  dialog.innerHTML = `
    <button type="button" class="btn btn-ghost btn-sm ss-viewer-close" autofocus aria-label="Close enlarged media">× Close</button>
    <div class="ss-viewer-stage"></div>
    <div class="ss-viewer-controls">
      <button type="button" class="btn btn-ghost ss-viewer-prev" aria-label="Previous enlarged photo">‹</button>
      <span class="ss-viewer-count" aria-live="polite"></span>
      <button type="button" class="btn btn-ghost ss-viewer-next" aria-label="Next enlarged photo">›</button>
    </div>`;
  root.appendChild(dialog);
  const stage = dialog.querySelector<HTMLElement>('.ss-viewer-stage')!;
  const controls = dialog.querySelector<HTMLElement>('.ss-viewer-controls')!;
  const counter = dialog.querySelector<HTMLElement>('.ss-viewer-count')!;
  const previous = dialog.querySelector<HTMLButtonElement>('.ss-viewer-prev')!;
  const next = dialog.querySelector<HTMLButtonElement>('.ss-viewer-next')!;
  let photos: string[] = [];
  let selected = 0;
  let onSelect: ((index: number) => void) | undefined;
  let restoreVideo: (() => void) | undefined;

  function showPhoto(index: number) {
    selected = (index + photos.length) % photos.length;
    const image = document.createElement('img');
    image.src = photos[selected]!;
    image.alt = `Photo ${selected + 1} of ${photos.length}`;
    stage.replaceChildren(image);
    counter.textContent = `${selected + 1} / ${photos.length}`;
    onSelect?.(selected);
  }

  function close() {
    if (dialog.open) dialog.close();
    // Restore synchronously before the slideshow can replace its previous content.
    restoreVideo?.();
    restoreVideo = undefined;
    stage.replaceChildren();
    playbackChanged();
  }

  dialog.querySelector('.ss-viewer-close')!.addEventListener('click', close);
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    restoreVideo?.();
    restoreVideo = undefined;
    stage.replaceChildren();
    playbackChanged();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  previous.addEventListener('click', () => showPhoto(selected - 1));
  next.addEventListener('click', () => showPhoto(selected + 1));
  dialog.addEventListener('keydown', event => {
    if (event.target instanceof HTMLVideoElement) return;
    if (photos.length && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      showPhoto(selected + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });

  return {
    close,
    isOpen: () => dialog.open,
    isVideoOpen: () => dialog.open && Boolean(restoreVideo),
    openPhotos(urls: string[], index: number, select: (index: number) => void) {
      if (!urls.length) return;
      pause();
      photos = urls;
      onSelect = select;
      controls.hidden = false;
      previous.disabled = next.disabled = photos.length === 1;
      dialog.showModal();
      showPhoto(index);
    },
    openVideo(video: HTMLVideoElement) {
      pause();
      photos = [];
      onSelect = undefined;
      controls.hidden = true;
      const marker = document.createComment('video position');
      video.before(marker);
      stage.replaceChildren(video);
      restoreVideo = () => {
        video.pause();
        if (marker.parentNode) marker.replaceWith(video);
      };
      dialog.showModal();
      playbackChanged();
    },
  };
}
