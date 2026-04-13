import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export const MagneticWrapper: React.FC<{ children: React.ReactNode, className?: string, strength?: number }> = ({ children, className = "", strength = 0.15 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const prefersReduced = useReducedMotion();
  const isFine = useMediaQuery('(pointer: fine) and (hover: hover)');

  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReduced || !isFine || !ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    x.set(middleX * strength);
    y.set(middleY * strength);
  };

  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: prefersReduced || !isFine ? 0 : springX, y: prefersReduced || !isFine ? 0 : springY }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  );
};
