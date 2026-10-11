import type { Page } from '@playwright/test';

/** Navigation timings of the current document, in milliseconds from navigation start. */
export interface NavigationMetrics {
  readonly ttfb: number;
  readonly domContentLoaded: number;
  readonly load: number;
  /** Bytes transferred for the document itself. */
  readonly transferSize: number;
}

/**
 * Reads `PerformanceNavigationTiming` for the page's current document. Waits
 * until `loadEventEnd` is populated, which only happens after every load
 * handler has returned.
 */
export async function readNavigationMetrics(page: Page): Promise<NavigationMetrics> {
  await page.waitForFunction(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return (nav?.loadEventEnd ?? 0) > 0;
  });
  return page.evaluate((): NavigationMetrics => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (!nav) throw new Error('PerformanceNavigationTiming entry not available');
    return {
      ttfb: nav.responseStart - nav.startTime,
      domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      load: nav.loadEventEnd - nav.startTime,
      transferSize: nav.transferSize,
    };
  });
}
