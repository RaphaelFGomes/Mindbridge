/** Normal operation (smoke, load, soak): any breach fails the run. */
export const steadyThresholds = {
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
  'http_req_duration{op:read}': ['p(95)<300'],
  'http_req_duration{op:write}': ['p(95)<500'],
};

/** Past normal load on purpose: the API may slow down, but must not fall over. */
export const stressThresholds = {
  http_req_failed: ['rate<0.05'],
  checks: ['rate>0.95'],
  'http_req_duration{op:read}': ['p(95)<1500'],
  'http_req_duration{op:write}': ['p(95)<2500'],
};

/** Statistics kept for every latency metric (the summary reads p95 and p99). */
export const summaryTrendStats = ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'];
