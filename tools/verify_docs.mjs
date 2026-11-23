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

// 9 — the sixth pillar and the pixel seam
if (!master.includes('P6')) fails.push(`${MASTER} does not declare the P6 pillar`);
if (!/pixel seam/i.test(master)) fails.push(`${MASTER} does not mention the pixel seam`);

// 10 — the new normative sections
if (!/^## 12\./m.test(master)) fails.push(`${MASTER} has no "## 12." heading`);
if (!/^## 13\./m.test(master)) fails.push(`${MASTER} has no "## 13." heading`);

// 11 — the pixel seam numbers
for (const token of ['8 px', '12 rows', '96 px', 'scaleY(-1)']) {
  if (!master.includes(token)) fails.push(`${MASTER} does not mention ${token} for the pixel seam`);
}
if (!master.includes('32 quantised') && !master.includes('32 steps')) {
  fails.push(`${MASTER} does not mention the 32 quantised scroll steps of the pixel seam`);
}

// 12 — the four plate families
for (const family of ['Chip', 'Card', 'Pill CTA', 'Bare plate']) {
  if (!master.includes(family)) fails.push(`${MASTER} does not declare the plate family "${family}"`);
}

// 13 — the junction rule
if (!/junction/i.test(master)) fails.push(`${MASTER} does not state the junction rule`);
if (!master.includes('double statement')) fails.push(`${MASTER} does not state the "double statement" junction rule`);

// 14 — gaps 8 and 11 are resolved
for (const gap of ['8', '11']) {
  const row = master.split('\n').find((line) => line.trim().startsWith(`| ${gap} |`));
  if (!row) {
    fails.push(`${MASTER} has no gaps-table row for gap #${gap}`);
  } else if (!row.includes('RESOLVED')) {
    fails.push(`${MASTER} gaps-table row for gap #${gap} is not marked RESOLVED`);
  }
}

// 15 — §13 reframed as an instrument readout
if (!master.includes('instrument readout')) fails.push(`${MASTER} does not contain "instrument readout"`);

// 16 — colour encodes family, never state
if (!/colour encodes/i.test(master)) fails.push(`${MASTER} does not state that colour encodes the family`);
if (!master.includes('family, never state')) fails.push(`${MASTER} does not state the "family, never state" rule`);

// 17 — the .btn.rec clarification
if (!master.includes('not a recording')) fails.push(`${MASTER} does not clarify that .btn.rec is not a recording indicator`);

// 18 — the TouchDesigner source frame is cited inside §13
if (!master.includes('окно TouchDesigner на бумаге')) fails.push(`${MASTER} does not cite the TouchDesigner source frame`);

// 19 — the wrong framing is gone
if (/stamp on paper/i.test(master)) fails.push(`${MASTER} still contains the removed "stamp on paper" framing`);

if (fails.length) {
  console.log(`GATE_FAIL: ${fails.length} check(s) failed`);
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}

console.log('GATE_PASS');
