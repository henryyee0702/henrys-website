import React from 'react';

const VIDEO_SRC =
  'https://res.cloudinary.com/dt8x2v9id/video/upload/f_auto,q_auto:good,vc_auto/v1775506700/%E5%80%8B%E4%BA%BA%E7%B6%B2%E7%AB%99%E5%BD%B1%E7%89%87_dj21gl.mov';
const POSTER_SRC =
  'https://res.cloudinary.com/dt8x2v9id/image/upload/f_auto,q_auto/v1775536380/frame-8-3_vuvv1l.png';

export const HomepageShowreel: React.FC = () => {
  return (
    <section className="w-full bg-[#050505]" aria-label="Featured showreel">
      <div className="relative h-screen min-h-[560px] overflow-hidden bg-black">
        <div className="absolute inset-0 motion-reduce:hidden">
          <video
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="absolute inset-0 hidden motion-reduce:block">
          <img
            src={POSTER_SRC}
            alt="The Melting Time featured frame"
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  );
};
