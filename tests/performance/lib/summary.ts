/** The parts of k6's end-of-test data the summary uses. */
interface Metric {
  values: Record<string, number>;
  thresholds?: Record<string, { ok: boolean }>;
}

interface SummaryData {
  metrics: Record<string, Metric | undefined>;
  state: { testRunDurationMs: number };
}

const ms = (value: number | undefined) => (value === undefined ? '-' : `${value.toFixed(0)} ms`);
const percent = (value: number | undefined) =>
  value === undefined ? '-' : `${(value * 100).toFixed(2)}%`;

/**
 * A Markdown summary for the terminal and the CI job summary, plus the raw JSON.
 * Written here rather than imported at runtime from jslib.k6.io (no unpinned code).
 */
export function summarize(scenario: string) {
  return (data: SummaryData) => {
    const metric = (name: string) => data.metrics[name]?.values;
    const latency = (name: string) => metric(name) ?? {};
    const rows = (
      [
        ['all requests', 'http_req_duration'],
        ['reads', 'http_req_duration{op:read}'],
        ['writes', 'http_req_duration{op:write}'],
      ] as const
    ).map(([label, name]) => {
      const values = latency(name);
      return `| ${label} | ${ms(values.med)} | ${ms(values['p(95)'])} | ${ms(values['p(99)'])} | ${ms(values.max)} |`;
    });

    const thresholds = Object.entries(data.metrics).flatMap(([name, value]) =>
      Object.entries(value?.thresholds ?? {}).map(
        ([rule, { ok }]) => `| ${ok ? '✅' : '❌'} | \`${name}\` | \`${rule}\` |`,
      ),
    );

    const markdown = [
      `## k6 ${scenario}`,
      '',
      `${metric('http_reqs')?.count ?? 0} requests (${(metric('http_reqs')?.rate ?? 0).toFixed(1)}/s) from up to ${metric('vus_max')?.max ?? 0} virtual users in ${(data.state.testRunDurationMs / 1000).toFixed(0)} s · failed ${percent(metric('http_req_failed')?.rate)} · checks ${percent(metric('checks')?.rate)}`,
      '',
      '| Latency | median | p95 | p99 | max |',
      '| --- | ---: | ---: | ---: | ---: |',
      ...rows,
      '',
      '| | Metric | Threshold |',
      '| --- | --- | --- |',
      ...thresholds,
      '',
    ].join('\n');

    return {
      stdout: `${markdown}\n`,
      [`reports/k6-${scenario}.md`]: markdown,
      [`reports/k6-${scenario}.json`]: JSON.stringify(data, null, 2),
      // In GitHub Actions each step has its own summary file, so overwriting it is safe.
      ...(__ENV.GITHUB_STEP_SUMMARY && { [__ENV.GITHUB_STEP_SUMMARY]: markdown }),
    };
  };
}
