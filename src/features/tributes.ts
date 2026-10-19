import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { mediaUrl, photoUrls, type Tribute } from '../lib/data';
import { embedUrl, escapeHtml, initials, youtubeThumb } from '../lib/media';
import { query, reducedMotion, canHover } from '../lib/ui';
import { setupVideoThumbnails } from '../lib/video-thumbnail';

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function avatarStyle(name: string) {
  const h = hash(name) % 360;
  return `background: linear-gradient(135deg, hsl(${h} 90% 75%), hsl(${(h + 60) % 360} 90% 65%))`;
}

export function hasVideo(tribute: Tribute) {
  return Boolean(tribute.video_path || tribute.video_link);
}

/** Unique "mini constellation" banner for cards without a photo/video. */
function cosmicBanner(t: Tribute): string {
  const random = seeded(hash(t.id + t.name));
  const hue = Math.floor(random() * 360);
  const points = Array.from({ length: 6 }, (_, i) => [20 + i * 50 + random() * 30, 18 + random() * 60] as const);
  const lines = points.slice(1).map((p, i) => `<line x1="${points[i]![0]}" y1="${points[i]![1]}" x2="${p[0]}" y2="${p[1]}" />`).join('');
  const dots = points.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 2 ? 3.2 : 1.8}" />`).join('');
  const dust = Array.from({ length: 26 }, () => `<circle cx="${random() * 340}" cy="${random() * 96}" r="${random() * 0.9 + 0.3}" opacity="${random() * 0.6 + 0.2}" />`).join('');
  return `
    <div class="card-banner" style="--h:${hue}">
      <svg viewBox="0 0 340 96" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g class="dust">${dust}</g><g class="lines">${lines}</g><g class="dots">${dots}</g>
      </svg>
      <span class="quote">“</span>
    </div>`;
}

// Explicit columns keep hovered cards stable in Chromium.
let cards: HTMLElement[] = [];
let wallColumns = 0;
let wallRevealTriggers: ScrollTrigger[] = [];
let stopWallThumbnails = () => {};
let stopGalleryThumbnails = () => {};
let stopPlayerThumbnail = () => {};

function cardMedia(t: Tribute): string {
  const photos = photoUrls(t);
  if (photos.length) {
    return `
      <div class="card-media">
        <img src="${escapeHtml(photos[0]!)}" alt="" loading="lazy" />
        ${photos.length > 1 ? `<span class="media-badge">📷 +${photos.length - 1}</span>` : ''}
        ${hasVideo(t) ? '<span class="media-badge left">🎬 Video</span>' : ''}
      </div>`;
  }
  if (hasVideo(t)) {
    const file = mediaUrl(t.video_path);
    const thumb = t.video_link ? youtubeThumb(t.video_link) : null;
    const inner = file
      ? `<span class="video-placeholder" data-video-thumbnail="${escapeHtml(file)}" aria-hidden="true">🎬</span>`
      : thumb
        ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />`
        : '';
    return `<div class="card-media video">${inner}<div class="play"></div></div>`;
  }
  return cosmicBanner(t);
}

function buildCards(tributes: Tribute[]) {
  cards = [...tributes].reverse().map((t) => {
    const card = document.createElement('article');
    card.className = 'card glass';
    card.innerHTML = `
      ${cardMedia(t)}
      <div class="card-body">
        <p class="card-msg clamp">${escapeHtml(t.message)}</p>
        <div class="card-foot">
          <div class="avatar" style="${avatarStyle(t.name)}">${escapeHtml(initials(t.name))}</div>
          <div><div class="card-name">${escapeHtml(t.name)}</div>${t.team ? `<div class="card-team">${escapeHtml(t.team)}</div>` : ''}</div>
        </div>
      </div>`;
    const media = photoUrls(t).length || hasVideo(t) ? 230 : 96;
    card.dataset.h = String(media + Math.min(8, Math.ceil(t.message.length / 42)) * 26 + 110);
    card.addEventListener('click', () => openTribute(t));
    attachSpotlight(card);
    return card;
  });
}

function layoutWall(force = false) {
  const wall = query('#wall');
  const width = wall.clientWidth;
  const cols = width >= 960 ? 3 : width >= 600 ? 2 : 1;
  if (!force && cols === wallColumns) return;
  wallColumns = cols;
  const columns = Array.from({ length: cols }, () => {
    const c = document.createElement('div');
    c.className = 'wall-col';
    return c;
  });
  const heights = new Array<number>(cols).fill(0);
  for (const card of cards) {
    const shortestColumn = heights.indexOf(Math.min(...heights));
    columns[shortestColumn]!.appendChild(card);
    heights[shortestColumn]! += Number(card.dataset.h);
  }
  wall.replaceChildren(...columns);
  ScrollTrigger.refresh();
}

export function renderWall(tributes: Tribute[]) {
  stopWallThumbnails();
  wallRevealTriggers.forEach(trigger => trigger.kill());
  wallRevealTriggers = [];
  if (cards.length) gsap.killTweensOf(cards);
  query('#wallEmpty').hidden = tributes.length > 0;
  buildCards(tributes);
  layoutWall(true);
  stopWallThumbnails = setupVideoThumbnails(query('#wall'));

  if (!reducedMotion && cards.length) {
    gsap.set(cards, { opacity: 0 });
    wallRevealTriggers = ScrollTrigger.batch(cards, {
      start: 'top 92%',
      onEnter: (els) =>
        gsap.fromTo(els, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', clearProps: 'transform' }),
      once: true,
    });
  }
}

/** Cursor-following glow + gentle lift (2D only — no 3D transforms). */
function attachSpotlight(el: HTMLElement) {
  if (reducedMotion || !canHover) return;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
}

export function renderVideos(tributes: Tribute[]) {
  stopGalleryThumbnails();
  stopPlayerThumbnail();
  const gallery = query('#videoGrid');
  const videos = tributes.filter(hasVideo).sort((a, b) =>
    (b.video_priority ?? 0) - (a.video_priority ?? 0) || a.id.localeCompare(b.id),
  );
  gallery.replaceChildren();
  gallery.hidden = videos.length === 0;
  query('#videoEmpty').hidden = videos.length > 0;
  if (!videos.length) return;

  gallery.innerHTML = `
    <div class="video-gallery-stage glass" role="group" aria-label="Video gallery">
      <div class="video-gallery-player"></div>
      <div class="video-gallery-caption" aria-live="polite"></div>
    </div>
    <div class="video-gallery-controls">
      <button type="button" class="btn btn-ghost" data-direction="-1" aria-label="Previous video">← Previous</button>
      <span class="video-gallery-count" aria-live="polite"></span>
      <button type="button" class="btn btn-ghost" data-direction="1" aria-label="Next video">Next →</button>
    </div>
    <div class="video-gallery-picks" role="group" aria-label="Choose a video"></div>`;

  const player = gallery.querySelector<HTMLElement>('.video-gallery-player')!;
  const caption = gallery.querySelector<HTMLElement>('.video-gallery-caption')!;
  const counter = gallery.querySelector<HTMLElement>('.video-gallery-count')!;
  const picks = gallery.querySelector<HTMLElement>('.video-gallery-picks')!;
  // A positive priority pins the highest-ranked video; otherwise keep a random opening.
  let selected = (videos[0]!.video_priority ?? 0) > 0 ? 0 : Math.floor(Math.random() * videos.length);

  const buttons = videos.map((tribute, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'video-gallery-pick';
    button.setAttribute('aria-label', `Select video: ${tribute.video_title || tribute.name}`);
    const thumbnail = tribute.video_link ? youtubeThumb(tribute.video_link) : photoUrls(tribute)[0];
    const file = mediaUrl(tribute.video_path);
    const fallback = `<span ${file ? `data-video-thumbnail="${escapeHtml(file)}"` : ''} aria-hidden="true">▶</span>`;
    button.innerHTML = `${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />` : fallback}<span>${escapeHtml(tribute.video_title || tribute.name)}</span>`;
    button.addEventListener('click', () => showVideo(index));
    picks.appendChild(button);
    return button;
  });

  function showVideo(index: number) {
    stopPlayerThumbnail();
    selected = (index + videos.length) % videos.length;
    const tribute = videos[selected]!;
    // Replacing the player stops the previous video; selecting never starts playback.
    player.innerHTML = videoHtml(tribute, false);
    stopPlayerThumbnail = setupVideoThumbnails(player);
    caption.innerHTML = `
      <b>${escapeHtml(tribute.video_title || tribute.name)}</b>
      <small>${escapeHtml(tribute.name)}${tribute.team ? ` · ${escapeHtml(tribute.team)}` : ''}</small>
      ${tribute.video_description ? `<p>${escapeHtml(tribute.video_description)}</p>` : ''}`;
    counter.textContent = `${selected + 1} / ${videos.length}`;
    buttons.forEach((button, position) => {
      button.setAttribute('aria-pressed', String(position === selected));
    });
    const selectedButton = buttons[selected]!;
    picks.scrollTo({ left: selectedButton.offsetLeft - picks.offsetLeft, behavior: 'instant' });
  }

  gallery.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
    button.disabled = videos.length === 1;
    button.addEventListener('click', () => showVideo(selected + Number(button.dataset.direction)));
  });

  // Swipe on the caption; native video controls and embedded players keep their gestures.
  let touchStart: { x: number; y: number } | null = null;
  caption.addEventListener('touchstart', event => {
    const touch = event.touches[0];
    touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });
  caption.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    if (!touchStart || !touch) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showVideo(selected + (dx < 0 ? 1 : -1));
  }, { passive: true });
  showVideo(selected);
  stopGalleryThumbnails = setupVideoThumbnails(picks);
}

export function videoHtml(t: Tribute, autoplay = true): string {
  const file = mediaUrl(t.video_path);
  if (file) return `<video src="${escapeHtml(file)}" controls playsinline preload="none" ${autoplay ? 'autoplay' : `data-video-thumbnail="${escapeHtml(file)}"`}></video>`;
  if (t.video_link) {
    const embed = embedUrl(t.video_link);
    if (embed) return `<iframe src="${escapeHtml(autoplay ? embed : embed.replace(/autoplay=1/g, 'autoplay=0'))}" title="Video from ${escapeHtml(t.name)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    return `<p><a class="btn btn-ghost" href="${escapeHtml(t.video_link)}" target="_blank" rel="noopener">▶ Open video</a></p>`;
  }
  return '';
}

export function openTribute(t: Tribute) {
  const photos = photoUrls(t);
  const video = videoHtml(t);
  const gallery = photos.length
    ? `<div class="modal-gallery">
        <img class="mg-main" src="${escapeHtml(photos[0]!)}" alt="" />
        ${photos.length > 1 ? `<div class="mg-thumbs">${photos.map((u, i) => `<button class="mg-thumb ${i === 0 ? 'active' : ''}" data-src="${escapeHtml(u)}"><img src="${escapeHtml(u)}" alt="" /></button>`).join('')}</div>` : ''}
      </div>`
    : '';
  const body = query('#modalBody');
  body.innerHTML = `
    ${video ? `<div class="modal-media">${video}</div>` : ''}
    ${gallery}
    <p class="modal-msg">${escapeHtml(t.message)}</p>
    <div class="card-foot">
      <div class="avatar" style="${avatarStyle(t.name)}">${escapeHtml(initials(t.name))}</div>
      <div><div class="card-name">${escapeHtml(t.name)}</div>${t.team ? `<div class="card-team">${escapeHtml(t.team)}</div>` : ''}</div>
    </div>`;
  body.querySelectorAll<HTMLButtonElement>('.mg-thumb').forEach((b) =>
    b.addEventListener('click', () => {
      const main = body.querySelector<HTMLImageElement>('.mg-main')!;
      gsap.fromTo(main, { opacity: 0.3, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.4 });
      main.src = b.dataset.src!;
      body.querySelectorAll('.mg-thumb').forEach((x) => x.classList.toggle('active', x === b));
    }),
  );
  query('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  query('#modal').hidden = true;
  query('#modalBody').innerHTML = ''; // stops any playing video
  document.body.style.overflow = '';
}

export function setupTributeModal() {
  query('#modal').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !query('#modal').hidden) closeModal();
  });
}

export function setupWallResize() {
  window.addEventListener('resize', () => layoutWall());
}
