/**
 * Minimal stand-in for the subset of `motion/react` that ThoughtLine and BranchedMenu use.
 * Implemented with the Web Animations API so the project does not need a second animation library.
 * Supports: animate(element, { prop: value | [values] }, { duration (s), delay (s), ease, repeat }) -> { stop() }
 * and useReducedMotion(). Only opacity is animated by the components that use this shim.
 */
import { useEffect, useState } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';

const toEasing = ease => (Array.isArray(ease) ? `cubic-bezier(${ease.join(',')})` : ease || 'ease');

const currentValue = (el, prop) => {
  const computed = window.getComputedStyle(el)[prop];
  return prop === 'opacity' ? Number(computed) : computed;
};

export function animate(element, keyframes, options = {}) {
  if (!element || typeof element.animate !== 'function') {
    // No Web Animations support: behave as a finished, thenable animation with nothing to stop.
    return { stop() {}, then(onFulfilled, onRejected) { return Promise.resolve().then(onFulfilled, onRejected); } };
  }
  const props = Object.keys(keyframes);
  const tracks = props.map(prop =>
    Array.isArray(keyframes[prop]) ? keyframes[prop] : [currentValue(element, prop), keyframes[prop]],
  );
  const length = Math.max(...tracks.map(track => track.length));
  const frames = Array.from({ length }, (_, index) =>
    Object.fromEntries(props.map((prop, j) => [prop, tracks[j][Math.min(index, tracks[j].length - 1)]])),
  );
  const repeat = options.repeat;
  const animation = element.animate(frames, {
    duration: (options.duration ?? 0.3) * 1000,
    delay: (options.delay ?? 0) * 1000,
    easing: toEasing(options.ease),
    iterations: repeat === Infinity ? Infinity : (repeat ?? 0) + 1,
    fill: 'forwards',
  });
  // motion's animate() returns a thenable that resolves when the animation finishes; ThoughtLine chains on it.
  // The Web Animations `finished` promise rejects when cancelled, so it is caught here and the chain
  // resolves either way; ThoughtLine's own cancelled flag guards the callbacks.
  const finished = (animation.finished || Promise.resolve()).catch(() => {});
  return {
    stop() {
      animation.cancel();
    },
    then(onFulfilled, onRejected) {
      return finished.then(onFulfilled, onRejected);
    },
  };
}

export function useReducedMotion() {
  const query = typeof window !== 'undefined' ? window.matchMedia?.(REDUCED) : null;
  const [reduced, setReduced] = useState(Boolean(query?.matches));
  useEffect(() => {
    const media = window.matchMedia?.(REDUCED);
    if (!media) return undefined;
    const onChange = event => setReduced(event.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}
