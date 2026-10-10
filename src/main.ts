import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import './styles/main.css';

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { site } from './config';
import { fetchTributes, type Tribute } from './lib/data';
import { query, reducedMotion, toast } from './lib/ui';
import { readDeletionCredential } from './lib/submission';
import { setupReceiptCopy, showDeletionView } from './lib/deletion';
import { bindContent, startCountdown } from './features/content';
import { setupForm } from './features/submission-form';
import {
  hasVideo, openTribute, renderWall, renderVideos,
  setupTributeModal, setupWallResize, videoHtml,
} from './features/tributes';
import { countUp, revealVideos, setupAnimations } from './effects/page';
import { startStarfield } from './effects/starfield';
import { createConstellation } from './effects/constellation';
import { fireworks } from './effects/celebrate';
import { createSlideshow } from './effects/slideshow';

async function main() {
  let tributes: Tribute[] = [];
  window.addEventListener('hashchange', () => {
    const credential = readDeletionCredential();
    if (credential) void showDeletionView(credential);
  });
  const deletionCredential = readDeletionCredential();
  if (deletionCredential) {
    await showDeletionView(deletionCredential);
    return;
  }
  setupReceiptCopy();
  setupTributeModal();
  setupWallResize();
  await bindContent();
  startCountdown();
  startStarfield(query<HTMLCanvasElement>('#stars'), reducedMotion);

  const constellation = createConstellation(
    query<HTMLCanvasElement>('#constellationCanvas'),
    query('#starTooltip'),
    site.honoree.firstName,
    openTribute,
  );

  const slideshow = createSlideshow({
    root: query('#slideshow'),
    getTributes: () => tributes,
    videoHtml: (t) => videoHtml(t),
    onEmpty: () => toast('No messages to show yet.'),
  });
  query('#slideshowBtn').addEventListener('click', slideshow.open);

  setupAnimations();
  setupForm(() => refreshTributes(false));
  query('#fireworksBtn').addEventListener('click', () => fireworks());

  await refreshTributes(true);

  async function refreshTributes(animateCounters: boolean) {
    try {
      tributes = await fetchTributes();
    } catch (error) {
      console.error(error);
      if (!tributes.length) {
        query('#wallEmpty').textContent = 'Messages could not be loaded. Please refresh or contact the organiser.';
        query('#videoEmpty').textContent = 'Videos could not be loaded. Please refresh or contact the organiser.';
        query('#wallEmpty').hidden = false;
        query('#videoEmpty').hidden = false;
      }
      toast('Could not refresh messages. Please refresh the page in a moment.');
      return;
    }

    constellation.setTributes(tributes);
    renderWall(tributes);
    renderVideos(tributes);
    const stats: Array<[HTMLElement, number]> = [
      [query('#statMessages'), tributes.length],
      [query('#statVideos'), tributes.filter(hasVideo).length],
      [query('#statTeams'), new Set(tributes.map(tribute => tribute.team?.trim().toLowerCase()).filter(Boolean)).size],
    ];
    stats.forEach(([element, value]) => {
      if (animateCounters) countUp(element, value);
      else element.textContent = String(value);
    });
    revealVideos();
    ScrollTrigger.refresh();
  }
}

void main().catch(() => {
  toast('The page could not start. Please refresh or contact the organiser.');
});
