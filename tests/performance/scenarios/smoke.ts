import type { Options } from 'k6/options';
import { summarize } from '../lib/summary.ts';
import { steadyThresholds, summaryTrendStats } from '../lib/thresholds.ts';

/** Every push: one user for 30 seconds. Does the API work, and is nothing slow? */
export const options: Options = {
  vus: 1,
  duration: '30s',
  thresholds: steadyThresholds,
  summaryTrendStats,
};

export { journey as default, seed as setup, cleanup as teardown } from '../lib/workload.ts';
export const handleSummary = summarize('smoke');
