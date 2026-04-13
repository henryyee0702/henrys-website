import React, { useState, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { X, Play, Pause, ArrowRight, RotateCcw } from 'lucide-react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { EPISODES } from '@/content/fulbright-episodes';
import type { EpisodeNode } from '@/content/fulbright-episodes';

// ==========================================
// 1. Configuration
// ==========================================
const CONFIG = {
  TIMING: {
    PULLBACK_DURATION: 1200,
    PUSHIN_DURATION: 1300,
    PANEL_DURATION: 800,
    DEFAULT_TRANSITION: 1200,
    SPEED_UP_MULTIPLIER: 25,
    NORMAL_MULTIPLIER: 1,
    LERP_FACTOR_SPEED: 0.05,
    LERP_FACTOR_CAM: 0.08,
    LERP_FACTOR_Z: 0.1,
  },
  CAMERA: {
    PULLBACK: { scale: 0.35, rotateX: 35, y: -200 },
    PUSHIN: { scale: 2.2, rotateX: 80, y: 100 },
    IDLE: { scale: 1, rotateX: 75, y: 0 },
    MOBILE_ACTIVE: { scale: 0.4, rotateX: 55, y: -20 },
  },
  LAYOUT: {
    PANEL_WIDTH: 600,
    SYS_MAX_SIZE: 950,
    MD_BREAKPOINT: 768,
  },
};

const EXCERPT_WORD_START_COLOR = 'rgb(114, 119, 128)';
const EXCERPT_WORD_FINAL_COLOR = 'rgb(245, 245, 247)';
const EXCERPT_WORD_START_OPACITY = 0.76;
const EXCERPT_REVEAL_SCROLL_MULTIPLIER = 0.3;
const EXCERPT_WORD_REVEAL_STAGGER = 0.35;
const EXCERPT_WORD_REVEAL_DURATION = 0.024;
const EXCERPT_SCROLL_DISTANCE_PER_WORD = 34 * EXCERPT_REVEAL_SCROLL_MULTIPLIER;
const EXCERPT_SCROLL_DISTANCE_MIN = 360 * EXCERPT_REVEAL_SCROLL_MULTIPLIER;
const EXCERPT_POST_REVEAL_BUFFER = 200;

// ==========================================
// 3. Utilities
// ==========================================
const parseTitle = (fullTitle: string) => {
  const parts = fullTitle.split(/:\s*(.+)/);
  return { prefix: parts[0] || '', main: parts[1] || fullTitle };
};

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const splitExcerptTokens = (text: string) => {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'undefined') {
    const segmenter = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
    return Array.from(segmenter.segment(text)).map((part, index) => ({
      key: `${index}-${part.segment}`,
      value: part.segment,
      animated: !/^\s+$/.test(part.segment),
    }));
  }

  return Array.from(text).map((char, index) => ({
    key: `${index}-${char}`,
    value: char,
    animated: !/^\s+$/.test(char),
  }));
};

const getExcerptScrollDistance = (text: string) => {
  const animatedTokenCount = splitExcerptTokens(text).filter((token) => token.animated).length;
  return Math.max(animatedTokenCount * EXCERPT_SCROLL_DISTANCE_PER_WORD, EXCERPT_SCROLL_DISTANCE_MIN);
};

const getExcerptGateMinHeight = (text: string) => `calc(100svh + ${getExcerptScrollDistance(text) + EXCERPT_POST_REVEAL_BUFFER}px)`;

// ==========================================
// 4. Precomputed physics state
// ==========================================
const INITIAL_PHYSICAL_Z: Record<string, number> = {};
const INITIAL_PHYSICAL_SCALE: Record<string, number> = {};
const INITIAL_PHYSICAL_LABEL_Y: Record<string, number> = {};
const INITIAL_PHYSICAL_LABEL_SCALE: Record<string, number> = {};
const INITIAL_ANGLES: Record<string, number> = {};
for (const node of EPISODES) {
  INITIAL_PHYSICAL_Z[node.id] = 0;
  INITIAL_PHYSICAL_SCALE[node.id] = 1;
  INITIAL_PHYSICAL_LABEL_Y[node.id] = 0;
  INITIAL_PHYSICAL_LABEL_SCALE[node.id] = 1;
  INITIAL_ANGLES[node.id] = node.isSun ? 0 : Math.random() * Math.PI * 2;
}

// ==========================================
// 5. ExcerptReveal — word-by-word stagger
// ==========================================
const ExcerptReveal: React.FC<{
  text: string;
  isActive: boolean;
  scrollerRef: React.RefObject<HTMLDivElement>;
}> = ({ text, isActive, scrollerRef }) => {
  const ref = useRef<HTMLQuoteElement>(null);
  const tokens = splitExcerptTokens(text);

  useEffect(() => {
    if (!isActive || !ref.current || !scrollerRef.current) return;

    gsap.registerPlugin(ScrollTrigger);

    const words = ref.current.querySelectorAll<HTMLElement>('[data-excerpt-word]');
    if (!words.length) return;
    const scrollDistance = getExcerptScrollDistance(text);

    gsap.set(words, {
      color: EXCERPT_WORD_START_COLOR,
      opacity: EXCERPT_WORD_START_OPACITY,
      yPercent: 8,
      scale: 0.985,
      rotateX: -8,
      filter: 'blur(1.6px)',
      transformOrigin: '50% 100%',
    });

    const revealTimeline = gsap.timeline({
      defaults: { overwrite: 'auto' },
      scrollTrigger: {
        trigger: ref.current,
        scroller: scrollerRef.current,
        start: 'top 28%',
        end: () => `+=${scrollDistance}`,
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    words.forEach((word, index) => {
      revealTimeline.to(
        word,
        {
          color: EXCERPT_WORD_FINAL_COLOR,
          opacity: 1,
          yPercent: 0,
          scale: 1,
          rotateX: 0,
          filter: 'blur(0px)',
          duration: EXCERPT_WORD_REVEAL_DURATION,
          ease: 'none',
        },
        index * EXCERPT_WORD_REVEAL_STAGGER,
      );
    });

    ScrollTrigger.refresh();

    return () => {
      revealTimeline.scrollTrigger?.kill();
      revealTimeline.kill();
    };
  }, [isActive, text, scrollerRef]);

  return (
    <blockquote
      ref={ref}
      className="text-[1.05rem] md:text-[1.15rem] text-white/70 font-light mb-10 md:mb-14 leading-[1.9] border-l-[2px] border-white/20 pl-5 md:pl-6"
    >
      {tokens.map((token) => {
        if (!token.animated) {
          return <React.Fragment key={token.key}>{token.value.replace(/ /g, '\u00A0')}</React.Fragment>;
        }

        return (
          <span
            key={token.key}
            data-excerpt-word
            className="inline-block will-change-[color,opacity,transform,filter]"
            style={{ color: EXCERPT_WORD_START_COLOR, opacity: EXCERPT_WORD_START_OPACITY }}
          >
            {token.value}
          </span>
        );
      })}
    </blockquote>
  );
};

// ==========================================
// 7. PlanetNode
// ==========================================
interface PlanetNodeProps {
  node: EpisodeNode;
  isHovered: boolean;
  isSelected: boolean;
  isTarget: boolean;
  isZooming: boolean;
  shouldBlur: boolean;
  onMouseEnter: (id: string) => void;
  onMouseLeave: () => void;
  onSelect: (node: EpisodeNode) => void;
}

interface PlanetNodeHandle {
  root: HTMLDivElement | null;
  body: HTMLDivElement | null;
  labelContainer: HTMLDivElement | null;
  labelText: HTMLSpanElement | null;
}

const PlanetNode = forwardRef<PlanetNodeHandle, PlanetNodeProps>(({
  node, isHovered, isSelected, isTarget, isZooming, shouldBlur, onMouseEnter, onMouseLeave, onSelect,
}, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);
  const labelTextRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    root: rootRef.current,
    body: bodyRef.current,
    labelContainer: labelContainerRef.current,
    labelText: labelTextRef.current,
  }));

  const { prefix } = parseTitle(node.title);
  const transitionDuration = isZooming ? `${CONFIG.TIMING.PULLBACK_DURATION}ms` : `${CONFIG.TIMING.DEFAULT_TRANSITION}ms`;

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={isZooming ? -1 : 0}
      aria-label={`檢視故事: ${node.title}`}
      className={`absolute top-0 left-0 preserve-3d cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:rounded-full
        ${!node.isSun ? 'will-change-transform' : ''}
        ${shouldBlur ? 'opacity-10 blur-md pointer-events-none' : 'opacity-100 blur-0'}`}
      onMouseEnter={() => !isZooming && onMouseEnter(node.id)}
      onMouseLeave={() => !isZooming && onMouseLeave()}
      onClick={() => !isZooming && onSelect(node)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isZooming) {
          e.preventDefault();
          onSelect(node);
        }
      }}
      style={{
        transitionProperty: 'opacity, filter',
        transitionDuration,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {node.isSun && (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] rounded-full animate-pulse bg-orange-400/20 blur-[15px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] h-[250%] rounded-full bg-yellow-300/10 blur-[30px] pointer-events-none" />
        </>
      )}

      {node.hasRing && (
        <div
          className="absolute top-1/2 left-1/2 rounded-full border-[1px] border-yellow-200/30"
          style={{
            width: node.size * 2.8,
            height: node.size * 2.8,
            transform: 'translate(-50%, -50%) rotateX(75deg)',
            boxShadow: '0 0 15px rgba(234, 179, 8, 0.15) inset, 0 0 15px rgba(234, 179, 8, 0.15)',
          }}
        />
      )}

      <div
        ref={bodyRef}
        className={`absolute top-1/2 left-1/2 rounded-full bg-gradient-to-br ${node.color}`}
        style={{
          width: node.size,
          height: node.size,
          transitionProperty: 'box-shadow',
          transitionDuration,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: node.isSun
            ? `0 0 40px 10px ${node.glow}, 0 0 80px 30px rgba(249, 115, 22, 0.2), inset 0 0 15px rgba(255,255,255,0.8)`
            : (isHovered || isSelected || (isTarget && isZooming))
              ? `0 0 45px 12px ${node.glow}, inset 0 0 15px rgba(255,255,255,0.9)`
              : `0 0 12px 1px ${node.glow}`,
        }}
      />

      <div ref={labelContainerRef} className="absolute bottom-full left-1/2 mb-4 flex flex-col items-center pointer-events-none">
        <span
          ref={labelTextRef}
          className={`whitespace-nowrap text-[10px] sm:text-[11px] uppercase tracking-[0.25em] font-medium px-3 py-1.5 rounded-full border
            ${(isHovered || isSelected) && !isZooming
              ? 'text-white border-white/30 bg-white/10 backdrop-blur-md drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]'
              : 'text-white/80 border-white/5 bg-[#020308]/60 backdrop-blur-md shadow-[0_4px_10px_rgba(0,0,0,0.5)]'}`}
          style={{
            transitionProperty: 'color, background-color, border-color, box-shadow',
            transitionDuration,
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {prefix}
        </span>
      </div>
    </div>
  );
});
PlanetNode.displayName = 'PlanetNode';

// ==========================================
// 8. Main Component
// ==========================================
interface MachineState {
  phase: 'idle' | 'pullback' | 'pushin';
  targetId: string | null;
  activeArticle: EpisodeNode | null;
}

export const FulbrightGalaxy: React.FC = () => {
  const [machineState, setMachineState] = useState<MachineState>({
    phase: 'idle',
    targetId: null,
    activeArticle: null,
  });

  const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [scale, setScale] = useState(1);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const planetRefs = useRef<Record<string, PlanetNodeHandle | null>>({});
  const sceneRef = useRef<HTMLDivElement>(null);
  const cameraWrapperRef = useRef<HTMLDivElement>(null);
  const scrollPanelRef = useRef<HTMLDivElement>(null);

  const panelWidth = windowWidth >= CONFIG.LAYOUT.MD_BREAKPOINT ? Math.round(windowWidth * 2 / 3) : windowWidth;

  const physicalZ = useRef({ ...INITIAL_PHYSICAL_Z });
  const physicalScale = useRef({ ...INITIAL_PHYSICAL_SCALE });
  const physicalLabelY = useRef({ ...INITIAL_PHYSICAL_LABEL_Y });
  const physicalLabelScale = useRef({ ...INITIAL_PHYSICAL_LABEL_SCALE });
  const angles = useRef({ ...INITIAL_ANGLES });

  const stateRefs = useRef<{
    phase: string;
    targetId: string | null;
    isActuallyPlaying: boolean;
    hoveredPlanet: string | null;
    activeArticle: EpisodeNode | null;
  }>({ phase: 'idle', targetId: null, isActuallyPlaying: true, hoveredPlanet: null, activeArticle: null });

  const speedMultiplier = useRef(CONFIG.TIMING.NORMAL_MULTIPLIER);
  const targetSpeedMultiplier = useRef(CONFIG.TIMING.NORMAL_MULTIPLIER);
  const cameraOffset = useRef({ x: 0, y: 0 });

  useIsomorphicLayoutEffect(() => {
    stateRefs.current = {
      phase: machineState.phase,
      targetId: machineState.targetId,
      isActuallyPlaying: !isUserPaused && !hoveredPlanet,
      hoveredPlanet,
      activeArticle: machineState.activeArticle,
    };
  }, [machineState.phase, machineState.targetId, isUserPaused, hoveredPlanet, machineState.activeArticle]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setWindowWidth(w);
      setScale(Math.min(1.1, Math.min(w, window.innerHeight) / CONFIG.LAYOUT.SYS_MAX_SIZE));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    targetSpeedMultiplier.current = machineState.phase === 'pullback'
      ? CONFIG.TIMING.SPEED_UP_MULTIPLIER
      : CONFIG.TIMING.NORMAL_MULTIPLIER;
  }, [machineState.phase]);

  const advancePhase = useCallback((expectedPhase: string) => {
    setMachineState((prev) => {
      if (prev.phase !== expectedPhase) return prev;
      if (prev.phase === 'pullback') return { ...prev, phase: 'pushin' };
      if (prev.phase === 'pushin') {
        const nextNode = EPISODES.find((n) => n.id === prev.targetId) || null;
        return { phase: 'idle', targetId: null, activeArticle: nextNode };
      }
      return prev;
    });
  }, []);

  const handleCameraTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== cameraWrapperRef.current || e.propertyName !== 'transform') return;
      advancePhase(stateRefs.current.phase);
    },
    [advancePhase],
  );

  useEffect(() => {
    if (machineState.phase === 'idle') return;
    const currentPhase = machineState.phase;
    const duration = currentPhase === 'pullback' ? CONFIG.TIMING.PULLBACK_DURATION : CONFIG.TIMING.PUSHIN_DURATION;
    const timerId = setTimeout(() => advancePhase(currentPhase), duration + 100);
    return () => clearTimeout(timerId);
  }, [machineState.phase, advancePhase]);

  // Animation loop
  useEffect(() => {
    if (reducedMotion) return;
    let reqId: number;
    let lastTime = performance.now();

    const loop = (timestamp: number) => {
      let deltaTime = timestamp - lastTime;
      lastTime = timestamp;
      if (deltaTime > 100) deltaTime = 16.666;
      const timeScale = deltaTime / 16.666;

      const frameAwareLerp = (start: number, end: number, factor: number) =>
        start + (end - start) * (1 - Math.pow(1 - factor, timeScale));

      const state = stateRefs.current;

      speedMultiplier.current = frameAwareLerp(speedMultiplier.current, targetSpeedMultiplier.current, CONFIG.TIMING.LERP_FACTOR_SPEED);

      if (state.isActuallyPlaying || speedMultiplier.current > 1.05) {
        for (const node of EPISODES) {
          if (!node.isSun) {
            angles.current[node.id] += node.speed * speedMultiplier.current * timeScale;
          }
        }
      }

      let targetCamX = 0;
      let targetCamY = 0;
      const isPushin = state.phase === 'pushin';
      const isZooming = state.phase !== 'idle';

      if (isPushin && state.targetId) {
        const targetNode = EPISODES.find((n) => n.id === state.targetId);
        if (targetNode && !targetNode.isSun) {
          const angle = angles.current[targetNode.id];
          targetCamX = -targetNode.radius * Math.cos(angle);
          targetCamY = -targetNode.radius * Math.sin(angle);
        }
      }

      cameraOffset.current.x = frameAwareLerp(cameraOffset.current.x, targetCamX, CONFIG.TIMING.LERP_FACTOR_CAM);
      cameraOffset.current.y = frameAwareLerp(cameraOffset.current.y, targetCamY, CONFIG.TIMING.LERP_FACTOR_CAM);

      if (sceneRef.current) {
        sceneRef.current.style.transform = `translate3d(${cameraOffset.current.x}px, ${cameraOffset.current.y}px, 0)`;
      }

      for (const node of EPISODES) {
        const isTarget = state.targetId === node.id;
        const isSelected = state.activeArticle?.id === node.id;
        const isHovered = state.hoveredPlanet === node.id;

        let x = 0;
        let y = 0;
        if (!node.isSun) {
          const angle = angles.current[node.id];
          x = node.radius * Math.cos(angle);
          y = node.radius * Math.sin(angle);
        }

        const targetZ = isTarget && isPushin ? 100 : 0;
        physicalZ.current[node.id] = frameAwareLerp(physicalZ.current[node.id], targetZ, CONFIG.TIMING.LERP_FACTOR_Z);

        const targetNodeScale = ((isHovered || isSelected) && !isZooming) || (isTarget && isZooming) ? 1.15 : 1;
        physicalScale.current[node.id] = frameAwareLerp(physicalScale.current[node.id], targetNodeScale, 0.15);

        const targetLabelY = (isHovered || isSelected) && !isZooming ? -8 : 0;
        physicalLabelY.current[node.id] = frameAwareLerp(physicalLabelY.current[node.id], targetLabelY, 0.15);

        const targetLabelScale = (isHovered || isSelected) && !isZooming ? 1.1 : 1;
        physicalLabelScale.current[node.id] = frameAwareLerp(physicalLabelScale.current[node.id], targetLabelScale, 0.15);

        const elRefs = planetRefs.current[node.id];
        if (elRefs?.root) {
          elRefs.root.style.transform = `translate3d(${x}px, ${y}px, ${physicalZ.current[node.id]}px) rotateX(-75deg)`;
          if (elRefs.body) elRefs.body.style.transform = `translate(-50%, -50%) scale(${physicalScale.current[node.id]})`;
          if (elRefs.labelContainer) elRefs.labelContainer.style.transform = `translate(-50%, ${physicalLabelY.current[node.id]}px)`;
          if (elRefs.labelText) elRefs.labelText.style.transform = `scale(${physicalLabelScale.current[node.id]})`;
        }
      }

      reqId = requestAnimationFrame(loop);
    };

    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, [reducedMotion]);

  const handleNextArticle = (nextArticle: EpisodeNode) => {
    if (machineState.phase !== 'idle') return;
    setMachineState({ phase: 'pullback', targetId: nextArticle.id, activeArticle: null });
  };

  const closeArticle = () => {
    setMachineState((prev) => ({ ...prev, activeArticle: null }));
  };

  const getCameraTransitionDuration = () => {
    if (machineState.phase === 'pullback') return `${CONFIG.TIMING.PULLBACK_DURATION}ms`;
    if (machineState.phase === 'pushin') return `${CONFIG.TIMING.PUSHIN_DURATION}ms`;
    return `${CONFIG.TIMING.DEFAULT_TRANSITION}ms`;
  };

  const getCameraTransform = () => {
    const { phase, activeArticle } = machineState;
    const isMobile = windowWidth < CONFIG.LAYOUT.MD_BREAKPOINT;

    if (phase === 'pullback') return `scale(${scale * CONFIG.CAMERA.PULLBACK.scale}) rotateX(${CONFIG.CAMERA.PULLBACK.rotateX}deg) translateY(${CONFIG.CAMERA.PULLBACK.y}px)`;
    if (phase === 'pushin') return `scale(${scale * CONFIG.CAMERA.PUSHIN.scale}) rotateX(${CONFIG.CAMERA.PUSHIN.rotateX}deg) translateY(${CONFIG.CAMERA.PUSHIN.y}px)`;

    if (activeArticle) {
      if (isMobile) return `scale(${scale * CONFIG.CAMERA.MOBILE_ACTIVE.scale}) rotateX(${CONFIG.CAMERA.MOBILE_ACTIVE.rotateX}deg) translateY(${CONFIG.CAMERA.MOBILE_ACTIVE.y}vh)`;
      const leftSpace = windowWidth - panelWidth;
      const safeScale = Math.max(0.35, Math.min(scale * 0.65, (leftSpace - 40) / CONFIG.LAYOUT.SYS_MAX_SIZE));
      return `scale(${safeScale}) rotateX(65deg) translateY(0px)`;
    }

    return `scale(${scale}) rotateX(${CONFIG.CAMERA.IDLE.rotateX}deg) translateY(0px)`;
  };

  const currentIndex = machineState.activeArticle ? EPISODES.findIndex((n) => n.id === machineState.activeArticle!.id) : -1;
  const nextArticleNode = currentIndex >= 0 && currentIndex < EPISODES.length - 1 ? EPISODES[currentIndex + 1] : null;

  return (
    <section id="fulbright-galaxy" className="relative h-screen overflow-hidden border-y border-white/[0.05] bg-[#020308]">
      <style>{`
        .preserve-3d { transform-style: preserve-3d; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
      `}</style>

      {/* Background layers */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.02)_0%,transparent_80%)] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none mix-blend-color-dodge opacity-40" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")` }} />

      {/* Header */}
      <header className="absolute top-6 left-6 md:top-8 md:left-10 z-20 pointer-events-none">
        <h2 className="text-xl md:text-2xl font-light tracking-[0.3em] text-white/90 drop-shadow-lg">
          FULBRIGHT<span className="text-white/40">DIARY</span>
        </h2>
      </header>

      {/* Solar system */}
      <main
        className="absolute inset-0 flex items-center justify-center ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          perspective: '1200px',
          transform: machineState.activeArticle && machineState.phase === 'idle' && windowWidth >= CONFIG.LAYOUT.MD_BREAKPOINT
            ? `translateX(-${panelWidth / 2}px)`
            : 'translateX(0px)',
          transitionDuration: `${CONFIG.TIMING.DEFAULT_TRANSITION}ms`,
          transitionProperty: 'transform',
        }}
      >
        <div
          ref={cameraWrapperRef}
          onTransitionEnd={handleCameraTransitionEnd}
          className="relative preserve-3d will-change-transform"
          style={{
            width: 0,
            height: 0,
            transform: getCameraTransform(),
            transition: `transform ${getCameraTransitionDuration()} cubic-bezier(0.65, 0, 0.35, 1)`,
          }}
        >
          <div ref={sceneRef} className="absolute inset-0 preserve-3d will-change-transform">
            {/* Orbit rings */}
            {EPISODES.filter((n) => !n.isSun).map((node) => (
              <div
                key={`orbit-${node.id}`}
                className={`absolute top-0 left-0 rounded-full border border-white/15 pointer-events-none transition-opacity duration-1000 ${
                  machineState.targetId && machineState.phase === 'pushin' ? 'opacity-0' : 'opacity-100'
                }`}
                style={{
                  width: node.radius * 2,
                  height: node.radius * 2,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}

            {/* Planet nodes */}
            {EPISODES.map((node) => (
              <PlanetNode
                key={node.id}
                ref={(el) => { planetRefs.current[node.id] = el; }}
                node={node}
                isHovered={hoveredPlanet === node.id}
                isSelected={machineState.activeArticle?.id === node.id}
                isTarget={machineState.targetId === node.id}
                isZooming={machineState.phase !== 'idle'}
                shouldBlur={machineState.targetId !== null && machineState.targetId !== node.id && machineState.phase === 'pushin'}
                onMouseEnter={setHoveredPlanet}
                onMouseLeave={() => setHoveredPlanet(null)}
                onSelect={(n) => setMachineState((prev) => ({ ...prev, activeArticle: n }))}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Article panel */}
      <aside
        aria-hidden={!machineState.activeArticle}
        className={`absolute top-0 right-0 h-full w-full max-w-full bg-[#030408]/90 backdrop-blur-3xl md:border-l border-white/10
          ease-[cubic-bezier(0.16,1,0.3,1)] z-50 shadow-[-40px_0_80px_rgba(0,0,0,0.8)]
          ${machineState.activeArticle && machineState.phase === 'idle' ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          transitionDuration: `${CONFIG.TIMING.PANEL_DURATION}ms`,
          transitionProperty: 'transform',
          ...(windowWidth >= CONFIG.LAYOUT.MD_BREAKPOINT ? { width: `${panelWidth}px` } : {}),
        }}
      >
        {machineState.activeArticle && (
          <article className="h-full flex flex-col relative">
            <header className="flex justify-between items-center px-8 py-8 md:px-12 md:py-10 border-b border-white/[0.05] shrink-0">
              <div className="flex items-center gap-4">
                <div
                  className={`w-3 h-3 rounded-full bg-gradient-to-br ${machineState.activeArticle.color}`}
                  style={{ boxShadow: `0 0 12px ${machineState.activeArticle.glow}` }}
                />
                <div className="flex flex-col">
                  <span className="text-[9px] md:text-[10px] text-neutral-500 font-light tracking-[0.25em] uppercase mb-1" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    {machineState.activeArticle.isSun ? '恆星 / 中心' : `行星 / 軌道 ${machineState.activeArticle.id}`}
                  </span>
                  <span className="text-[12px] md:text-[14px] text-neutral-300 font-light tracking-[0.15em] uppercase" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    {machineState.activeArticle.planet}
                  </span>
                </div>
              </div>
              <button
                onClick={closeArticle}
                className="text-neutral-500 hover:text-white transition-all bg-white/5 hover:bg-white/15 p-3 rounded-full backdrop-blur-md"
                aria-label="關閉"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </header>

            <div ref={scrollPanelRef} className="flex-1 overflow-y-auto px-8 py-10 md:px-12 md:py-12 pb-[50vh] custom-scrollbar relative">
              <div className="relative mb-10 md:mb-14" style={{ minHeight: getExcerptGateMinHeight(machineState.activeArticle.excerpt) }}>
                <div className="sticky top-0 bg-[#030408]/96 pb-8 pt-1">
                  <h3 className="text-[1.8rem] md:text-[2.2rem] font-medium text-white/95 leading-[1.2] mb-8 md:mb-10 tracking-tight">
                    {parseTitle(machineState.activeArticle.title).main}
                  </h3>
                  {machineState.activeArticle.imageUrl && (
                    <figure className="mb-6 md:mb-8 w-full overflow-hidden rounded-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-neutral-900">
                      <img
                        src={machineState.activeArticle.imageUrl}
                        alt={machineState.activeArticle.imageAlt || parseTitle(machineState.activeArticle.title).main}
                        className="w-full object-cover max-h-[28vh]"
                        loading="lazy"
                      />
                    </figure>
                  )}
                  <ExcerptReveal
                    text={machineState.activeArticle.excerpt}
                    isActive={machineState.phase === 'idle' && !!machineState.activeArticle}
                    scrollerRef={scrollPanelRef}
                  />
                </div>
              </div>

              <div className="prose prose-invert prose-p:font-light prose-p:text-neutral-300 prose-p:leading-[2.1] max-w-none space-y-6">
                {machineState.activeArticle.content.split('\n').map((paragraph, idx) => (
                  paragraph.trim() !== '' && <p key={`p-${idx}`}>{paragraph}</p>
                ))}
              </div>

              <nav className="mt-20 md:mt-24">
                {nextArticleNode ? (
                  <button
                    onClick={() => handleNextArticle(nextArticleNode)}
                    className="group w-full relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-8 md:p-10 transition-all hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex flex-col items-start gap-2 md:gap-3">
                        <span className="text-[9px] md:text-[10px] text-neutral-500 font-light tracking-[0.3em] uppercase" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          下一站
                        </span>
                        <span className="text-lg md:text-xl text-white/95 font-medium tracking-wide">
                          {parseTitle(nextArticleNode.title).main}
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
                        <ArrowRight size={20} className="text-neutral-400 group-hover:text-white group-hover:translate-x-1.5 transition-all" strokeWidth={1} />
                      </div>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={closeArticle}
                    className="flex items-center gap-4 mx-auto px-8 py-4 rounded-full border border-white/15 bg-black/40 text-[9px] tracking-[0.3em] text-white/70 hover:text-white transition-all"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  >
                    <RotateCcw size={14} strokeWidth={1.5} /> 返回軌道
                  </button>
                )}
              </nav>
            </div>
          </article>
        )}
      </aside>

      {/* Copyright - Bottom Center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:bottom-8 z-20 text-[#A1A1AA] text-[13px] md:text-sm font-light tracking-wide pointer-events-none">
        © 2026 Tseng Pin-Han. A machine for becoming.
      </div>

      {/* Controls - Bottom Right */}
      <div className="absolute bottom-6 right-6 md:bottom-8 md:right-10 z-20 flex gap-6 text-neutral-500">
        <button
          onClick={() => setIsUserPaused(!isUserPaused)}
          className="group hover:text-white transition-colors flex items-center gap-3 text-[9px] tracking-[0.2em] uppercase font-light"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          <span className="p-2 md:p-2.5 rounded-full border border-white/10 group-hover:border-white/30 transition-colors">
            {isUserPaused ? <Play size={14} strokeWidth={1.5} /> : <Pause size={14} strokeWidth={1.5} />}
          </span>
          {isUserPaused ? '繼續' : '暫停'}
        </button>
      </div>
    </section>
  );
};
