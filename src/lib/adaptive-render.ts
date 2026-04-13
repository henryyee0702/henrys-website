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
 * - When idle, renders only every 4th frame (~15 fps).
 */
export function shouldThrottleFrame(
  frameCount: number,
  isIdle: boolean,
): boolean {
  if (typeof document !== 'undefined' && document.hidden) return true;
  if (isIdle) return frameCount % 4 !== 0;
  return false;
}
