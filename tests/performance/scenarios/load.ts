import type { Options } from 'k6/options';
import { summarize } from '../lib/summary.ts';
import { steadyThresholds, summaryTrendStats } from '../lib/thresholds.ts';

/** Expected peak: 50 assistants and people at once for 5 minutes. */
export const options: Options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: steadyThresholds,
  summaryTrendStats,
};

export { journey as default, seed as setup, cleanup as teardown } from '../lib/workload.ts';
export const handleSummary = summarize('load');
