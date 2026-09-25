import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useGpuTier } from '@/components/webgl/gpu-tier';
import type { CinematicBlackHoleProps, UmbraVisualPhase } from '@/components/webgl/CinematicBlackHole';
import { CelestialCollapse, UMBRA_COLLAPSE_DURATION_MS } from './CelestialCollapse';
import { getUmbraLayoutMode } from './umbra-types';
import type { UmbraLayoutMode, UmbraSceneSnapshot } from './umbra-types';
import '@/styles/umbra-experience.css';

const FILM_PLATE_SRC = '/images/event-horizon-film-plate.png';

type CinematicBlackHoleModule = typeof import('@/components/webgl/CinematicBlackHole');
let cinematicBlackHolePromise: Promise<CinematicBlackHoleModule> | null = null;

const loadCinematicBlackHole = () => {
  if (!cinematicBlackHolePromise) {
    cinematicBlackHolePromise = import('@/components/webgl/CinematicBlackHole').catch((error) => {
      cinematicBlackHolePromise = null;
      throw error;
    });
  }
  return cinematicBlackHolePromise;
};

export const preloadUmbraVisual = async (includeFilmPlate = true) => {
  const filmPlate = includeFilmPlate
    ? new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = FILM_PLATE_SRC;
    })
    : Promise.resolve();
  await Promise.allSettled([loadCinematicBlackHole(), filmPlate]);
};

interface UmbraExperienceProps {
  scene: UmbraSceneSnapshot;
  onDismiss: () => void;
}

interface ViewportState {
  width: number;
  height: number;
  visualHeight: number;
  visualOffsetTop: number;
  mode: UmbraLayoutMode;
}

type GateStatus = 'idle' | 'checking' | 'rejected' | 'unavailable' | 'cooldown' | 'accepted';

const ARCHIVE_GATE_CONFIG = {
  umbra: {
    endpoint: '/api/umbra',
    passwordLength: 7,
    hint: 'MMDD SHEEP',
  },
  birthday: {
    endpoint: '/api/birthday',
    passwordLength: 8,
    hint: 'YYYYMMDD',
  },
} as const;

const readViewport = (): ViewportState => {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const visualHeight = Math.max(1, window.visualViewport?.height ?? height);
  const visualOffsetTop = Math.max(0, window.visualViewport?.offsetTop ?? 0);
  return {
    width,
    height,
    visualHeight,
    visualOffsetTop,
    mode: getUmbraLayoutMode(width, visualHeight),
  };
};

export const UmbraExperience: React.FC<UmbraExperienceProps> = ({ scene, onDismiss }) => {
  const gateConfig = ARCHIVE_GATE_CONFIG[scene.archive];
  const [phase, setPhase] = useState<UmbraVisualPhase>('collapse');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<GateStatus>('idle');
  const [attempt, setAttempt] = useState(0);
  const [collapseReady, setCollapseReady] = useState(false);
  const [visualFailed, setVisualFailed] = useState(false);
  const [BlackHoleVisual, setBlackHoleVisual] = useState<React.ComponentType<CinematicBlackHoleProps> | null>(null);
  const [remainingBodies, setRemainingBodies] = useState(scene.bodies.length);
  const [viewport, setViewport] = useState<ViewportState>(() => ({
    width: scene.viewport.width,
    height: scene.viewport.height,
    visualHeight: scene.viewport.height,
    visualOffsetTop: 0,
    mode: getUmbraLayoutMode(scene.viewport.width, scene.viewport.height),
  }));
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const navigationTimerRef = useRef<number | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const phaseRef = useRef<UmbraVisualPhase>(phase);
  const dismissRef = useRef(onDismiss);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');
  const gpuProfile = useGpuTier();
  const canRenderBlackHole = gpuProfile.tier !== 'fallback' && !reducedMotion && !visualFailed;
  const blackHoleActive = canRenderBlackHole && Boolean(BlackHoleVisual);

  const handleVisualError = useCallback(() => setVisualFailed(true), []);

  useEffect(() => {
    if (!canRenderBlackHole || BlackHoleVisual) return;
    let active = true;
    void loadCinematicBlackHole()
      .then(({ CinematicBlackHole }) => {
        if (active) setBlackHoleVisual(() => CinematicBlackHole);
      })
      .catch(() => {
        if (active) setVisualFailed(true);
      });
    return () => {
      active = false;
    };
  }, [BlackHoleVisual, canRenderBlackHole]);

  useEffect(() => {
    phaseRef.current = phase;
    dismissRef.current = onDismiss;
  }, [onDismiss, phase]);

  useEffect(() => {
    if (!collapseReady) return;
    const duration = reducedMotion ? 420 : UMBRA_COLLAPSE_DURATION_MS;
    const timer = window.setTimeout(() => setPhase('gate'), duration);
    return () => window.clearTimeout(timer);
  }, [collapseReady, reducedMotion]);

  useEffect(() => {
    if (phase !== 'gate' || isCoarsePointer) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [isCoarsePointer, phase]);

  useEffect(() => {
    let resizeFrame = 0;
    const updateViewport = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => setViewport(readViewport()));
    };
    updateViewport();
    window.addEventListener('resize', updateViewport, { passive: true });
    window.addEventListener('orientationchange', updateViewport, { passive: true });
    window.visualViewport?.addEventListener('resize', updateViewport, { passive: true });
    window.visualViewport?.addEventListener('scroll', updateViewport, { passive: true });
    return () => {
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const rootOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 40);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phaseRef.current !== 'unlocking') {
        isMountedRef.current = false;
        requestControllerRef.current?.abort();
        dismissRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMountedRef.current = false;
      requestControllerRef.current?.abort();
      window.clearTimeout(focusTimer);
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
      const previousFocus = previousFocusRef.current;
      window.requestAnimationFrame(() => {
        if (previousFocus && previousFocus !== document.body && document.contains(previousFocus)) previousFocus.focus();
        else document.querySelector<HTMLElement>('[data-umbra-probe]')?.focus();
      });
    };
  }, []);

  const dismiss = () => {
    if (phase === 'unlocking') return;
    isMountedRef.current = false;
    requestControllerRef.current?.abort();
    onDismiss();
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'),
    ).filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (focusable.length === 1) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length === 0 || status === 'checking' || phase !== 'gate') return;
    setStatus('checking');
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const response = await fetch(gateConfig.endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; destination?: string; reason?: string };
      if (!isMountedRef.current || controller.signal.aborted) return;

      if (!response.ok || !result.ok) {
        setAttempt((current) => current + 1);
        setPassword('');
        setStatus(response.status === 429 || result.reason === 'cooldown'
          ? 'cooldown'
          : response.status === 503 || result.reason === 'unavailable'
            ? 'unavailable'
            : 'rejected');
        window.setTimeout(() => inputRef.current?.focus(), 180);
        return;
      }

      setStatus('accepted');
      setPhase('unlocking');
      const destination = typeof result.destination === 'string' ? result.destination : gateConfig.endpoint;
      navigationTimerRef.current = window.setTimeout(() => {
        window.location.assign(destination);
      }, reducedMotion ? 520 : 2450);
    } catch {
      if (!isMountedRef.current || controller.signal.aborted) return;
      setStatus('unavailable');
      window.setTimeout(() => inputRef.current?.focus(), 180);
    }
  };

  const statusMessage = status === 'rejected'
    ? '軌道無法穩定。記憶並不認得這組座標。'
    : status === 'cooldown'
      ? '時空擾動過強，請稍後再嘗試。'
      : status === 'unavailable'
        ? '私人軌道暫時失去訊號。'
        : status === 'accepted'
          ? '座標吻合。正在穩定蟲洞。'
          : '';

  const style = {
    '--umbra-x': `${scene.trigger.x * 100}%`,
    '--umbra-y': `${scene.trigger.y * 100}%`,
    '--umbra-vvh': `${viewport.visualHeight}px`,
    '--umbra-vvoffset': `${viewport.visualOffsetTop}px`,
  } as React.CSSProperties;

  return (
    <div
      className="umbra-experience fixed inset-0 z-[80] overflow-hidden"
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby="umbra-gate-title"
      aria-describedby="umbra-gate-description umbra-gate-status"
      onKeyDown={handleDialogKeyDown}
      data-phase={phase}
      data-status={status}
      data-gpu-tier={gpuProfile.tier}
      data-layout={viewport.mode}
      style={style}
    >
      <div className="pointer-events-none absolute inset-0 z-0 bg-[#010205]" />
      {blackHoleActive && BlackHoleVisual ? (
        <BlackHoleVisual
          scene={scene}
          phase={phase}
          quality={gpuProfile.tier === 'full' ? 'full' : 'reduced'}
          onError={handleVisualError}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_24%,rgba(253,194,111,.13),transparent_17%),#010205]" />
      )}

      {(viewport.mode === 'split' || !blackHoleActive) && (
        <div
          aria-hidden="true"
          className="umbra-film-plate pointer-events-none absolute inset-0 z-[3] overflow-hidden"
          data-film-mode={blackHoleActive ? 'texture' : 'fallback'}
        >
          <img src={FILM_PLATE_SRC} alt="" draggable={false} className="h-full w-full max-w-none select-none object-cover" />
        </div>
      )}

      <CelestialCollapse
        scene={scene}
        quality={gpuProfile.tier === 'full' ? 'full' : 'reduced'}
        reducedMotion={reducedMotion}
        onReady={() => setCollapseReady(true)}
        onProgress={setRemainingBodies}
      />

      <div aria-hidden="true" className="umbra-collapse-copy pointer-events-none absolute left-6 top-7 z-[18] md:left-10 md:top-[7.25rem]">
        <p className="text-[8px] uppercase tracking-[0.34em] text-white/38" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          UMBRA CHANNEL / GRAVITATIONAL FAILURE
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-[9px] tracking-[0.24em] text-[#f2d18a]/74" style={{ fontFamily: '"JetBrains Mono", monospace' }}>ORBITAL DECAY</span>
          <span className="text-[9px] tracking-[0.18em] text-white/42" style={{ fontFamily: '"JetBrains Mono", monospace' }}>{String(scene.bodies.length).padStart(2, '0')} → {String(remainingBodies).padStart(2, '0')}</span>
        </div>
        <div
          className="mt-3 grid w-44 gap-1"
          style={{ gridTemplateColumns: `repeat(${scene.bodies.length}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: scene.bodies.length }, (_, index) => (
            <span key={`decay-${index}`} className="umbra-decay-segment h-px" data-ingested={index < scene.bodies.length - remainingBodies} />
          ))}
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">{remainingBodies} 個軌道仍在坍縮</span>

      <button
        ref={closeRef}
        type="button"
        onClick={dismiss}
        disabled={phase === 'unlocking'}
        className="absolute right-[max(1.5rem,env(safe-area-inset-right))] top-[max(1.5rem,env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/36 transition-colors hover:border-white/24 hover:text-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 disabled:pointer-events-none disabled:opacity-0"
        aria-label="中止私人軌道"
      >
        <X size={17} strokeWidth={1.2} />
      </button>

      {viewport.mode === 'split' && (
        <div aria-hidden="true" className="umbra-gate-veil pointer-events-none absolute left-[42.5%] top-[61%] z-[8] h-[30%] w-[39%]" />
      )}

      <div className="umbra-gate-shell pointer-events-none absolute left-0 z-20 w-full">
        <div data-umbra-gate className="umbra-gate pointer-events-auto absolute">
          <p className="mb-5 text-[8px] font-light uppercase tracking-[0.34em] text-white/48 md:text-[9px]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            UMBRA CHANNEL / EVENT HORIZON
          </p>
          <h3 id="umbra-gate-title" className="text-[clamp(1.08rem,1.75vw,1.45rem)] font-light tracking-[0.08em] text-white/86">
            只有記憶能穿越這裡
          </h3>

          <form className="mt-5 md:mt-6" onSubmit={handleSubmit} noValidate>
            <label className="sr-only" htmlFor="umbra-password">私人軌道密碼</label>
            <div className="umbra-password-track relative flex min-h-14 items-center gap-[clamp(.45rem,2vw,1.25rem)] border-b border-white/16 pr-[6.8rem] focus-within:border-[#f2d18a]/58">
              {Array.from({ length: gateConfig.passwordLength }, (_, index) => (
                <span
                  key={`password-orb-${index}`}
                  className="umbra-password-orb h-2.5 w-2.5 shrink-0 rounded-full border border-[#ffedbe]/45 bg-[#ffedbe]/15 shadow-[0_0_9px_rgba(255,205,119,.22)] transition-all duration-300"
                  data-filled={index < password.length}
                  aria-hidden="true"
                />
              ))}
              <input
                ref={inputRef}
                id="umbra-password"
                type="password"
                value={password}
                maxLength={gateConfig.passwordLength}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={phase !== 'gate' || status === 'checking'}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (status !== 'checking') setStatus('idle');
                }}
                className="absolute inset-0 h-full w-[calc(100%-6.8rem)] cursor-text opacity-0"
              />
              <button
                type="submit"
                disabled={password.length === 0 || status === 'checking' || phase !== 'gate'}
                className="absolute bottom-0 right-0 top-0 px-1 text-[9px] uppercase tracking-[0.24em] text-[#efd28f]/74 transition-colors hover:text-[#fff0c8] focus-visible:outline-none focus-visible:text-white disabled:cursor-default disabled:text-white/18"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {status === 'checking' ? 'READING' : phase === 'unlocking' ? 'STABLE' : 'STABILIZE'}
              </button>
            </div>
            <p id="umbra-gate-description" className="mt-3 text-[8px] uppercase tracking-[0.28em] text-white/30 md:mt-4 md:text-[9px]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              {gateConfig.hint}
            </p>
            <p
              key={`${status}-${attempt}`}
              id="umbra-gate-status"
              data-umbra-status
              aria-live="polite"
              className={`mt-3 min-h-5 text-[9px] tracking-[0.12em] md:mt-4 ${status === 'accepted' ? 'text-[#a9e7cf]/70' : 'text-[#ff9f8b]/56'}`}
            >
              {statusMessage}
            </p>
          </form>
        </div>
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-2 z-10 rounded-[10px] border border-white/[0.08]" />
      {viewport.mode === 'split' && (
        <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/3 top-2 z-10 w-px bg-gradient-to-b from-white/0 via-white/[0.08] to-white/0">
          <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-black/20 shadow-[0_0_30px_rgba(255,224,164,0.08)]" />
        </div>
      )}
    </div>
  );
};
