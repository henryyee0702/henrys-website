import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { UmbraOrigin } from './umbra-types';

const DISPLAY_DURATION_SECONDS = 7.02;
const HOLD_SPEED_MULTIPLIER = 2;
const HOLD_DURATION_MS = (DISPLAY_DURATION_SECONDS * 1000) / HOLD_SPEED_MULTIPLIER;
const TARGET_PADDING = 22;

interface SecretDividerHandleProps {
  visible: boolean;
  enabled: boolean;
  panelLeft: number;
  isMobile: boolean;
  sectionRef: React.RefObject<HTMLElement>;
  getTargetRect: () => DOMRect | null;
  onIntent?: () => void;
  onComplete: (origin: UmbraOrigin) => void;
}

type ProbeState = 'idle' | 'dragging' | 'holding';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const SecretDividerHandle: React.FC<SecretDividerHandleProps> = ({
  visible,
  enabled,
  panelLeft,
  isMobile,
  sectionRef,
  getTargetRect,
  onIntent,
  onComplete,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<HTMLProgressElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const holdStartRef = useRef(0);
  const holdFrameRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const keyboardHoldRef = useRef(false);
  const [probeState, setProbeState] = useState<ProbeState>('idle');

  const paintOffset = useCallback((x: number, y: number, immediate = true) => {
    offsetRef.current = { x, y };
    const button = buttonRef.current;
    if (!button) return;
    button.style.transitionDuration = immediate ? '0ms' : '700ms';
    button.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0)`;
  }, []);

  const paintProgress = useCallback((progress: number) => {
    if (progressRef.current) progressRef.current.value = progress;
    if (timeRef.current) timeRef.current.textContent = `${(progress * DISPLAY_DURATION_SECONDS).toFixed(2)} S`;
  }, []);

  const cancelHold = useCallback(() => {
    if (holdFrameRef.current !== null) cancelAnimationFrame(holdFrameRef.current);
    holdFrameRef.current = null;
    holdStartRef.current = 0;
    paintProgress(0);
    setProbeState((current) => (current === 'holding' ? 'dragging' : current));
  }, [paintProgress]);

  const resetProbe = useCallback(() => {
    if (completedRef.current) return;
    cancelHold();
    const button = buttonRef.current;
    const pointerId = pointerIdRef.current;
    if (button && pointerId !== null && button.hasPointerCapture(pointerId)) {
      button.releasePointerCapture(pointerId);
    }
    pointerIdRef.current = null;
    keyboardHoldRef.current = false;
    paintOffset(0, 0, false);
    setProbeState('idle');
  }, [cancelHold, paintOffset]);

  const finish = useCallback((targetRect: DOMRect) => {
    if (completedRef.current) return;
    completedRef.current = true;
    cancelHold();

    const sectionRect = sectionRef.current?.getBoundingClientRect();
    if (!sectionRect) return;
    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;
    onComplete({
      x: clamp((centerX - sectionRect.left) / sectionRect.width, 0, 1),
      y: clamp((centerY - sectionRect.top) / sectionRect.height, 0, 1),
    });
  }, [cancelHold, onComplete, sectionRef]);

  const isInsideTarget = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.max(rect.width, rect.height) / 2 + TARGET_PADDING;
    return Math.hypot(clientX - centerX, clientY - centerY) <= radius;
  }, []);

  const beginHold = useCallback((requireOverlap = true) => {
    if (!enabled || holdFrameRef.current !== null || completedRef.current) return;
    holdStartRef.current = performance.now();
    setProbeState('holding');

    const tick = (now: number) => {
      const targetRect = getTargetRect();
      const buttonRect = buttonRef.current?.getBoundingClientRect();
      if (!targetRect || (requireOverlap && (!buttonRect || !isInsideTarget(
        buttonRect.left + buttonRect.width / 2,
        buttonRect.top + buttonRect.height / 2,
        targetRect,
      )))) {
        cancelHold();
        return;
      }
      const progress = clamp((now - holdStartRef.current) / HOLD_DURATION_MS, 0, 1);
      paintProgress(progress);
      if (progress >= 1) {
        holdFrameRef.current = null;
        finish(targetRect);
        return;
      }
      holdFrameRef.current = requestAnimationFrame(tick);
    };

    holdFrameRef.current = requestAnimationFrame(tick);
  }, [cancelHold, enabled, finish, getTargetRect, isInsideTarget, paintProgress]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!visible || completedRef.current) return;
    event.preventDefault();
    onIntent?.();
    pointerIdRef.current = event.pointerId;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setProbeState('dragging');
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId || completedRef.current) return;
    const sectionRect = sectionRef.current?.getBoundingClientRect();
    if (!sectionRect) return;

    const baseX = isMobile ? sectionRect.width / 2 : panelLeft;
    const nextX = clamp(event.clientX - dragStartRef.current.x, -baseX + 24, sectionRect.width - baseX - 24);
    const baseY = isMobile ? 24 : sectionRect.height * 0.67;
    const nextY = clamp(event.clientY - dragStartRef.current.y, -baseY + 24, sectionRect.height - baseY - 24);
    paintOffset(nextX, nextY);

    const targetRect = enabled ? getTargetRect() : null;
    if (targetRect && isInsideTarget(event.clientX, event.clientY, targetRect)) {
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const targetCenterY = targetRect.top + targetRect.height / 2;
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const currentCenterX = buttonRect.left + buttonRect.width / 2;
      const currentCenterY = buttonRect.top + buttonRect.height / 2;
      paintOffset(
        offsetRef.current.x + targetCenterX - currentCenterX,
        offsetRef.current.y + targetCenterY - currentCenterY,
      );
      beginHold();
    } else {
      cancelHold();
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetProbe();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' || event.repeat || !enabled || completedRef.current) return;
    event.preventDefault();
    onIntent?.();
    const targetRect = getTargetRect();
    if (!targetRect) return;
    keyboardHoldRef.current = true;
    beginHold(false);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' || !keyboardHoldRef.current) return;
    event.preventDefault();
    resetProbe();
  };

  const handleAccessibleActivate = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0 || !enabled || completedRef.current) return;
    onIntent?.();
    const targetRect = getTargetRect();
    if (targetRect) {
      beginHold(false);
    }
  };

  useEffect(() => {
    if (visible) return;
    completedRef.current = false;
    resetProbe();
  }, [resetProbe, visible]);

  useEffect(() => {
    const cancel = () => resetProbe();
    const handleVisibility = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (holdFrameRef.current !== null) cancelAnimationFrame(holdFrameRef.current);
    };
  }, [resetProbe]);

  if (!visible) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      data-umbra-probe
      data-probe-state={probeState}
      aria-label={enabled ? '文章分隔控制點；拖曳至太陽或按 Enter 啟動 7.02 秒穩定程序' : '文章分隔控制點'}
      aria-keyshortcuts="Space Enter"
      className="umbra-probe interactive-node absolute z-[70] h-12 w-12 touch-none select-none rounded-full p-0 outline-none"
      style={{
        left: isMobile ? '50%' : `${panelLeft}px`,
        top: isMobile ? '24px' : '67%',
        transform: `translate(-50%, -50%) translate3d(${offsetRef.current.x}px, ${offsetRef.current.y}px, 0)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={resetProbe}
      onFocus={onIntent}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onClick={handleAccessibleActivate}
      onBlur={resetProbe}
    >
      <span aria-hidden="true" className="umbra-probe__core absolute left-1/2 top-1/2 h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-[#090a0f]/90 shadow-[0_0_18px_rgba(255,255,255,0.08)]" />
      <span className="umbra-probe__telemetry pointer-events-none absolute left-12 top-1/2 hidden -translate-y-1/2 whitespace-nowrap text-left" aria-hidden={probeState !== 'holding'}>
        <span ref={timeRef} className="block text-[10px] tracking-[0.24em] text-[#f6d993]">0.00 S</span>
        <span className="mt-1 block text-[8px] tracking-[0.28em] text-white/30">HOLDING</span>
        <progress ref={progressRef} className="umbra-hold-progress mt-2 block h-px w-20" max={1} value={0} />
      </span>
    </button>
  );
};
