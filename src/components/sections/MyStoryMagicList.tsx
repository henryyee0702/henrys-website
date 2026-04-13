import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ArrowUpRight } from 'lucide-react';

type MyStoryMagicItem = {
  href: string;
  title: string;
  excerpt?: string;
  coverImage?: string;
  dayLabel: string;
  dateLabel: string;
};

interface MyStoryMagicListProps {
  items: MyStoryMagicItem[];
  variant?: 'home' | 'series';
}

export const MyStoryMagicList: React.FC<MyStoryMagicListProps> = ({ items, variant = 'home' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const magicRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndexRef = useRef(0);
  const pointerFineRef = useRef(true);
  const reducedMotionRef = useRef(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const magic = magicRef.current;
    const targets = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    if (!container || !magic || !targets.length) return;

    const pointerQuery = window.matchMedia('(pointer: fine)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const syncEnvironment = () => {
      pointerFineRef.current = pointerQuery.matches;
      reducedMotionRef.current = motionQuery.matches;
      gsap.set(magic, { autoAlpha: pointerFineRef.current ? 1 : 0 });
    };

    const positionMagic = (index: number, animate = true, forceVisible = false) => {
      const target = itemRefs.current[index];
      if (!target) return;

      activeIndexRef.current = index;

      const visible = pointerFineRef.current || forceVisible;
      const left = target.offsetLeft;
      const top = target.offsetTop;
      const width = target.offsetWidth;
      const height = target.offsetHeight;

      if (animate && !reducedMotionRef.current) {
        gsap.to(magic, {
          left,
          top,
          width,
          height,
          autoAlpha: visible ? 1 : 0,
          duration: 0.42,
          ease: 'power3.out',
          overwrite: 'auto',
        });
        return;
      }

      gsap.set(magic, {
        left,
        top,
        width,
        height,
        autoAlpha: visible ? 1 : 0,
      });
    };

    syncEnvironment();
    positionMagic(0, false);

    const resizeObserver = new ResizeObserver(() => {
      positionMagic(activeIndexRef.current, false);
    });

    resizeObserver.observe(container);
    targets.forEach((target) => resizeObserver.observe(target));

    const handleMediaChange = () => {
      syncEnvironment();
      positionMagic(activeIndexRef.current, false);
    };

    pointerQuery.addEventListener('change', handleMediaChange);
    motionQuery.addEventListener('change', handleMediaChange);

    return () => {
      resizeObserver.disconnect();
      pointerQuery.removeEventListener('change', handleMediaChange);
      motionQuery.removeEventListener('change', handleMediaChange);
      gsap.killTweensOf(magic);
    };
  }, [items.length, variant]);

  const moveTo = (index: number, forceVisible = false) => {
    const magic = magicRef.current;
    const target = itemRefs.current[index];
    if (!magic || !target) return;

    activeIndexRef.current = index;

    const visible = pointerFineRef.current || forceVisible;
    const left = target.offsetLeft;
    const top = target.offsetTop;
    const width = target.offsetWidth;
    const height = target.offsetHeight;

    if (reducedMotionRef.current) {
      gsap.set(magic, { left, top, width, height, autoAlpha: visible ? 1 : 0 });
      return;
    }

    gsap.to(magic, {
      left,
      top,
      width,
      height,
      autoAlpha: visible ? 1 : 0,
      duration: 0.42,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  };

  const baseItemClass = variant === 'home'
    ? 'rounded-[1.7rem] px-3 py-3 md:px-4 md:py-4'
    : 'rounded-[1.45rem] px-3 py-3 md:px-4 md:py-4';
  const monochromeBaseFilter = 'grayscale(1) contrast(1.12) brightness(0.82)';
  const activeMediaFilter = 'grayscale(0) saturate(1.08) contrast(1.04) brightness(0.98)';
  const activeMediaIndex = focusedIndex ?? hoveredIndex;

  return (
    <div
      ref={containerRef}
      className="relative isolate"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <div
        ref={magicRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-0 overflow-hidden rounded-[1.8rem] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] shadow-[0_24px_90px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl opacity-0"
      >
        <div className="absolute inset-y-[14%] left-0 w-[3px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.06))]" />
        <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent)]" />
      </div>

      <div className={variant === 'home' ? 'space-y-3 md:space-y-4' : 'space-y-2.5 md:space-y-3'}>
        {items.map((item, index) => {
          const isVisuallyActive = activeMediaIndex === index;

          return (
            <a
              key={item.href}
              ref={(el) => { itemRefs.current[index] = el; }}
              href={item.href}
              style={{ contentVisibility: 'auto', containIntrinsicSize: variant === 'home' ? '420px' : '260px' }}
              onMouseEnter={() => {
                setHoveredIndex(index);
                moveTo(index);
              }}
              onMouseLeave={() => {
                setHoveredIndex((current) => (current === index ? null : current));
              }}
              onFocus={() => {
                setFocusedIndex(index);
                moveTo(index, true);
              }}
              onBlur={() => {
                setFocusedIndex((current) => (current === index ? null : current));
                if (!pointerFineRef.current && magicRef.current) {
                  gsap.to(magicRef.current, { autoAlpha: 0, duration: 0.2, overwrite: 'auto' });
                }
              }}
              className={`group relative z-10 block border border-transparent transition-colors duration-300 focus:outline-none ${baseItemClass}`}
            >
              {variant === 'home' ? (
                <article className="flex flex-col md:flex-row gap-4 md:gap-8">
                  {item.coverImage && (
                    <div className="relative w-full md:w-72 flex-shrink-0 overflow-hidden rounded-[1.15rem] aspect-video bg-[#0E0E10] border border-white/[0.05]">
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        style={{ filter: isVisuallyActive ? activeMediaFilter : monochromeBaseFilter }}
                        className={`w-full h-full object-cover transition-[transform,filter] duration-700 ease-out ${isVisuallyActive ? 'scale-[1.03]' : 'scale-100'}`}
                        loading={index < 2 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                      <div className={`pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),transparent_28%,transparent_72%,rgba(0,0,0,0.32))] transition-opacity duration-500 ${isVisuallyActive ? 'opacity-18' : 'opacity-70'}`} />
                      <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.18),transparent_28%)] mix-blend-screen transition-opacity duration-500 ${isVisuallyActive ? 'opacity-10' : 'opacity-35'}`} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
                      <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#8D9098] tabular-nums">{item.dayLabel}</span>
                      <span className="text-[11px] text-[#5A5C65] tabular-nums">{item.dateLabel}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-base md:text-[1.18rem] font-medium text-[#F0F0F3] mb-2 leading-snug group-hover:text-white group-focus:text-white transition-colors duration-300 max-w-xl">
                        {item.title}
                      </h3>
                      <ArrowUpRight size={15} className={`mt-1 shrink-0 transition-all duration-300 ${isVisuallyActive ? 'text-white translate-x-0.5' : 'text-[#686A72]'}`} />
                    </div>
                    {item.excerpt && (
                      <p className="text-[14px] md:text-[15px] text-[#9A9CA5] font-light leading-[1.9] line-clamp-2 md:line-clamp-3 max-w-2xl">
                        {item.excerpt}
                      </p>
                    )}
                  </div>
                </article>
              ) : (
                <article className="grid gap-3 md:grid-cols-[6rem_7rem_minmax(0,1fr)_7rem] md:items-center">
                  <div className="flex items-center gap-2 text-xs text-[#6C6E76] tracking-wide tabular-nums font-medium">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[#9699A1]">{item.dayLabel}</span>
                  </div>
                  <time className="text-xs text-[#5C5E67] tracking-wide tabular-nums">{item.dateLabel}</time>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="text-base md:text-[1.06rem] font-medium text-[#E7E8EC] group-hover:text-white group-focus:text-white transition-colors tracking-tight leading-snug">
                        {item.title}
                      </h4>
                      <ArrowUpRight size={14} className={`mt-1 shrink-0 transition-all duration-300 ${isVisuallyActive ? 'text-white translate-x-0.5' : 'text-[#676972]'}`} />
                    </div>
                    {item.excerpt && (
                      <p className="mt-1.5 text-sm text-[#8A8C95] font-light leading-relaxed line-clamp-2">
                        {item.excerpt}
                      </p>
                    )}
                  </div>
                  {item.coverImage ? (
                    <div className="relative hidden md:block overflow-hidden rounded-xl aspect-[4/3] bg-[#0E0E10] border border-white/[0.05]">
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        style={{ filter: isVisuallyActive ? activeMediaFilter : monochromeBaseFilter }}
                        className={`w-full h-full object-cover transition-[transform,filter] duration-700 ease-out ${isVisuallyActive ? 'scale-[1.03]' : 'scale-100'}`}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                      <div className={`pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_30%,transparent_72%,rgba(0,0,0,0.28))] transition-opacity duration-500 ${isVisuallyActive ? 'opacity-18' : 'opacity-75'}`} />
                    </div>
                  ) : (
                    <div className="hidden md:block" />
                  )}
                </article>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
};