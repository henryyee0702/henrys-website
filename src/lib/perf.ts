/**
 * Lightweight client-side performance instrumentation.
 * Opt-in: activated by ?perf=1 query param or localStorage.perf === '1'.
 */

interface PerfEntry {
  name: string;
  ts: number;
  data?: Record<string, unknown>;
}

let enabled = false;
const entries: PerfEntry[] = [];

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      new URLSearchParams(window.location.search).has('perf') ||
      localStorage.getItem('perf') === '1'
    );
  } catch {
    return false;
  }
}

export function initPerf(): void {
  enabled = isEnabled();
  if (!enabled) return;

  if ('PerformanceObserver' in window) {
    try {
      new PerformanceObserver((list) => {
        const entry = list.getEntries().at(-1);
        if (entry) {
          log('lcp', {
            startTime: Math.round(entry.startTime),
            element: (entry as PerformanceEntry & { element?: Element }).element?.tagName,
            url: (entry as PerformanceEntry & { url?: string }).url,
          });
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      let clsSum = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) clsSum += (entry as PerformanceEntry & { value?: number }).value ?? 0;
        }
        log('cls', { value: +clsSum.toFixed(4) });
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Observer types may not be supported in all browsers
    }
  }

  (window as Window & { __perfReport?: () => PerfEntry[] }).__perfReport = () => {
    console.table(entries);
    return entries;
  };
}

export function log(name: string, data?: Record<string, unknown>): void {
  if (!enabled) return;
  const entry: PerfEntry = { name, ts: Math.round(performance.now()), data };
  entries.push(entry);
  console.debug(`[perf] ${name}`, data ?? '');
}

export function logMount(component: string): void {
  log('mount', { component });
}

export function logUnmount(component: string): void {
  log('unmount', { component });
}
