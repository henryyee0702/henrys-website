export interface UmbraOrigin {
  x: number;
  y: number;
}

export interface UmbraBodySnapshot {
  id: string;
  label: string;
  x: number;
  y: number;
  sizePx: number;
  color: string;
  glow: string;
  hasRing: boolean;
}

export interface UmbraSceneSnapshot {
  trigger: UmbraOrigin;
  sink: UmbraOrigin;
  viewport: {
    width: number;
    height: number;
  };
  bodies: UmbraBodySnapshot[];
}

export type UmbraLayoutMode = 'split' | 'compact-landscape' | 'stack';

export const getUmbraLayoutMode = (width: number, height: number): UmbraLayoutMode => {
  if (width >= 900 && height >= 620) return 'split';
  if (width / Math.max(height, 1) >= 1.55 && height < 620) return 'compact-landscape';
  return 'stack';
};

export const getUmbraCompositionAnchor = (width: number, height: number): UmbraOrigin => {
  const mode = getUmbraLayoutMode(width, height);
  if (mode === 'split') return { x: 0.215, y: 0.515 };
  if (mode === 'compact-landscape') return { x: 0.25, y: 0.48 };
  return { x: 0.5, y: height < 620 ? 0.22 : 0.255 };
};
