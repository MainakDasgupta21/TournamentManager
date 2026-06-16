import { useEffect } from 'react';

const BASE = 'TourneyOps';
const DEFAULT_TITLE = `${BASE} — Tournament Management`;

/**
 * Sets `document.title` to "<title> · TourneyOps" while the component is
 * mounted. Falsy values fall back to the default. We intentionally don't
 * reset on unmount — the next destination sets its own title — which avoids
 * title flicker between nested layout/page effects.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : DEFAULT_TITLE;
  }, [title]);
}
