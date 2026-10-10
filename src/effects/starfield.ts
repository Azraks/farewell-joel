/**
 * Full-screen animated starfield background.
 * - Hyperspace "warp" intro that settles into a calm, twinkling sky
 * - Three depth layers with mouse + scroll parallax
 * - Occasional shooting stars
 */
interface Star {
  x: number; // 0..1 relative position
  y: number;
  z: number; // depth layer 0.2..1 (1 = nearest)
  r: number;
  tw: number; // twinkle phase
  hue: number;
}

interface Shooter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export function startStarfield(canvas: HTMLCanvasElement, reducedMotion: boolean) {
  const ctx = canvas.getContext('2d')!;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let stars: Star[] = [];
  const shooters: Shooter[] = [];
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let warp = reducedMotion ? 0 : 1; // 1 → 0 during intro
  const start = performance.now();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(700, (w * h) / 2600));
    stars = Array.from({ length: count }, () => {
      const z = Math.random() ** 2 * 0.8 + 0.2;
      return {
        x: Math.random(),
        y: Math.random(),
        z,
        r: z * 1.6 + 0.2,
        tw: Math.random() * Math.PI * 2,
        hue: [210, 260, 190, 45][Math.floor(Math.random() * 4)]!,
      };
    });
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / w - 0.5) * 2;
    mouse.ty = (e.clientY / h - 0.5) * 2;
  });
  resize();

  function spawnShooter() {
    const fromLeft = Math.random() < 0.5;
    shooters.push({
      x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5,
      y: Math.random() * h * 0.4,
      vx: (fromLeft ? 1 : -1) * (8 + Math.random() * 6),
      vy: 3 + Math.random() * 3,
      life: 1,
    });
  }

  function frame(now: number) {
    const t = (now - start) / 1000;
    if (warp > 0) warp = Math.max(0, 1 - t / 2.2);
    const ease = warp * warp;

    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    const scrollY = window.scrollY;

    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;

    for (const s of stars) {
      // Parallax offset based on depth
      let x = s.x * w - mouse.x * 18 * s.z;
      let y = ((s.y * h - scrollY * 0.08 * s.z) % h + h) % h - mouse.y * 18 * s.z;
      x = ((x % w) + w) % w;

      const twinkle = reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(t * (1 + s.z * 2) + s.tw);
      const alpha = Math.min(1, (0.25 + s.z * 0.75) * twinkle);

      if (ease > 0.001) {
        // Warp streaks radiating from centre
        const dx = x - cx;
        const dy = y - cy;
        const len = ease * 0.35 * s.z;
        ctx.strokeStyle = `hsla(${s.hue}, 90%, 85%, ${alpha})`;
        ctx.lineWidth = s.r;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - dx * len, y - dy * len);
        ctx.stroke();
      } else {
        ctx.fillStyle = `hsla(${s.hue}, 80%, 88%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.z > 0.85) {
          // soft glow on the nearest stars
          ctx.fillStyle = `hsla(${s.hue}, 90%, 75%, ${alpha * 0.15})`;
          ctx.beginPath();
          ctx.arc(x, y, s.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (!reducedMotion && warp === 0 && Math.random() < 0.004) spawnShooter();
    for (let i = shooters.length - 1; i >= 0; i--) {
      const m = shooters[i]!;
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.012;
      if (m.life <= 0) {
        shooters.splice(i, 1);
        continue;
      }
      const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12);
      grad.addColorStop(0, `rgba(255,255,255,${m.life})`);
      grad.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 12, m.y - m.vy * 12);
      ctx.stroke();
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
