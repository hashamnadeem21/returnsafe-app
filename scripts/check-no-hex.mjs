#!/usr/bin/env node
// Fails if any hex colour (#abc, #aabbcc, #aabbccdd) appears in src/ outside src/theme/tokens.ts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const srcDir = join(root, 'src');
const allowed = new Set(['src/theme/tokens.ts']);
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

export function findHexViolations() {
  const violations = [];
  for (const file of walk(srcDir)) {
    if (!/\.(tsx?|jsx?)$/.test(file)) continue;
    const rel = relative(root, file);
    if (allowed.has(rel)) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const hits = line.match(HEX);
        if (hits) violations.push(`${rel}:${i + 1}  ${hits.join(', ')}`);
      });
  }
  return violations;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const v = findHexViolations();
  if (v.length) {
    console.error(`Hex colours found outside src/theme/tokens.ts:\n${v.join('\n')}`);
    process.exit(1);
  }
  console.log('No hex colours outside src/theme/tokens.ts');
}
