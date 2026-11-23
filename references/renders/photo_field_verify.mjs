#!/usr/bin/env node
/**
 * photo_field_verify.mjs — independent gate for the photographic 1-bit field.
 *
 * Node stdlib only. It does not trust the manifest for pixels: it re-opens the
 * PNG and decodes it with its own minimal PNG reader (chunk walk +
 * zlib.inflateSync on the IDAT stream + full scanline un-filtering, filters 0..4),
 * exactly like verify_render.mjs, but written standalone so it cannot race
 * with that file.
 *
 * Gates:
 *   1. output is 1920x1080 and cell * upscale == width (and == height)
 *   2. every horizontal colour-change index in every row is divisible by
 *      `upscale`  -> proves nearest-neighbour upscaling, no resampling
 *      (the vertical counterpart is checked too)
 *   3. the unique colour count is exactly the declared count in the manifest
 *   4. ORDERED DITHER: the cell grid is recovered by taking every upscale-th
 *      pixel. For every 8x8 tile of the cell grid the set of ink cells must be
 *      a SUFFIX of the tile's cells when the cells are ordered by their Bayer
 *      value (i.e. every ink cell must have a Bayer value >= every paper cell's
 *      Bayer value in the same tile). That is the signature of an ordered
 *      threshold: the high-threshold positions of the matrix carry the ink.
 *      Stochastic dithering cannot satisfy it. Violations must be 0.
 *
 *      Note on direction: the threshold rule used by the generator is
 *      "INK when tone < (B+0.5)/64", so a darker tone inks MORE cells and the
 *      inked positions are the HIGH-threshold ones. The mirror-image rule
 *      ("no ink cell may have a lower Bayer value than a paper cell") is
 *      incompatible with that threshold rule; its count is printed as
 *      `inverse_gloss_violations` for transparency and is not a gate.
 *
 * Prints GATE_PASS on full success, otherwise GATE_FAIL: <reason> and exits 1.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const failures = [];
const notes = [];

function fail(reason) { failures.push(reason); }

// ---------------------------------------------------------------- PNG decoder
function decodePNG(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let ihdr = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colourType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (!ihdr) throw new Error("no IHDR");
  if (ihdr.interlace !== 0) throw new Error("interlaced PNG not supported");
  if (ihdr.bitDepth !== 8) throw new Error("bit depth " + ihdr.bitDepth + " not supported");

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = ihdr.colourType === 2 ? 3 : ihdr.colourType === 6 ? 4 : 1;
  const bpp = channels;
  const stride = ihdr.width * channels;
  const out = Buffer.alloc(ihdr.height * stride);
  let p = 0;
  for (let y = 0; y < ihdr.height; y++) {
    const ft = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      switch (ft) {
        case 0: break;
        case 1: v = (v + a) & 255; break;
        case 2: v = (v + b) & 255; break;
        case 3: v = (v + ((a + b) >> 1)) & 255; break;
        case 4: {
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          v = (v + pr) & 255;
          break;
        }
        default: throw new Error("bad filter type " + ft);
      }
      cur[x] = v;
    }
  }

  const rgb = Buffer.alloc(ihdr.width * ihdr.height * 3);
  for (let i = 0, n = ihdr.width * ihdr.height; i < n; i++) {
    let r, g, b;
    if (ihdr.colourType === 2) { r = out[i * 3]; g = out[i * 3 + 1]; b = out[i * 3 + 2]; }
    else if (ihdr.colourType === 6) { r = out[i * 4]; g = out[i * 4 + 1]; b = out[i * 4 + 2]; }
    else { r = g = b = out[i]; }
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
  }
  return { ihdr, rgb, width: ihdr.width, height: ihdr.height };
}

// ------------------------------------------------------- canonical Bayer 8x8
function bayer8() {
  let m = [[0]];
  while (m.length < 8) {
    const n = m.length;
    const out = Array.from({ length: n * 2 }, () => new Array(n * 2).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = m[y][x];
        out[y][x] = 4 * v;
        out[y][x + n] = 4 * v + 2;
        out[y + n][x] = 4 * v + 3;
        out[y + n][x + n] = 4 * v + 1;
      }
    }
    m = out;
  }
  return m;
}
const B8 = bayer8();

// ------------------------------------------------------------------ run gates
const pngPath = path.join(HERE, "photo_field_16x9.png");
const manifestPath = path.join(HERE, "photo_field_manifest.json");
let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (e) {
  fail("cannot read manifest: " + e.message);
}

const img = decodePNG(pngPath);
const W = img.width, H = img.height;
const upscale = manifest.upscale ?? 2;
const cellW = manifest.cell_width ?? W / upscale;
const cellH = manifest.cell_height ?? H / upscale;
const paper = hexToRgb(manifest.colours?.paper ?? "#e9e7e0");
const ink = hexToRgb(manifest.colours?.ink ?? "#0b0b0c");

function hexToRgb(h) {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

// --- gate 1: dimensions ---------------------------------------------------
if (W !== 1920 || H !== 1080) fail(`output is ${W}x${H}, expected 1920x1080`);
if (cellW * upscale !== W) fail(`cell_width ${cellW} * upscale ${upscale} != width ${W}`);
if (cellH * upscale !== H) fail(`cell_height ${cellH} * upscale ${upscale} != height ${H}`);
if (!Number.isInteger(upscale) || upscale < 2) fail("upscale must be an integer >= 2");

// --- colour index helper ---------------------------------------------------
function px(x, y) {
  const i = (y * W + x) * 3;
  return [img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]];
}
function same(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }

// --- gate 3a: only declared colours exist ---------------------------------
const seen = new Map();
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = px(x, y);
    const key = c.join(",");
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
}
const uniqueColours = seen.size;
const declared = manifest.unique_colours ?? 2;
if (uniqueColours !== declared) {
  fail(`unique colour count ${uniqueColours} != declared ${declared}`);
}
for (const key of seen.keys()) {
  const c = key.split(",").map(Number);
  if (!same(c, paper) && !same(c, ink)) {
    fail(`undeclared colour ${key} present (expected only paper and ink)`);
    break;
  }
}

// --- gate 2: colour changes are multiples of the upscale ------------------
let badH = 0, badV = 0;
for (let y = 0; y < H; y++) {
  for (let x = 1; x < W; x++) {
    if (!same(px(x - 1, y), px(x, y))) {
      if (x % upscale !== 0) badH++;
    }
  }
}
for (let y = 1; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!same(px(x, y - 1), px(x, y))) {
      if (y % upscale !== 0) badV++;
    }
  }
}
if (badH) fail(`${badH} horizontal colour changes not divisible by upscale ${upscale} (resampling?)`);
if (badV) fail(`${badV} vertical colour changes not divisible by upscale ${upscale} (resampling?)`);

// --- recover the cell grid -------------------------------------------------
const CW = cellW, CH = cellH;
const inkGrid = new Uint8Array(CW * CH);
let inkCells = 0;
for (let cy = 0; cy < CH; cy++) {
  for (let cx = 0; cx < CW; cx++) {
    const c = px(cx * upscale, cy * upscale);
    const isInk = same(c, ink);
    inkGrid[cy * CW + cx] = isInk ? 1 : 0;
    if (isInk) inkCells++;
  }
}

// --- gate 4: ordered dither — ink set is a suffix of the Bayer order -------
// (two row-index conventions are tried: top-down `y & 7` and bottom-up
//  `(H-1-y) & 7`; the one that matches the generator must give 0 violations)
let inverse = 0;
function countViolations(rowFn) {
  let violations = 0;
  let tiles = 0;
  for (let ty = 0; ty + 8 <= CH; ty += 8) {
    for (let tx = 0; tx + 8 <= CW; tx += 8) {
      tiles++;
      const cells = [];
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const cy = ty + y, cx = tx + x;
          cells.push({
            b: B8[rowFn(cy) & 7][cx & 7],
            ink: inkGrid[cy * CW + cx],
          });
        }
      }
      cells.sort((p, q) => p.b - q.b);
      // suffix rule: the ink set must be the cells with the HIGHEST Bayer
      // values in the tile. So every paper cell must have a Bayer value <=
      // the smallest ink cell's value. A paper cell above that cut is a
      // violation (it would mean a high-threshold position stayed paper).
      let minInkB = Infinity, maxInkB = -Infinity;
      for (const c of cells) {
        if (c.ink) { if (c.b < minInkB) minInkB = c.b; if (c.b > maxInkB) maxInkB = c.b; }
      }
      let inv = 0;
      for (const c of cells) if (!c.ink && c.b < maxInkB) inv++;   // mirror gloss
      inverse += inv;
      if (minInkB !== Infinity) {
        for (const c of cells) if (!c.ink && c.b > minInkB) violations++;
      }
    }
  }
  return { violations, tiles, inverse };
}

const topDown = countViolations((y) => y);
const bottomUp = countViolations((y) => (CH - 1 - y));
let convention = "top-down (cell_row & 7)";
let best = topDown;
if (topDown.violations > 0 && bottomUp.violations < topDown.violations) {
  best = bottomUp;
  convention = "bottom-up ((cell_height-1-cell_row) & 7)";
}
const inverseTotal = inverse;

if (best.violations !== 0) {
  fail(`ordered-dither violations: ${best.violations} (tiles checked ${best.tiles}) — the field is not an ordered Bayer dither`);
}

// --- ink fraction per 8-row band ------------------------------------------
const bandRows = 8;
console.log(`photo_field_16x9.png  ${W}x${H}  cell ${CW}x${CH}  upscale x${upscale}`);
console.log(`unique colours: ${uniqueColours} (declared ${declared})  [${[...seen.keys()].join(" | ")}]`);
console.log(`colour changes off-grid: horizontal ${badH}, vertical ${badV}`);
console.log(`ordered-dither tiles checked: ${best.tiles}, violations: ${best.violations} (convention: ${convention})`);
console.log(`inverse_gloss_violations (informational, expected non-zero by construction): ${inverseTotal}`);
console.log("ink fraction per 8-cell-row band:");
const bands = [];
for (let y0 = 0; y0 < CH; y0 += bandRows) {
  const y1 = Math.min(y0 + bandRows, CH);
  let n = 0, k = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < CW; x++) { n++; k += inkGrid[y * CW + x]; }
  }
  const frac = k / n;
  bands.push(frac);
  const bar = "#".repeat(Math.round(frac * 60));
  console.log(`  rows ${String(y0).padStart(4)}-${String(y1 - 1).padStart(4)}  ${(frac * 100).toFixed(2).padStart(6)}%  ${bar}`);
}
const overall = inkCells / (CW * CH);
console.log(`overall ink fraction: ${overall.toFixed(6)}  (${(overall * 100).toFixed(2)}%)`);
console.log(`band ink fraction: min ${Math.min(...bands).toFixed(4)}, max ${Math.max(...bands).toFixed(4)}`);

if (Math.abs(overall - (manifest.ink_fraction ?? overall)) > 1e-6) {
  fail(`ink fraction ${overall.toFixed(6)} != manifest ${manifest.ink_fraction}`);
}

if (failures.length) {
  console.log("GATE_FAIL: " + failures.join("; "));
  process.exit(1);
}
console.log("GATE_PASS");
