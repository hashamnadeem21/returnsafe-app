// Turns the raw V8 dumps from `npm run coverage` (vitest workers and the Functions emulator's
// workers, all running the compiled lib/) into one istanbul report for src/ through the build's
// source maps, prints it, and fails below 80% on any metric.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { convert } from 'ast-v8-to-istanbul';
import libCoverage from 'istanbul-lib-coverage';
import { parseAstAsync } from 'vite';

const THRESHOLD = 80;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = join(root, 'lib') + '/';
const map = libCoverage.createCoverageMap({});

const rawDir = join(root, 'coverage/raw');
for (const dump of existsSync(rawDir) ? readdirSync(rawDir) : []) {
  const { result } = JSON.parse(readFileSync(join(rawDir, dump), 'utf8'));
  for (const script of result) {
    if (!script.url.startsWith('file://')) continue;
    const file = fileURLToPath(script.url);
    if (!file.startsWith(lib) || !file.endsWith('.js')) continue;
    const code = readFileSync(file, 'utf8');
    const sourceMap = JSON.parse(readFileSync(`${file}.map`, 'utf8'));
    sourceMap.sources = sourceMap.sources.map((s) => resolve(dirname(file), s));
    const data = await convert({
      ast: parseAstAsync(code),
      code,
      wrapperLength: 0,
      coverage: script,
      sourceMap,
    });
    map.merge(data);
  }
}
map.filter((file) => file.startsWith(join(root, 'src') + '/'));

const total = libCoverage.createCoverageSummary();
const pct = (m) => (m.total === 0 ? 100 : m.pct).toFixed(1).padStart(7);
console.log('File'.padEnd(32), '  Stmts  Branch   Funcs   Lines');
for (const file of map.files().sort()) {
  const s = map.fileCoverageFor(file).toSummary();
  total.merge(s);
  const row = [s.statements, s.branches, s.functions, s.lines].map(pct).join(' ');
  console.log(relative(root, file).padEnd(32), row);
}
console.log(
  'All files'.padEnd(32),
  [total.statements, total.branches, total.functions, total.lines].map(pct).join(' '),
);
const low = ['statements', 'branches', 'functions', 'lines'].filter(
  (k) => total[k].pct < THRESHOLD,
);
if (low.length) {
  console.error(`Coverage below ${THRESHOLD}%: ${low.join(', ')}`);
  process.exit(1);
}
