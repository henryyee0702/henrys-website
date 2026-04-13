import React, { useRef, useEffect, memo } from 'react';
import { useReducedMotion, type MotionValue } from 'framer-motion';

interface ElectromagneticFieldProps {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
}

export const ElectromagneticField: React.FC<ElectromagneticFieldProps> = memo(({ mouseX, mouseY }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReduced = useReducedMotion();
  const isVisibleRef = useRef(false);

  useEffect(() => {
    if (prefersReduced || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let cols = 0, rows = 0;
    const spacing = 45;

    const parentEl = canvas.parentElement;
    const io = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
    }, { rootMargin: '200px' });
    if (parentEl) io.observe(parentEl);

    const resize = () => {
      if (!parentEl) return;
      const rect = parentEl.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      cols = Math.floor(canvas.width / spacing) + 1;
      rows = Math.floor(canvas.height / spacing) + 1;
    };
    window.addEventListener('resize', resize);
    resize();

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      if (!isVisibleRef.current) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const canvasRect = canvas.getBoundingClientRect();
      const mx = mouseX.get() - canvasRect.left;
      const my = mouseY.get() - canvasRect.top;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const cx = i * spacing;
          const cy = j * spacing;
          const dx = mx - cx;
          const dy = my - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const angle = Math.atan2(dy, dx);
          const intensity = Math.max(0, 1 - dist / 600);
          const length = 4 + intensity * 20;

          const p1x = cx - Math.cos(angle) * (length / 2);
          const p1y = cy - Math.sin(angle) * (length / 2);
          const p2x = cx + Math.cos(angle) * (length / 2);
          const p2y = cy + Math.sin(angle) * (length / 2);

          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
        }
      }
      ctx.stroke();
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
      io.disconnect();
    };
  }, [mouseX, mouseY, prefersReduced]);

  if (prefersReduced) return null;
  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-0 mix-blend-screen opacity-50" 
      aria-hidden="true" 
    />
  );
});

ElectromagneticField.displayName = 'ElectromagneticField';
