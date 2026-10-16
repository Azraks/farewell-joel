import { gsap } from 'gsap';
import { photoUrls, type Tribute } from '../lib/data';
import { escapeHtml } from '../lib/media';
import { reducedMotion } from '../lib/ui';
import { createSlideshowMediaViewer } from './slideshow-media-viewer';
import { createSlideshowFullscreen } from './slideshow-fullscreen';
import { createSlideshowFocus } from './slideshow-focus';
import {
  createSlideshowPlayback, createVideoReadingClock, messageReadingSeconds,
} from './slideshow-playback';
import { animateSlide, createTransitionPicker } from './slideshow-transitions';

/** One colleague per slide, with scrollable text and a selectable photo stack. */
interface SlideshowOptions {
  root: HTMLElement;
  getTributes: () => Tribute[];
  videoHtml: (t: Tribute, autoplay?: boolean) => string;
  onEmpty: () => void;
}

export function createSlideshow({ root, getTributes, videoHtml, onEmpty }: SlideshowOptions) {
  const bg = root.querySelector<HTMLElement>('.ss-bg')!;
  const drift = root.querySelector<HTMLElement>('.ss-drift')!;
  const slide = root.querySelector<HTMLElement>('.slide')!;
  const counter = root.querySelector<HTMLElement>('.ss-count')!;
  const bar = root.querySelector<HTMLElement>('.ss-progress-bar')!;

  let currentIndex = 0;
  let items: Tribute[] = [];
  let generation = 0;
  let paused = false;
  let entranceComplete = false;
  let lastVideoTime = 0;
  let videoClock: number | undefined;
  let videoLoadTimeout: number | undefined;
  let frameCleanups: Array<() => void> = [];
  let playback: ReturnType<typeof createSlideshowPlayback> | undefined;
  const pauseButton = root.querySelector<HTMLButtonElement>('.ss-pause')!;
  const status = root.querySelector<HTMLElement>('.ss-status')!;
  const viewer = createSlideshowMediaViewer(root, () => {
    paused = true;
    updatePause();
  }, updateVideoPlayback);
  const focus = createSlideshowFocus(root, pauseButton);
  const fullscreen = createSlideshowFullscreen({
    isFullscreen: () => Boolean(document.fullscreenElement),
    isSlideshowFullscreen: () => document.fullscreenElement === document.documentElement,
    enter: async () => { await document.documentElement.requestFullscreen?.(); },
    exit: async () => { await document.exitFullscreen(); },
  }, close);
  let slideTimeline: gsap.core.Timeline | null = null;
  let progressTween: gsap.core.Tween | null = null;
  let driftTweens: gsap.core.Tween[] = [];
  const nextTransition = createTransitionPicker();

  const getPhotoPool = () => items.flatMap(photoUrls);

  function setBackground(url: string | null, own: boolean, holdSeconds: number) {
    const layer = document.createElement('div');
    layer.className = `ss-layer ${own ? 'own' : 'borrowed'}`;
    if (url) layer.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
    else layer.classList.add('nebula-only');
    // Random Ken Burns path
    const r = () => (Math.random() - 0.5) * 8;
    layer.style.setProperty('--x1', `${r()}%`);
    layer.style.setProperty('--y1', `${r()}%`);
    layer.style.setProperty('--x2', `${r()}%`);
    layer.style.setProperty('--y2', `${r()}%`);
    layer.style.setProperty('--dur', `${holdSeconds + 3}s`);
    bg.appendChild(layer);
    if (reducedMotion) gsap.set(layer, { opacity: 1 });
    else gsap.fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.out' });
    // Remove older layers after the cross-fade
    const old = [...bg.children].slice(0, -1);
    old.forEach((el) => {
      if (reducedMotion) el.remove();
      else gsap.to(el, { opacity: 0, duration: 1.6, onComplete: () => el.remove() });
    });
  }

  function startDrift() {
    stopDrift();
    if (reducedMotion) return;
    const photos = getPhotoPool();
    if (!photos.length) return;
    const count = Math.min(12, Math.max(6, photos.length * 2));
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'ss-polaroid-mini';
      el.innerHTML = `<img src="${escapeHtml(photos[i % photos.length]!)}" alt="" />`;
      const size = 90 + Math.random() * 90;
      el.style.width = `${size}px`;
      el.style.left = `${Math.random() * 100}%`;
      drift.appendChild(el);
      const dur = 26 + Math.random() * 20;
      gsap.set(el, { yPercent: 0, y: window.innerHeight + 200, rotation: (Math.random() - 0.5) * 40 });
      driftTweens.push(
        gsap.to(el, {
          y: -300,
          rotation: `+=${(Math.random() - 0.5) * 60}`,
          duration: dur,
          ease: 'none',
          repeat: -1,
          delay: -Math.random() * dur, // start mid-flight so the screen isn't empty
        }),
      );
    }
  }

  function stopDrift() {
    driftTweens.forEach((t) => t.kill());
    driftTweens = [];
    drift.innerHTML = '';
  }

  function wordsHtml(text: string) {
    return escapeHtml(text)
      .split(/(\s+)/)
      .map((w) => (w.trim() ? `<span class="w">${w}</span>` : w))
      .join('');
  }

  function isPaused() {
    return paused || document.hidden;
  }

  function clearFrame() {
    viewer.close();
    generation++;
    clearTimeout(videoLoadTimeout);
    clearInterval(videoClock);
    frameCleanups.forEach(cleanup => cleanup());
    frameCleanups = [];
    playback?.dispose();
    playback = undefined;
    progressTween?.kill();
    progressTween = null;
    slideTimeline?.kill();
    slideTimeline = null;
  }

  function runTimer(seconds: number) {
    bar.parentElement!.style.opacity = '1';
    progressTween = gsap.fromTo(bar, { scaleX: 0 }, {
      scaleX: 1, duration: seconds, ease: 'none', paused: isPaused(),
      onComplete: () => show(currentIndex + 1),
    });
  }

  function updatePause() {
    if (paused && !entranceComplete) slideTimeline?.progress(1);
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    pauseButton.setAttribute('aria-pressed', String(paused));
    slideTimeline?.paused(isPaused());
    progressTween?.paused(isPaused());
    driftTweens.forEach(tween => tween.paused(isPaused()));
    root.classList.toggle('is-paused', isPaused());
    updateVideoPlayback();
    lastVideoTime = performance.now();
  }

  function updateVideoPlayback() {
    // The enlarged player is still the same video, with its own native controls.
    playback?.setSuspended(viewer.isVideoOpen() ? document.hidden : isPaused());
  }

  function setupPhotoGallery(photos: string[], pauseToRead: () => void) {
    const photoCards = [...slide.querySelectorAll<HTMLButtonElement>('.ss-photo-card')];
    if (photoCards.length) {
      const stack = slide.querySelector<HTMLElement>('.ss-photo-stack')!;
      // Match the horizontal and vertical padding in .ss-photo-card.
      const horizontalBorder = 16;
      const verticalBorder = 36;
      const fitPhotos = () => {
        const maxWidth = stack.clientWidth * 0.9;
        const maxHeight = stack.clientHeight * 0.9;
        photoCards.forEach(card => {
          const image = card.querySelector('img')!;
          if (!image.naturalWidth || !image.naturalHeight) return;
          const ratio = image.naturalWidth / image.naturalHeight;
          const width = Math.max(1, Math.min(maxWidth - horizontalBorder, (maxHeight - verticalBorder) * ratio));
          card.style.width = `${width + horizontalBorder}px`;
          card.style.height = `${width / ratio + verticalBorder}px`;
        });
      };
      const resizeObserver = new ResizeObserver(fitPhotos);
      resizeObserver.observe(stack);
      photoCards.forEach(card => card.querySelector('img')!.addEventListener('load', fitPhotos));
      fitPhotos();
      frameCleanups.push(() => {
        resizeObserver.disconnect();
        photoCards.forEach(card => card.querySelector('img')!.removeEventListener('load', fitPhotos));
      });
    }
    let selectedPhoto = 0;
    function selectPhoto(index: number) {
      selectedPhoto = (index + photoCards.length) % photoCards.length;
      photoCards.forEach((card, position) => {
        const depth = (position - selectedPhoto + photoCards.length) % photoCards.length;
        card.style.zIndex = String(photoCards.length - depth);
        card.setAttribute('aria-pressed', String(position === selectedPhoto));
        card.setAttribute('aria-label', `Enlarge photo ${position + 1}`);
      });
      slide.querySelector('.ss-photo-count')!.textContent = `${selectedPhoto + 1} / ${photos.length}`;
    }
    photoCards.forEach((card, index) => card.addEventListener('click', () => {
      viewer.openPhotos(photos, index, selectPhoto);
    }));
    if (photoCards.length) {
      selectPhoto(0);
      const previousPhoto = slide.querySelector<HTMLButtonElement>('.ss-photo-prev')!;
      const nextPhoto = slide.querySelector<HTMLButtonElement>('.ss-photo-next')!;
      previousPhoto.disabled = nextPhoto.disabled = photoCards.length === 1;
      previousPhoto.addEventListener('click', () => {
        pauseToRead();
        selectPhoto(selectedPhoto - 1);
      });
      nextPhoto.addEventListener('click', () => {
        pauseToRead();
        selectPhoto(selectedPhoto + 1);
      });
    }
  }

  function startVideoPlayback(video: HTMLVideoElement, readingSeconds: number, version: number) {
    const clock = createVideoReadingClock(readingSeconds);
    const onPlaying = () => {
      clock.replay();
      status.textContent = '';
    };
    const onError = () => {
      status.textContent = 'Video could not be played. Choose Next to continue.';
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);
    frameCleanups.push(() => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
    });
    playback = createSlideshowPlayback(video, () => {
      if (version === generation) status.textContent = 'Press play on the video, or choose Next to continue.';
    });
    lastVideoTime = performance.now();
    videoClock = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(0.5, (now - lastVideoTime) / 1000);
      lastVideoTime = now;
      if (version !== generation) return;
      const timing = clock.tick(elapsed, isPaused(), !video.paused && video.readyState >= 3, video.ended);
      bar.parentElement!.style.opacity = timing.reading ? '1' : '0';
      gsap.set(bar, { scaleX: timing.progress });
      if (timing.finished) show(currentIndex + 1);
    }, 100);
    videoLoadTimeout = window.setTimeout(() => {
      if (version === generation && !isPaused() && video.readyState < 3) {
        status.textContent = 'Video is taking longer to load. Press play or choose Next.';
      }
    }, 12000);
  }

  function show(i: number) {
    if (!items.length || root.hidden) return;
    clearFrame();
    const version = generation;
    currentIndex = (i + items.length) % items.length;
    const tribute = items[currentIndex]!;
    const readingSeconds = messageReadingSeconds(tribute.message);
    entranceComplete = false;
    gsap.set(bar, { scaleX: 0 });
    bar.parentElement!.style.opacity = '0';
    status.textContent = '';
    const photos = photoUrls(tribute);
    const allPhotos = getPhotoPool();
    setBackground(photos[0] ?? allPhotos[0] ?? null, photos.length > 0, readingSeconds);
    const videoMarkup = videoHtml(tribute, Boolean(tribute.video_link && !tribute.video_path));
    const hasMedia = photos.length > 0 || Boolean(videoMarkup);
    const stack = photos.length ? `
      <div class="ss-photo-gallery">
        <div class="ss-photo-stack">
          ${photos.map((url, index) => `<button type="button" class="ss-polaroid ss-photo-card" style="--r:${[-4, 3, -2, 2][index] ?? 0}deg; --o:${index}" aria-label="View photo ${index + 1}"><img src="${escapeHtml(url)}" alt="Photo ${index + 1} from ${escapeHtml(tribute.name)}" /></button>`).join('')}
        </div>
        <div class="ss-photo-controls">
          <button type="button" class="btn btn-ghost btn-sm ss-photo-prev" aria-label="Previous slide photo">‹</button>
          <span class="ss-photo-count" aria-live="polite"></span>
          <button type="button" class="btn btn-ghost btn-sm ss-photo-next" aria-label="Next slide photo">›</button>
        </div>
      </div>` : '';
    slide.className = `slide ss-person ${hasMedia ? 'ss-person-with-media' : ''} ${photos.length && videoMarkup ? 'ss-person-mixed' : ''}`;
    const expandButton = tribute.video_path
      ? '<button type="button" class="btn btn-ghost btn-sm ss-video-expand" aria-label="Enlarge video">⛶</button>'
      : '';
    const videoPanel = videoMarkup ? `<div class="ss-video">${videoMarkup}${expandButton}</div>` : '';
    const mediaPanel = hasMedia ? `<div class="ss-person-media">${videoPanel}${stack}</div>` : '';
    slide.innerHTML = `
      ${mediaPanel}
      <div class="ss-text">
        <div class="slide-msg" tabindex="0" role="region" aria-label="Message from ${escapeHtml(tribute.name)}">${wordsHtml(tribute.message)}</div>
        <div class="slide-name">— ${escapeHtml(tribute.name)}${tribute.team ? ` · ${escapeHtml(tribute.team)}` : ''}</div>
      </div>`;
    counter.textContent = `${currentIndex + 1} / ${items.length}`;
    pauseButton.disabled = Boolean(slide.querySelector('iframe'));

    function pauseToRead() {
      if (pauseButton.disabled || paused) return;
      // Finish the entrance before freezing so content never remains invisible.
      if (!entranceComplete) slideTimeline?.progress(1);
      paused = true;
      updatePause();
      status.textContent = '';
    }

    const message = slide.querySelector<HTMLElement>('.slide-msg')!;
    message.addEventListener('wheel', pauseToRead, { passive: true });
    message.addEventListener('touchmove', pauseToRead, { passive: true });
    message.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) pauseToRead();
    });
    setupPhotoGallery(photos, pauseToRead);
    const videoElement = slide.querySelector('video');
    if (videoElement) {
      slide.querySelector('.ss-video-expand')!.addEventListener('click', () => viewer.openVideo(videoElement));
      videoElement.addEventListener('dblclick', () => viewer.openVideo(videoElement));
    }
    const transition = nextTransition();
    slide.dataset.transition = transition;

    function afterEntrance() {
      if (version !== generation || root.hidden) return;
      entranceComplete = true;
      if (!videoMarkup) {
        status.textContent = '';
        runTimer(readingSeconds);
        return;
      }
      if (!videoElement) {
        status.textContent = 'External video: play here or open the link. Choose Next when finished.';
        return;
      }
      startVideoPlayback(videoElement, readingSeconds, version);
      updatePause();
    }

    function enter() {
      if (version !== generation || root.hidden) return;
      clearTimeout(videoLoadTimeout);
      status.textContent = '';
      if (reducedMotion) afterEntrance();
      else {
        slideTimeline = animateSlide(slide, transition);
        slideTimeline.eventCallback('onComplete', afterEntrance);
        // Manual navigation while paused must still reveal the new frame.
        if (isPaused()) slideTimeline.progress(1);
      }
    }

    enter();
    updatePause();
  }

  function open() {
    if (!root.hidden) return;
    items = [...getTributes()];
    if (!items.length) return onEmpty();
    paused = false;
    root.hidden = false;
    focus.open();
    void fullscreen.open();
    startDrift();
    show(0);
  }

  function close() {
    if (root.hidden) return;
    clearFrame();
    stopDrift();
    root.hidden = true;
    slide.innerHTML = '';
    bg.innerHTML = '';
    focus.close();
    void fullscreen.close();
  }

  pauseButton.addEventListener('click', () => {
    paused = !paused;
    if (!paused) playback?.requestPlay();
    updatePause();
  });
  document.addEventListener('visibilitychange', () => {
    if (!root.hidden) updatePause();
  });
  root.querySelector('.ss-prev')!.addEventListener('click', () => show(currentIndex - 1));
  root.querySelector('.ss-next')!.addEventListener('click', () => show(currentIndex + 1));
  root.querySelector('.ss-close')!.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (root.hidden || viewer.isOpen()) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('video, iframe, a, input')) return;
    if (e.key === ' ' && target.closest('button')) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (!pauseButton.disabled) {
        paused = !paused;
        if (!paused) playback?.requestPlay();
        updatePause();
      }
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      show(currentIndex + 1);
    }
    if (e.key === 'ArrowLeft') show(currentIndex - 1);
  });
  // Leaving browser fullscreen with Esc also closes the show
  document.addEventListener('fullscreenchange', fullscreen.changed);

  return { open, close, isOpen: () => !root.hidden };
}
