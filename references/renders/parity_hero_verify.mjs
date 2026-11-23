#!/usr/bin/env node
/*
 * Independent verifier for the hero parity render.
 *
 * Reads (with a minimal stdlib-only PNG decoder):
 *   - parity_hero_1439x739.png       (this render)
 *   - REFERENCE_gpu_hero_1439x739.png (the GPU reference)
 *
 * Compares the statistics measured on the reference against the same statistics
 * measured on the render, and measures pixel-level agreement.
 *
 * Gate (as specified):
 *   - size 1439x739
 *   - unique colours within +-15 % of the reference's
 *   - #e9e7e1 percentage within +-2 pp
 *   - orange (R>150,G<120,B<90) within +-1.5 pp
 *   - exact #0b0b0c below 0.1 %
 *   - MAE per channel <= 12 and >= 60 % of pixels with max channel difference <= 12
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDER = path.join(HERE, "parity_hero_1439x739.png");
const REFERENCE = path.join(HERE, "REFERENCE_gpu_hero_1439x739.png");

/* ----------------------------------------------------------- PNG decoding */
function decodePNG(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG: " + file);
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  let palette = null;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = Buffer.from(data);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("only 8-bit PNG supported (" + bitDepth + ")");
  if (interlace !== 0) throw new Error("interlaced PNG not supported");
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : colorType === 3 ? 1 : 0;
  if (!channels) throw new Error("unsupported colour type " + colorType);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
  };

  let pos = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[i] = v & 0xff;
    }
    prev = cur;
  }

  /* normalise to RGB triplets */
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0, n = width * height; i < n; i++) {
    let r, g, b;
    if (colorType === 2) { r = out[i * 3]; g = out[i * 3 + 1]; b = out[i * 3 + 2]; }
    else if (colorType === 6) { r = out[i * 4]; g = out[i * 4 + 1]; b = out[i * 4 + 2]; }
    else if (colorType === 0) { r = g = b = out[i]; }
    else { const p = out[i] * 3; r = palette[p]; g = palette[p + 1]; b = palette[p + 2]; }
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
  }
  return { width, height, data: rgb };
}

/* ------------------------------------------------------------- statistics */
function stats(img) {
  const { width, height, data } = img;
  const total = width * height;
  const seen = new Map();
  let paper = 0, ink = 0, orange = 0, nearPaper = 0;
  for (let i = 0; i < total; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const key = (r << 16) | (g << 8) | b;
    seen.set(key, (seen.get(key) || 0) + 1);
    if (r === 0xe9 && g === 0xe7 && b === 0xe1) paper++;
    if (r === 0x0b && g === 0x0b && b === 0x0c) ink++;
    if (r > 150 && g < 120 && b < 90) orange++;
    if (Math.abs(r - 0xe9) <= 8 && Math.abs(g - 0xe7) <= 8 && Math.abs(b - 0xe1) <= 8) nearPaper++;
  }
  return {
    width, height,
    total,
    unique: seen.size,
    paperPct: 100 * paper / total,
    inkPct: 100 * ink / total,
    orangePct: 100 * orange / total,
    nearPaperPct: 100 * nearPaper / total,
  };
}

function compare(a, b) {
  const n = a.width * a.height;
  let sum = 0, within = 0, max = 0;
  for (let i = 0; i < n; i++) {
    const dr = Math.abs(a.data[i * 3] - b.data[i * 3]);
    const dg = Math.abs(a.data[i * 3 + 1] - b.data[i * 3 + 1]);
    const db = Math.abs(a.data[i * 3 + 2] - b.data[i * 3 + 2]);
    sum += dr + dg + db;
    const m = Math.max(dr, dg, db);
    if (m > max) max = m;
    if (m <= 12) within++;
  }
  return { mae: sum / (n * 3), withinPct: 100 * within / n, max };
}

/* ------------------------------------------------------------------ main */
function main() {
  const failures = [];
  const render = decodePNG(RENDER);
  const reference = decodePNG(REFERENCE);
  const rs = stats(render);
  const gs = stats(reference);
  const cmp = compare(render, reference);

  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log("PARITY VERIFIER — site's own hero shader, Python/NumPy vs GPU reference");
  console.log("");
  console.log(pad("metric", 34) + padL("reference", 14) + padL("render", 14) + padL("delta", 12));
  console.log("-".repeat(74));
  const row = (name, r, v, delta) =>
    console.log(pad(name, 34) + padL(r, 14) + padL(v, 14) + padL(delta, 12));
  row("size", gs.width + "x" + gs.height, rs.width + "x" + rs.height, "-");
  row("unique colours", gs.unique, rs.unique, (rs.unique - gs.unique >= 0 ? "+" : "") + (rs.unique - gs.unique));
  row("#e9e7e1 %", gs.paperPct.toFixed(3), rs.paperPct.toFixed(3), (rs.paperPct - gs.paperPct).toFixed(3) + " pp");
  row("#0b0b0c % (exact)", gs.inkPct.toFixed(3), rs.inkPct.toFixed(3), (rs.inkPct - gs.inkPct).toFixed(3) + " pp");
  row("orange % (R>150,G<120,B<90)", gs.orangePct.toFixed(3), rs.orangePct.toFixed(3), (rs.orangePct - gs.orangePct).toFixed(3) + " pp");
  row("within +-8 of paper %", gs.nearPaperPct.toFixed(3), rs.nearPaperPct.toFixed(3), (rs.nearPaperPct - gs.nearPaperPct).toFixed(3) + " pp");
  row("MAE per channel", "-", cmp.mae.toFixed(4), "-");
  row("max channel difference", "-", cmp.max, "-");
  row("pixels with max diff <= 12 %", "-", cmp.withinPct.toFixed(3), "-");
  console.log("");

  const check = (ok, msg) => { if (!ok) failures.push(msg); };

  check(rs.width === 1439 && rs.height === 739, "render is not 1439x739");
  const uniqLo = gs.unique * 0.85, uniqHi = gs.unique * 1.15;
  check(rs.unique >= uniqLo && rs.unique <= uniqHi,
    "unique colours " + rs.unique + " outside +-15 % of " + gs.unique + " (" + Math.round(uniqLo) + ".." + Math.round(uniqHi) + ")");
  check(Math.abs(rs.paperPct - gs.paperPct) <= 2.0,
    "#e9e7e1 " + rs.paperPct.toFixed(3) + " % outside +-2 pp of " + gs.paperPct.toFixed(3) + " %");
  check(Math.abs(rs.orangePct - gs.orangePct) <= 1.5,
    "orange " + rs.orangePct.toFixed(3) + " % outside +-1.5 pp of " + gs.orangePct.toFixed(3) + " %");
  check(rs.inkPct < 0.1, "exact #0b0b0c is " + rs.inkPct.toFixed(3) + " % (>= 0.1 %)");
  check(cmp.mae <= 12, "MAE " + cmp.mae.toFixed(4) + " > 12");
  check(cmp.withinPct >= 60, "pixels within 12: " + cmp.withinPct.toFixed(3) + " % < 60 %");

  if (failures.length) {
    console.log("GATE_FAIL: " + failures.join("; "));
    process.exit(1);
  }
  console.log("GATE_PASS");
}

main();
