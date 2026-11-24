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

// 20 — §14 photography contract
if (!master.includes('## 14.') || !master.includes('Photography contract')) {
  fails.push(`${MASTER} has no "## 14. Photography contract" section`);
}

// 21 — §15 interaction states
if (!master.includes('## 15.') || !master.includes('Interaction states')) {
  fails.push(`${MASTER} has no "## 15. Interaction states" section`);
}

// 22 — §16 network diagram language
if (!master.includes('## 16.') || !master.includes('Network diagram language')) {
  fails.push(`${MASTER} has no "## 16. Network diagram language" section`);
}

// 23 — §17 and §18
if (!master.includes('## 17.') || !master.includes('## 18.')) {
  fails.push(`${MASTER} has no "## 17." / "## 18." headings`);
}

// 24 — the dive invariant
if (!master.includes('sum of opacities') || !master.includes('scale(2.4)')) {
  fails.push(`${MASTER} does not state the dive invariant (sum of opacities / scale(2.4))`);
}

// 25 — the interaction query
if (!master.includes('hover:hover')) {
  fails.push(`${MASTER} does not state the hover:hover interaction query`);
}

// 26 — the two press motions
if (!master.includes('translateY(1px)') || !master.includes('scale(.99)')) {
  fails.push(`${MASTER} does not state both press motions (translateY(1px) / scale(.99))`);
}

// 27 — touch targets and the mobile pre-baked halftone
if (!master.includes('44 px') || !master.includes('pre-baked')) {
  fails.push(`${MASTER} is missing the 44 px touch minimum or the pre-baked halftone fallback`);
}

// 28 — the D1 contrast defect
if (!master.includes('--dim') || !master.includes('3.2:1')) {
  fails.push(`${MASTER} does not record the --dim contrast defect (3.2:1)`);
}

// 29 — the D5 prefers-color-scheme decision
if (!master.includes('prefers-color-scheme') || !/zero occurrences|no occurrences/.test(master)) {
  fails.push(`${MASTER} does not record the prefers-color-scheme zero occurrences decision`);
}

// 30 — the agent guide exists
const guide = read('AGENT_GUIDE.md');
if (!guide) fails.push('AGENT_GUIDE.md is missing');

// 31 — it teaches how to explore the site
if (!guide.includes('How to explore the site')) {
  fails.push('AGENT_GUIDE.md has no "How to explore the site" section');
}

// 32 — it names the interaction query and the press motion
if (!guide.includes('hover:hover') || !guide.includes('translateY(1px)')) {
  fails.push('AGENT_GUIDE.md is missing hover:hover and/or translateY(1px)');
}

// 33 — it records the dead --sand token
if (!guide.includes('--sand') || !(/dead token/i.test(guide) || /unused/i.test(guide))) {
  fails.push('AGENT_GUIDE.md does not record --sand as a dead/unused token');
}

// 34 — it records the zero-form-fields decision
if (!/zero real form fields|zero form fields/i.test(guide)) {
  fails.push('AGENT_GUIDE.md does not record the zero real form fields decision');
}

// 35 — it names both gates
if (!guide.includes('verify_docs.mjs') || !guide.includes('verify_render.mjs')) {
  fails.push('AGENT_GUIDE.md does not name both verification gates');
}

// 36 — README points at the guide
if (!read('README.md').includes('AGENT_GUIDE.md')) {
  fails.push('README.md does not link AGENT_GUIDE.md');
}

// 37 — the seam text inversion device (§12.11)
if (!/mix-blend-mode:\s*difference/.test(master)) {
  fails.push(`${MASTER} does not document the seam text inversion (mix-blend-mode:difference)`);
}

// 38 — the inversion arithmetic (§12.11)
for (const hex of ['#060709', '#e4e3dd']) {
  if (!master.includes(hex)) fails.push(`${MASTER} is missing the inversion result ${hex}`);
}

// 39 — the legibility exception (§12.12)
if (!master.includes('x-seamfull')) {
  fails.push(`${MASTER} does not document the x-seamfull legibility exception`);
}

// 40 — the hero is a photograph (§14.8)
if (!master.includes('HERO_TEX')) {
  fails.push(`${MASTER} does not record HERO_TEX (the hero samples a photograph, not a motif)`);
}

// 41 — the "start with the hero" lesson in the agent guide
if (!guide.includes('HERO_TEX') || !/halftoned photograph/.test(guide)) {
  fails.push('AGENT_GUIDE.md does not record the "start with the hero" lesson (HERO_TEX / halftoned photograph)');
}

// 42 — the live-site comparison notes
const notes = read('references/renders/NOTES.md');
if (!notes.includes('s = 2/32') || !/exact match/i.test(notes)) {
  fails.push('references/renders/NOTES.md does not record the live comparison (s = 2/32 / exact match)');
}

// 43 — the operating brief exists and states the source hierarchy
const briefing = read('BRIEFING.md');
if (!briefing) {
  fails.push('BRIEFING.md is missing');
} else {
  if (!/сайт\s*[—-]\s*главный источник дизайн-элементов/i.test(briefing)) {
    fails.push('BRIEFING.md does not state that the site is the primary source for design elements');
  }
  // the five-step collection protocol
  for (const step of ['Шаг 1', 'Шаг 2', 'Шаг 3', 'Шаг 4', 'Шаг 5']) {
    if (!briefing.includes(step)) fails.push(`BRIEFING.md is missing ${step} of the collection protocol`);
  }
  // the location inventory must be present and concrete
  if (!briefing.includes('en/index.html:61')) {
    fails.push('BRIEFING.md has no concrete token locations (expected en/index.html:61)');
  }
  // the hard prohibitions
  if (!/Не менять сайт/i.test(briefing)) {
    fails.push('BRIEFING.md does not forbid changing the site');
  }
  if (!/Display-P3/.test(briefing)) {
    fails.push('BRIEFING.md does not warn about the Display-P3 reference colour space');
  }
  // the gate-is-not-the-eye rule
  if (!/открыть PNG/i.test(briefing)) {
    fails.push('BRIEFING.md does not require looking at the render, not just the gate');
  }
}

// 44 — README points at the brief
const readme = read('README.md');
if (!readme || !readme.includes('BRIEFING.md')) {
  fails.push('README.md does not link BRIEFING.md');
}

if (fails.length) {
  console.log(`GATE_FAIL: ${fails.length} check(s) failed`);
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}

console.log('GATE_PASS');
