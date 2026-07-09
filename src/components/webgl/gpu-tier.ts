/**
 * WebGL device-capability detection & degradation tiers.
 *
 * ┌──────────┬────────────────────────────────────────────────┐
 * │ Tier     │ Description                                    │
 * ├──────────┼────────────────────────────────────────────────┤
 * │ full     │ Desktop / high-end tablet. Run every effect.   │
 * │ reduced  │ Mid-range mobile. Simplified shaders, lower    │
 * │          │ DPR, smaller shadow maps, fewer lights.        │
 * │ fallback │ Low-end / no WebGL / prefers-reduced-motion.   │
 * │          │ Show static <img> only.                        │
 * └──────────┴────────────────────────────────────────────────┘
 *
 * Decision flow (all checks are client-side):
 *
 *   1. prefers-reduced-motion: reduce → fallback
 *   2. WebGL not available                → fallback
 *   3. GPU renderer blacklisted           → fallback
 *   4. hardware concurrency ≤ 2           → reduced
 *   5. deviceMemory ≤ 4 (when available)  → reduced
 *   6. touch-primary + screen ≤ 820px     → reduced
 *   7. Otherwise                          → full
 */

export type GpuTier = 'full' | 'reduced' | 'fallback';

export interface GpuProfile {
  tier: GpuTier;
  maxDpr: number;
  shadowMapSize: number;
  maxLights: number;
  enablePostProcessing: boolean;
}

const PROFILES: Record<GpuTier, GpuProfile> = {
  full: {
    tier: 'full',
    maxDpr: 2,
    shadowMapSize: 2048,
    maxLights: 6,
    enablePostProcessing: true,
  },
  reduced: {
    tier: 'reduced',
    maxDpr: 1.4,
    shadowMapSize: 512,
    maxLights: 2,
    enablePostProcessing: false,
  },
  fallback: {
    tier: 'fallback',
    maxDpr: 1,
    shadowMapSize: 0,
    maxLights: 0,
    enablePostProcessing: false,
  },
};

/** Known weak / emulated GPU renderers. */
const GPU_BLOCKLIST = /swiftshader|llvmpipe|software|microsoft basic/i;

function probeWebGL(): { available: boolean; renderer: string } {
  try {
    const c = document.createElement('canvas');
    const gl =
      (c.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (c.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return { available: false, renderer: '' };

    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg
      ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string
      : '';

    // Clean up context
    const ext = gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();

    return { available: true, renderer };
  } catch {
    return { available: false, renderer: '' };
  }
}

/**
 * Detect GPU tier. Call once on mount and cache the result.
 * SSR-safe: returns 'fallback' when `window` is unavailable.
 */
export function detectGpuTier(): GpuProfile {
  if (typeof window === 'undefined') return PROFILES.fallback;

  // 1. Reduced motion
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return PROFILES.fallback;
  }

  // 2-3. WebGL availability + GPU blocklist
  const { available, renderer } = probeWebGL();
  if (!available || GPU_BLOCKLIST.test(renderer)) {
    return PROFILES.fallback;
  }

  // 4. Hardware concurrency
  if (navigator.hardwareConcurrency != null && navigator.hardwareConcurrency <= 2) {
    return PROFILES.reduced;
  }

  // 5. Device memory (Chrome only)
  if ('deviceMemory' in navigator && (navigator as Navigator & { deviceMemory?: number }).deviceMemory! <= 4) {
    return PROFILES.reduced;
  }

  // 6. Touch-primary small screen
  const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches;
  if (isTouchPrimary && window.screen.width <= 820) {
    return PROFILES.reduced;
  }

  return PROFILES.full;
}

/**
 * Adapt a Cloudinary image URL to serve an appropriate resolution
 * based on GPU tier. Full tier gets the original; reduced/fallback
 * receive width-limited variants.
 */
export function adaptCloudinaryUrl(url: string, tier: GpuTier): string {
  if (tier === 'full') return url;
  const maxWidth = tier === 'reduced' ? 1280 : 1024;
  return url.replace(
    /(\/upload\/)((?:[^/]+\/)*)(?=v\d)/,
    (_, upload: string, transforms: string) => {
      const sizeParam = `w_${maxWidth},c_limit`;
      if (transforms) {
        return `${upload}${transforms.replace(/\/$/, '')},${sizeParam}/`;
      }
      return `${upload}${sizeParam}/`;
    },
  );
}

// ── React hook ──────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';

/**
 * React hook that returns the GPU profile.
 * During SSR / first paint it conservatively returns 'fallback',
 * then upgrades after hydration.
 */
export function useGpuTier(): GpuProfile {
  const [profile, setProfile] = useState<GpuProfile>(PROFILES.fallback);

  useEffect(() => {
    setProfile(detectGpuTier());
  }, []);

  return profile;
}
