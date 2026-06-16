/**
 * Shared Framer Motion variants and spring presets so motion feels consistent
 * across the app instead of being re-declared ad hoc on every page.
 *
 * `MotionConfig reducedMotion="user"` (in main.jsx) already neutralises these
 * for users who prefer reduced motion, so individual call sites don't need to.
 */

/** Signature easing — a calm, broadcast-grade ease-out. */
export const easeOut = [0.16, 1, 0.3, 1];

export const spring = { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 };
export const softSpring = { type: 'spring', stiffness: 200, damping: 26 };

/** Fade up into place. The default entrance for cards and sections. */
export const fadeRise = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
};

/** Container that staggers its children in. Pair with `staggerItem`. */
export const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
};

/** Pop a small element in (badges, tiles). */
export const scaleIn = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: easeOut } },
};

/** Right-anchored slide-over (desktop match drawer / nav sheet). */
export const sheetRight = {
  initial: { x: '100%' },
  animate: { x: 0, transition: spring },
  exit: { x: '100%', transition: { duration: 0.2, ease: easeOut } },
};

/** Bottom-anchored slide-over (mobile sheets). */
export const sheetBottom = {
  initial: { y: '100%' },
  animate: { y: 0, transition: spring },
  exit: { y: '100%', transition: { duration: 0.2, ease: easeOut } },
};

/** Interactive press/hover feedback for clickable cards. */
export const hoverTap = {
  whileHover: { y: -4 },
  whileTap: { scale: 0.985 },
  transition: spring,
};
