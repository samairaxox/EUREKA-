import { useEffect, useState } from 'react';

const QUERY = {
  reduced: '(prefers-reduced-motion: reduce)',
  coarse: '(pointer: coarse)',
};

/** Returns true while the user has asked the OS for reduced motion. Updates live. */
export function usePrefersReducedMotion() {
  return useMediaQuery(QUERY.reduced);
}

/** Returns true on touch-first devices, where cursor effects are disabled. */
export function useCoarsePointer() {
  return useMediaQuery(QUERY.coarse);
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const onChange = event => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}
