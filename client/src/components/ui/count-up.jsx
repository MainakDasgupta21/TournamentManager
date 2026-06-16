import * as React from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/**
 * Animated number that counts up to `value` when it mounts / changes. Falls
 * back to the final value instantly when the user prefers reduced motion.
 * Renders a plain string so it can live anywhere (display headings, tiles).
 */
export function CountUp({ value, duration = 1.1, format, className }) {
  const target = Number(value) || 0;
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(reduce ? target : 0);
  const ref = React.useRef(0);

  React.useEffect(() => {
    if (reduce) {
      setDisplay(target);
      return;
    }
    const controls = animate(ref.current, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    ref.current = target;
    return () => controls.stop();
  }, [target, duration, reduce]);

  const rounded = Math.round(display);
  return <span className={className}>{format ? format(rounded) : rounded}</span>;
}
