import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../lib/motion';

const WORDS = ['thought', 'discovery', 'clarity', 'possibility'];
// Widest word sets the box width so the sentence never shifts.
const WIDEST = WORDS.reduce((a, b) => (b.length > a.length ? b : a), '');

/**
 * Rotates only the final word of the tagline. The rest of the sentence stays put because the word's box
 * is sized to the widest option. Reduced-motion users get a single, fixed word.
 */
export default function RotatingWord({ interval = 3200 }) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduced) return undefined;
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex(current => (current + 1) % WORDS.length);
        setVisible(true);
      }, 260);
    }, interval);
    return () => window.clearInterval(id);
  }, [interval, reduced]);

  return (
    <span className="rotating-word" style={{ minWidth: `${WIDEST.length}ch` }}>
      <span className={`rotating-word-inner${visible ? ' is-visible' : ''}`}>{WORDS[index]}</span>
    </span>
  );
}
