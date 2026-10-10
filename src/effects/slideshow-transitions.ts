import { gsap } from 'gsap';

const transitions = ['rise', 'slide', 'focus', 'reveal', 'postcard'] as const;
type Transition = typeof transitions[number];

/** Draw all five effects in a random order before reusing any of them. */
export function createTransitionPicker() {
  let remaining: Transition[] = [];
  let previous: Transition | undefined;

  return (): Transition => {
    if (!remaining.length) remaining = [...transitions];
    const choices = remaining.filter(transition => transition !== previous);
    const selected = choices[Math.floor(Math.random() * choices.length)]!;
    remaining.splice(remaining.indexOf(selected), 1);
    previous = selected;
    return selected;
  };
}

/** All tweens belong to one timeline so next/exit can stop the entire entrance. */
export function animateSlide(slide: HTMLElement, transition: Transition): gsap.core.Timeline {
  const timeline = gsap.timeline();
  const text = slide.querySelector('.ss-text');
  const words = slide.querySelectorAll('.w');
  const name = slide.querySelector('.slide-name');
  const photos = slide.querySelectorAll('.ss-polaroid');
  const video = slide.querySelector('.ss-video');
  const media = video ? [video] : [...photos];
  const wordStagger = Math.min(0.06, 2.2 / Math.max(1, words.length));

  switch (transition) {
    case 'rise':
      if (media.length) {
        timeline.fromTo(media, { opacity: 0, y: 90, scale: 0.8 },
          { opacity: 1, y: 0, scale: 1, duration: 1.1, stagger: 0.15, ease: 'back.out(1.2)' }, 0);
      }
      if (words.length) {
        timeline.fromTo(words, { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: 0.6, stagger: wordStagger, ease: 'power2.out' }, 0.3);
      }
      timeline.fromTo(name, { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.8 }, '-=0.3');
      break;

    case 'slide':
      if (media.length) {
        timeline.fromTo(media, { opacity: 0, x: -110 },
          { opacity: 1, x: 0, duration: 1.2, stagger: 0.12, ease: 'power3.out' }, 0);
      }
      timeline.fromTo(text, { opacity: 0, x: 90 },
        { opacity: 1, x: 0, duration: 1.3, ease: 'power3.out' }, 0.15);
      break;

    case 'focus':
      if (media.length) {
        timeline.fromTo(media, { opacity: 0, scale: 1.12, filter: 'blur(10px)' },
          { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.5, stagger: 0.1, ease: 'power2.out' }, 0);
      }
      timeline.fromTo(text, { opacity: 0, scale: 0.94, filter: 'blur(8px)' },
        { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.5, ease: 'power2.out' }, 0.2);
      break;

    case 'reveal':
      if (media.length) {
        timeline.fromTo(media, { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 1.2, stagger: 0.15, ease: 'power2.out' }, 0);
      }
      timeline.fromTo(text, { clipPath: 'inset(0 100% 0 0)', opacity: 0 },
        { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: 1.6, ease: 'power2.inOut' }, 0.2);
      break;

    case 'postcard':
      if (photos.length) {
        timeline.fromTo(photos, { opacity: 0, scale: 0.5, y: 120, rotation: -25 },
          { opacity: 1, scale: 1, y: 0, rotation: (index: number) => [-6, 5, -2][index] ?? 0,
            duration: 1.3, stagger: 0.18, ease: 'back.out(1.4)' }, 0);
      }
      // Keep playable video upright; only photo cards receive the rotation.
      if (video) {
        timeline.fromTo(video, { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 1.1, ease: 'power2.out' }, 0);
      }
      if (words.length) {
        timeline.fromTo(words, { opacity: 0, y: -16, rotation: -5 },
          { opacity: 1, y: 0, rotation: 0, duration: 0.7,
            stagger: { each: wordStagger, from: 'end' }, ease: 'power2.out' }, 0.3);
      }
      timeline.fromTo(name, { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.7 }, '-=0.2');
      break;
  }

  return timeline;
}
