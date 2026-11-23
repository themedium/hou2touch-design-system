#!/usr/bin/env node
/**
 * verify_docs.mjs — gate for the design-system canon corrections.
 *
 * No dependencies, plain fs. Prints exactly `GATE_PASS` on full success,
 * otherwise `GATE_FAIL: <reason>`. Exit code is 1 on failure.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const fails = [];

function read(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8');
  } catch (err) {
    fails.push(`cannot read ${rel}: ${err.message}`);
    return '';
  }
}

const MASTER = 'MASTER_DESIGN_SYSTEM.md';
const master = read(MASTER);
const color = read('identity/color-system.md');
const video = read('production/video-production-guidelines.md');

// 1 — canonical TOP + deviation register heading
if (!master.includes('#65a30d')) fails.push(`${MASTER} does not declare the canonical TOP #65a30d`);
if (!/Deviation register/.test(master)) fails.push(`${MASTER} has no /Deviation register/ heading`);

// 2 — #8a63c9 may only appear on lines that also say "legacy" or "RU"
for (const rel of ['identity/color-system.md', MASTER]) {
  const text = rel === MASTER ? master : color;
  text.split('\n').forEach((line, i) => {
    if (!line.includes('#8a63c9')) return;
    const near = line.toLowerCase();
    if (!near.includes('legacy') && !near.includes('ru')) {
      fails.push(`${rel}:${i + 1} presents #8a63c9 without "legacy"/"RU": ${line.trim().slice(0, 80)}`);
    }
  });
}

// 3 — both gutter tokens
if (!master.includes('--gut')) fails.push(`${MASTER} does not mention --gut`);
if (!master.includes('--gap')) fails.push(`${MASTER} does not mention --gap`);

// 4 — coarse dot pitch
if (!master.includes('24 px')) fails.push(`${MASTER} does not mention the 24 px coarse dot pitch`);

// 5 — the three bezier curves
for (const curve of ['.19,1,.22,1', '.22,1,.36,1', '.2,0,0,1']) {
  if (!master.includes(curve)) fails.push(`${MASTER} is missing the easing curve ${curve}`);
}

// 6 — the mask-bake duration
if (!master.includes('1.65')) fails.push(`${MASTER} does not mention the 1.65 s mask bake`);

// 7 — video master format
if (!video.includes('ProRes 422 HQ')) fails.push('production/video-production-guidelines.md is missing ProRes 422 HQ');
if (!video.includes('Rec.709')) fails.push('production/video-production-guidelines.md is missing Rec.709');
if (!/no audio/i.test(video)) fails.push('production/video-production-guidelines.md does not state that there is no audio');

// 8 — the five family colours
for (const hex of ['#45a654', '#65a30d', '#3d7fd6', '#c34f9a', '#9a9a96']) {
  if (!color.includes(hex)) fails.push(`identity/color-system.md is missing the family colour ${hex}`);
}

if (fails.length) {
  console.log(`GATE_FAIL: ${fails.length} check(s) failed`);
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}

console.log('GATE_PASS');
