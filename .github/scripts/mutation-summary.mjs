// Writes a package's Stryker mutation score (from its JSON report) to the job summary.
import { appendFileSync, readFileSync } from 'node:fs';

const [reportPath, label] = process.argv.slice(2);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

const rows = Object.entries(report.files).map(([file, { mutants }]) => {
  const count = (statuses) => mutants.filter((m) => statuses.includes(m.status)).length;
  const detected = count(['Killed', 'Timeout']);
  const undetected = count(['Survived', 'NoCoverage']);
  return { file: file.replace(/^.*?\/src\//, 'src/'), detected, undetected };
});
const detected = rows.reduce((sum, row) => sum + row.detected, 0);
const undetected = rows.reduce((sum, row) => sum + row.undetected, 0);
const score = (d, u) => (d + u === 0 ? 'n/a' : `${((100 * d) / (d + u)).toFixed(1)}%`);

const lines = [
  `### Mutation score, ${label}: ${score(detected, undetected)}`,
  '',
  '| File | Score | Undetected |',
  '| --- | ---: | ---: |',
  ...rows.map(
    (row) => `| ${row.file} | ${score(row.detected, row.undetected)} | ${row.undetected} |`,
  ),
  '',
];
appendFileSync(process.env.GITHUB_STEP_SUMMARY ?? '/dev/stdout', `${lines.join('\n')}\n`);
