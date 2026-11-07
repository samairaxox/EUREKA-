import { useEffect, useRef } from 'react';

const PALETTE = ['#E9E4F7', '#CFC3EE', '#F7EBB8', '#EDCFCB', '#C9D3F5'];

/**
 * Slow, low-contrast pastel field drawn on a canvas. Used behind the sign-in form and the landing hero.
 * Motion is disabled for prefers-reduced-motion and the loop pauses when the tab is hidden.
 */
export default function PastelField({ className = '', intensity = 0.55 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = null;
    let width = 0;
    let height = 0;
    const blobs = PALETTE.map((color, i) => ({
      color,
      phase: i * 1.7,
      speed: 0.00012 + i * 0.00003,
      radius: 0.34 + (i % 3) * 0.08,
    }));

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = time => {
      ctx.fillStyle = '#FBF8F2';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = intensity;
      blobs.forEach(blob => {
        const x = width * (0.5 + 0.38 * Math.sin(time * blob.speed + blob.phase));
        const y = height * (0.5 + 0.32 * Math.cos(time * blob.speed * 0.8 + blob.phase));
        const r = Math.max(width, height) * blob.radius;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(1, 'rgba(251,248,242,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      });
      ctx.globalAlpha = 1;
    };

    const loop = time => {
      draw(time);
      frame = window.requestAnimationFrame(loop);
    };

    resize();
    if (reduce) {
      draw(0);
    } else {
      frame = window.requestAnimationFrame(loop);
    }
    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = null;
      } else if (!reduce && frame === null) {
        frame = window.requestAnimationFrame(loop);
      }
    };
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intensity]);

  return <canvas ref={canvasRef} className={`pastel-field ${className}`} aria-hidden="true" />;
}
