import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

/**
 * Lightweight route transition: a clean fade + rise whenever the relevant
 * route key changes. We deliberately use an enter-only, keyed remount (rather
 * than AnimatePresence exit animations) because React Router's <Outlet/> reads
 * the *current* location, so animating an exiting subtree would briefly show
 * the next page's content. Pass `transitionKey` to group routes that should
 * share a persistent layout (e.g. tournament tabs) and avoid re-animating.
 *
 * Uses a plain fade + rise (no blur filter, which is expensive to animate and
 * hurts text legibility mid-transition) and collapses to an opacity-only fade
 * when the user prefers reduced motion.
 */
export default function PageTransition({ children, transitionKey }) {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={transitionKey ?? pathname}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.15 : 0.26, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
