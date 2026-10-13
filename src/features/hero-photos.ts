import { heroMedia } from '../lib/hero-assets';
import { query } from '../lib/ui';

export function setupHeroPhotos() {
  const photos = heroMedia.filter(item => !item.video);
  const openButton = query<HTMLButtonElement>('#heroPhotosBtn');
  openButton.hidden = photos.length === 0;
  if (!photos.length) return;

  const dialog = query<HTMLDialogElement>('#heroPhotosDialog');
  const image = query<HTMLImageElement>('#heroPhoto');
  const counter = query('#heroPhotoCount');
  const thumbs = query('#heroPhotoThumbs');
  const previous = query<HTMLButtonElement>('#previousHeroPhoto');
  const next = query<HTMLButtonElement>('#nextHeroPhoto');
  let selected = 0;
  let savedOverflow = '';

  const buttons = photos.map((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'memory-photo-thumb';
    button.setAttribute('aria-label', `View photo ${index + 1}`);
    const thumbnail = document.createElement('img');
    thumbnail.src = photo.url;
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    button.appendChild(thumbnail);
    button.addEventListener('click', () => show(index));
    thumbs.appendChild(button);
    return button;
  });

  function show(index: number) {
    selected = (index + photos.length) % photos.length;
    image.src = photos[selected]!.url;
    image.alt = `Photo ${selected + 1} from Joel’s memories`;
    counter.textContent = `${selected + 1} / ${photos.length}`;
    buttons.forEach((button, position) => {
      button.setAttribute('aria-pressed', String(position === selected));
    });
    buttons[selected]!.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }

  previous.disabled = next.disabled = photos.length === 1;
  previous.addEventListener('click', () => show(selected - 1));
  next.addEventListener('click', () => show(selected + 1));
  openButton.addEventListener('click', () => {
    const current = document.querySelector<HTMLImageElement>('#heroMedia img.is-visible');
    const currentIndex = photos.findIndex(photo => current?.getAttribute('src') === photo.url);
    savedOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    show(currentIndex >= 0 ? currentIndex : 0);
  });
  query('#closeHeroPhotos').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.style.overflow = savedOverflow;
    openButton.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(selected + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
}
