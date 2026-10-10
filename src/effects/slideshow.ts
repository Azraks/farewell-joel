import { gsap } from 'gsap';
import { photoUrls, type Tribute } from '../lib/data';
import { escapeHtml } from '../lib/media';
import { reducedMotion } from '../lib/ui';
import { animateSlide, createTransitionPicker } from './slideshow-transitions';

/**
 * Fullscreen party slideshow.
 * - Background: Ken Burns (slow zoom + pan) of the tribute's own photos, cross-faded.
 *   Slides without photos borrow a random photo from the pool, heavily blurred.
 * - Floating polaroids of every uploaded photo drift behind the text.
 * - Foreground: five entrance effects alternate in a shuffled rotation.
 */
interface SlideshowOptions {
  root: HTMLElement;
  getTributes: () => Tribute[];
  videoHtml: (t: Tribute) => string;
  onEmpty: () => void;
}

export function createSlideshow({ root, getTributes, videoHtml, onEmpty }: SlideshowOptions) {
  const bg = root.querySelector<HTMLElement>('.ss-bg')!;
  const drift = root.querySelector<HTMLElement>('.ss-drift')!;
  const slide = root.querySelector<HTMLElement>('.slide')!;
  const counter = root.querySelector<HTMLElement>('.ss-count')!;
  const bar = root.querySelector<HTMLElement>('.ss-progress-bar')!;

  let idx = 0;
  let timer: number | undefined;
  let bgCycle: number | undefined;
  let slideTimeline: gsap.core.Timeline | null = null;
  let progressTween: gsap.core.Tween | null = null;
  let driftTweens: gsap.core.Tween[] = [];
  const nextTransition = createTransitionPicker();

  const list = () => getTributes();
  const pool = () => list().flatMap(photoUrls);

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
    const photos = pool();
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

  function show(i: number) {
    const items = list();
    if (!items.length) return;
    idx = (i + items.length) % items.length;
    const t = items[idx]!;
    const photos = photoUrls(t);
    const video = videoHtml(t);
    const hold = Math.min(22, 6 + t.message.length * 0.045 + (photos.length ? 3 : 0));

    clearTimeout(timer);
    clearInterval(bgCycle);
    progressTween?.kill();
    slideTimeline?.kill();

    // Background
    const p = pool();
    if (photos.length) {
      setBackground(photos[0]!, true, hold);
      if (photos.length > 1) {
        let k = 0;
        bgCycle = window.setInterval(() => setBackground(photos[++k % photos.length]!, true, 6), Math.max(4000, (hold * 1000) / photos.length));
      }
    } else {
      setBackground(p.length ? p[Math.floor(Math.random() * p.length)]! : null, false, hold);
    }

    // Foreground
    const stack = !video && photos.length
      ? `<div class="ss-stack">${photos
          .slice(0, 3)
          .map((u, n) => `<figure class="ss-polaroid" style="--r:${[-6, 5, -2][n]}deg; --o:${n}"><img src="${escapeHtml(u)}" alt="" /></figure>`)
          .join('')}</div>`
      : '';
    slide.className = `slide ${stack ? 'with-photo' : ''} ${video ? 'with-video' : ''}`;
    slide.innerHTML = `
      ${video ? `<div class="ss-video">${video}</div>` : ''}
      ${stack}
      <div class="ss-text">
        <div class="slide-msg">${wordsHtml(t.message)}</div>
        <div class="slide-name">— ${escapeHtml(t.name)}${t.team ? ` · ${escapeHtml(t.team)}` : ''}</div>
      </div>`;
    counter.textContent = `${idx + 1} / ${items.length}`;

    const transition = nextTransition();
    slide.dataset.transition = transition;
    if (!reducedMotion) slideTimeline = animateSlide(slide, transition);

    // Auto-advance
    const vid = slide.querySelector('video');
    if (vid) {
      vid.addEventListener('ended', () => show(idx + 1));
      bar.parentElement!.style.opacity = '0';
    } else if (slide.querySelector('iframe')) {
      bar.parentElement!.style.opacity = '0'; // embedded players can't report "ended" → manual next
    } else {
      bar.parentElement!.style.opacity = '1';
      progressTween = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: hold, ease: 'none' });
      timer = window.setTimeout(() => show(idx + 1), hold * 1000);
    }
  }

  function open() {
    if (!list().length) return onEmpty();
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    document.documentElement.requestFullscreen?.().catch(() => {});
    startDrift();
    show(0);
  }

  function close() {
    clearTimeout(timer);
    clearInterval(bgCycle);
    progressTween?.kill();
    slideTimeline?.kill();
    stopDrift();
    root.hidden = true;
    slide.innerHTML = '';
    bg.innerHTML = '';
    document.body.style.overflow = '';
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  root.querySelector('.ss-prev')!.addEventListener('click', () => show(idx - 1));
  root.querySelector('.ss-next')!.addEventListener('click', () => show(idx + 1));
  root.querySelector('.ss-close')!.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      show(idx + 1);
    }
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'Escape') close();
  });
  // Leaving browser fullscreen with Esc also closes the show
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !root.hidden) close();
  });

  return { open, close, isOpen: () => !root.hidden };
}
