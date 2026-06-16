import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

/**
 * Lightweight route transition: a clean fade + rise whenever the relevant
 * route key changes. We deliberately use an enter-only, keyed remount (rather
 * than AnimatePresence exit animations) because React Router's <Outlet/> reads
 * the *current* location, so animating an exiting subtree would briefly show
 * the next page's content. Pass `transitionKey` to group routes that should
 * share a persistent layout (e.g. tournament tabs) and avoid re-animating.
 */
export default function PageTransition({ children, transitionKey }) {
  const { pathname } = useLocation();
  return (
    <motion.div
      key={transitionKey ?? pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
