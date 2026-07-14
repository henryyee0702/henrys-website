import React, { useEffect, useRef } from 'react';

import { getUmbraCompositionAnchor } from './umbra-types';
import type { UmbraBodySnapshot, UmbraSceneSnapshot } from './umbra-types';

export const UMBRA_COLLAPSE_DURATION_MS = 4550;

interface CelestialCollapseProps {
  scene: UmbraSceneSnapshot;
  quality: 'full' | 'reduced';
  reducedMotion: boolean;
  onReady?: () => void;
  onProgress?: (remaining: number) => void;
}

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const bodyTiming = (index: number, reducedMotion: boolean) => {
  if (reducedMotion) {
    return { start: 40 + index * 10, duration: 250 };
  }
  if (index === 0) return { start: 260, duration: 980 };
  return { start: 760 + (index - 1) * 140, duration: 2380 - index * 36 };
};

const colorChannels = (hex: string) => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgba = (body: UmbraBodySnapshot, alpha: number) => {
  const { r, g, b } = colorChannels(body.color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const writePathPoint = (
  output: Float32Array,
  offset: number,
  body: UmbraBodySnapshot,
  index: number,
  progress: number,
  sinkX: number,
  sinkY: number,
  width: number,
  height: number,
) => {
  const startX = body.x * width;
  const startY = body.y * height;
  const dx = startX - sinkX;
  const dy = startY - sinkY;
  const direction = index % 3 === 0 ? -1 : 1;
  const revolutions = index === 0 ? 0 : 1.12 + index * 0.145;
  const angle = direction * TAU * revolutions * progress * progress;
  const radial = 1 - progress * progress * progress;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const shear = 1 - smoothstep((progress - 0.6) / 0.4) * 0.08;

  output[offset] = sinkX + (dx * cos - dy * sin) * radial;
  output[offset + 1] = sinkY + (dx * sin + dy * cos) * radial * shear;
};

export const CelestialCollapse: React.FC<CelestialCollapseProps> = ({
  scene,
  quality,
  reducedMotion,
  onReady,
  onProgress,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(onReady);
  const progressRef = useRef(onProgress);

  useEffect(() => {
    readyRef.current = onReady;
    progressRef.current = onProgress;
  }, [onProgress, onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      const fallbackFrame = requestAnimationFrame(() => {
        progressRef.current?.(0);
        readyRef.current?.();
      });
      return () => cancelAnimationFrame(fallbackFrame);
    }

    let frame = 0;
    let resizeFrame = 0;
    let disposed = false;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let startedAt = performance.now();
    let previousFrameAt = startedAt;
    let lastDrawAt = 0;
    let hiddenAt = 0;
    let pausedDuration = 0;
    let lastRemaining = -1;
    let anchorX = getUmbraCompositionAnchor(width, height).x;
    let anchorY = getUmbraCompositionAnchor(width, height).y;
    const point = new Float32Array(2);
    const previousPoint = new Float32Array(2);
    const samples = quality === 'full' ? 22 : 12;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, quality === 'full' ? 1.5 : 1);
      const nextWidth = Math.max(1, Math.round(width * dpr));
      const nextHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = true;
    };

    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };

    const drawOrbitalField = (sinkX: number, sinkY: number, elapsed: number) => {
      const collapse = smoothstep(elapsed / (reducedMotion ? 320 : 3400));
      const fieldRadius = Math.min(width, height) * (0.12 + collapse * 0.08);
      context.save();
      context.translate(sinkX, sinkY);
      context.rotate(elapsed * 0.00008);
      context.lineWidth = 0.6;
      for (let index = 0; index < 5; index += 1) {
        const radius = fieldRadius * (0.72 + index * 0.22);
        context.beginPath();
        context.ellipse(0, 0, radius, radius * 0.26, -0.08, 0, TAU);
        context.strokeStyle = `rgba(255, 208, 137, ${0.055 * (1 - collapse * 0.45)})`;
        context.stroke();
      }
      context.restore();
    };

    const drawBody = (
      body: UmbraBodySnapshot,
      index: number,
      progress: number,
      sinkX: number,
      sinkY: number,
    ) => {
      writePathPoint(point, 0, body, index, progress, sinkX, sinkY, width, height);
      const trailWindow = quality === 'full' ? 0.22 : 0.14;
      const trailStart = Math.max(0, progress - trailWindow);

      if (progress > 0.015 && index > 0) {
        context.save();
        context.globalCompositeOperation = 'lighter';
        context.lineCap = 'round';
        for (let sample = 0; sample < samples - 1; sample += 1) {
          const a = sample / (samples - 1);
          const b = (sample + 1) / (samples - 1);
          const progressA = trailStart + (progress - trailStart) * a;
          const progressB = trailStart + (progress - trailStart) * b;
          writePathPoint(previousPoint, 0, body, index, progressA, sinkX, sinkY, width, height);
          writePathPoint(point, 0, body, index, progressB, sinkX, sinkY, width, height);
          const tidal = smoothstep((progress - 0.48) / 0.5);
          context.beginPath();
          context.moveTo(previousPoint[0], previousPoint[1]);
          context.lineTo(point[0], point[1]);
          context.lineWidth = Math.max(0.55, body.sizePx * (0.08 + tidal * 0.11) * b);
          context.strokeStyle = rgba(body, (0.025 + b * 0.24) * (1 - progress * 0.68));
          context.shadowColor = body.color;
          context.shadowBlur = 5 + tidal * 16;
          context.stroke();
        }
        context.restore();
      }

      writePathPoint(point, 0, body, index, progress, sinkX, sinkY, width, height);
      const nextProgress = Math.min(1, progress + 0.012);
      writePathPoint(previousPoint, 0, body, index, nextProgress, sinkX, sinkY, width, height);
      const velocityX = previousPoint[0] - point[0];
      const velocityY = previousPoint[1] - point[1];
      const angle = Math.atan2(velocityY, velocityX);
      const tidal = smoothstep((progress - 0.53) / 0.42);
      const headAlpha = smoothstep((1 - progress) / 0.08);
      const baseRadius = Math.max(2.4, body.sizePx * 0.5 * (1 - progress * 0.72));

      context.save();
      context.translate(point[0], point[1]);
      context.rotate(angle);
      context.scale(1 + tidal * 7.5, Math.max(0.16, 1 - tidal * 0.78));
      context.globalCompositeOperation = 'lighter';
      const gradient = context.createRadialGradient(-baseRadius * 0.2, -baseRadius * 0.18, 0, 0, 0, baseRadius);
      gradient.addColorStop(0, `rgba(255,255,255,${0.94 * headAlpha})`);
      gradient.addColorStop(0.25, rgba(body, 0.96 * headAlpha));
      gradient.addColorStop(1, rgba(body, 0));
      context.fillStyle = gradient;
      context.shadowColor = body.color;
      context.shadowBlur = 14 + tidal * 20;
      context.beginPath();
      context.arc(0, 0, baseRadius, 0, TAU);
      context.fill();
      context.restore();

      if (body.hasRing && progress < 0.72) {
        context.save();
        context.translate(point[0], point[1]);
        context.rotate(angle - 0.28);
        context.scale(1 + tidal * 3.4, 1 - tidal * 0.55);
        context.beginPath();
        context.ellipse(0, 0, baseRadius * 1.85, baseRadius * 0.48, 0, 0, TAU);
        context.strokeStyle = rgba(body, (0.52 - progress * 0.54) * headAlpha);
        context.lineWidth = 0.8;
        context.shadowColor = body.color;
        context.shadowBlur = 9;
        context.stroke();
        context.restore();
      }

      if (progress < 0.66 && width >= 560) {
        context.save();
        context.font = '500 8px "JetBrains Mono", monospace';
        context.letterSpacing = '0.2em';
        context.fillStyle = `rgba(226, 230, 238, ${0.42 * (1 - progress / 0.66)})`;
        context.fillText(body.label, point[0] + 12, point[1] - 11);
        context.restore();
      }
    };

    const render = (now: number) => {
      if (disposed) return;
      if (document.hidden) {
        frame = requestAnimationFrame(render);
        return;
      }

      const minFrameTime = quality === 'full' ? 1000 / 60 : 1000 / 30;
      if (now - lastDrawAt < minFrameTime) {
        frame = requestAnimationFrame(render);
        return;
      }
      const deltaSeconds = Math.min(0.1, Math.max(0, now - previousFrameAt) / 1000);
      previousFrameAt = now;
      lastDrawAt = now;
      const elapsed = Math.max(0, now - startedAt - pausedDuration);

      const renderEnd = reducedMotion ? 540 : UMBRA_COLLAPSE_DURATION_MS + 300;
      if (elapsed >= renderEnd) {
        context.clearRect(0, 0, width, height);
        if (lastRemaining !== 0) {
          lastRemaining = 0;
          progressRef.current?.(0);
        }
        frame = 0;
        return;
      }

      const anchorTarget = getUmbraCompositionAnchor(width, height);
      const anchorEase = 1 - Math.exp(-3.4 * deltaSeconds);
      anchorX += (anchorTarget.x - anchorX) * anchorEase;
      anchorY += (anchorTarget.y - anchorY) * anchorEase;
      const moveStart = reducedMotion ? 180 : 3500;
      const moveDuration = reducedMotion ? 130 : 820;
      const moveProgress = smoothstep((elapsed - moveStart) / moveDuration);
      const sinkX = (scene.sink.x + (anchorX - scene.sink.x) * moveProgress) * width;
      const sinkY = (scene.sink.y + (anchorY - scene.sink.y) * moveProgress) * height;

      context.clearRect(0, 0, width, height);
      drawOrbitalField(sinkX, sinkY, elapsed);

      let remaining = 0;
      scene.bodies.forEach((body, index) => {
        const timing = bodyTiming(index, reducedMotion);
        const progress = clamp01((elapsed - timing.start) / timing.duration);
        if (progress < 1) {
          remaining += 1;
          drawBody(body, index, progress, sinkX, sinkY);
        }
      });

      if (remaining !== lastRemaining) {
        lastRemaining = remaining;
        progressRef.current?.(remaining);
      }

      const shockStart = reducedMotion ? 300 : 3820;
      const shock = clamp01((elapsed - shockStart) / (reducedMotion ? 180 : 720));
      if (shock > 0 && shock < 1) {
        const radius = Math.min(width, height) * (0.018 + shock * 0.24);
        context.save();
        context.globalCompositeOperation = 'lighter';
        context.beginPath();
        context.arc(sinkX, sinkY, radius, 0, TAU);
        context.strokeStyle = `rgba(255, 225, 171, ${(1 - shock) * 0.34})`;
        context.lineWidth = Math.max(0.5, (1 - shock) * 2.2);
        context.shadowColor = '#ffd595';
        context.shadowBlur = 18;
        context.stroke();
        context.restore();
      }

      frame = requestAnimationFrame(render);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = performance.now();
      } else if (hiddenAt > 0) {
        pausedDuration += performance.now() - hiddenAt;
        hiddenAt = 0;
        previousFrameAt = performance.now();
      }
    };

    resize();
    const initialAnchor = getUmbraCompositionAnchor(width, height);
    anchorX = initialAnchor.x;
    anchorY = initialAnchor.y;
    startedAt = performance.now();
    previousFrameAt = startedAt;
    frame = requestAnimationFrame(render);
    requestAnimationFrame(() => readyRef.current?.());

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleResize)
      : null;
    observer?.observe(canvas.parentElement ?? canvas);
    window.addEventListener('resize', scheduleResize, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      window.visualViewport?.removeEventListener('resize', scheduleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [quality, reducedMotion, scene]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[6] h-full w-full"
      data-umbra-collapse-canvas
    />
  );
};
