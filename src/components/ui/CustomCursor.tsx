import React, { useRef, useState, useEffect, memo } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export const CustomCursor: React.FC = memo(() => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const prefersReduced = useReducedMotion();
  const isFine = useMediaQuery('(pointer: fine) and (hover: hover)');

  useEffect(() => {
    if (prefersReduced || !isFine) return;
    
    let rafId: number;
    const moveCursor = (e: MouseEvent) => {
      if (cursorRef.current) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          if (cursorRef.current) {
            cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
          }
        });
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a') || target.closest('button') || target.closest('.interactive-node')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleMouseOver);
      cancelAnimationFrame(rafId);
    };
  }, [prefersReduced, isFine]);

  if (prefersReduced || !isFine) return null;

  return (
    <div 
      ref={cursorRef}
      className={`fixed top-0 left-0 w-4 h-4 rounded-full pointer-events-none z-[100] -ml-2 -mt-2 transition-all duration-300 ease-out will-change-transform
        ${isHovering ? 'scale-[2.5] bg-white mix-blend-difference' : 'scale-100 border border-white/40 bg-white/10 backdrop-blur-[1px]'}
      `}
      style={{ backfaceVisibility: 'hidden' }}
    />
  );
});

CustomCursor.displayName = 'CustomCursor';
