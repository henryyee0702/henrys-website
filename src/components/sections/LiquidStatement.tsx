import React, { useEffect, useId, useRef, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import { gsap } from 'gsap';
import { ElectromagneticField } from '@/components/webgl/ElectromagneticField';
import { HeroLiquidShader } from '@/components/webgl/HeroLiquidShader';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useGpuTier } from '@/components/webgl/gpu-tier';

const STATEMENT_EN_SUBTITLE = 'Engineer and artist';
const ENGINEER_WORD = '工程師';

const ARTIST_INTERACTION_PADDING = { x: 128, y: 84 };
const WORD_CLASS = 'inline-block font-semibold leading-[0.95] tracking-[-0.05em] text-[#F5F5F7]';
const IDENTITY_ZH_CLASS = 'whitespace-nowrap text-[clamp(3.2rem,8.32vw,7.76rem)] font-semibold leading-[0.97] tracking-[-0.055em] text-[#F5F5F7]';
const IDENTITY_EN_CLASS = 'whitespace-nowrap text-center text-[clamp(1.5rem,5.2vw,4.85rem)] font-medium uppercase tracking-[0.18em] min-[768px]:tracking-[0.24em] text-[#F5F5F7] overflow-visible';
const STATEMENT_SUBTITLE_CLASS = 'mx-auto max-w-[26rem] text-balance text-center text-[clamp(0.88rem,1.4vw,1.08rem)] font-medium tracking-[0.12em] text-white/58 sm:max-w-[30rem] sm:text-[clamp(0.94rem,1.2vw,1.16rem)]';
const ENGINEER_REPLAY_ENTER_THRESHOLD = 0.45;
const ENGINEER_REPLAY_EXIT_THRESHOLD = 0.08;

interface EngineerWordMetrics {
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  letterSpacing: string;
}

const EngineerElectricWord: React.FC<{
  reducedMotion: boolean;
  wordClassName: string;
}> = ({ reducedMotion, wordClassName }) => {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const fallbackRef = useRef<HTMLSpanElement>(null);
  const baseRef = useRef<SVGTextElement>(null);
  const strokeRef = useRef<SVGTextElement>(null);
  const zapRef = useRef<SVGTextElement>(null);
  const fillRef = useRef<SVGTextElement>(null);
  const isReplayZoneActiveRef = useRef(false);
  const [metrics, setMetrics] = useState<EngineerWordMetrics | null>(null);
  const svgId = useId().replace(/:/g, '');
  const gradientId = `${svgId}-engineer-electric-gradient`;

  useEffect(() => {
    if (reducedMotion) {
      setMetrics(null);
      return;
    }

    const measure = measureRef.current;
    if (!measure) return;

    let frameId = 0;

    const updateMetrics = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const rect = measure.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const computedStyle = window.getComputedStyle(measure);
        const nextMetrics = {
          width: rect.width,
          height: rect.height,
          fontSize: Number.parseFloat(computedStyle.fontSize) || rect.height,
          fontFamily: computedStyle.fontFamily || 'sans-serif',
          fontWeight: computedStyle.fontWeight || '600',
          letterSpacing: computedStyle.letterSpacing === 'normal' ? '0px' : computedStyle.letterSpacing,
        };

        setMetrics((current) => {
          if (
            current &&
            Math.abs(current.width - nextMetrics.width) < 0.5 &&
            Math.abs(current.height - nextMetrics.height) < 0.5 &&
            Math.abs(current.fontSize - nextMetrics.fontSize) < 0.5 &&
            current.fontFamily === nextMetrics.fontFamily &&
            current.fontWeight === nextMetrics.fontWeight &&
            current.letterSpacing === nextMetrics.letterSpacing
          ) {
            return current;
          }

          return nextMetrics;
        });
      });
    };

    updateMetrics();

    const resizeObserver = new ResizeObserver(() => {
      updateMetrics();
    });
    resizeObserver.observe(measure);

    document.fonts?.ready.then(() => {
      updateMetrics();
    }).catch(() => {
      updateMetrics();
    });

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !metrics) return;

    const wrapper = wrapperRef.current;
    const fallback = fallbackRef.current;
    const base = baseRef.current;
    const stroke = strokeRef.current;
    const zap = zapRef.current;
    const fill = fillRef.current;

    if (!wrapper || !fallback || !base || !stroke || !zap || !fill) return;

    const dashLength = Math.max(metrics.width * 5.4, 1800);
    const zapPattern = [
      Math.max(metrics.width * 0.028, 12),
      Math.max(metrics.width * 0.045, 18),
      Math.max(metrics.width * 0.014, 6),
      Math.max(metrics.width * 0.058, 24),
      Math.max(metrics.width * 0.032, 14),
      Math.max(metrics.width * 0.07, 28),
    ].join(' ');

    const setInitialState = () => {
      gsap.set(wrapper, { scale: 0.982, transformOrigin: '50% 62%' });
      gsap.set(fallback, { opacity: 1 });
      gsap.set(base, { opacity: 0 });
      gsap.set(stroke, {
        opacity: 0.94,
        strokeDasharray: dashLength,
        strokeDashoffset: dashLength,
      });
      gsap.set(zap, {
        opacity: 0,
        strokeDasharray: zapPattern,
        strokeDashoffset: dashLength,
      });
      gsap.set(fill, { opacity: 0 });
    };

    const setCompletedState = () => {
      gsap.set(wrapper, { scale: 1, transformOrigin: '50% 62%' });
      gsap.set(fallback, { opacity: 0 });
      gsap.set(base, { opacity: 0.12 });
      gsap.set(stroke, {
        opacity: 0,
        strokeDasharray: dashLength,
        strokeDashoffset: 0,
      });
      gsap.set(zap, {
        opacity: 0,
        strokeDasharray: zapPattern,
        strokeDashoffset: -dashLength * 0.56,
      });
      gsap.set(fill, { opacity: 1 });
    };

    if (isReplayZoneActiveRef.current) {
      setCompletedState();
    } else {
      setInitialState();
    }

    const timeline = gsap.timeline({
      paused: true,
      defaults: { overwrite: 'auto' },
    });

    timeline
      .to(wrapper, { scale: 1.032, duration: 1.08, ease: 'power2.out' }, 0)
      .to(base, { opacity: 0.96, duration: 0.18, ease: 'power1.out' }, 0.02)
      .to(fallback, { opacity: 0.08, duration: 0.18, ease: 'power1.out' }, 0.02)
      .to(zap, { opacity: 1, duration: 0.16, ease: 'power1.out' }, 0.12)
      .to(stroke, { strokeDashoffset: 0, duration: 0.92, ease: 'power2.inOut' }, 0.12)
      .to(zap, { strokeDashoffset: -dashLength * 0.56, duration: 0.96, ease: 'power2.inOut' }, 0.12)
      .to(zap, { opacity: 0.74, duration: 0.18, ease: 'power1.out' }, 0.56)
      .to(fallback, { opacity: 0, duration: 0.18, ease: 'power1.out' }, 0.6)
      .to(fill, { opacity: 1, duration: 0.24, ease: 'power2.out' }, 0.82)
      .to(stroke, { opacity: 0, duration: 0.2, ease: 'power1.out' }, 0.84)
      .to(base, { opacity: 0.12, duration: 0.22, ease: 'power1.out' }, 0.84)
      .to(zap, { opacity: 0, duration: 0.22, ease: 'power1.out' }, 0.92)
      .to(wrapper, { scale: 1, duration: 0.32, ease: 'power2.out' }, 0.98);

    timeline.eventCallback('onComplete', () => {
      setCompletedState();
    });

    const replayAnimation = () => {
      setInitialState();
      timeline.pause(0);
      timeline.timeScale(0.5);
      timeline.play(0);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry?.intersectionRatio ?? 0;
        const isEntering = Boolean(entry?.isIntersecting) && ratio >= ENGINEER_REPLAY_ENTER_THRESHOLD;
        const isLeaving = !entry?.isIntersecting || ratio <= ENGINEER_REPLAY_EXIT_THRESHOLD;

        if (isLeaving) {
          if (!isReplayZoneActiveRef.current) return;
          isReplayZoneActiveRef.current = false;
          timeline.pause(0);
          return;
        }

        if (!isEntering || isReplayZoneActiveRef.current) return;

        isReplayZoneActiveRef.current = true;
        replayAnimation();
      },
      {
        threshold: [0, ENGINEER_REPLAY_EXIT_THRESHOLD, ENGINEER_REPLAY_ENTER_THRESHOLD, 1],
        rootMargin: '0px 0px -10% 0px',
      },
    );

    observer.observe(wrapper);

    return () => {
      observer.disconnect();
      timeline.kill();
    };
  }, [metrics, reducedMotion]);

  if (reducedMotion) {
    return <span className={wordClassName}>{ENGINEER_WORD}</span>;
  }

  const strokeWidth = metrics ? Math.max(metrics.fontSize * 0.028, 1.6) : 1.6;
  const zapStrokeWidth = metrics ? Math.max(metrics.fontSize * 0.048, 2.6) : 2.6;

  return (
    <span ref={wrapperRef} className="relative inline-flex align-baseline overflow-visible">
      <span className="sr-only">{ENGINEER_WORD}</span>
      <span ref={measureRef} aria-hidden="true" className={`${wordClassName} invisible select-none`}>
        {ENGINEER_WORD}
      </span>
      <span ref={fallbackRef} aria-hidden="true" className={`${wordClassName} pointer-events-none absolute inset-0`}>
        {ENGINEER_WORD}
      </span>
      {metrics ? (
        <>
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${metrics.width} ${metrics.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#12161B" />
                <stop offset="20%" stopColor="#E7EBF0" />
                <stop offset="48%" stopColor="#FFFFFF" />
                <stop offset="72%" stopColor="#C8D0D8" />
                <stop offset="100%" stopColor="#12161B" />
              </linearGradient>
            </defs>

            <text
              ref={baseRef}
              x="50%"
              y="50%"
              dominantBaseline="central"
              textAnchor="middle"
              fill="#02060D"
              stroke="rgba(255, 255, 255, 0.03)"
              strokeWidth={0.6}
              style={{
                fontFamily: metrics.fontFamily,
                fontSize: metrics.fontSize,
                fontWeight: metrics.fontWeight,
                letterSpacing: metrics.letterSpacing,
              }}
            >
              {ENGINEER_WORD}
            </text>
            <text
              ref={strokeRef}
              x="50%"
              y="50%"
              dominantBaseline="central"
              textAnchor="middle"
              fill="transparent"
              stroke={`url(#${gradientId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                fontFamily: metrics.fontFamily,
                fontSize: metrics.fontSize,
                fontWeight: metrics.fontWeight,
                letterSpacing: metrics.letterSpacing,
                paintOrder: 'stroke fill',
              }}
            >
              {ENGINEER_WORD}
            </text>
            <text
              ref={zapRef}
              x="50%"
              y="50%"
              dominantBaseline="central"
              textAnchor="middle"
              fill="transparent"
              stroke="#FFFFFF"
              strokeWidth={zapStrokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                fontFamily: metrics.fontFamily,
                fontSize: metrics.fontSize,
                fontWeight: metrics.fontWeight,
                letterSpacing: metrics.letterSpacing,
                paintOrder: 'stroke fill',
              }}
            >
              {ENGINEER_WORD}
            </text>
            <text
              ref={fillRef}
              x="50%"
              y="50%"
              dominantBaseline="central"
              textAnchor="middle"
              fill="#F8FAFC"
              style={{
                fontFamily: metrics.fontFamily,
                fontSize: metrics.fontSize,
                fontWeight: metrics.fontWeight,
                letterSpacing: metrics.letterSpacing,
              }}
            >
              {ENGINEER_WORD}
            </text>
          </svg>
        </>
      ) : null}
    </span>
  );
};

const ArtistLiquidWord: React.FC<{
  word: string;
  reducedMotion: boolean;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
  wordClassName: string;
}> = ({ word, reducedMotion, mouseX, mouseY, wordClassName }) => {
  if (reducedMotion) {
    return <span className={wordClassName}>{word}</span>;
  }

  return (
    <span className="relative inline-block align-baseline">
      <span className={`${wordClassName} invisible select-none`}>{word}</span>
      <HeroLiquidShader
        text={word}
        mouseX={mouseX}
        mouseY={mouseY}
        fitToContainer
        variant="inline"
        interactionPadding={ARTIST_INTERACTION_PADDING}
        className="pointer-events-none absolute inset-0"
      />
    </span>
  );
};

export const LiquidStatement: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const gpu = useGpuTier();
  const reducedEffects = reducedMotion || gpu.tier === 'fallback';

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  return (
    <section
      ref={sectionRef}
      id="liquid-statement"
      className="relative w-full min-h-[58vh] scroll-mt-[8.5rem] min-[394px]:max-[430px]:min-h-[64vh] min-[768px]:max-[1024px]:min-h-[72vh] lg:min-h-[84vh] overflow-hidden border-y border-white/[0.05] bg-[#050505]"
      onPointerMove={reducedEffects ? undefined : handlePointerMove}
    >
      <ElectromagneticField mouseX={mouseX} mouseY={mouseY} />
      <div className="relative z-10 mx-auto flex w-full max-w-[1540px] flex-col gap-12 px-4 py-8 min-[394px]:max-[430px]:gap-14 min-[394px]:max-[430px]:px-5 min-[394px]:max-[430px]:py-10 min-[768px]:max-[1024px]:gap-16 min-[768px]:max-[1024px]:px-8 min-[768px]:max-[1024px]:py-16 md:px-6 md:py-16 lg:gap-20 lg:px-10 lg:py-20">
        <div className="relative flex w-full max-w-[1400px] justify-center overflow-visible">
          <div
            data-identity-stack
            className="mx-auto flex w-fit max-w-full flex-col items-center gap-y-2.5 overflow-visible text-center min-[768px]:gap-y-3.5"
          >
            <div className="flex flex-nowrap items-baseline justify-center gap-x-[0.6em] whitespace-nowrap overflow-visible">
              <p data-identity-zh className={IDENTITY_ZH_CLASS}>
                <span className="whitespace-nowrap">曾品翰</span>
              </p>
            </div>
            <p data-identity-en className={IDENTITY_EN_CLASS}>
              <span className="whitespace-nowrap inline-block pr-[0.04em]">TSENG PIN HAN</span>
            </p>
          </div>
        </div>

        <div data-statement-panel className="rounded-[2rem] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] px-5 py-8 shadow-[0_24px_90px_rgba(0,0,0,0.22)] backdrop-blur-[24px] min-[394px]:max-[430px]:px-6 min-[394px]:max-[430px]:py-9 min-[768px]:max-[1024px]:px-8 min-[768px]:max-[1024px]:py-10 lg:rounded-[2.25rem] lg:px-10 lg:py-12">
          <div className="mx-auto flex w-full max-w-[980px] flex-col items-center justify-center gap-4 text-center min-[768px]:max-[1024px]:gap-5 md:gap-6">
            <div className="space-y-3 min-[768px]:max-[1024px]:space-y-4 md:space-y-[1.125rem]">
              <div data-statement-title className="flex flex-wrap items-baseline justify-center gap-x-[0.18em] gap-y-2 text-center text-[clamp(2.3rem,5vw,4.9rem)] leading-[0.95] text-[#F5F5F7]">
                <span className="inline-flex overflow-visible pb-[0.14em] pr-[0.02em]">
                  <EngineerElectricWord reducedMotion={reducedEffects} wordClassName={WORD_CLASS} />
                </span>
                <span className="inline-flex overflow-visible pb-[0.14em] pr-[0.02em]">
                  <span className={WORD_CLASS}>與</span>
                </span>
                <span className="inline-flex overflow-visible pb-[0.14em] pr-[0.02em]">
                  <ArtistLiquidWord
                    word="藝術家"
                    reducedMotion={reducedEffects}
                    mouseX={mouseX}
                    mouseY={mouseY}
                    wordClassName={WORD_CLASS}
                  />
                </span>
              </div>
              <p data-statement-subtitle className={STATEMENT_SUBTITLE_CLASS}>
                {STATEMENT_EN_SUBTITLE}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
