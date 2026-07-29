import React from 'react';
import '@/styles/three-rectangle-loader.css';

interface ThreeRectangleLoaderProps {
  ariaLabel?: string;
  className?: string;
}

export const ThreeRectangleLoader: React.FC<ThreeRectangleLoaderProps> = ({
  ariaLabel = 'Loading',
  className = '',
}) => (
  <div
    className={`three-rectangle-loader ${className}`}
    role="status"
    aria-label={ariaLabel}
  >
    <span className="three-rectangle-loader__shape" />
    <span className="three-rectangle-loader__shape" />
    <span className="three-rectangle-loader__shape" />
  </div>
);
