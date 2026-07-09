/**
 * Lightweight adaptive rendering utilities.
 * Reduces GPU work when the user is idle or the tab is hidden.
 */

/**
 * Tracks user interaction recency.
 * After `timeoutMs` of inactivity, `.idle` returns true.
 */
export class IdleTracker {
  private lastActivity = performance.now();
  private readonly timeoutMs: number;

  constructor(timeoutMs = 2000) {
    this.timeoutMs = timeoutMs;
  }

  /** Call on user interaction (mouse move, pointer down, etc.) */
  ping() {
    this.lastActivity = performance.now();
  }

  get idle() {
    return performance.now() - this.lastActivity > this.timeoutMs;
  }
}

/**
 * Returns true when the current frame should be skipped.
 * - Always skips while `document.hidden` (tab in background).
 * - Supports separate active/idle frame intervals for low-power effects.
 */
export function shouldThrottleFrame(
  frameCount: number,
  isIdle: boolean,
  options: {
    activeFrameInterval?: number;
    idleFrameInterval?: number;
  } = {},
): boolean {
  if (typeof document !== 'undefined' && document.hidden) return true;
  const activeFrameInterval = Math.max(1, options.activeFrameInterval ?? 1);
  const idleFrameInterval = Math.max(activeFrameInterval, options.idleFrameInterval ?? 4);
  const interval = isIdle ? idleFrameInterval : activeFrameInterval;
  return interval > 1 && frameCount % interval !== 0;
}
