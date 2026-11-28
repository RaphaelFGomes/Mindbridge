import type { Options } from 'k6/options';
import { summarize } from '../lib/summary.ts';
import { steadyThresholds, summaryTrendStats } from '../lib/thresholds.ts';

/** Moderate load for 30 minutes: leaks (memory, connections) show up as drift. */
export const options: Options = {
  stages: [
    { duration: '1m', target: 30 },
    { duration: '30m', target: 30 },
    { duration: '1m', target: 0 },
  ],
  thresholds: steadyThresholds,
  summaryTrendStats,
};

export { journey as default, seed as setup, cleanup as teardown } from '../lib/workload.ts';
export const handleSummary = summarize('soak');
