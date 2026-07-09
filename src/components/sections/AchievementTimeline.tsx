import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HonorArtifactPreview } from '@/components/webgl/HonorArtifactPreview';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { achievements, type Achievement } from '@/content/achievements';

const ENGLISH_WORD_START_COLOR = 'rgb(114, 119, 128)';
const ENGLISH_WORD_FINAL_COLOR = 'rgb(245, 245, 247)';
const ENGLISH_WORD_START_OPACITY = 0.76;
const ENGLISH_WORD_STAGGER = 0.35;
const ENGLISH_WORD_DURATION = 0.24;
const ENGLISH_REVEAL_HOLD_RATIO = 0.16;
const ENGLISH_REVEAL_HOLD_MULTIPLIER = 3;
const LAST_ACHIEVEMENT_FULBRIGHT_VISIBILITY_BUFFER_RATIO = 0.5;
const EXTENDED_ENGLISH_REVEAL_HOLD_RATIO = ENGLISH_REVEAL_HOLD_RATIO * ENGLISH_REVEAL_HOLD_MULTIPLIER;
const DEFAULT_ACHIEVEMENT_STEP_HEIGHT = `${100 + (ENGLISH_REVEAL_HOLD_MULTIPLIER - 1) * ENGLISH_REVEAL_HOLD_RATIO * 100}svh`;
const LAST_ACHIEVEMENT_STEP_HEIGHT = `${132 + (ENGLISH_REVEAL_HOLD_MULTIPLIER - 1) * ENGLISH_REVEAL_HOLD_RATIO * 100 + LAST_ACHIEVEMENT_FULBRIGHT_VISIBILITY_BUFFER_RATIO * 100}svh`;
const formatYear = (year: number) => year.toString().padStart(4, '0');

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const RollingYearDisplay: React.FC<{ year: number }> = ({ year }) => {
  const digitRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const previousYearRef = useRef(year);

  useIsomorphicLayoutEffect(() => {
    const previousYear = previousYearRef.current;
    const previousDigits = formatYear(previousYear);
    const nextDigits = formatYear(year);
    const direction = year >= previousYear ? 'up' : 'down';

    digitRefs.current.forEach((digit, index) => {
      if (!digit) return;

      gsap.killTweensOf(digit);

      if (previousDigits[index] === nextDigits[index]) {
        digit.textContent = nextDigits[index];
        gsap.set(digit, { yPercent: 0, autoAlpha: 1 });
        return;
      }

      const exitY = direction === 'up' ? -115 : 115;
      const enterY = direction === 'up' ? 115 : -115;
      const delay = (nextDigits.length - 1 - index) * 0.06;

      gsap.to(digit, {
        yPercent: exitY,
        autoAlpha: 0,
        duration: 0.18,
        delay,
        ease: 'power2.in',
        overwrite: 'auto',
        onComplete: () => {
          digit.textContent = nextDigits[index];
          gsap.set(digit, { yPercent: enterY, autoAlpha: 0 });
          gsap.to(digit, {
            yPercent: 0,
            autoAlpha: 1,
            duration: 0.28,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        },
      });
    });

    previousYearRef.current = year;

    return () => {
      digitRefs.current.forEach((digit) => {
        if (digit) gsap.killTweensOf(digit);
      });
    };
  }, [year]);

  const yearDigits = formatYear(year).split('');

  return (
    <div aria-label={String(year)} className="flex w-[4.5ch] whitespace-nowrap text-[clamp(4.65rem,14vw,11.2rem)] font-light leading-[0.88] tracking-[-0.075em] text-white tabular-nums" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
      {yearDigits.map((digit, index) => (
        <span key={`${year}-${index}`} aria-hidden="true" className="relative inline-flex h-[0.88em] w-[1.08ch] overflow-hidden">
          <span
            ref={(element) => {
              digitRefs.current[index] = element;
            }}
            className="block will-change-transform"
          >
            {digit}
          </span>
        </span>
      ))}
    </div>
  );
};

const LineBrokenCopy: React.FC<{
  ariaLabel: string;
  as?: React.ElementType;
  lines: {
    base: string[];
    lg?: string[];
  };
  className: string;
}> = ({ ariaLabel, as: Tag = 'div', lines, className }) => {
  const renderLines = (items: string[]) =>
    items.map((line, index) => (
      <span key={`${line}-${index}`} className="block whitespace-nowrap">
        {line}
      </span>
    ));

  return (
    <Tag aria-label={ariaLabel} className={className}>
      {lines.lg ? (
        <>
          <span className="block lg:hidden">{renderLines(lines.base)}</span>
          <span className="hidden lg:block">{renderLines(lines.lg)}</span>
        </>
      ) : (
        <span className="block">{renderLines(lines.base)}</span>
      )}
    </Tag>
  );
};

const WordBrokenCopy: React.FC<{
  ariaLabel: string;
  lines: {
    base: string[];
    lg?: string[];
  };
  className: string;
}> = ({ ariaLabel, lines, className }) => {
  const renderLines = (items: string[], viewportKey: string) =>
    items.map((line, lineIndex) => {
      const words = line.split(' ').filter(Boolean);

      return (
        <span key={`${viewportKey}-${line}-${lineIndex}`} className="block whitespace-nowrap">
          {words.map((word, wordIndex) => (
            <React.Fragment key={`${viewportKey}-${lineIndex}-${word}-${wordIndex}`}>
              <span data-honor-english-word className="inline-block will-change-[color,opacity,transform,filter]">
                {word}
              </span>
              {wordIndex < words.length - 1 ? ' ' : null}
            </React.Fragment>
          ))}
        </span>
      );
    });

  return (
    <p aria-label={ariaLabel} className={className}>
      {lines.lg ? (
        <>
          <span className="block lg:hidden">{renderLines(lines.base, 'base')}</span>
          <span className="hidden lg:block">{renderLines(lines.lg, 'lg')}</span>
        </>
      ) : (
        <span className="block">{renderLines(lines.base, 'base')}</span>
      )}
    </p>
  );
};

const countEnglishWordsForViewport = (lines: Achievement['titleEnLines'], isLargeViewport: boolean) => {
  const sourceLines = isLargeViewport && lines.lg ? lines.lg : lines.base;
  return sourceLines.reduce((count, line) => count + line.split(' ').filter(Boolean).length, 0);
};

const HonorCopyBlock: React.FC<{
  item: Achievement;
  headingTag: React.ElementType;
  headingClassName: string;
  englishClassName: string;
}> = ({ item, headingTag, headingClassName, englishClassName }) => {
  return (
    <div className="space-y-4 min-[768px]:space-y-5">
      <LineBrokenCopy ariaLabel={item.titleZh} as={headingTag} lines={item.titleZhLines} className={headingClassName} />
      <WordBrokenCopy ariaLabel={item.titleEn} lines={item.titleEnLines} className={englishClassName} />
    </div>
  );
};

const StaticArtifactCard: React.FC<{ item: Achievement }> = ({ item }) => {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-white/[0.02] p-5 md:rounded-[1.75rem] md:p-6">
      <div className="text-[11px] uppercase tracking-[0.28em] text-[#8A8D96]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
        {item.year}
      </div>

      <div className="mt-3 max-w-[min(100%,26rem)]">
        <HonorCopyBlock
          item={item}
          headingTag="h4"
          headingClassName="text-[1.55rem] font-semibold leading-[0.98] tracking-[-0.05em] text-white md:text-[2rem]"
          englishClassName="text-[0.78rem] font-medium uppercase leading-[1.5] tracking-[0.16em] text-[#727881] md:text-[0.82rem]"
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-[1.2rem] border border-white/[0.06] bg-[#090909] p-4 md:p-6">
        <img src={item.artifact.frontTextureUrl} alt={item.artifact.staticImageAlt} className="aspect-[16/10] w-full object-contain" loading="lazy" />
      </div>
    </div>
  );
};

export const AchievementTimeline: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const artifactShellRef = useRef<HTMLDivElement>(null);
  const sectionGlowRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  const activeItem = achievements[activeIndex];

  const setActiveAchievement = (index: number) => {
    if (index < 0 || index >= achievements.length) return;
    if (activeIndexRef.current === index) return;

    activeIndexRef.current = index;
    setActiveIndex(index);
  };

  useEffect(() => {
    if (reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const steps = stepRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!steps.length) return;

      steps.forEach((step, index) => {
        ScrollTrigger.create({
          trigger: step,
          start: 'top center',
          end: 'bottom center',
          onEnter: () => setActiveAchievement(index),
          onEnterBack: () => setActiveAchievement(index),
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion) return;

    const copy = copyRef.current;
    const artifactShell = artifactShellRef.current;
    const sectionGlow = sectionGlowRef.current;
    const activeStep = stepRefs.current[activeIndex];
    const nextStep = stepRefs.current[activeIndex + 1];

    if (!copy || !artifactShell || !sectionGlow || !activeStep) return;

    const englishWords = Array.from(copy.querySelectorAll<HTMLElement>('[data-honor-english-word]')).filter(
      (word) => window.getComputedStyle(word).display !== 'none',
    );
    const isLargeViewport = window.matchMedia('(min-width: 1024px)').matches;
    const referenceWordCount = countEnglishWordsForViewport(achievements[2].titleEnLines, isLargeViewport);
    const actualTimelineDuration = Math.max(0, (englishWords.length - 1) * ENGLISH_WORD_STAGGER) + ENGLISH_WORD_DURATION;
    const referenceTimelineDuration = Math.max(0, (referenceWordCount - 1) * ENGLISH_WORD_STAGGER) + ENGLISH_WORD_DURATION;
    const extraTimelinePadding = Math.max(0, referenceTimelineDuration - actualTimelineDuration);
    const isLastAchievement = activeIndex === achievements.length - 1;
    const getAbsoluteTop = (element: Element) => element.getBoundingClientRect().top + window.scrollY;
    const getRevealStart = () => getAbsoluteTop(activeStep) - window.innerHeight * 0.5;
    const getRevealHoldDistance = () => window.innerHeight * EXTENDED_ENGLISH_REVEAL_HOLD_RATIO;
    const getRevealEnd = () => {
      const defaultEnd = getAbsoluteTop(activeStep) + activeStep.getBoundingClientRect().height - window.innerHeight * 0.5;
      let boundaryEnd = defaultEnd;

      if (nextStep) {
        const nextStepTrigger = getAbsoluteTop(nextStep) - window.innerHeight * 0.5;
        boundaryEnd = Math.min(boundaryEnd, nextStepTrigger);
      }

      if (isLastAchievement) {
        const fulbrightGalaxy = document.getElementById('fulbright-galaxy');
        if (fulbrightGalaxy) {
          const fulbrightFirstVisiblePoint = getAbsoluteTop(fulbrightGalaxy) - window.innerHeight;
          const fulbrightBufferedReleasePoint = fulbrightFirstVisiblePoint - window.innerHeight * LAST_ACHIEVEMENT_FULBRIGHT_VISIBILITY_BUFFER_RATIO;
          boundaryEnd = Math.min(boundaryEnd, fulbrightBufferedReleasePoint);
        }
      }

      return Math.max(getRevealStart() + 1, boundaryEnd - getRevealHoldDistance());
    };

    const timeline = gsap.timeline({ defaults: { overwrite: 'auto' } });
    const englishRevealTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: activeStep,
        start: getRevealStart,
        end: getRevealEnd,
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    gsap.set(englishWords, {
      color: ENGLISH_WORD_START_COLOR,
      opacity: ENGLISH_WORD_START_OPACITY,
      yPercent: 8,
      scale: 0.985,
      rotateX: -8,
      filter: 'blur(1.6px)',
      transformOrigin: '50% 100%',
    });

    timeline
      .fromTo(copy, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.34, ease: 'power3.out' }, 0)
      .fromTo(artifactShell, { y: 18, autoAlpha: 0, scale: 0.985 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.48, ease: 'power3.out' }, 0.05);

    englishWords.forEach((word, index) => {
      englishRevealTimeline.to(
        word,
        {
          color: ENGLISH_WORD_FINAL_COLOR,
          opacity: 1,
          yPercent: 0,
          scale: 1,
          rotateX: 0,
          filter: 'blur(0px)',
          duration: ENGLISH_WORD_DURATION,
          ease: 'none',
        },
        index * ENGLISH_WORD_STAGGER,
      );
    });

    if (extraTimelinePadding > 0) {
      englishRevealTimeline.to({}, { duration: extraTimelinePadding, ease: 'none' });
    }

    gsap.set(sectionGlow, { backgroundColor: activeItem.artifact.accentColor });

    return () => {
      englishRevealTimeline.scrollTrigger?.kill();
      englishRevealTimeline.kill();
      timeline.kill();
    };
  }, [activeIndex, reducedMotion]);

  const goToSlide = (index: number) => {
    const target = stepRefs.current[index];
    if (!target) return;

    setActiveAchievement(index);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (reducedMotion) {
    return (
      <section id="honors" className="mx-auto max-w-6xl px-5 py-20 md:px-6 md:py-24">
        <div className="space-y-6">
          {achievements.map((item) => (
            <div key={`${item.year}-${item.titleZh}`} id={`honor-${item.year}`}>
              <StaticArtifactCard item={item} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="honors" ref={sectionRef} className="relative bg-[#050505]">
      <div className="sticky top-0 z-10 h-[100svh] overflow-hidden border-y border-white/[0.05] bg-[#050505]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_20%,rgba(255,255,255,0)_80%,rgba(255,255,255,0.02)_100%)]" />
        <div
          ref={sectionGlowRef}
          className={`absolute left-[6%] top-[10%] rounded-full ${coarsePointer ? 'h-[22rem] w-[22rem] opacity-[0.08] blur-[72px]' : 'h-[36rem] w-[36rem] opacity-[0.11] blur-[160px]'}`}
          style={{ backgroundColor: activeItem.artifact.accentColor }}
        />
        {activeIndex === achievements.length - 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[22svh] bg-[linear-gradient(180deg,rgba(5,5,5,0)_0%,rgba(5,5,5,0.88)_45%,rgba(5,5,5,1)_100%)]" />
        ) : null}

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[1480px] flex-col gap-5 px-5 py-6 min-[768px]:gap-6 min-[768px]:px-8 min-[768px]:py-8 min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,4.7fr)_minmax(0,5.3fr)] min-[1180px]:items-start min-[1180px]:gap-10 min-[1180px]:px-12 min-[1180px]:py-10 xl:px-14 xl:py-12">
          <div className="flex shrink-0 flex-col justify-start pt-[4.85rem] min-[768px]:pt-[5.5rem] min-[1180px]:pt-[3.5rem] xl:pt-[4rem]">
            <div ref={copyRef} className="space-y-6 min-[768px]:space-y-7">
              <RollingYearDisplay year={activeItem.year} />
              <div className="max-w-[min(100%,41rem)] min-[1180px]:max-w-[min(100%,39rem)]">
                <HonorCopyBlock
                  item={activeItem}
                  headingTag="h3"
                  headingClassName="text-[clamp(2.05rem,5.8vw,4rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-white"
                  englishClassName="max-w-[min(100%,34rem)] text-[clamp(0.72rem,1.14vw,0.98rem)] font-medium uppercase leading-[1.5] tracking-[0.12em] text-[#727881] min-[768px]:tracking-[0.14em]"
                />
              </div>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden min-[1180px]:flex-none min-[1180px]:overflow-visible min-[1180px]:pl-4">
            <div
              ref={artifactShellRef}
              className="relative h-full min-h-[12rem] w-full sm:min-h-[14rem] min-[1180px]:ml-auto min-[1180px]:h-[min(72svh,48rem)] min-[1180px]:max-w-[44rem] min-[1180px]:min-h-[30rem] min-[1180px]:self-center"
            >
              <HonorArtifactPreview artifact={activeItem.artifact} />
            </div>
          </div>
        </div>

        <nav className="absolute bottom-6 left-4 right-4 z-30 flex items-center gap-3 md:bottom-auto md:left-auto md:right-10 md:top-1/2 md:-translate-y-1/2 md:flex-col md:gap-4">
          <div className="flex items-center gap-2.5 md:flex-col md:gap-3">
            {achievements.map((item, index) => (
              <button
                key={`${item.year}-${index}`}
                type="button"
                onClick={() => goToSlide(index)}
                className={`group flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] transition-colors duration-300 ${activeIndex === index ? 'text-white' : 'text-[#5F6169] hover:text-white'}`}
                aria-label={`Go to honor ${item.year}: ${item.titleZh}`}
                aria-pressed={activeIndex === index}
              >
                <span className={`h-2.5 w-2.5 rounded-full border transition-all duration-300 ${activeIndex === index ? 'scale-110 border-white bg-white shadow-[0_0_16px_rgba(255,255,255,0.22)]' : 'border-white/[0.2] bg-white/[0.08]'}`} />
                <span>{item.year}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      <div className="-mt-[100svh]" aria-hidden="true">
        {achievements.map((item, index) => (
          <div
            key={`${item.year}-step-${index}`}
            id={`honor-${item.year}`}
            ref={(el) => { stepRefs.current[index] = el; }}
            className="h-[100svh]"
            style={{ height: index === achievements.length - 1 ? LAST_ACHIEVEMENT_STEP_HEIGHT : DEFAULT_ACHIEVEMENT_STEP_HEIGHT }}
          />
        ))}
      </div>
    </section>
  );
};
