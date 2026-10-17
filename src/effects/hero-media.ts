import { query, reducedMotion } from '../lib/ui';

import { heroRotation as media } from '../lib/hero-assets';

export function setupHeroMedia() {
  const root = query('#heroMedia');
  if (!media.length) return;
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: HTMLImageElement | HTMLVideoElement | null = null;
  let visible = true;
  let generation = 0;
  let introComplete = reducedMotion;
  let loading = false;

  function schedule(delay: number) {
    clearTimeout(timer);
    if (!reducedMotion && visible && !document.hidden) timer = setTimeout(next, delay);
  }

  function next() {
    index = (index + 1) % media.length;
    show();
  }

  function show() {
    loading = true;
    const item = media[index]!;
    const currentGeneration = ++generation;
    // Skip a stalled load rather than leaving the rotation stuck.
    schedule(15000);
    const element = document.createElement(item.video ? 'video' : 'img');
    element.className = 'hero-memory';
    if (element instanceof HTMLVideoElement) {
      element.muted = true;
      element.playsInline = true;
      element.preload = 'metadata';
      element.addEventListener('ended', () => {
        if (currentGeneration === generation) next();
      }, { once: true });
    } else {
      element.alt = '';
    }
    const reveal = () => {
      if (currentGeneration !== generation) return;
      loading = false;
      const previous = active;
      active = element;
      root.appendChild(element);
      requestAnimationFrame(() => element.classList.add('is-visible'));
      if (previous instanceof HTMLVideoElement) previous.pause();
      previous?.classList.remove('is-visible');
      setTimeout(() => previous?.remove(), reducedMotion ? 0 : 1200);
      if (element instanceof HTMLVideoElement && visible && !document.hidden) {
        void element.play().catch(() => schedule(6000));
      }
      // A timeout also advances videos that stall or never report an ending.
      schedule(item.video ? 15000 : 6500);
    };
    element.addEventListener(item.video ? 'loadeddata' : 'load', reveal, { once: true });
    element.addEventListener('error', () => {
      if (currentGeneration === generation) {
        loading = false;
        schedule(1000);
      }
    }, { once: true });
    element.src = item.url;
    if (element instanceof HTMLVideoElement) element.load();
  }

  function updatePlayback() {
    if (!visible || document.hidden) {
      clearTimeout(timer);
      if (active instanceof HTMLVideoElement) active.pause();
    } else if (!active && introComplete && !loading) {
      show();
    } else if (active) {
      if (active instanceof HTMLVideoElement) void active.play().catch(() => {});
      schedule(6500);
    }
  }

  new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    updatePlayback();
  }).observe(query('#hero'));
  document.addEventListener('visibilitychange', updatePlayback);
  if (reducedMotion) {
    const firstPhoto = media.findIndex(item => !item.video);
    if (firstPhoto < 0) return;
    index = firstPhoto;
    show();
  } else {
    // Match the starfield's 2.2-second warp introduction.
    setTimeout(() => {
      introComplete = true;
      if (visible && !document.hidden && !loading) show();
    }, 2200);
  }
}
