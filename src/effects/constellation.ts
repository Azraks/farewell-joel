import type { Tribute } from '../lib/data';
import { chooseConstellation, projectConstellation, sampleConstellationTributes } from '../lib/constellation-patterns';
import licenseUrl from '../assets/constellations/LICENSE?url';

/** A real sky pattern with a small rotating sample of tribute stars. */
interface Node {
  x: number; // 0..1
  y: number; // 0..1
  r: number;
  label: string;
  tribute: Tribute | null;
  phase: number;
}

export function createConstellation(
  canvas: HTMLCanvasElement,
  tooltip: HTMLElement,
  centreLabel: string,
  onSelect: (t: Tribute) => void,
) {
  const ctx = canvas.getContext('2d')!;
  let w = 0;
  let h = 0;
  let nodes: Node[] = [];
  let tributes: Tribute[] = [];
  let previousId: string | null = null;
  try { previousId = sessionStorage.getItem('farewell-constellation'); } catch { /* Storage may be disabled. */ }
  let pattern = chooseConstellation(previousId);
  try { sessionStorage.setItem('farewell-constellation', pattern.id); } catch { /* Random selection still works. */ }
  let positions = projectConstellation(pattern);
  let edges = pattern.edges;
  const nameLink = document.querySelector<HTMLAnchorElement>('#constellationName')!;
  function updateName() {
    nameLink.textContent = pattern.name + ' ↗';
    nameLink.href = 'https://www.google.com/search?q=' + encodeURIComponent(pattern.name + ' constellation stars astronomy');
    nameLink.setAttribute('aria-label', `Learn about ${pattern.name} on Google (opens in a new tab)`);
  }
  updateName();
  document.querySelector<HTMLAnchorElement>('#constellationCredits')!.href = licenseUrl;
  let reveal = 0; // 0..1 animation progress
  let visible = false;
  let hover = -1;

  const centre: Node = { x: 0.5, y: 0.5, r: 6, label: centreLabel, tribute: null, phase: 0 };
  nodes = positions.map((position, index) => index === 0 ? centre : ({ ...position, r: 3.2, label: pattern.name, tribute: null, phase: Math.random() * 6 }));

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Uniform screen-space scaling preserves the actual shape on phones too.
    const scale = Math.max(1, Math.min(w - 90, h - 160));
    nodes.forEach((node, index) => {
      node.x = 0.5 + positions[index]!.x * scale / Math.max(1, w);
      node.y = 0.46 + positions[index]!.y * scale / Math.max(1, h);
    });
  }

  function setTributes(list: Tribute[]) {
    tributes = [...list];
    const selected = sampleConstellationTributes(list, nodes.length - 1);
    nodes.forEach((node, index) => {
      if (index === 0) return;
      node.tribute = selected[index - 1] ?? null;
      node.label = node.tribute?.name ?? `${pattern.name} · star ${index + 1}`;
    });
    hover = -1;
    tooltip.classList.remove('show');
    canvas.style.cursor = 'default';
  }

  document.querySelector<HTMLButtonElement>('#refreshConstellation')!.addEventListener('click', () => {
    // Reuse loaded submissions and bundled star data; no network requests or page reload.
    pattern = chooseConstellation(pattern.id);
    positions = projectConstellation(pattern);
    edges = pattern.edges;
    nodes = positions.map((position, index) => index === 0 ? centre : ({
      ...position, r: 3.2, label: pattern.name, tribute: null, phase: Math.random() * 6,
    }));
    reveal = 0;
    setTributes(tributes);
    resize();
    updateName();
    try { sessionStorage.setItem('farewell-constellation', pattern.id); } catch { /* Optional refresh history. */ }
  });

  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting), { threshold: 0.25 });
  io.observe(canvas);

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    hover = -1;
    let bestD = 22 * 22;
    nodes.forEach((n, i) => {
      const d = (n.x * w - mx) ** 2 + (n.y * h - my) ** 2;
      if (d < bestD) {
        bestD = d;
        hover = i;
      }
    });
    if (hover >= 0) {
      const n = nodes[hover]!;
      tooltip.textContent = n.label;
      tooltip.style.transform = `translate(${n.x * w}px, ${n.y * h - 18}px) translate(-50%, -100%)`;
      tooltip.classList.add('show');
      canvas.style.cursor = n.tribute ? 'pointer' : 'default';
    } else {
      tooltip.classList.remove('show');
      canvas.style.cursor = 'default';
    }
  });
  canvas.addEventListener('pointerleave', () => {
    hover = -1;
    tooltip.classList.remove('show');
  });
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    hover = -1;
    let distance = 22 ** 2;
    nodes.forEach((node, index) => {
      const next = (node.x * w - event.clientX + rect.left) ** 2 + (node.y * h - event.clientY + rect.top) ** 2;
      if (next < distance) { distance = next; hover = index; }
    });
    const t = hover >= 0 ? nodes[hover]!.tribute : null;
    if (t) onSelect(t);
  });

  window.addEventListener('resize', () => {
    resize();
  });
  resize();

  function frame(now: number) {
    const t = now / 1000;
    if (visible && reveal < 1) reveal = Math.min(1, reveal + 0.008);
    ctx.clearRect(0, 0, w, h);

    // Edges draw in progressively
    const shown = reveal * edges.length;
    edges.forEach(([a, b], i) => {
      const p = Math.max(0, Math.min(1, shown - i));
      if (p <= 0) return;
      const A = nodes[a]!;
      const B = nodes[b]!;
      const active = hover === a || hover === b;
      ctx.strokeStyle = active ? 'rgba(160,220,255,0.75)' : 'rgba(130,170,255,0.22)';
      ctx.lineWidth = active ? 1.4 : 0.8;
      ctx.beginPath();
      ctx.moveTo(A.x * w, A.y * h);
      ctx.lineTo((A.x + (B.x - A.x) * p) * w, (A.y + (B.y - A.y) * p) * h);
      ctx.stroke();
    });

    nodes.forEach((n, i) => {
      const appear = i === 0 ? 1 : Math.max(0, Math.min(1, reveal * nodes.length - i + 1));
      if (appear <= 0) return;
      const x = n.x * w;
      const y = n.y * h;
      const pulse = 1 + 0.25 * Math.sin(t * 2 + n.phase);
      const r = n.r * (hover === i ? 1.8 : 1) * appear * (i === 0 ? 1 + 0.1 * Math.sin(t * 1.5) : 1);
      const colour = i === 0 ? '255,214,120' : '170,210,255';

      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 7 * pulse);
      g.addColorStop(0, `rgba(${colour},0.55)`);
      g.addColorStop(1, `rgba(${colour},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 7 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255,255,255,${0.9 * appear})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      if (i === 0) {
        // diffraction spikes on the centre star
        ctx.strokeStyle = 'rgba(255,230,170,0.5)';
        ctx.lineWidth = 1;
        const L = 26 + 4 * Math.sin(t * 1.5);
        ctx.beginPath();
        ctx.moveTo(x - L, y);
        ctx.lineTo(x + L, y);
        ctx.moveTo(x, y - L);
        ctx.lineTo(x, y + L);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,230,170,0.9)';
        ctx.font = '600 13px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.label.toUpperCase(), x, y + 44);
      }
    });

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { setTributes };
}
