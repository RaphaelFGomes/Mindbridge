import type { Options } from 'k6/options';
import { summarize } from '../lib/summary.ts';
import { stressThresholds, summaryTrendStats } from '../lib/thresholds.ts';

/** Up to six times the expected peak: where does it bend, and does it recover? */
export const options: Options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 300 },
    { duration: '1m', target: 0 },
  ],
  thresholds: stressThresholds,
  summaryTrendStats,
};

export { journey as default, seed as setup, cleanup as teardown } from '../lib/workload.ts';
export const handleSummary = summarize('stress');
