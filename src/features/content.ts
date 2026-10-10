import { site } from '../config';
import { isDemo, isLive, isTestSubmission } from '../lib/environment';
import { escapeHtml, initials } from '../lib/media';
import { query } from '../lib/ui';

export async function bindContent() {
  const values: Record<string, string> = {
    firstName: site.honoree.firstName,
    tagline: site.tagline,
    intro: site.intro,
    closing: site.closing,
    signedBy: site.signedBy,
  };
  document.querySelectorAll<HTMLElement>('[data-bind]').forEach((el) => {
    const v = values[el.dataset.bind!];
    if (v !== undefined) el.textContent = v;
  });
  document.title = site.metadata.title || `Thank You, ${site.honoree.fullName} — Farewell`;
  query('#heroRole').textContent = site.honoree.title;

  const core = query('#avatarCore');
  if (site.honoree.photo) {
    core.innerHTML = `<img src="${escapeHtml(site.honoree.photo)}" alt="${escapeHtml(site.honoree.fullName)}" />`;
  } else {
    core.textContent = initials(site.honoree.fullName);
  }

  const milestones = import.meta.env.VITE_DEMO_MODE === 'true'
    ? (await import('../demo/milestones')).demoMilestones
    : site.milestones;
  const showJourney = milestones.length > 0;
  query('#journey').hidden = !showJourney;
  document.querySelectorAll<HTMLElement>('a[href="#journey"]').forEach((link) => { link.hidden = !showJourney; });
  const timeline = query('#timeline');
  milestones.forEach((m) => {
    const el = document.createElement('div');
    el.className = 'milestone';
    el.innerHTML = `<div class="year">${escapeHtml(m.year)}</div><h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(m.text)}</p>`;
    timeline.appendChild(el);
  });

  query('#modeBadge').textContent = isDemo ? 'Demo mode — fictional sample messages; nothing is saved'
    : !isLive ? 'Site configuration is missing — submissions unavailable'
    : isTestSubmission ? 'Test submissions — marked for organiser cleanup' : '';
  if (!isLive && !isDemo) query('#form').hidden = true;
}

export function startCountdown() {
  if (!site.farewellDate) return;
  const target = new Date(site.farewellDate).getTime();
  if (Number.isNaN(target)) return;
  const el = query('#countdown');
  el.hidden = false;
  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const parts: Array<[number, string]> = [
      [Math.floor(diff / 86_400_000), 'Days'],
      [Math.floor((diff / 3_600_000) % 24), 'Hours'],
      [Math.floor((diff / 60_000) % 60), 'Min'],
      [Math.floor((diff / 1000) % 60), 'Sec'],
    ];
    el.innerHTML = parts.map(([v, l]) => `<div><b>${String(v).padStart(2, '0')}</b><small>${l}</small></div>`).join('');
  };
  tick();
  setInterval(tick, 1000);
}
