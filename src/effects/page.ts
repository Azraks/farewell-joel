import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { query, reducedMotion } from '../lib/ui';

gsap.registerPlugin(ScrollTrigger);

export function setupAnimations() {
  const nav = query('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const glow = query('.cursor-glow');
  window.addEventListener('pointermove', (e) => {
    glow.style.left = `${e.clientX}px`;
    glow.style.top = `${e.clientY}px`;
  });

  if (reducedMotion) return;

  gsap.from('.hero-avatar', { scale: 0, opacity: 0, duration: 1.4, delay: 1.2, ease: 'elastic.out(1, 0.6)' });
  // Keep button gradients out of the blur layer to avoid repaint artifacts on navigation.
  gsap.from('.hero-anim:not(.hero-cta)', { y: 40, opacity: 0, filter: 'blur(10px)', duration: 1.1, stagger: 0.12, delay: 1.5, ease: 'power3.out', clearProps: 'filter' });
  gsap.from('.hero-cta', { y: 40, opacity: 0, duration: 1.1, delay: 2.1, ease: 'power3.out', clearProps: 'transform,opacity' });

  gsap.set('.reveal', { opacity: 0 });
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    onEnter: (els) => gsap.fromTo(els, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.1, ease: 'power3.out' }),
    once: true,
  });

  if (!query('#journey').hidden) {
    gsap.to('#timelineProgress', {
      height: '100%',
      ease: 'none',
      scrollTrigger: { trigger: '#timeline', start: 'top 70%', end: 'bottom 60%', scrub: true },
    });
  }
  gsap.utils.toArray<HTMLElement>('.milestone').forEach((el, i) => {
    gsap.from(el, {
      x: i % 2 === 0 ? -60 : 60,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  gsap.to('.hero-title', { yPercent: 40, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
}

export function countUp(el: HTMLElement, to: number) {
  if (reducedMotion) {
    el.textContent = String(to);
    return;
  }
  const obj = { v: 0 };
  gsap.to(obj, {
    v: to,
    duration: 1.8,
    ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 90%' },
    onUpdate: () => (el.textContent = String(Math.round(obj.v))),
  });
}

let videoRevealTriggers: ScrollTrigger[] = [];

export function revealVideos() {
  videoRevealTriggers.forEach(trigger => trigger.kill());
  videoRevealTriggers = [];
  const cards = document.querySelectorAll<HTMLElement>('.reveal-v');
  if (reducedMotion || !cards.length) return;
  gsap.set(cards, { opacity: 0 });
  videoRevealTriggers = ScrollTrigger.batch(cards, {
    start: 'top 90%',
    onEnter: (elements) => gsap.fromTo(elements,
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, clearProps: 'transform' }),
    once: true,
  });
}
