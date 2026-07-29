import React, { useRef, useEffect, memo } from 'react';
import { useReducedMotion, type MotionValue } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ElectromagneticFieldProps {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
}

export const ElectromagneticField: React.FC<ElectromagneticFieldProps> = memo(({ mouseX, mouseY }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReduced = useReducedMotion();
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');
  const shouldRender = !prefersReduced && !isCoarsePointer;
  const isVisibleRef = useRef(false);

  useEffect(() => {
    if (!shouldRender || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId = 0;
    let isDisposed = false;
    let cols = 0, rows = 0;
    const spacing = 45;

    const parentEl = canvas.parentElement;

    const render = () => {
      animationFrameId = 0;
      if (isDisposed || !isVisibleRef.current || document.hidden) return;

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

    const cancelScheduledRender = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    };

    const scheduleRender = () => {
      if (isDisposed || animationFrameId || !isVisibleRef.current || document.hidden) return;
      animationFrameId = requestAnimationFrame(render);
    };

    const resize = () => {
      if (!parentEl) return;
      const rect = parentEl.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      cols = Math.floor(canvas.width / spacing) + 1;
      rows = Math.floor(canvas.height / spacing) + 1;
      scheduleRender();
    };
    const resizeObserver = new ResizeObserver(resize);
    if (parentEl) resizeObserver.observe(parentEl);
    resize();

    const unsubscribeMouseX = mouseX.on('change', scheduleRender);
    const unsubscribeMouseY = mouseY.on('change', scheduleRender);

    const io = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
      if (isVisibleRef.current) scheduleRender();
      else cancelScheduledRender();
    }, { rootMargin: '200px' });
    if (parentEl) io.observe(parentEl);

    const handleVisibilityChange = () => {
      if (document.hidden) cancelScheduledRender();
      else scheduleRender();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isDisposed = true;
      cancelScheduledRender();
      unsubscribeMouseX();
      unsubscribeMouseY();
      resizeObserver.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mouseX, mouseY, shouldRender]);

  if (!shouldRender) return null;
  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-0 mix-blend-screen opacity-50" 
      aria-hidden="true" 
    />
  );
});

ElectromagneticField.displayName = 'ElectromagneticField';
