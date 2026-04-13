import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useViewportMode } from '@/hooks/useViewportMode';

interface CinematicWorkHeroProps {
  title: string;
  imageSrc: string;
  videoSrc?: string;
  videoPoster?: string;
}

export const CinematicWorkHero: React.FC<CinematicWorkHeroProps> = ({ title, imageSrc, videoSrc, videoPoster }) => {
  const hasVideo = !!videoSrc;
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const viewportMode = useViewportMode();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });

  // Background Screenshot Fade In
  const screenshotOpacity = useTransform(smoothProgress, [0.1, 0.4, 1], [0, 1, 1]);

  // TARGET BOUNDING BOX PARAMETERS
  // Exact coordinates matching the literal preview monitor region in the background screenshot.
  const targetConfig = {
    compact: {
      top: '14.5%', left: '9%', width: '82%', height: '27%', radius: '14px', playhead: ['18%', '88%'], objectPosition: '61% center', lineTop: '40%', lineBottom: '21%'
    },
    phone: {
      top: '13.5%', left: '11%', width: '78%', height: '26%', radius: '12px', playhead: ['22%', '91%'], objectPosition: '59% center', lineTop: '36%', lineBottom: '19%'
    },
    tablet: {
      top: '10.5%', left: '28%', width: '42%', height: '18%', radius: '9px', playhead: ['25%', '95%'], objectPosition: '54% center', lineTop: '23%', lineBottom: '14%'
    },
    desktop: {
      top: '7.6%', left: '45.9%', width: '11.8%', height: '10.6%', radius: '6px', playhead: ['27.6%', '97%'], objectPosition: 'center', lineTop: '18.4%', lineBottom: '12.8%'
    },
  }[viewportMode];

  // Physical Layout Interpolation (width, height, top, left) - No transform: scale() used.
  const top = useTransform(smoothProgress, [0, 0.6, 1], ['0%', targetConfig.top, targetConfig.top]);
  const left = useTransform(smoothProgress, [0, 0.6, 1], ['0%', targetConfig.left, targetConfig.left]);
  const width = useTransform(smoothProgress, [0, 0.6, 1], ['100%', targetConfig.width, targetConfig.width]);
  const height = useTransform(smoothProgress, [0, 0.6, 1], ['100%', targetConfig.height, targetConfig.height]);
  const borderRadius = useTransform(smoothProgress, [0, 0.6, 1], ['0px', targetConfig.radius, targetConfig.radius]);

  // Playhead: moves across the timeline area of the screenshot
  // Start aligned with the source screenshot's original playhead, then move right.
  // Visible only after the screenshot fades in (progress > 0.4)
  const playheadSource = reducedMotion ? scrollYProgress : smoothProgress;
  const playheadLeft = useTransform(playheadSource, [0.45, 1], targetConfig.playhead);
  const playheadOpacity = useTransform(smoothProgress, [0.35, 0.5], [0, 1]);

  return (
    <section ref={containerRef} className="relative w-full h-[210vh] min-[394px]:max-[430px]:h-[225vh] min-[768px]:max-[1024px]:h-[250vh] lg:h-[300vh] bg-[#0A0A0C] z-10">
      {/* Sticky viewport bounds */}
      <div className="sticky top-0 w-full h-screen overflow-hidden flex bg-[#0A0A0C]">

        {/* Background Layer (Z-0): Exact literal screenshot UI (fades in) */}
        <motion.div
          style={{ opacity: screenshotOpacity }}
          className="absolute inset-0 z-0 pointer-events-none"
        >
          <img
            src="https://res.cloudinary.com/dt8x2v9id/image/upload/f_auto,q_auto/v1775492486/Screenshot_2026-04-07_at_12.21.10_AM_u9jm6b.png"
            alt="Source Post-Production Environment"
            className="w-full h-full object-cover"
            style={{ objectPosition: targetConfig.objectPosition }}
          />
        </motion.div>

        {/* Playhead overlay: white vertical line on the timeline */}
        <motion.div
          style={{ left: playheadLeft, opacity: playheadOpacity }}
          className="absolute inset-y-0 w-px z-[5] pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute left-0 w-px bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]" style={{ top: targetConfig.lineTop, bottom: targetConfig.lineBottom }} />
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-sm bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)]" style={{ top: targetConfig.lineTop }} />
        </motion.div>

        {/* Foreground Layer (Z-10): The old image migrating via CSS layout properties to the screenshot's monitor */}
        <motion.div
          style={{
            top,
            left,
            width,
            height,
            borderRadius,
            boxShadow: "0 10px 40px rgba(0,0,0,0.8)"
          }}
          className="absolute z-10 overflow-hidden"
        >
          {hasVideo ? (
            <>
              <video
                src={videoSrc}
                poster={videoPoster || imageSrc}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover motion-reduce:hidden"
              />
              <img
                src={videoPoster || imageSrc}
                alt={title}
                className="hidden motion-reduce:block w-full h-full object-cover"
              />
            </>
          ) : (
            <img
              src={imageSrc}
              alt={title}
              className="w-full h-full object-cover"
            />
          )}
        </motion.div>

      </div>
    </section>
  );
};
