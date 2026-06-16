import confetti from 'canvas-confetti';

/** True when the user has asked the OS to minimise motion. */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A celebratory confetti burst, used for champion / podium moments. Honours
 * the user's reduced-motion preference (no-op when reduced). The colors lean
 * on the brand palette plus gold for the trophy feel.
 */
export function celebrate({ colors } = {}) {
  if (prefersReducedMotion()) return;

  const palette = colors ?? ['#6366f1', '#22d3ee', '#fbbf24', '#f8fafc'];
  const end = Date.now() + 900;

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      startVelocity: 55,
      origin: { x: 0, y: 0.7 },
      colors: palette,
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      startVelocity: 55,
      origin: { x: 1, y: 0.7 },
      colors: palette,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
