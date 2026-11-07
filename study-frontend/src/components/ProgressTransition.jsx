import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../lib/motion';

/**
 * A short, automatic progress transition shown between screens. It finishes on its own after `duration` ms
 * and calls onDone. It is deliberately not draggable: React Bits' Wake Slider is an interactive control, so
 * this is a separate animation inspired by its look, as the brief allows. `onSkip` lets the user continue at once.
 */
export default function ProgressTransition({ label, duration = 1600, onDone, onSkip }) {
  const reduced = usePrefersReducedMotion();
  const total = reduced ? Math.min(duration, 450) : duration;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const started = performance.now();
    let frame;
    const tick = now => {
      const t = Math.min(1, (now - started) / total);
      setProgress(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const timer = window.setTimeout(() => onDone?.(), total);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    // onDone is intentionally read once for this transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  return (
    <div className="progress-transition" role="status" aria-live="polite">
      <p className="progress-transition-label">{label}</p>
      <div className="progress-transition-track" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      {onSkip && (
        <button type="button" className="ghost-btn small" onClick={onSkip}>Continue</button>
      )}
    </div>
  );
}
