import confetti from 'canvas-confetti';

const COLOURS = ['#ffd678', '#9ad0ff', '#c79bff', '#ff8adc', '#ffffff'];

/** Star-shaped confetti burst — used after a successful submission. */
export function starBurst() {
  const defaults = { spread: 360, ticks: 90, gravity: 0.4, decay: 0.94, startVelocity: 28, colors: COLOURS, zIndex: 2000 };
  const shoot = () => {
    confetti({ ...defaults, particleCount: 40, scalar: 1.2, shapes: ['star'] });
    confetti({ ...defaults, particleCount: 15, scalar: 0.75, shapes: ['circle'] });
  };
  shoot();
  setTimeout(shoot, 120);
  setTimeout(shoot, 240);
}

/** Multi-second fireworks show for the finale. */
export function fireworks(durationMs = 4000) {
  const end = Date.now() + durationMs;
  const rand = (a: number, b: number) => Math.random() * (b - a) + a;
  const tick = () => {
    const left = end - Date.now();
    if (left <= 0) return;
    const count = 50 * (left / durationMs);
    const base = { startVelocity: 32, spread: 360, ticks: 70, zIndex: 2000, colors: COLOURS };
    confetti({ ...base, particleCount: count, origin: { x: rand(0.1, 0.3), y: rand(0.1, 0.4) } });
    confetti({ ...base, particleCount: count, origin: { x: rand(0.7, 0.9), y: rand(0.1, 0.4) } });
    setTimeout(tick, 260);
  };
  tick();
}
