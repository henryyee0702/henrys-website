import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export const HonorsHero: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const frame = frameRef.current;
      const shade = shadeRef.current;
      const title = titleRef.current;

      if (!frame || !shade || !title) return;

      const media = gsap.matchMedia();

      const createExitTimeline = ({
        start,
        frameYPercent,
        frameScale,
        shadeOpacity,
      }: {
        start: string;
        frameYPercent: number;
        frameScale: number;
        shadeOpacity: number;
      }) => {
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start,
            end: 'bottom top',
            scrub: 0.35,
            invalidateOnRefresh: true,
          },
        });

        timeline
          .to(frame, { yPercent: frameYPercent, scale: frameScale, ease: 'none', duration: 1 }, 0)
          .to(shade, { autoAlpha: shadeOpacity, ease: 'none', duration: 1 }, 0)
          .to(
            title,
            {
              xPercent: -132,
              yPercent: -4,
              autoAlpha: 0,
              ease: 'none',
              duration: 0.76,
            },
            0,
          );

        return () => {
          timeline.scrollTrigger?.kill();
          timeline.kill();
        };
      };

      media.add('(orientation: landscape)', () => createExitTimeline({
        start: 'top 10%',
        frameYPercent: 12,
        frameScale: 0.968,
        shadeOpacity: 0.48,
      }));

      media.add('(orientation: portrait)', () => createExitTimeline({
        start: 'top 14%',
        frameYPercent: 7,
        frameScale: 0.975,
        shadeOpacity: 0.44,
      }));

      return () => {
        media.revert();
      };
    }, sectionRef);

    return () => {
      ctx.revert();
    };
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} id="honors-hero" className="relative bg-[#050505]">
      <div ref={frameRef} className="relative isolate min-h-[34svh] overflow-hidden will-change-transform min-[394px]:max-[430px]:min-h-[36svh] min-[768px]:max-[1024px]:min-h-[42svh] lg:min-h-[52svh]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_24%,rgba(255,239,204,0.1),transparent_28%),radial-gradient(circle_at_16%_92%,rgba(30,58,138,0.08),transparent_30%),radial-gradient(circle_at_52%_100%,rgba(127,29,29,0.07),transparent_30%),linear-gradient(180deg,#070707_0%,#050505_100%)]" />
        <div ref={shadeRef} className="pointer-events-none absolute inset-0 bg-black opacity-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: 'min(12vw, 7rem) 100%' }} />

        <div className="relative z-10 mx-auto flex min-h-[34svh] w-full max-w-[1520px] items-end px-4 pb-3 pt-3 min-[394px]:max-[430px]:min-h-[36svh] min-[394px]:max-[430px]:px-5 min-[768px]:max-[1024px]:min-h-[42svh] min-[768px]:max-[1024px]:px-8 md:px-8 md:pb-4 md:pt-4 lg:min-h-[52svh] xl:px-12">
          <h2
            ref={titleRef}
            className="block ml-[-0.085em] whitespace-nowrap text-[clamp(5.8rem,33vw,28rem)] leading-[0.9] tracking-[-0.05em] text-white will-change-[transform,opacity]"
            style={{ fontFamily: '"Anton", sans-serif' }}
          >
            HONORS
          </h2>
        </div>
      </div>
    </section>
  );
};
