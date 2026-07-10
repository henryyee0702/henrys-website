import React from 'react';

interface ThreeRectangleLoaderProps {
  ariaLabel?: string;
  className?: string;
}

export const ThreeRectangleLoader: React.FC<ThreeRectangleLoaderProps> = ({
  ariaLabel = 'Loading',
  className = '',
}) => (
  <>
    <style>{`
      .three-rectangle-loader {
        --loader-size: clamp(4.8rem, 10vw, 6.4rem);
        --rect-width: calc(var(--loader-size) * 0.22);
        --rect-height: calc(var(--loader-size) * 0.28);
        --top-center-x: calc((var(--loader-size) - var(--rect-width)) / 2);
        --top-center-y: calc(var(--loader-size) * 0.07);
        --bottom-left-x: calc(var(--loader-size) * 0.185);
        --bottom-left-y: calc(var(--loader-size) * 0.515);
        --bottom-right-x: calc(var(--loader-size) - var(--rect-width) - (var(--loader-size) * 0.185));
        --bottom-right-y: calc(var(--loader-size) * 0.515);
        position: relative;
        width: var(--loader-size);
        height: var(--loader-size);
        animation: three-rectangle-loader-breathe 2000ms ease-in-out infinite;
        will-change: transform;
      }

      .three-rectangle-loader::before {
        content: '';
        position: absolute;
        inset: -62%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.16), transparent 68%);
        pointer-events: none;
      }

      .three-rectangle-loader__shape {
        position: absolute;
        left: 0;
        top: 0;
        width: var(--rect-width);
        height: var(--rect-height);
        border: clamp(2.5px, 0.25vw, 4px) solid rgba(255, 255, 255, 0.92);
        background: rgba(255, 255, 255, 0.02);
        box-shadow: 0 0 14px rgba(255, 255, 255, 0.12), 0 0 28px rgba(255, 255, 255, 0.05);
        animation:
          three-rectangle-loader-path 4000ms cubic-bezier(1, 0, 0, 1) infinite,
          three-rectangle-loader-blink 1000ms ease-in-out infinite;
        will-change: transform, filter, opacity;
      }

      .three-rectangle-loader__shape:nth-child(1) { border-color: rgba(255, 255, 255, 0.98); }
      .three-rectangle-loader__shape:nth-child(2) {
        border-color: rgba(255, 255, 255, 0.88);
        animation-delay: -1333ms, -75ms;
      }
      .three-rectangle-loader__shape:nth-child(3) {
        border-color: rgba(255, 255, 255, 0.78);
        animation-delay: -2666ms, -150ms;
      }

      @keyframes three-rectangle-loader-path {
        0%, 100% { transform: translate3d(var(--top-center-x), var(--top-center-y), 0); }
        33.333% { transform: translate3d(var(--bottom-right-x), var(--bottom-right-y), 0); }
        66.666% { transform: translate3d(var(--bottom-left-x), var(--bottom-left-y), 0); }
      }

      @keyframes three-rectangle-loader-blink {
        0%, 100% { filter: brightness(1); opacity: 0.95; }
        50% { filter: brightness(0.72); opacity: 0.82; }
      }

      @keyframes three-rectangle-loader-breathe {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(0.7); }
      }

      @media (prefers-reduced-motion: reduce) {
        .three-rectangle-loader { animation: none; }
        .three-rectangle-loader__shape {
          animation: three-rectangle-loader-reduced 1600ms ease-in-out infinite;
          transform: translate3d(var(--top-center-x), var(--top-center-y), 0);
        }
        .three-rectangle-loader__shape:nth-child(2) {
          animation-delay: -240ms;
          transform: translate3d(var(--bottom-right-x), var(--bottom-right-y), 0);
        }
        .three-rectangle-loader__shape:nth-child(3) {
          animation-delay: -480ms;
          transform: translate3d(var(--bottom-left-x), var(--bottom-left-y), 0);
        }
      }

      @keyframes three-rectangle-loader-reduced {
        0%, 100% { opacity: 0.48; }
        50% { opacity: 1; }
      }
    `}</style>
    <div
      className={`three-rectangle-loader ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      <span className="three-rectangle-loader__shape" />
      <span className="three-rectangle-loader__shape" />
      <span className="three-rectangle-loader__shape" />
    </div>
  </>
);
