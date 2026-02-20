import { Page } from '@playwright/test';

export interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  domComplete?: number;
  loadEventEnd?: number;
  // Add more metrics as needed
}

/**
 * Collects frontend performance metrics from a Playwright page.
 * @param page The Playwright page object.
 * @returns A Promise that resolves to an object containing performance metrics.
 */
export async function getPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
  const metrics = await page.evaluate(() => {
    const perf = window.performance;
    const navTiming = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintMetrics = perf.getEntriesByType('paint') as PerformancePaintTiming[];

    const fcpEntry = paintMetrics.find(entry => entry.name === 'first-contentful-paint');
    const lcpEntry = perf.getEntriesByType('largest-contentful-paint')[0] as LargestContentfulPaint;

    return {
      fcp: fcpEntry ? fcpEntry.startTime : undefined,
      lcp: lcpEntry ? lcpEntry.startTime : undefined,
      domComplete: navTiming?.domComplete,
      loadEventEnd: navTiming?.loadEventEnd,
    };
  });
  return metrics;
}

/**
 * Helper to measure a specific performance metric and return it.
 * @param page The Playwright page object.
 * @param metricName The name of the metric to retrieve (e.g., 'fcp', 'lcp').
 * @returns The value of the metric, or undefined if not found.
 */
export async function measureMetric(page: Page, metricName: keyof PerformanceMetrics): Promise<number | undefined> {
  const metrics = await getPerformanceMetrics(page);
  return metrics[metricName];
}
