#!/usr/bin/env node
/**
 * verify_render.mjs — independent gate for the Hou2Touch pure-Python renders.
 *
 * Node stdlib only. It does NOT trust the manifest for pixels: it re-opens every
 * PNG and decodes it with its own minimal PNG reader (chunk walk + zlib.inflateSync
 * on the IDAT stream + full scanline un-filtering, filters 0..4).
 *
 * The images are written by render.py via Pillow as 8-bit truecolour RGB
 * (PNG colour type 2, bit depth 8, non-interlaced) — see render_manifest.json
 * ("png_format"). Colour types 0/2/4/6 and bit depth 8 are supported here.
 *
 * Gates:
 *   1. upscale is an integer >= 2 and cell_width*upscale == output_width
 *      (and cell_height*upscale == output_height)
 *   2. unique RGB colour count <= 4  (TARGET exactly 3: paper + ink + one accent)
 *   3. every pixel is paper, ink, or the declared accent — offenders are counted
 *   4. every horizontal colour-change index in every row is divisible by `upscale`
 *      (proves nearest-neighbour upscaling, not bilinear)
 *   5. accent coverage between 0.5% and 5% of the frame
 *   6. accent is embedded in the ink mass (no accent cell floating on paper,
 *      every accent region touches ink)
 *   7. every declared text rect lies inside a declared quiet zone with >= 2
 *      cells of padding on every side, contains no accent pixels and does
 *      contain ink
 *   8. no ink inside a quiet zone outside the declared text rects (no field
 *      intrusion, no oversized background glyph behind the type)
 *   9. consecutive display lines overlap by <= 2 cells (declared boxes AND the
 *      measured ink profile of the PNG)
 *  10. the largest 4-connected accent region at cell resolution is >= 9 cells
 *  11. every quiet zone bleeds to at least one full outer edge with zero inset
 *  12. no display glyph is larger than the headline
 *
 * Prints GATE_PASS on full success, otherwise GATE_FAIL: <reason> and exits 1.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// `node verify_render.mjs --old <dir>` runs the same gates against a previous
// render set (manifest + PNGs in <dir>) — used to prove that a new gate really
// does catch the defect it was written for.
const USE_DIR = process.argv[2] === "--old" && process.argv[3] ? process.argv[3] : HERE;
const failures = [];
const notes = [];

function fail(reason) {
  failures.push(reason);
}

// ---------------------------------------------------------------- PNG decoder
function decodePNG(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let ihdr = null;
  let palette = null;
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
    } else if (type === "PLTE") {
      palette = Buffer.from(data);
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
  let channels;
  switch (ihdr.colourType) {
    case 0: channels = 1; break;
    case 2: channels = 3; break;
    case 4: channels = 2; break;
    case 6: channels = 4; break;
    case 3: channels = 1; break;
    default: throw new Error("colour type " + ihdr.colourType + " not supported");
  }
  const bpp = ihdr.colourType === 3 ? 1 : channels;
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

  // normalise to RGB triplets
  const rgb = Buffer.alloc(ihdr.width * ihdr.height * 3);
  for (let i = 0, n = ihdr.width * ihdr.height; i < n; i++) {
    let r, g, b;
    if (ihdr.colourType === 2) { r = out[i * 3]; g = out[i * 3 + 1]; b = out[i * 3 + 2]; }
    else if (ihdr.colourType === 6) { r = out[i * 4]; g = out[i * 4 + 1]; b = out[i * 4 + 2]; }
    else if (ihdr.colourType === 0) { r = g = b = out[i]; }
    else if (ihdr.colourType === 4) { r = g = b = out[i * 2]; }
    else { const idx = out[i]; r = palette[idx * 3]; g = palette[idx * 3 + 1]; b = palette[idx * 3 + 2]; }
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
  }
  return { ihdr, rgb, width: ihdr.width, height: ihdr.height };
}

function hex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function parseHex(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------------------------------------------------------------- main
// The 8x8 Bayer matrix, rebuilt from scratch (the canonical recursion
//   M' = [[4M, 4M+2], [4M+3, 4M+1]]  from  [[0]]
// three times).  This is deliberately NOT imported from render.py — the seam
// gate recomputes the matrix and the whole ramp on its own.
function bayer8() {
  let M = [[0]];
  for (let k = 0; k < 3; k++) {
    const n = M.length, N = [];
    for (let i = 0; i < 2 * n; i++) {
      N.push([]);
      for (let j = 0; j < 2 * n; j++) {
        N[i][j] = M[i % n][j % n] * 4 + [[0, 2], [3, 1]][Math.floor(i / n)][Math.floor(j / n)];
      }
    }
    M = N;
  }
  return M.flat(); // row-major, values 0..63
}
const B8 = bayer8();

const manifestPath = path.join(USE_DIR, "render_manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.log("GATE_FAIL: render_manifest.json not found");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

for (const out of manifest.outputs) {
  const label = out.path;
  const file = path.join(USE_DIR, out.path);
  if (!fs.existsSync(file)) { fail(`${label}: file missing`); continue; }

  // ---- gate 1: geometry / integer upscale ------------------------------
  const up = out.upscale;
  if (!Number.isInteger(up) || up < 2) fail(`${label}: upscale ${up} is not an integer >= 2`);
  if (out.cell_width * up !== out.output_width)
    fail(`${label}: cell_width*upscale (${out.cell_width * up}) != output_width (${out.output_width})`);
  if (out.cell_height * up !== out.output_height)
    fail(`${label}: cell_height*upscale (${out.cell_height * up}) != output_height (${out.output_height})`);
  if (out.pure_function !== true) fail(`${label}: manifest pure_function is not true`);

  // ---- independent decode ----------------------------------------------
  let img;
  try { img = decodePNG(file); }
  catch (e) { fail(`${label}: PNG decode failed — ${e.message}`); continue; }

  if (img.width !== out.output_width || img.height !== out.output_height)
    fail(`${label}: PNG is ${img.width}x${img.height}, manifest says ${out.output_width}x${out.output_height}`);

  // ---- gate 2 + 3: palette ----------------------------------------------
  const paper = parseHex(out.paper);
  const ink = parseHex(out.ink);
  const accent = parseHex(out.accent);
  if (!paper || !ink || !accent) { fail(`${label}: manifest palette is malformed`); continue; }
  const allowed = new Map([
    [paper.join(","), "paper"],
    [ink.join(","), "ink"],
    [accent.join(","), "accent"],
  ]);
  const seen = new Map();
  let offenders = 0;
  const n = img.width * img.height;
  for (let i = 0; i < n; i++) {
    const key = `${img.rgb[i * 3]},${img.rgb[i * 3 + 1]},${img.rgb[i * 3 + 2]}`;
    seen.set(key, (seen.get(key) || 0) + 1);
    if (!allowed.has(key)) offenders++;
  }
  if (seen.size > 4) fail(`${label}: ${seen.size} unique colours (max 4)`);
  if (offenders > 0) fail(`${label}: ${offenders} pixels are neither paper, ink, nor accent`);
  if (seen.size !== out.unique_colours)
    fail(`${label}: manifest unique_colours=${out.unique_colours} but PNG has ${seen.size}`);
  if (!out.two_tones_plus_at_most_one_accent)
    fail(`${label}: manifest does not assert two tones + at most one accent`);
  if (out.exactly_two_tones_plus_one_accent === false)
    notes.push(`${label}: TARGET of exactly 3 colours not met (got ${seen.size})`);

  // ---- cell-resolution class grid ---------------------------------------
  const cw = out.cell_width, chh = out.cell_height;
  const inkKey = ink.join(","), accentKey = accent.join(",");
  const cls = new Uint8Array(cw * chh); // 0 paper, 1 ink, 2 accent
  for (let cy = 0; cy < chh; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const i = ((cy * up) * img.width + cx * up) * 3;
      const key = `${img.rgb[i]},${img.rgb[i + 1]},${img.rgb[i + 2]}`;
      cls[cy * cw + cx] = key === accentKey ? 2 : (key === inkKey ? 1 : 0);
    }
  }
  const cellHas = (cx, cy, v) =>
    cx >= 0 && cy >= 0 && cx < cw && cy < chh && cls[cy * cw + cx] === v;

  // ---- gate 5: accent coverage -----------------------------------------
  const accentPixels = seen.get(accentKey) || 0;
  const accentPct = (accentPixels / n) * 100;
  console.log(`   accent: ${accentPixels} px = ${accentPct.toFixed(3)}% of frame`);
  if (accentPct < 0.5) fail(`${label}: accent covers ${accentPct.toFixed(3)}% (min 0.5%)`);
  if (accentPct > 5.0) fail(`${label}: accent covers ${accentPct.toFixed(3)}% (max 5%)`);

  // ---- gate 6: accent containment (at CELL resolution) ------------------
  // Every accent cell must be embedded in the ink mass: it may not float on
  // paper (all four neighbours paper) and its region must touch ink.
  {
    let violations = 0, accentCells = 0, firstV = null;
    for (let cy = 0; cy < chh; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        if (cls[cy * cw + cx] !== 2) continue;
        accentCells++;
        let allPaper = true;
        const nb = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of nb) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cw || ny >= chh) continue; // edge = not paper
          if (cls[ny * cw + nx] !== 0) allPaper = false;
        }
        if (allPaper) {
          violations++;
          if (!firstV) firstV = `cell ${cx},${cy}`;
        }
      }
    }
    console.log(`   accent containment: ${accentCells} accent cells, ${violations} violations`);
    if (violations > 0) fail(`${label}: ${violations} accent cells floating on paper (first: ${firstV})`);
  }

  // ---- gate 10: the accent is a solid block -----------------------------
  // Largest 4-connected accent region at cell resolution must be >= 9 cells.
  let largestCells = [];
  {
    const minBlock = out.accent_min_block_cells ?? 9;
    const seenCell = new Uint8Array(cw * chh);
    let largest = 0, largestAt = null, regions = 0, unembedded = 0;
    for (let cy = 0; cy < chh; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        if (cls[cy * cw + cx] !== 2 || seenCell[cy * cw + cx]) continue;
        regions++;
        const sx = cx, sy = cy;
        const stack = [cy * cw + cx];
        seenCell[cy * cw + cx] = 1;
        let size = 0, touchesInk = false;
        const cells = [];
        while (stack.length) {
          const idx = stack.pop();
          const y = (idx / cw) | 0, x = idx - y * cw;
          size++;
          cells.push([x, y]);
          const nb = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          for (const [dx, dy] of nb) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= cw || ny >= chh) continue;
            const v = cls[ny * cw + nx];
            if (v === 1) touchesInk = true;
            else if (v === 2 && !seenCell[ny * cw + nx]) {
              seenCell[ny * cw + nx] = 1;
              stack.push(ny * cw + nx);
            }
          }
        }
        if (!touchesInk) unembedded++;
        if (size > largest) { largest = size; largestAt = `${sx},${sy}`; largestCells = cells; }
      }
    }
    console.log(`   accent block: ${regions} regions, largest ${largest} cells (min ${minBlock}) at ${largestAt}, unembedded ${unembedded}`);
    if (largest < minBlock)
      fail(`${label}: largest accent region is ${largest} cells (min ${minBlock}) — accent is a hairline, not a mass`);
    if (unembedded > 0)
      fail(`${label}: ${unembedded} accent regions not touching any ink cell`);
  }

  // ---- gates 7, 8, 9, 11, 12: geometry declared in the manifest ----------
  const textRects = out.text_rects;
  const quietZones = out.quiet_zones;
  if (!Array.isArray(textRects) || textRects.length === 0)
    fail(`${label}: manifest declares no text_rects`);
  if (!Array.isArray(quietZones) || quietZones.length === 0)
    fail(`${label}: manifest declares no quiet_zones`);

  if (Array.isArray(textRects) && Array.isArray(quietZones)) {
    const cellPx = up; // one cell == `up` output px
    const padCells = 2;

    // gate 11 — every quiet zone bleeds to a full outer edge, zero inset
    for (const z of quietZones) {
      const insets = {
        left: z.x, top: z.y,
        right: img.width - (z.x + z.w), bottom: img.height - (z.y + z.h),
      };
      const touches = ["left", "top", "right", "bottom"].filter((k) => insets[k] === 0);
      console.log(`   quiet zone [${z.x},${z.y} ${z.w}x${z.h}] insets L${insets.left} T${insets.top} R${insets.right} B${insets.bottom} -> bleeds ${touches.join("+") || "NOWHERE"}`);
      if (touches.length === 0)
        fail(`${label}: quiet zone [${z.x},${z.y} ${z.w}x${z.h}] does not bleed to any outer edge (insets L${insets.left} T${insets.top} R${insets.right} B${insets.bottom})`);
      if (z.w <= 0 || z.h <= 0) fail(`${label}: quiet zone has empty area`);
    }

    // gate 7 — text inside a quiet zone with >= 2 cells of padding, no accent
    //          inside the text, and the text actually present (ink)
    for (const r of textRects) {
      let best = null, bestPad = -Infinity;
      for (const z of quietZones) {
        const pads = {
          left: (r.x - z.x) / cellPx,
          top: (r.y - z.y) / cellPx,
          right: (z.x + z.w - (r.x + r.w)) / cellPx,
          bottom: (z.y + z.h - (r.y + r.h)) / cellPx,
        };
        const minPad = Math.min(pads.left, pads.top, pads.right, pads.bottom);
        if (minPad > bestPad) { bestPad = minPad; best = pads; }
      }
      const inside = bestPad >= padCells;
      console.log(`   text rect "${(r.text || "").slice(0, 24)}" [${r.x},${r.y} ${r.w}x${r.h}] ` +
        `quiet padding L${best ? best.left.toFixed(2) : "?"} T${best ? best.top.toFixed(2) : "?"} ` +
        `R${best ? best.right.toFixed(2) : "?"} B${best ? best.bottom.toFixed(2) : "?"} cells`);
      if (!inside)
        fail(`${label}: text rect "${r.text}" is not inside a quiet zone with >= ${padCells} cells padding (best ${bestPad.toFixed(2)})`);
      // pixels inside the rect: no accent, and there must be ink (the text)
      let accentIn = 0, inkIn = 0, otherIn = 0;
      const px0 = Math.max(0, r.x), py0 = Math.max(0, r.y);
      const px1 = Math.min(img.width, r.x + r.w), py1 = Math.min(img.height, r.y + r.h);
      for (let y = py0; y < py1; y++) {
        for (let x = px0; x < px1; x++) {
          const i = (y * img.width + x) * 3;
          const key = `${img.rgb[i]},${img.rgb[i + 1]},${img.rgb[i + 2]}`;
          if (key === accentKey) accentIn++;
          else if (key === inkKey) inkIn++;
          else if (key === paper.join(",")) { /* paper is fine */ }
          else otherIn++;
        }
      }
      if (accentIn > 0)
        fail(`${label}: ${accentIn} accent pixels inside text rect "${r.text}" — text is clipped/overprinted`);
      if (otherIn > 0)
        fail(`${label}: ${otherIn} foreign pixels inside text rect "${r.text}"`);
      if (inkIn === 0)
        fail(`${label}: text rect "${r.text}" contains no ink — the text is missing`);
    }

    // gate 8 — no ink inside a quiet zone outside the declared text rects
    //          (catches field intrusion and oversized background glyphs)
    for (const z of quietZones) {
      const zx0 = Math.max(0, z.x), zy0 = Math.max(0, z.y);
      const zx1 = Math.min(img.width, z.x + z.w), zy1 = Math.min(img.height, z.y + z.h);
      let strayInk = 0;
      for (let y = zy0; y < zy1; y++) {
        for (let x = zx0; x < zx1; x++) {
          const i = (y * img.width + x) * 3;
          const key = `${img.rgb[i]},${img.rgb[i + 1]},${img.rgb[i + 2]}`;
          if (key !== inkKey) continue;
          let inRect = false;
          for (const r of textRects) {
            if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) { inRect = true; break; }
          }
          if (!inRect) strayInk++;
        }
      }
      console.log(`   quiet zone stray ink outside text rects: ${strayInk} px`);
      if (strayInk > 0)
        fail(`${label}: ${strayInk} ink px inside the quiet zone but outside the text rects — field or background glyph intrudes`);
    }
  }

  // ---- gate 9: no display-line overlap ----------------------------------
  {
    const lines = out.display_lines || [];
    if (lines.length < 2)
      notes.push(`${label}: only ${lines.length} display line(s) declared`);
    let worstDeclared = -Infinity, worstMeasured = -Infinity;
    for (let i = 0; i + 1 < lines.length; i++) {
      const a = lines[i].bbox_cell, b = lines[i + 1].bbox_cell;
      const ov = a[3] - b[1]; // positive = vertical overlap in cells
      worstDeclared = Math.max(worstDeclared, ov);
      // measured from the PNG: rows of the overlap band that carry ink
      const x0 = Math.max(0, Math.min(a[0], b[0])), x1 = Math.min(cw, Math.max(a[2], b[2]));
      const yTop = Math.max(0, Math.ceil(b[1])), yBot = Math.min(chh, Math.floor(a[3]));
      let inkRows = 0;
      for (let cy = yTop; cy <= yBot; cy++) {
        for (let cx = Math.floor(x0); cx < Math.ceil(x1); cx++) {
          if (cls[cy * cw + cx] === 1) { inkRows++; break; }
        }
      }
      worstMeasured = Math.max(worstMeasured, inkRows);
      console.log(`   display lines ${i}->${i + 1}: declared overlap ${ov.toFixed(2)} cells, measured ink rows ${inkRows}`);
    }
    if (worstDeclared > 2)
      fail(`${label}: consecutive display lines overlap by ${worstDeclared.toFixed(2)} cells (max 2)`);
    if (worstMeasured > 2)
      fail(`${label}: measured display-line ink overlap is ${worstMeasured} cells (max 2)`);
  }

  // ---- gate 12: no display glyph larger than the headline ----------------
  {
    const head = out.headline_size ?? 0;
    const maxDisp = out.display_max_size ?? head;
    console.log(`   display sizes: headline ${head}, max ${maxDisp}`);
    if (maxDisp > head)
      fail(`${label}: a display glyph is larger than the headline (${maxDisp} > ${head})`);
    const dispRects = (out.text_rects || []).filter((r) => r.kind === "display");
    const headRect = dispRects.length
      ? dispRects.reduce((a, b) => (a.h >= b.h ? a : b))
      : null;
    for (const r of dispRects) {
      if (headRect && r.h > headRect.h)
        fail(`${label}: display rect "${r.text}" (h=${r.h}) is taller than the headline (h=${headRect.h})`);
    }
  }

  // ---- gate 13: no straight edge (the paper->field junction) -------------
  // P6: "every dark<->light junction is a Bayer seam, never a straight edge
  // and never a blur".  For every composition that declares a field region we
  // scan, at cell resolution, where the paper ends and the field begins.  A
  // straight edge is one column that is the transition on more than 25 % of
  // the lines AND whose lines span at least 30 % of the composition.
  // A composition whose junction IS a Bayer seam band (the §12 pixel seam)
  // declares it and is exempt: the band is verified cell by cell against the
  // live rule by the seam-fidelity gate below.
  {
    const fr = out.field_region;
    if (fr) {
      const hist = new Map();     // transition coord -> {n, minLine, maxLine}
      let n = 0;
      const scan = (get, len, base, line) => {
        let t = -1;
        for (let i = 0; i < len; i++) { const v = get(i); if (v !== 0) { t = i; break; } }
        if (t < 0) return;
        n++;
        const key = t + base;
        const e = hist.get(key) || { n: 0, min: line, max: line };
        e.n++; if (line < e.min) e.min = line; if (line > e.max) e.max = line;
        hist.set(key, e);
      };
      if (fr.axis === "x") {
        for (let cy = fr.cell_y0; cy < fr.cell_y1; cy++)
          scan((i) => cls[cy * cw + fr.cell_x0 + i], fr.cell_x1 - fr.cell_x0, fr.cell_x0, cy);
      } else {
        for (let cx = fr.cell_x0; cx < fr.cell_x1; cx++)
          scan((i) => cls[(fr.cell_y0 + i) * cw + cx], fr.cell_y1 - fr.cell_y0, fr.cell_y0, cx);
      }
      const entries = [...hist.entries()].sort((a, b) => b[1].n - a[1].n);
      const top = entries[0] || [null, { n: 0, min: 0, max: 0 }];
      const dim = fr.axis === "x" ? img.height : img.width;
      console.log(`   straight-edge (${fr.axis}-scan from ${fr.axis === "x" ? fr.cell_x0 : fr.cell_y0}): ` +
        `${n} lines with a transition; worst ${fr.axis}=${top[0]} on ${top[1].n} lines ` +
        `(${(100 * top[1].n / Math.max(1, n)).toFixed(1)}%), spanning lines ${top[1].min}..${top[1].max} ` +
        `(${(100 * (top[1].max - top[1].min + 1) / Math.max(1, n)).toFixed(1)}% of the scanned lines)`);
      if (fr.junction === "bayer_seam_band") {
        // The seam band is no longer exempt BY ASSERTION: it is checked.  For
        // every column of the band, find the first row of the band that
        // carries ink.  A Bayer ramp varies that row from column to column; a
        // straight cut would hold it constant.  The standard deviation of
        // that index is the machine check that replaces the exemption.
        const sm = out.seam;
        const bandTop = Math.round(sm.y_top / up);
        const bandRows = sm.rows * sm.cell;
        const x0c = Math.round(sm.x0 / up);
        const x1c = x0c + Math.round(sm.width / up);
        const firsts = [];
        for (let cx = x0c; cx < x1c; cx++) {
          let first = -1;
          for (let cy = bandTop; cy < bandTop + bandRows; cy++) {
            if (cls[cy * cw + cx] !== 0) { first = cy - bandTop; break; }
          }
          if (first >= 0) firsts.push(first);
        }
        const mean = firsts.reduce((a, b) => a + b, 0) / Math.max(1, firsts.length);
        const sd = Math.sqrt(firsts.reduce((a, b) => a + (b - mean) * (b - mean), 0) /
                              Math.max(1, firsts.length));
        console.log(`   seam band first-ink row: ${firsts.length} columns, ` +
          `mean ${mean.toFixed(2)} cells, std-dev ${sd.toFixed(3)} cells (min 1.0)`);
        if (sd < 1.0)
          fail(`${label}: the seam band is a straight cut, not a Bayer ramp — the first-ink ` +
            `row index varies by only ${sd.toFixed(3)} cells across columns (min 1.0)`);
        else
          console.log(`   straight-edge: exempt — this junction IS the §12 Bayer seam band ` +
            `(proved by the first-ink-row std-dev ${sd.toFixed(3)} cells >= 1.0, and verified ` +
            `cell by cell against the live rule by the seam-fidelity gate)`);
      } else {
        let worst = null;
        for (const [coord, e] of entries) {
          const span = e.max - e.min + 1;
          if (e.n > 0.25 * n && span >= 0.30 * n)
            if (!worst || e.n > worst[1].n) worst = [coord, e];
        }
        if (worst)
          fail(`${label}: straight edge — the paper->field transition is at ${fr.axis}=${worst[0]} ` +
            `(px ${worst[0] * up}) on ${worst[1].n} of ${n} lines (${(100 * worst[1].n / n).toFixed(1)}%, ` +
            `limit 25%) spanning ${worst[1].max - worst[1].min + 1} lines ` +
            `(${(100 * (worst[1].max - worst[1].min + 1) / n).toFixed(1)}% of the scanned lines, limit 30%): ` +
            `a straight cut, not a Bayer seam`);
      }
    }
  }

  // ---- gate 14: motif coherence (the poster's field must read as contours)
  // Three rules:
  //  (a) the strict ink/paper alternation run (the signature of scanline
  //      breakage) must stay under 60 cells;
  //  (b) the longest run of fine dithering (every maximal ink AND paper
  //      sub-run at most 2 cells) must stay under 60 cells;
  //  (c) the STROKE WIDTH: the mean length of the ink runs in a row.  A
  //      contour is a line (1-3 cells); the broken, slab-like terrain measured
  //      11.6 cells per run with 38 % of the field inked — that is the defect
  //      this gate exists to catch.
  if (label === "poster_a4.png" && out.field_region) {
    const fr = out.field_region;
    let longestFine = 0, fineAt = null, longestAlt = 0, altAt = null;
    let inkCells = 0, fieldCells = 0, runs = 0, runCells = 0;
    for (let cy = fr.cell_y0; cy < fr.cell_y1; cy++) {
      let run = 0;
      for (let cx = fr.cell_x0 + 1; cx < fr.cell_x1; cx++) {
        const a = cls[cy * cw + cx - 1] !== 0, b = cls[cy * cw + cx] !== 0;
        if (a !== b) { run++; if (run > longestAlt) { longestAlt = run; altAt = [cx, cy]; } }
        else run = 0;
      }
      const runsRow = [];
      let v = cls[cy * cw + fr.cell_x0] !== 0 ? 1 : 0, l = 0;
      for (let cx = fr.cell_x0; cx < fr.cell_x1; cx++) {
        const b = cls[cy * cw + cx] !== 0 ? 1 : 0;
        fieldCells++;
        if (b) inkCells++;
        if (b === v) l++;
        else { runsRow.push([v, l]); if (v) { runs++; runCells += l; } v = b; l = 1; }
      }
      runsRow.push([v, l]); if (v) { runs++; runCells += l; }
      let cur = 0, curStart = fr.cell_x0, x = fr.cell_x0;
      for (const [val, len] of runsRow) {
        if (len <= 2) {
          if (cur === 0) curStart = x;
          cur += len;
          if (cur > longestFine) { longestFine = cur; fineAt = [curStart, cy]; }
        } else cur = 0;
        x += len;
      }
    }
    const meanRun = runs ? runCells / runs : 0;
    const inkPct = fieldCells ? (100 * inkCells) / fieldCells : 0;
    console.log(`   motif coherence: longest fine-dither run ${longestFine} cells at ${fineAt}, ` +
      `longest strict ink/paper alternation ${longestAlt} cells at ${altAt}, ` +
      `mean ink stroke ${meanRun.toFixed(2)} cells, field ink ${inkPct.toFixed(2)}%`);
    if (longestFine > 60)
      fail(`${label}: the field contains a ${longestFine}-cell horizontal run of fine dithering ` +
        `(at cell ${fineAt}) — the strokes are broken, not contours`);
    if (longestAlt > 60)
      fail(`${label}: the field contains a ${longestAlt}-cell horizontal alternation of ink and paper ` +
        `(at cell ${altAt}) — the signature of scanline breakage`);
    if (meanRun > 6.0)
      fail(`${label}: the mean ink stroke is ${meanRun.toFixed(2)} cells (limit 6.0) with ` +
        `${inkPct.toFixed(2)}% of the field inked — the motif is a slab, not a contour map`);
  }

  // ---- gate 15: the accent is a region, not a geometric cross -------------
  // The accent must not be a drawn shape.  The test is applied to the accent
  // AS A WHOLE — every accent cell — and there is NO aspect precondition:
  // a rectangle or a bar is ~100 % self-similar under 180 deg rotation and
  // under both mirrors, whatever shape its bounding box happens to be.  The
  // old aspect loophole (a 76x24 cell block scored 96.6 % and used to pass
  // because its bbox was not square-ish) is gone.
  {
    const cells = [];
    for (let cy = 0; cy < chh; cy++)
      for (let cx = 0; cx < cw; cx++)
        if (cls[cy * cw + cx] === 2) cells.push([cx, cy]);
    if (cells.length) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of cells) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const set = new Set(cells.map((c) => c[0] + "," + c[1]));
      let s180 = 0, sH = 0, sV = 0;
      for (const [x, y] of cells) {
        if (set.has((x0 + x1 - x) + "," + (y0 + y1 - y))) s180++;
        if (set.has(x + "," + (y0 + y1 - y))) sH++;
        if (set.has((x0 + x1 - x) + "," + y)) sV++;
      }
      const n = cells.length;
      const sc180 = s180 / n, scH = sH / n, scV = sV / n;
      const maxSym = Math.max(sc180, scH, scV);
      console.log(`   accent shape: ${n} accent cells, bbox ${w}x${h} cells ` +
        `(aspect ${(w / h).toFixed(3)}), ` +
        `symmetry 180° ${(sc180 * 100).toFixed(1)}%, mirror-H ${(scH * 100).toFixed(1)}%, ` +
        `mirror-V ${(scV * 100).toFixed(1)}%`);
      if (maxSym >= 0.95)
        fail(`${label}: the accent is a drawn shape — ${n} cells, bbox ${w}x${h}, ` +
          `sym180 ${(sc180 * 100).toFixed(1)}%, mirror-H ${(scH * 100).toFixed(1)}%, ` +
          `mirror-V ${(scV * 100).toFixed(1)}% (limit 95%, no aspect exemption): ` +
          `it is a geometric block, not a region of the field's structure`);
    }
    // the largest single accent region, with the relaxed square-ish tier
    {
      const cells = largestCells;
      if (cells.length) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of cells) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const set = new Set(cells.map((c) => c[0] + "," + c[1]));
      let s180 = 0, sH = 0, sV = 0;
      for (const [x, y] of cells) {
        if (set.has((x0 + x1 - x) + "," + (y0 + y1 - y))) s180++;
        if (set.has(x + "," + (y0 + y1 - y))) sH++;
        if (set.has((x0 + x1 - x) + "," + y)) sV++;
      }
      const n = cells.length;
      const sc180 = s180 / n, scH = sH / n, scV = sV / n;
      const squareish = Math.max(w, h) / Math.min(w, h) <= 1.2;
      const maxSym = Math.max(sc180, scH, scV);
      console.log(`   accent region: largest ${n} cells, bbox ${w}x${h} cells ` +
        `(aspect ${(w / h).toFixed(3)}, square-ish ${squareish}), ` +
        `symmetry 180° ${(sc180 * 100).toFixed(1)}%, mirror-H ${(scH * 100).toFixed(1)}%, ` +
        `mirror-V ${(scV * 100).toFixed(1)}%`);
      if (squareish && maxSym >= 0.85)
        fail(`${label}: the largest accent region is a geometric cross — a ${w}x${h} cell block ` +
          `(square-ish) with sym180 ${(sc180 * 100).toFixed(1)}%, mirror-H ${(scH * 100).toFixed(1)}%, ` +
          `mirror-V ${(scV * 100).toFixed(1)}% (relaxed limit 85%): it is a drawn shape, not a region ` +
          `of the field's structure`);
      }
    }
  }

  // ---- gate 16: large form ----------------------------------------------
  // A field must contain at least one LARGE connected mass: 2000 cells at
  // cell resolution.  This is the "large form" rule — a composition has to
  // read as a few big shapes, not as confetti or dust.  The largest
  // connected ink region (ink + accent, i.e. the drawn mass) is measured
  // for every composition that declares a field.
  if (out.field_region) {
    const seen = new Uint8Array(cw * chh);
    const stack = new Int32Array(cw * chh);
    let best = 0, bestAt = null;
    for (let i = 0; i < cw * chh; i++) {
      if (cls[i] === 0 || seen[i]) continue;
      let sp = 0, size = 0;
      stack[sp++] = i; seen[i] = 1;
      while (sp > 0) {
        const j = stack[--sp]; size++;
        const x = j % cw, y = (j / cw) | 0;
        if (x > 0 && cls[j - 1] !== 0 && !seen[j - 1]) { seen[j - 1] = 1; stack[sp++] = j - 1; }
        if (x < cw - 1 && cls[j + 1] !== 0 && !seen[j + 1]) { seen[j + 1] = 1; stack[sp++] = j + 1; }
        if (y > 0 && cls[j - cw] !== 0 && !seen[j - cw]) { seen[j - cw] = 1; stack[sp++] = j - cw; }
        if (y < chh - 1 && cls[j + cw] !== 0 && !seen[j + cw]) { seen[j + cw] = 1; stack[sp++] = j + cw; }
      }
      if (size > best) { best = size; bestAt = `${i % cw},${(i / cw) | 0}`; }
    }
    console.log(`   large form: largest connected ink region ${best} cells at ${bestAt} (min 2000)`);
    if (best < 2000)
      fail(`${label}: the largest connected ink region is ${best} cells (min 2000) — ` +
        `the field has no large form`);
  }

  // ---- seam gates: only for the composition that declares a seam ---------
  const seam = out.seam;
  if (seam) {
    const cell = seam.cell;             // render cells per seam cell
    const rows = seam.rows;
    const bandH = seam.band_height;      // output px
    const yTop = seam.y_top;             // output px
    const x0 = seam.x0;                  // output px, left edge of the band

    // --- 1. band geometry -------------------------------------------------
    if (rows !== 12) fail(`${label}: seam rows ${rows} (must be 12)`);
    if (bandH !== rows * cell * up)
      fail(`${label}: seam band_height ${bandH} != rows*cell*upscale (${rows * cell * up})`);
    if (yTop % up !== 0 || x0 % up !== 0)
      fail(`${label}: seam band is not cell-aligned (y_top ${yTop}, x0 ${x0})`);
    const cellPx = cell * up;
    const mmExact = (cellPx / 300) * 25.4;
    // this poster uses the PROPORTIONAL scale: the seam keeps its on-screen
    // weight (~10.7% of height) rather than true size (8 px = 0.675 mm, which
    // would make the band a 8.13 mm hairline).  Assert the proportion instead.
    if (seam.scale_used !== "proportional")
      fail(`${label}: seam scale_used ${seam.scale_used} (this poster must use the proportional scale)`);
    const bandPct = (bandH / img.height) * 100;
    if (bandPct < 8 || bandPct > 13)
      fail(`${label}: seam band is ${bandPct.toFixed(2)}% of page height (proportional target 8-13%)`);
    if (seam.x0 !== 0 || seam.width !== img.width)
      fail(`${label}: seam band is not full width (x0 ${seam.x0}, width ${seam.width} of ${img.width})`);
    console.log(`   seam geometry: cell ${cell} render cells = ${cellPx} px = ${mmExact.toFixed(3)} mm (proportional), rows ${rows}, band ${bandH} px = ${bandPct.toFixed(2)}% of page (${(bandH / 300 * 25.4).toFixed(2)} mm), y_top ${yTop}, full width`);

    // --- the band's pixel height in the OUTPUT ----------------------------
    // The row above the band is pure paper, the row below it is the solid
    // dark region: the band is exactly bandH pixels tall.
    {
      const rowIs = (y, want) => {
        if (y < 0 || y >= img.height) return false;
        for (let x = x0; x < img.width; x++) {
          const i = (y * img.width + x) * 3;
          const key = `${img.rgb[i]},${img.rgb[i + 1]},${img.rgb[i + 2]}`;
          if (want === "paper" && key !== paper.join(",")) return false;
          if (want === "ink" && key !== ink.join(",")) return false;
        }
        return true;
      };
      const above = rowIs(yTop - 1, "paper");
      const below = rowIs(yTop + bandH, "ink");
      console.log(`   band edges: row ${yTop - 1} all paper ${above}, row ${yTop + bandH} all ink ${below} -> measured band height ${bandH} px`);
      if (!above) fail(`${label}: the row above the seam band is not pure paper`);
      if (!below) fail(`${label}: the row below the seam band is not solid ink — the band is not exactly ${bandH} px tall`);
      // no accent inside the band
      let accentInBand = 0;
      for (let y = yTop; y < yTop + bandH; y++)
        for (let x = x0; x < img.width; x++) {
          const i = (y * img.width + x) * 3;
          if (`${img.rgb[i]},${img.rgb[i + 1]},${img.rgb[i + 2]}` === accentKey) accentInBand++;
        }
      if (accentInBand > 0) fail(`${label}: ${accentInBand} accent pixels inside the seam band`);
    }

    // --- 2. Bayer fidelity: rebuild the LIVE rule from scratch ------------
    // The live rule is applied verbatim and unquantised:
    //     ink if t > B8[(r % 8) * 8 + (i % 8)]
    // Its realised density is NOT a ramp (the eight Bayer rows have different
    // histograms).  We assert exact agreement with the live rule, not with a
    // monotone ideal — a monotone gate would test a rule the site never ran.
    const bandTopCell = yTop / up;
    const x0Cell = x0 / up;
    const rowFrac = [];
    const rowExpected = [];
    let mismatches = 0, firstMismatch = null;
    for (let r = 0; r < rows; r++) {
      const v = (r + 0.5) / rows;
      const t = Math.min(Math.max(v * 1.3 - 0.3 + (seam.scroll_offset_s ?? 0), 0), 1) * 64;
      let ink = 0, total = 0, expInk = 0;
      for (let rr = r * cell; rr < (r + 1) * cell; rr++) {
        const cy = bandTopCell + rr;
        for (let cx = x0Cell; cx < cw; cx++) {
          const ci = Math.floor((cx - x0Cell) / cell);
          const b = B8[(r % 8) * 8 + (ci % 8)];
          const expected = t > b;                  // the live rule, verbatim
          const actual = cls[cy * cw + cx] !== 0;
          total++;
          if (expected) expInk++;
          if (actual) ink++;
          if (expected !== actual) {
            mismatches++;
            if (!firstMismatch) firstMismatch = `cell ${cx},${cy} (row ${r})`;
          }
        }
      }
      rowFrac.push(ink / total);
      rowExpected.push(expInk / total);
    }
    console.log(`   seam Bayer: ${mismatches} mismatching cells of ${rows * cell * (cw - x0Cell)} (live rule, verbatim, unquantised)`);
    for (let r = 0; r < rows; r++)
      console.log(`     row ${String(r).padStart(2)}: expected ${(rowExpected[r] * 100).toFixed(1)}%  measured ${(rowFrac[r] * 100).toFixed(1)}%`);
    if (mismatches > 0)
      fail(`${label}: ${mismatches} seam cells do not match the live Bayer rule (first: ${firstMismatch})`);

    // --- 3. the band is a band, not noise ---------------------------------
    // The live rule is non-monotone by construction, but it must still ramp
    // from paper to near-ink overall: the first quarter is pure paper and the
    // last quarter is mostly ink.  This catches a broken matrix or a flipped
    // direction without demanding a ramp the site does not have.
    const firstQuarter = rowFrac.slice(0, 3);
    if (firstQuarter.some((f) => f > 1e-9))
      fail(`${label}: seam rows 0..2 must be pure paper (got ${firstQuarter.map((f) => (f * 100).toFixed(1) + '%').join(', ')})`);
    const lastQuarter = rowFrac.slice(rows - 3);
    const lastAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;
    if (lastAvg < 0.75)
      fail(`${label}: seam last three rows average ${(lastAvg * 100).toFixed(1)}% ink (must be >= 75%)`);
    const bandAvg = rowFrac.reduce((a, b) => a + b, 0) / rows;
    if (bandAvg < 0.35 || bandAvg > 0.65)
      fail(`${label}: seam band averages ${(bandAvg * 100).toFixed(1)}% ink (must be 35-65%: a band, not a slab or a void)`);
    console.log(`   seam ramp: rows 0-2 pure paper, last three avg ${(lastAvg * 100).toFixed(1)}%, band avg ${(bandAvg * 100).toFixed(1)}% (non-monotone by construction)`);
  }

  // ---- gate 4: nearest-neighbour proof ----------------------------------
  let bad = 0;
  let firstBad = null;
  for (let y = 0; y < img.height; y++) {
    const row = y * img.width;
    for (let x = 1; x < img.width; x++) {
      const i = row + x;
      const changed =
        img.rgb[i * 3] !== img.rgb[(i - 1) * 3] ||
        img.rgb[i * 3 + 1] !== img.rgb[(i - 1) * 3 + 1] ||
        img.rgb[i * 3 + 2] !== img.rgb[(i - 1) * 3 + 2];
      if (changed && x % up !== 0) {
        bad++;
        if (!firstBad) firstBad = `row ${y} x ${x}`;
      }
    }
  }
  if (bad > 0) fail(`${label}: ${bad} colour changes not on an upscale boundary (first: ${firstBad})`);

  const counts = [...seen.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(
    `OK ${label}: ${img.width}x${img.height} cell ${out.cell_width}x${out.cell_height} up ${up} ` +
    `colours=${seen.size} [${counts}] offenders=${offenders} misaligned_changes=${bad}`
  );
}

for (const nte of notes) console.log("NOTE " + nte);

if (failures.length) {
  console.log("GATE_FAIL: " + failures.join(" | "));
  process.exit(1);
}
console.log("GATE_PASS");
