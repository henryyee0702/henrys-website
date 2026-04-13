import { useEffect, useState } from 'react';

export type ViewportMode = 'compact' | 'phone' | 'tablet' | 'desktop';

const resolveViewportMode = (width: number): ViewportMode => {
  if (width <= 393) return 'compact';
  if (width <= 430) return 'phone';
  if (width <= 1024) return 'tablet';
  return 'desktop';
};

export const useViewportMode = (initialMode: ViewportMode = 'desktop') => {
  const [viewportMode, setViewportMode] = useState<ViewportMode>(initialMode);

  useEffect(() => {
    const syncViewportMode = () => {
      setViewportMode(resolveViewportMode(window.innerWidth));
    };

    syncViewportMode();
    window.addEventListener('resize', syncViewportMode);

    return () => {
      window.removeEventListener('resize', syncViewportMode);
    };
  }, []);

  return viewportMode;
};