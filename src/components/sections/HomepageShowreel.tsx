import React from 'react';

const CLOUDINARY_SHOWREEL_ID = 'v1775506700/%E5%80%8B%E4%BA%BA%E7%B6%B2%E7%AB%99%E5%BD%B1%E7%89%87_dj21gl.mp4';

export const HOMEPAGE_SHOWREEL_VIDEO_DESKTOP_SRC =
  `https://res.cloudinary.com/dt8x2v9id/video/upload/f_mp4,q_auto:good,vc_h264,w_1920,h_1080,c_fill/${CLOUDINARY_SHOWREEL_ID}`;
export const HOMEPAGE_SHOWREEL_VIDEO_MOBILE_SRC =
  `https://res.cloudinary.com/dt8x2v9id/video/upload/f_mp4,q_auto:good,vc_h264,w_960,h_540,c_fill/${CLOUDINARY_SHOWREEL_ID}`;
export const HOMEPAGE_SHOWREEL_POSTER_SRC =
  'https://res.cloudinary.com/dt8x2v9id/image/upload/f_auto,q_auto,w_1600,h_900,c_fill/v1775536380/frame-8-3_vuvv1l.png';

export const HomepageShowreel: React.FC = () => {
  return (
    <section className="w-full bg-[#050505]" aria-label="Featured showreel">
      <style>{`
        [data-homepage-showreel-layout] {
          --showreel-frame-max-width: calc(100svh * 16 / 9);
        }

        @media (max-aspect-ratio: 16 / 9) {
          [data-homepage-showreel-layout] {
            height: auto;
            min-height: 0;
          }
        }

        @media (max-width: 767px) and (max-aspect-ratio: 16 / 9) {
          [data-homepage-showreel-layout] {
            --showreel-frame-max-width: 100vw;
            flex-direction: column;
            justify-content: flex-start;
            padding-block: clamp(8.25rem, 16svh, 9.25rem) clamp(0.5rem, 1.6svh, 1rem);
          }
        }
      `}</style>

      <div
        data-homepage-showreel-layout
        className="relative flex h-[100svh] min-h-[560px] w-full items-center justify-center overflow-hidden bg-black md:h-screen"
      >
        <div data-homepage-showreel-frame className="relative aspect-video w-full shrink-0 max-w-[var(--showreel-frame-max-width)] overflow-hidden bg-black motion-reduce:hidden">
          <video
            data-homepage-showreel-video
            poster={HOMEPAGE_SHOWREEL_POSTER_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="block h-full w-full object-cover object-center"
          >
            <source media="(max-width: 767px)" src={HOMEPAGE_SHOWREEL_VIDEO_MOBILE_SRC} type="video/mp4" />
            <source src={HOMEPAGE_SHOWREEL_VIDEO_DESKTOP_SRC} type="video/mp4" />
          </video>
        </div>

        <div
          data-homepage-showreel-reduced-frame
          className="relative hidden aspect-video w-full shrink-0 max-w-[var(--showreel-frame-max-width)] overflow-hidden bg-black motion-reduce:block"
        >
          <img
            src={HOMEPAGE_SHOWREEL_POSTER_SRC}
            alt="The Melting Time featured frame"
            loading="eager"
            decoding="async"
            className="block h-full w-full object-cover object-center"
          />
        </div>
      </div>
    </section>
  );
};
