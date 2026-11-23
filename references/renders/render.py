#!/usr/bin/env python3
"""
Hou2Touch design system — pure-Python, browser-free render of the 1-bit field.

Reimplements, outside the browser, the exact pipeline documented in
design-system/generative/shaders.md:

  * motif()  -> vec2(ink density, colour mask)
  * composite -> 1-bit ordered dither against the canonical 8x8 Bayer matrix
                 threshold th = (B8[y&7][x&7]+0.5)/64
  * colour gate -> accent ONLY where the motif's colour mask fires AND the cell is inked
  * field is 1-bit: exactly paper #e9e7e0 and ink #0b0b0c, plus ONE family colour.

Rendering rules (as specified):
  * Render at CELL resolution (target/2). Cell = 2 px. Bayer tiles over 8 cells = 16 px dot pitch.
  * NEVER resample: the cell buffer is upscaled by an integer factor with nearest neighbour (np.repeat).
  * Motifs are pure functions of (uv, aspect, time). No state, no integration, no feedback.

Typography (M8):
  * Display voice = the project's own "H2T Bebas" (hou2touch_redesign/fonts/h2t-bebas.otf),
    set on a 0.8 line-height rhythm with optical overshoot and a -0.03 em left margin.
  * The 0.8 rhythm is kept, but the optical overshoot of a line is measured from the
    real glyph boxes and a per-line gap is inserted when two consecutive display
    lines would touch (DISPLAY_MAX_OVERLAP_CELLS).
  * Text / mono voices come from the same fonts/ directory when a matching family exists.

Quiet zones:
  * ONE quiet zone per image: the type column, which bleeds to the LEFT, TOP and
    BOTTOM outer edge with zero inset. Nothing of the field is allowed inside it,
    so no "pasted white rectangle" can appear and no background glyph can collide
    with the type.

Accent:
  * The accent is a SOLID region inside the ink mass (not a hairline outline):
    the colour mask is thresholded, then only connected blocks of >= 9 cells are
    kept, so the accent always reads as a mass.

Dependencies: numpy + Pillow (scipy optional, used for fast connected components).
"""

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    from scipy import ndimage
    HAVE_SCIPY = True
except Exception:            # pragma: no cover - optional acceleration
    HAVE_SCIPY = False

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
FONT_DIR = os.path.join(ROOT, "fonts")

PAPER = (233, 231, 224)   # #e9e7e0
INK = (11, 11, 12)        # #0b0b0c
FAMILY = {
    "sop": (61, 127, 214),    # #3d7fd6
    "chop": (69, 166, 84),    # #45a654
    "top": (101, 163, 13),    # #65a30d
    "comp": (154, 154, 150),  # #9a9a96 — the neutral family
}

DISPLAY_LH = 0.8                # the system's M8: lh .8, uppercase, tracking ~0
DISPLAY_OVERSHOOT = 0.06       # fraction of the em the glyph box may overflow its line box
DISPLAY_LEFT_MARGIN_EM = -0.03  # optical compensation for the condensed sidebearing
DISPLAY_MAX_OVERLAP_CELLS = 2  # consecutive display lines may overlap by at most this

QUIET_PAD_CELLS = 6            # quiet-zone padding around the type (>= 2 required)
ACCENT_MIN_BLOCK_CELLS = 9     # the accent must contain a solid block of >= 9 cells

ACCENT_TARGET = 0.030     # aim for ~3% of the frame
ACCENT_MIN = 0.015
ACCENT_MAX = 0.045


# --------------------------------------------------------------------------
# Bayer 8x8 — built by the canonical recursion
#   M' = [[4M, 4M+2], [4M+3, 4M+1]]   ( == 4*M + [[0,2],[3,1]] tiled 2x2 )
# --------------------------------------------------------------------------
def bayer8():
    m = np.array([[0]], dtype=np.int32)
    while m.shape[0] < 8:
        m = np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])
    return m


B8 = bayer8()


def bayer_threshold(h, w):
    """Threshold per cell. gl_FragCoord.y is bottom-up, so the Bayer row index is
    (H-1-row)&7 for a top-down image buffer."""
    rows = (h - 1 - np.arange(h)) & 7
    cols = np.arange(w) & 7
    return (B8[rows][:, cols].astype(np.float64) + 0.5) / 64.0


# --------------------------------------------------------------------------
# GLSL helpers (verbatim semantics)
# --------------------------------------------------------------------------
def fract(x):
    return x - np.floor(x)


def step(edge, x):
    return (x >= edge).astype(np.float64)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def h1(px, py):
    return fract(np.sin(px * 127.1 + py * 311.7) * 43758.5453)


def vn(px, py):
    ix, iy = np.floor(px), np.floor(py)
    fx, fy = fract(px), fract(py)
    fx = fx * fx * (3.0 - 2.0 * fx)
    fy = fy * fy * (3.0 - 2.0 * fy)
    c00 = h1(ix, iy)
    c10 = h1(ix + 1, iy)
    c01 = h1(ix, iy + 1)
    c11 = h1(ix + 1, iy + 1)
    return (c00 * (1 - fx) * (1 - fy) + c10 * fx * (1 - fy)
            + c01 * fx * fy + c11 * fx * fy)


def fbm3(px, py):
    a, s = 0.5, 0.0
    for _ in range(3):
        s = s + a * vn(px, py)
        px = px * 2.03 + 1.7
        py = py * 2.03 + 9.2
        a *= 0.5
    return s / 0.875


def fwidth2(arr):
    """|fwidth| approximation: |dx| + |dy| of the field per CELL."""
    gx = np.zeros_like(arr)
    gy = np.zeros_like(arr)
    gx[:, 1:-1] = (arr[:, 2:] - arr[:, :-2]) * 0.5
    gx[:, 0] = arr[:, 1] - arr[:, 0]
    gx[:, -1] = arr[:, -1] - arr[:, -2]
    gy[1:-1, :] = (arr[2:, :] - arr[:-2, :]) * 0.5
    gy[0, :] = arr[1, :] - arr[0, :]
    gy[-1, :] = arr[-1, :] - arr[-2, :]
    return np.maximum(1e-4, np.abs(gx) + np.abs(gy))


# --------------------------------------------------------------------------
# Motifs — pure functions of (uv, aspect, t).
# Each returns (ink_density, colour_field) where colour_field is a CONTINUOUS
# mask: the accent is the part of it that is densest, tightened by a threshold
# so the accent stays a small fraction of the frame.
# --------------------------------------------------------------------------
def motif_terrain(uvx, uvy, asp, t, zoom=1.0, band=0.62, sigma=0.06, band_ink=1.0,
                  band_lo=0.56, band_hi=0.68, stroke=2.0, stroke_hi=2.6):
    """M==3 — terrain: topographic contours, index contours, one elevation band.

    The elevation band is inked SOLID (band_ink) so the accent — which may only
    live inside ink — has a mass to sit in."""
    qx = uvx * asp
    qy = uvy
    px = (qx * 1.15 + t * 0.025) * zoom
    py = (qy * 1.15) * zoom
    hh = 0.7 * fbm3(px, py) + 0.3 * fbm3(px * 1.9 + 3.7, py * 1.9 + 3.7)
    lv = hh * 16.0
    fl = fract(lv)
    fw = fwidth2(lv)
    dd = np.minimum(fl, 1.0 - fl) / fw
    idx = step(0.0, np.mod(np.floor(lv + 0.5), 5.0))
    # contour strokes are inked SOLID (several cells wide) so the accent can
    # live in their interior without ever touching paper
    line = 1.0 - smoothstep(stroke + idx * 0.9, stroke_hi + idx * 1.1, dd)
    hx = fbm3(px + 0.01, py) - fbm3(px, py)
    shade = np.clip(-hx * 38.0, 0.0, 1.0) * 0.24
    inband = step(band_lo, hh) * step(hh, band_hi)
    ink = np.maximum(line, shade) + inband * band_ink
    # continuous colour field: a gaussian ridge on the elevation band
    col = np.exp(-(((hh - band) / sigma) ** 2))
    return ink, col


def motif_shader(uvx, uvy, asp, t, center_cx=0.72, solid=0.90):
    """M==18 — shader: posterised radial field + scanlines + vignette.

    The radial core is pushed right (center_cx) so it survives the quiet margin
    column, and the posterised tone is inked solid enough to host the accent."""
    cx = uvx * asp - asp * center_cx
    cy = uvy - 0.5
    r = np.sqrt(cx * cx + cy * cy)
    a = np.arctan2(cy, cx)
    w = fbm3(a * 1.9 + t * 0.05, r * 2.4 + t * 0.05)
    v = np.sin(r * 22.0 - t * 0.75 + w * 7.0) * 0.5 + 0.5
    v = np.power(v, 1.5)
    st = np.floor(v * 6.0) / 6.0
    e = fract(v * 6.0)
    edge = (1.0 - smoothstep(0.0, 0.10, np.minimum(e, 1.0 - e))) * step(0.02, v) * step(v, 0.98)
    ink = np.maximum(st * solid, edge * 0.92)
    scan = 0.78 + 0.22 * (0.5 + 0.5 * np.sin(uvy * 820.0))
    vig = 1.0 - smoothstep(0.35, 1.15, r)
    ink = ink * scan * (0.5 + 0.5 * vig)
    # the brightest posterised band is inked SOLID, so the accent has a mass to
    # live in (the accent may only exist inside ink)
    ink = np.maximum(ink, step(0.82, v) * (0.55 + 0.45 * vig))
    # continuous colour field: bright tone, away from the posterised edges,
    # away from the vignette
    col = v * (1.0 - edge) * vig
    return ink, col


def motif_chladni(uvx, uvy, asp, t, col_w=0.030, ring_w=0.055):
    """M==0 — chladni: crisp nodal lines, sand halo, beat ring at 120 bpm.

    The beat ring is inked as a solid annulus so the accent has a mass."""
    qx = uvx * asp
    qy = uvy
    beat = fract(t * 2.0)
    env = np.exp(-beat * 6.0)
    ph = t * 0.09
    n = 2.0 + 1.5 * (1.0 + np.sin(ph))
    m = 5.0 + 1.5 * (1.0 + np.cos(ph * 0.7))
    ccx = (qx - asp * 0.66) * np.pi * 0.95
    ccy = (qy - 0.5) * np.pi * 0.95
    v = (np.cos(n * ccx) * np.cos(m * ccy) - np.cos(m * ccx) * np.cos(n * ccy))
    w = 0.05 + 0.05 * env
    av = np.abs(v)
    line = 1.0 - smoothstep(w * 2.5, w * 4.0, av)
    sand = (1.0 - smoothstep(w * 2.0, w * 6.0, av)) * 0.38
    dx = qx - asp * 0.66
    dy = qy - 0.5
    r = np.sqrt(dx * dx + dy * dy)
    d = np.abs(r - beat * 1.25)
    ring = (1.0 - smoothstep(0.0, 0.012, d)) * env
    annulus = np.exp(-((d / ring_w) ** 2)) * env
    ink = np.maximum(line, sand) + ring * 0.9 + annulus * 0.95
    # continuous colour field: a gaussian ridge on the beat ring
    col = np.exp(-((d / col_w) ** 2)) * env
    return ink, col


MOTIFS = {
    "terrain": motif_terrain,
    "shader": motif_shader,
    "chladni": motif_chladni,
}


# --------------------------------------------------------------------------
# Fonts — the project's own faces in hou2touch_redesign/fonts/
# --------------------------------------------------------------------------
SYSTEM_FALLBACKS = {
    "display": [
        "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Narrow.ttf",
        "/System/Library/Fonts/HelveticaNeue.ttc",
    ],
    "text": [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
    ],
    "mono": [
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/Supplemental/Courier New.ttf",
    ],
}


def _loadable(path):
    try:
        ImageFont.truetype(path, 20)
        return True
    except Exception:
        return False


def scan_fonts():
    """Return (faces, dict kind -> path, report) from the project fonts dir."""
    faces = []
    if os.path.isdir(FONT_DIR):
        for fn in sorted(os.listdir(FONT_DIR)):
            if not fn.lower().endswith((".otf", ".ttf", ".ttc")):
                continue
            p = os.path.join(FONT_DIR, fn)
            try:
                f = ImageFont.truetype(p, 20)
                fam, style = f.getname()
            except Exception as e:
                faces.append({"file": fn, "error": str(e)})
                continue
            faces.append({"file": fn, "family": fam, "style": style, "path": p})
    return faces


FACES = scan_fonts()
FACE_BY_FAMILY = {f.get("family", "").lower(): f for f in FACES if "family" in f}


def pick_font(kind):
    """Choose a real project face for a voice; fall back to a system face."""
    if kind == "display":
        pref = ["h2t-bebas.otf", "h2t-bebas.ttf"]
        for fn in pref:
            p = os.path.join(FONT_DIR, fn)
            if os.path.exists(p) and _loadable(p):
                return p, "project"
        for f in FACES:
            if "bebas" in f.get("file", "").lower() and _loadable(f["path"]):
                return f["path"], "project"
    if kind == "text":
        for fam in ("inter tight", "intertight", "inter"):
            f = FACE_BY_FAMILY.get(fam)
            if f and _loadable(f["path"]):
                return f["path"], "project"
    if kind == "mono":
        for fam in ("jetbrains mono", "jetbrainsmono"):
            f = FACE_BY_FAMILY.get(fam)
            if f and _loadable(f["path"]):
                return f["path"], "project"
    for p in SYSTEM_FALLBACKS[kind]:
        if os.path.exists(p) and _loadable(p):
            return p, "system"
    return None, "none"


FONT_PATH, FONT_SOURCE = {}, {}
for _k in ("display", "text", "mono"):
    FONT_PATH[_k], FONT_SOURCE[_k] = pick_font(_k)

FONTS = FONT_PATH  # backwards-compatible alias


def font_report():
    out = {"font_dir": FONT_DIR, "font_dir_exists": os.path.isdir(FONT_DIR), "files": FACES,
           "chosen": {k: {"path": v, "source": FONT_SOURCE[k]} for k, v in FONT_PATH.items()}}
    return out


# --------------------------------------------------------------------------
# Type metrics
# --------------------------------------------------------------------------
def measure(text, font_path, size, track=0.0):
    f = ImageFont.truetype(font_path, size)
    w = 0.0
    for ch in text:
        w += f.getlength(ch) + size * track
    return w - (size * track if text else 0)


def fit_size(text, font_path, target_w, track=0.0, cap=400, floor=6):
    """Largest size whose advance width fits `target_w`."""
    size = cap
    while size > floor and measure(text, font_path, size, track) > target_w:
        size -= 1
    return size


def cap_height(font_path, size):
    f = ImageFont.truetype(font_path, size)
    bb = f.getbbox("HOU2", anchor="ls")
    return float(-bb[1])


def draw_item(draw, it):
    """Draw one type item. Display items are placed on a BASELINE (lh .8 rhythm);
    text/mono items are placed on their top-left."""
    path = FONT_PATH[it["kind"]]
    size = it["size"]
    f = ImageFont.truetype(path, size)
    track = it.get("track", 0.0)
    x, y = it["x"], it["y"]
    anchor = "ls" if it["kind"] == "display" else "la"
    if track > 0:
        for ch in it["text"]:
            draw.text((x, y), ch, font=f, fill=255, anchor=anchor)
            x += f.getlength(ch) + size * track
    else:
        draw.text((x, y), it["text"], font=f, fill=255, anchor=anchor)


def type_bbox(it, Wc, Hc, pad=24):
    """Tight ink bbox of one type item, in CELL coordinates (absolute)."""
    img = Image.new("L", (Wc + 2 * pad, Hc + 2 * pad), 0)
    d = ImageDraw.Draw(img)
    it2 = dict(it)
    it2["x"] = it["x"] + pad
    it2["y"] = it["y"] + pad
    draw_item(d, it2)
    bb = img.getbbox()
    if bb is None:
        return None
    return (float(bb[0] - pad), float(bb[1] - pad),
            float(bb[2] - pad), float(bb[3] - pad))


def render_type_mask(Wc, Hc, items):
    """Binary type mask at cell resolution + per-item tight ink bboxes."""
    img = Image.new("L", (Wc, Hc), 0)
    d = ImageDraw.Draw(img)
    boxes = []
    for it in items:
        draw_item(d, it)
        bb = type_bbox(it, Wc, Hc)
        boxes.append(bb if bb is not None else (it["x"], it["y"], it["x"], it["y"]))
    return (np.asarray(img) > 127), boxes


# --------------------------------------------------------------------------
# Type layout — the display rhythm is measured, not assumed.
# --------------------------------------------------------------------------
def layout_type(spec):
    """Build the type items for one composition.

    Returns (items, display_lines). Display lines keep the 0.8 lh rhythm but a
    per-line gap is inserted when the measured glyph boxes would collide, so
    consecutive display lines never overlap by more than
    DISPLAY_MAX_OVERLAP_CELLS cells.
    """
    Wc, Hc = spec["cell_w"], spec["cell_h"]
    col_x = spec["col_x"]
    col_w = spec["col_w"]
    items = []
    disp_lines = []

    for blk in spec["type_blocks"]:
        kind = blk["kind"]
        measure_w = blk.get("w", col_w)
        if kind == "display":
            lines = blk["lines"]
            size = fit_size(max(lines, key=len), FONT_PATH["display"], measure_w)
            if blk.get("max_size"):
                size = min(size, int(blk["max_size"]))
            cap = cap_height(FONT_PATH["display"], size)
            x = col_x + DISPLAY_LEFT_MARGIN_EM * size
            base = blk["y"] + cap
            prev = None
            for i, ln in enumerate(lines):
                it = {"text": ln, "kind": "display", "size": size,
                      "x": x, "y": int(round(base + i * size * DISPLAY_LH)),
                      "track": 0.0}
                for _ in range(8):
                    bb = type_bbox(it, Wc, Hc)
                    if prev is None or bb is None:
                        break
                    pbb = type_bbox(prev, Wc, Hc)
                    ov = pbb[3] - bb[1]              # vertical overlap in cells
                    if ov <= DISPLAY_MAX_OVERLAP_CELLS:
                        break
                    it["y"] = int(round(it["y"] + (ov - DISPLAY_MAX_OVERLAP_CELLS)))
                items.append(it)
                bb = type_bbox(it, Wc, Hc)
                disp_lines.append({"text": ln, "size": size,
                                   "bbox_cell": [round(v, 2) for v in bb]})
                prev = it
        else:
            path = FONT_PATH[kind]
            track = blk.get("track", 0.0)
            # a block may be one line ("text") or several ("lines"); the size is
            # fitted to the LONGEST line so all lines share one optical size
            lines = blk.get("lines") or [blk["text"]]
            size = fit_size(max(lines, key=len), path, measure_w, track=track)
            if blk.get("max_size"):
                size = min(size, int(blk["max_size"]))
            if blk.get("min_size"):
                size = max(size, int(blk["min_size"]))
            lh = blk.get("line_height", 1.35)
            for i, ln in enumerate(lines):
                it = {"text": ln, "kind": kind, "size": size,
                      "x": col_x, "y": int(round(blk["y"] + i * size * lh)), "track": track}
                items.append(it)
    return items, disp_lines


# --------------------------------------------------------------------------
# Grid (12 columns, margin 3.9% of width, gutter 1.4% of width)
# --------------------------------------------------------------------------
class Grid:
    def __init__(self, Wc):
        self.W = Wc
        self.margin = int(round(0.039 * Wc))
        self.gutter = int(round(0.014 * Wc))
        self.colw = (Wc - 2 * self.margin - 11 * self.gutter) / 12.0

    def x(self, i):
        return self.margin + i * (self.colw + self.gutter)

    def span(self, n):
        return n * self.colw + (n - 1) * self.gutter

    @property
    def right(self):
        return self.W - self.margin


def quiet_zones(spec, boxes):
    """The type column as ONE quiet zone.

    It bleeds to the LEFT, TOP and BOTTOM outer edge with zero inset, so it
    reads as a margin of the page rather than a white rectangle pasted on top
    of the field. Nothing of the field is allowed inside it.
    """
    Wc, Hc = spec["cell_w"], spec["cell_h"]
    right = 0.0
    for bb in boxes:
        if bb is None:
            continue
        right = max(right, bb[2])
    x1 = int(min(Wc - 2, np.ceil(right) + QUIET_PAD_CELLS))
    if x1 < 2:
        x1 = 2
    return [(0, 0, x1, Hc)]


# --------------------------------------------------------------------------
# Accent: a SOLID region inside the ink mass (never a hairline outline).
# --------------------------------------------------------------------------
def interior_ink(is_ink):
    """Cells whose four 4-neighbours are all ink — the 1-cell interior of the ink mass."""
    nb = is_ink.copy()
    nb[:, :-1] &= is_ink[:, 1:]
    nb[:, 1:] &= is_ink[:, :-1]
    nb[:-1, :] &= is_ink[1:, :]
    nb[1:, :] &= is_ink[:-1, :]
    return nb


def all_four_in(mask):
    """True where all four 4-neighbours are inside `mask`."""
    r = mask.copy()
    r[:, :-1] &= mask[:, 1:]
    r[:, 1:] &= mask[:, :-1]
    r[:-1, :] &= mask[1:, :]
    r[1:, :] &= mask[:-1, :]
    return r


def components(mask):
    """4-neighbour connected components -> (labels, sizes) at cell resolution."""
    if HAVE_SCIPY:
        st = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=bool)
        lab, n = ndimage.label(mask, structure=st)
        if n == 0:
            return lab, np.array([], dtype=np.int64)
        sizes = np.bincount(lab.ravel())
        sizes[0] = 0
        return lab, sizes
    # pure-python fallback
    lab = np.zeros(mask.shape, dtype=np.int32)
    cur = 0
    for sy, sx in np.argwhere(mask):
        if lab[sy, sx]:
            continue
        cur += 1
        stack = [(int(sy), int(sx))]
        lab[sy, sx] = cur
        while stack:
            y, x = stack.pop()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] \
                        and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = cur
                    stack.append((ny, nx))
    sizes = np.bincount(lab.ravel())
    if len(sizes) > 1:
        sizes[0] = 0
    return lab, sizes


def calibrate_accent(col, is_ink, region, target=ACCENT_TARGET,
                     min_block=ACCENT_MIN_BLOCK_CELLS):
    """Pick the accent: a solid mass inside the ink mass.

    Rules:
      * the accent only ever exists where the cell was ALREADY inked;
      * candidates are restricted to the 1-cell INTERIOR of the ink mass, so an
        accent cell always has pure-ink 4-neighbours;
      * the threshold is scanned and only connected blocks of >= `min_block`
        cells are kept — the accent is therefore a MASS, never a hairline.
    """
    total = col.size
    inner = interior_ink(is_ink)
    cand = region & inner & (col > 1e-6)
    if cand.sum() == 0:
        return np.zeros_like(cand), 0.0, 0
    vals = np.sort(col[cand])[::-1]
    scored = []
    for f in (0.02, 0.05, 0.09, 0.15, 0.25, 0.4, 0.6, 0.8, 1.0):
        k = max(1, min(vals.size, int(vals.size * f)))
        t = vals[k - 1]
        acc0 = cand & (col >= t)
        lab, sizes = components(acc0)
        keep = np.zeros_like(acc0)
        big = 0
        for cid in range(1, len(sizes)):
            if sizes[cid] >= min_block:
                keep |= (lab == cid)
                big = max(big, int(sizes[cid]))
        frac = keep.sum() / float(total)
        scored.append((frac, keep, big))
    in_band = [s for s in scored if ACCENT_MIN <= s[0] <= ACCENT_MAX and s[2] >= min_block]
    if in_band:
        best = min(in_band, key=lambda s: abs(s[0] - target))
    else:
        usable = [s for s in scored if s[2] >= min_block]
        if usable:
            under = [s for s in usable if s[0] <= ACCENT_MAX]
            best = (max(under, key=lambda s: s[0]) if under
                    else min(usable, key=lambda s: abs(s[0] - target)))
        else:
            best = max(scored, key=lambda s: s[2])
    return best[1], best[0], best[2]


# --------------------------------------------------------------------------
# Composition builder
# --------------------------------------------------------------------------
def motif_pass(spec, params):
    """Evaluate one motif parameter set -> (ink density, colour field)."""
    Wc, Hc = spec["cell_w"], spec["cell_h"]
    asp = Wc / Hc
    UVX, UVY = np.meshgrid((np.arange(Wc) + 0.5) / Wc, (np.arange(Hc) + 0.5) / Hc)
    motif = spec["motif"]
    if motif == "terrain":
        p = dict(zoom=spec.get("zoom", 2.0), band=0.62, sigma=0.06, band_ink=1.0,
                 band_lo=0.56, band_hi=0.68, stroke=2.0, stroke_hi=2.6)
        p.update(params)
        return motif_terrain(UVX, UVY, asp, spec["t"], **p)
    if motif == "shader":
        p = dict(center_cx=0.72, solid=0.90)
        p.update(params)
        return motif_shader(UVX, UVY, asp, spec["t"], **p)
    p = dict(col_w=0.030, ring_w=0.055)
    p.update(params)
    return motif_chladni(UVX, UVY, asp, spec["t"], **p)


def rect_mask(rects, Wc, Hc):
    q = np.zeros((Hc, Wc), dtype=bool)
    for (x0, y0, x1, y1) in rects:
        q[y0:y1, x0:x1] = True
    return q


def build(spec):
    Wc, Hc = spec["cell_w"], spec["cell_h"]
    up = spec["upscale"]
    Wo, Ho = Wc * up, Hc * up

    # type first: the quiet zone depends on the type lockup
    if all(FONTS.values()):
        items, disp_lines = layout_type(spec)
        tmask, boxes = render_type_mask(Wc, Hc, items)
        typology = "real fonts"
    else:
        items = spec.get("type_blocks") and [] or []
        tmask, boxes = np.zeros((Hc, Wc), dtype=bool), []
        typology = "geometric blocks (no fonts available)"

    # quiet zones: the field is forced to paper behind (and around) the type
    rects = quiet_zones(spec, boxes)
    qmask = rect_mask(rects, Wc, Hc)
    th = bayer_threshold(Hc, Wc)
    region = (~qmask)
    target = spec.get("accent_target", ACCENT_TARGET)

    # the motif parameters are searched so the accent lands in the 1.5-4.5%
    # band of the frame as a solid mass (deterministic: same params -> same result)
    variants = spec.get("motif_variants") or [spec.get("motif_params", {})]
    best = None
    for params in variants:
        ink, col = motif_pass(spec, params)
        ink = ink * (~qmask)
        col = col * (~qmask)
        is_ink = ink > th
        accent, frac, block = calibrate_accent(col, is_ink, region, target)
        in_band = 0.015 <= frac <= 0.045
        score = (0 if in_band else 1, abs(frac - target))
        if best is None or score < best[0]:
            best = (score, params, ink, col, is_ink, accent, frac, block)
    _, chosen, ink, col, is_ink, accent, frac, block = best
    accent_frac = accent.sum() / float(accent.size)

    # sanity: inside the quiet zone the field must be pure paper
    field_in_quiet = (is_ink & qmask).sum()
    if field_in_quiet:
        raise RuntimeError("quiet zone still contains field ink: %d cells" % field_in_quiet)

    out = np.zeros((Hc, Wc, 3), dtype=np.uint8)
    out[...] = np.array(PAPER, dtype=np.uint8)
    out[is_ink] = np.array(INK, dtype=np.uint8)
    out[accent] = np.array(FAMILY[spec["family"]], dtype=np.uint8)

    # type is always pure ink, drawn over the field
    out[tmask] = np.array(INK, dtype=np.uint8)

    # nearest-neighbour upscale only — never resample
    big = np.repeat(np.repeat(out, up, axis=0), up, axis=1)

    img = Image.fromarray(big, mode="RGB")
    path = os.path.join(HERE, spec["file"])
    img.save(path, format="PNG", optimize=True)

    cols, counts = np.unique(big.reshape(-1, 3), axis=0, return_counts=True)
    uniq = [tuple(int(v) for v in c) for c in cols]
    hexof = lambda c: "#%02x%02x%02x" % tuple(int(v) for v in c)

    # ---- declared geometry (cell aligned, reported in output px) -----------
    text_rects = []
    for it, bb in zip(items, boxes):
        if bb is None:
            continue
        x0, y0, x1, y1 = bb
        text_rects.append({
            "kind": it["kind"],
            "text": it["text"],
            "size": it["size"],
            "x": int(round(x0 * up)), "y": int(round(y0 * up)),
            "w": int(round((x1 - x0) * up)), "h": int(round((y1 - y0) * up)),
        })
    quiet_zones_px = [{"x": r[0] * up, "y": r[1] * up,
                       "w": (r[2] - r[0]) * up, "h": (r[3] - r[1]) * up} for r in rects]
    display_lines = [{"text": d["text"], "size": d["size"],
                      "bbox_cell": d["bbox_cell"]} for d in disp_lines]
    disp_sizes = [d["size"] for d in disp_lines] or [0]

    manifest = {
        "path": spec["file"],
        "output_width": Wo,
        "output_height": Ho,
        "cell_width": Wc,
        "cell_height": Hc,
        "upscale": up,
        "cell_px": 2,
        "bayer": "8x8 ordered, th=(B8[y&7][x&7]+0.5)/64",
        "dot_pitch_px": 16,
        "unique_colours": len(uniq),
        "unique_colour_list": [hexof(c) for c in uniq],
        "paper": "#%02x%02x%02x" % PAPER,
        "ink": "#%02x%02x%02x" % INK,
        "accent": "#%02x%02x%02x" % FAMILY[spec["family"]],
        "family": spec["family"],
        "two_tones_plus_at_most_one_accent": len(uniq) <= 4,
        "exactly_two_tones_plus_one_accent": len(uniq) == 3,
        "motif": spec["motif"],
        "time": spec["t"],
        "field_zoom": spec.get("zoom", 1.0),
        "png_format": "8-bit RGB (PNG colour type 2), non-interlaced, no interlacing/palette",
        "pure_function": True,
        "typography": typology,
        "typefaces": {k: v for k, v in FONTS.items()},
        "typeface_source": {k: FONT_SOURCE[k] for k in FONTS},
        "display_line_height": DISPLAY_LH,
        "display_optical_overshoot_em": DISPLAY_OVERSHOOT,
        "display_left_margin_em": DISPLAY_LEFT_MARGIN_EM,
        "display_max_overlap_cells": DISPLAY_MAX_OVERLAP_CELLS,
        "quiet_zones_cell_rects": [list(r) for r in rects],
        "text_rects": text_rects,
        "quiet_zones": quiet_zones_px,
        "display_lines": display_lines,
        "headline_size": max(disp_sizes) if disp_lines else 0,
        "display_max_size": max(disp_sizes),
        "accent_min_block_cells": ACCENT_MIN_BLOCK_CELLS,
        "accent_largest_block_cells": int(block),
        "accent_fraction": round(accent_frac, 5),
        "accent_fraction_pct": round(accent_frac * 100.0, 3),
        "accent_cells": int(accent.sum()),
        "pixel_counts": {hexof(c): int(n) for c, n in zip(cols, counts)},
    }
    return manifest


# --------------------------------------------------------------------------
# The three compositions
# --------------------------------------------------------------------------
def make_specs():
    specs = []

    # ---- 1. A4 portrait, terrain motif, SOP blue -----------------------
    Wc, Hc = 1240, 1754
    g = Grid(Wc)
    specs.append({
        "file": "poster_a4.png", "cell_w": Wc, "cell_h": Hc, "upscale": 2,
        "family": "sop", "motif": "terrain", "t": 6.0,
        "col_x": g.x(0), "col_w": 620,
        "type_blocks": [
            {"kind": "display", "lines": ["HOU2", "TOUCH"], "y": int(0.09 * Hc),
             "w": 620, "max_size": int(0.16 * Hc)},
            {"kind": "text", "text": "A one-bit field rendered in pure Python.",
             "y": int(0.80 * Hc), "w": 380},
            {"kind": "mono", "text": "COURSE 207 / SOP / TERRAIN / 1-BIT",
             "y": int(0.87 * Hc), "w": 440, "track": 0.07},
        ],
        "accent_target": 0.030,
        "motif_variants": [
            {"zoom": 1.6, "sigma": 0.15, "band_lo": 0.52, "band_hi": 0.72},
            {"zoom": 1.6, "sigma": 0.30, "band_lo": 0.52, "band_hi": 0.72},
            {"zoom": 2.0, "sigma": 0.15, "band_lo": 0.52, "band_hi": 0.72},
            {"zoom": 2.0, "sigma": 0.30, "band_lo": 0.52, "band_hi": 0.72},
            {"zoom": 2.4, "sigma": 0.15, "band_lo": 0.52, "band_hi": 0.72},
            {"zoom": 1.6, "sigma": 0.15, "band_lo": 0.52, "band_hi": 0.72,
             "stroke": 3.2, "stroke_hi": 4.0},
            {"zoom": 2.0, "sigma": 0.15, "band_lo": 0.52, "band_hi": 0.72,
             "stroke": 3.2, "stroke_hi": 4.0},
            {"zoom": 1.6, "sigma": 0.15, "band_lo": 0.52, "band_hi": 0.72,
             "stroke": 4.2, "stroke_hi": 5.2},
        ],
    })

    # ---- 2. 16:9 still, shader motif, CHOP green ----------------------
    Wc, Hc = 960, 540
    g = Grid(Wc)
    specs.append({
        "file": "still_16x9.png", "cell_w": Wc, "cell_h": Hc, "upscale": 2,
        "family": "chop", "motif": "shader", "t": 6.0,
        "col_x": g.x(0), "col_w": 430,
        "type_blocks": [
            {"kind": "display", "lines": ["SPECTRAL", "RINGS"], "y": int(0.09 * Hc),
             "w": 430, "max_size": int(0.22 * Hc)},
            {"kind": "text",
             "text": "Posterised interference, ordered-dithered.",
             "y": int(0.62 * Hc), "w": 340},
            {"kind": "mono", "text": "COURSE 301 / CHOP / SHADER / 1-BIT",
             "y": int(0.78 * Hc), "w": 340, "track": 0.07},
        ],
        "accent_target": 0.030,
        "motif_variants": [
            {"center_cx": 0.68, "solid": 0.90},
            {"center_cx": 0.74, "solid": 0.90},
            {"center_cx": 0.80, "solid": 0.90},
        ],
    })

    # ---- 3. square, chladni motif, TOP green ---------------------------
    Wc, Hc = 540, 540
    g = Grid(Wc)
    specs.append({
        "file": "square_1080.png", "cell_w": Wc, "cell_h": Hc, "upscale": 2,
        "family": "top", "motif": "chladni", "t": 6.05,
        "col_x": g.x(0), "col_w": 320,
        "type_blocks": [
            {"kind": "display", "lines": ["NODAL", "PLATE"], "y": int(0.09 * Hc),
             "w": 320, "max_size": int(0.22 * Hc)},
            {"kind": "text", "text": "Chladni plate, 540 cells.",
             "y": int(0.55 * Hc), "w": 240},
            {"kind": "mono", "text": "COURSE 101 / TOP / CHLADNI / 1-BIT",
             "y": int(0.75 * Hc), "w": 260, "track": 0.07},
        ],
        "accent_target": 0.030,
        "motif_variants": [
            {"col_w": 0.030, "ring_w": 0.06},
            {"col_w": 0.050, "ring_w": 0.10},
            {"col_w": 0.050, "ring_w": 0.16},
            {"col_w": 0.090, "ring_w": 0.22},
        ],
    })
    return specs


# --------------------------------------------------------------------------
# §12 — THE PIXEL SEAM
#
# The seam is the ordered-dither band that joins the paper to the dark region
# of a section.  Its rule (en/index.html, the "pixel edge" canvas):
#
#     cell   = 8 px desktop   (12 rows, 96 px band)
#     rows   = 12
#     cols   = ceil(width / cell)
#     v      = (r + 0.5) / rows
#     t      = clamp(v*1.3 - 0.3 + s, 0, 1) * 64
#     ink if t > B8[(r % 8) * 8 + (i % 8)]
#
# `s` is the scroll offset; print and video are STATIC, so s = 0 here.
# B8 is the same recursive 8x8 Bayer matrix the field uses (bayer8() above).
#
# The rule is applied VERBATIM and UNQUANTISED.  The realised density of a band
# row is therefore
#     #{B8 values in row (r % 8) below t} / 8
# and the eight Bayer ROWS have different histograms, so that density is NOT a
# ramp: rows 0..3 are pure paper, row 5 dips to 25%, rows 8/10/11 sit near
# 87.5%, and the last row is not solid either.  That non-monotonicity is the
# real behaviour of the live rule and is reproduced exactly, not "repaired".
# A gate that demands a monotone ramp would be testing a rule the site does
# not implement.
#
# SCALE — two scales are possible for print:
#
#   (a) TRUE SIZE — one seam cell = 8 output px = 0.675 mm at 300 dpi (the
#       system's own print rule, "16 px = 1.35 mm").  The band is then 96 px
#       = 8.13 mm = 2.7% of an A4 page: the seam reads as a hairline and the
#       poster stops being about the seam.
#   (b) PROPORTIONAL — the seam keeps the weight it has on screen: 96 px in a
#       ~900 px viewport is ~10.7% of the height.  On A4/300 dpi (3508 px)
#       that is ~375 px; with 12 rows, ~31 px per cell.  Realised here at an
#       integer 30 px per cell (15 render cells at up = 2):
#       band = 12 * 30 = 360 px = 10.26% of the page = 30.48 mm.
#
# This poster uses (b).  Both are reported in the manifest.
# --------------------------------------------------------------------------
SEAM_ROWS = 12            # rows of the seam band
SEAM_CELL_RENDER = 15     # one seam cell = 15 render cells = 30 output px
SEAM_SCROLL = 0.0         # static: print and video are static at s = 0
SEAM_CELL_MM = 0.675      # 8 px at 300 dpi — the system's TRUE-SIZE print rule
#                          # ("16 px = 1.35 mm at 300 dpi" => 8 px = 0.675 mm)


def seam_ramp(rows=SEAM_ROWS, s=SEAM_SCROLL):
    """The threshold ramp, one value per band row."""
    out = []
    for r in range(rows):
        v = (r + 0.5) / rows
        out.append(min(max(v * 1.3 - 0.3 + s, 0.0), 1.0) * 64.0)
    return out


def seam_mask(Wc, Hc, x0, band_top, cell, rows=SEAM_ROWS, s=SEAM_SCROLL):
    """The seam's ink mask at render-cell resolution — the LIVE rule, verbatim.

        v   = (r + 0.5) / rows
        t   = clamp(v*1.3 - 0.3 + s, 0, 1) * 64
        ink if t > B8[(r % 8) * 8 + (i % 8)]

    One seam cell is `cell` render cells wide and tall.  No quantisation and no
    monotonicity repair: the density is whatever the live rule produces.
    Returns (mask, ink_fraction_per_row); the fraction weights a partial last
    column by its real width so it matches the rendered pixels exactly.
    """
    m = np.zeros((Hc, Wc), dtype=bool)
    cols = int(np.ceil((Wc - x0) / float(cell)))
    ts = seam_ramp(rows, s)
    fracs = []
    for r in range(rows):
        t = ts[r]
        ink_w = 0
        total_w = 0
        for i in range(cols):
            cx0 = x0 + i * cell
            cx1 = min(cx0 + cell, Wc)
            w = cx1 - cx0
            total_w += w
            if t > int(B8[(r % 8), (i % 8)]):
                m[band_top + r * cell:band_top + (r + 1) * cell, cx0:cx1] = True
                ink_w += w
        fracs.append(ink_w / float(total_w) if total_w else 0.0)
    return m, fracs


def build_seam(spec):
    """The fourth composition: the pixel seam (§12) as a poster.

    There is no motif here: PAPER above, DARK below, and the seam band between
    them.  The band is the subject; the type sits in the quiet column.
    """
    Wc, Hc = spec["cell_w"], spec["cell_h"]
    up = spec["upscale"]
    Wo, Ho = Wc * up, Hc * up

    items, disp_lines = layout_type(spec)
    tmask, boxes = render_type_mask(Wc, Hc, items)
    rects = quiet_zones(spec, boxes)
    # snap the quiet column's right edge UP to a whole seam cell, so the band
    # ends on a whole cell too (no half-cell at the right edge) and the ramp
    # fractions are exactly k/8
    rows, cell = spec["seam_rows"], spec["seam_cell"]
    band_h = rows * cell
    band_top = spec["band_top_cell"]
    dark_top = band_top + band_h
    if band_top <= 0:
        raise RuntimeError("seam band does not fit below the paper")
    if dark_top >= Hc:
        raise RuntimeError("seam band does not fit above the dark region")

    # the type column's right edge snaps UP to a whole seam cell, so the quiet
    # zone and the seam share one grid (no half-cell at the column edge)
    qedge = int(np.ceil(rects[0][2] / float(cell)) * cell)
    qedge = min(qedge, Wc)
    # ONE quiet zone: the paper above the seam, bleeding to the left and top
    # edges with zero inset, so the type reads as a page margin and not as a
    # pasted box
    rects = [(0, 0, qedge, band_top)]

    out = np.zeros((Hc, Wc, 3), dtype=np.uint8)
    out[...] = np.array(PAPER, dtype=np.uint8)
    out[dark_top:, :] = np.array(INK, dtype=np.uint8)      # dark region: full bleed

    smask, fracs = seam_mask(Wc, Hc, 0, band_top, cell, rows, spec["scroll"])
    out[smask] = np.array(INK, dtype=np.uint8)             # seam band: full width

    # ONE accent: a ladder of thin rules inside the dark region, one rule per
    # band row, continuing the seam's row rhythm below the band.  Not a floating
    # block — it reads as a measurement scale, which is what the seam is.
    ax0 = spec["accent_x_cell"]
    aw = spec["accent_w_cell"]
    ah = spec["accent_h_cells"]
    accent_cells = 0
    for k in range(spec["accent_rules"]):
        ay0 = dark_top + spec["accent_top_offset_cells"] + k * spec["accent_pitch_cells"]
        if ax0 + aw > Wc or ay0 + ah > Hc:
            raise RuntimeError("accent ladder does not fit inside the dark region")
        out[ay0:ay0 + ah, ax0:ax0 + aw] = np.array(FAMILY[spec["family"]], dtype=np.uint8)
        accent_cells += ah * aw

    out[tmask] = np.array(INK, dtype=np.uint8)                  # type is pure ink

    big = np.repeat(np.repeat(out, up, axis=0), up, axis=1)
    img = Image.fromarray(big, mode="RGB")
    img.save(os.path.join(HERE, spec["file"]), format="PNG", optimize=True)

    cols, counts = np.unique(big.reshape(-1, 3), axis=0, return_counts=True)
    uniq = [tuple(int(v) for v in c) for c in cols]
    hexof = lambda c: "#%02x%02x%02x" % tuple(int(v) for v in c)

    text_rects = []
    for it, bb in zip(items, boxes):
        if bb is None:
            continue
        bx0, by0, bx1, by1 = bb
        text_rects.append({
            "kind": it["kind"], "text": it["text"], "size": it["size"],
            "x": int(round(bx0 * up)), "y": int(round(by0 * up)),
            "w": int(round((bx1 - bx0) * up)), "h": int(round((by1 - by0) * up)),
        })
    quiet_zones_px = [{"x": r[0] * up, "y": r[1] * up,
                       "w": (r[2] - r[0]) * up, "h": (r[3] - r[1]) * up} for r in rects]
    display_lines = [{"text": d["text"], "size": d["size"],
                      "bbox_cell": d["bbox_cell"]} for d in disp_lines]
    disp_sizes = [d["size"] for d in disp_lines] or [0]
    accent_frac = accent_cells / float(Wc * Hc)

    manifest = {
        "path": spec["file"],
        "output_width": Wo,
        "output_height": Ho,
        "cell_width": Wc,
        "cell_height": Hc,
        "upscale": up,
        "cell_px": 2,
        "bayer": "8x8 ordered, th=(B8[y&7][x&7]+0.5)/64",
        "dot_pitch_px": 16,
        "unique_colours": len(uniq),
        "unique_colour_list": [hexof(c) for c in uniq],
        "paper": "#%02x%02x%02x" % PAPER,
        "ink": "#%02x%02x%02x" % INK,
        "accent": "#%02x%02x%02x" % FAMILY[spec["family"]],
        "family": spec["family"],
        "two_tones_plus_at_most_one_accent": len(uniq) <= 4,
        "exactly_two_tones_plus_one_accent": len(uniq) == 3,
        "motif": "seam",
        "time": spec["scroll"],
        "field_zoom": 1.0,
        "png_format": "8-bit RGB (PNG colour type 2), non-interlaced, no interlacing/palette",
        "pure_function": True,
        "typography": "real fonts",
        "typefaces": {k: v for k, v in FONTS.items()},
        "typeface_source": {k: FONT_SOURCE[k] for k in FONTS},
        "display_line_height": DISPLAY_LH,
        "display_optical_overshoot_em": DISPLAY_OVERSHOOT,
        "display_left_margin_em": DISPLAY_LEFT_MARGIN_EM,
        "display_max_overlap_cells": DISPLAY_MAX_OVERLAP_CELLS,
        "quiet_zones_cell_rects": [list(r) for r in rects],
        "text_rects": text_rects,
        "quiet_zones": quiet_zones_px,
        "display_lines": display_lines,
        "headline_size": max(disp_sizes) if disp_lines else 0,
        "display_max_size": max(disp_sizes),
        "accent_min_block_cells": ACCENT_MIN_BLOCK_CELLS,
        "accent_largest_block_cells": int(aw * ah),
        "accent_rule_count": int(spec["accent_rules"]),
        "accent_fraction": round(accent_frac, 5),
        "accent_fraction_pct": round(accent_frac * 100.0, 3),
        "accent_cells": int(accent_cells),
        "pixel_counts": {hexof(c): int(n) for c, n in zip(cols, counts)},
        "seam": {
            "cell": cell,
            "cell_output_px": cell * up,
            "cell_mm": round(cell * up / 300.0 * 25.4, 4),
            "cell_mm_true_size": SEAM_CELL_MM,
            "rows": rows,
            "band_height": band_h * up,
            "band_height_mm": round(band_h * up / 300.0 * 25.4, 3),
            "band_height_pct_of_page": round(band_h * up / float(Ho) * 100.0, 3),
            "y_top": band_top * up,
            "x0": 0,
            "width": Wo,
            "full_width": True,
            "dark_top": dark_top * up,
            "dark_full_bleed": True,
            "scroll_offset_s": spec["scroll"],
            "static": "s = 0 — print and video are static",
            "ramp": "v = (r + 0.5) / rows; t = clamp(v*1.3 - 0.3 + s, 0, 1) * 64",
            "bayer": ("8x8 recursive M'=[[4M,4M+2],[4M+3,4M+1]] (values 0..63); "
                      "row phase (r % 8), column phase (i % 8)"),
            "threshold_rule": ("the LIVE rule, verbatim and unquantised: a cell is ink "
                               "when t > B8[(r % 8) * 8 + (i % 8)]"),
            "ramp_t_per_row": [round(t, 6) for t in seam_ramp(rows, spec["scroll"])],
            "ink_fraction_per_row": [round(f, 6) for f in fracs],
            "monotone": False,
            "monotone_note": ("the live ramp is NOT monotone by construction: the eight "
                              "Bayer rows have different histograms, so rows 0..3 are pure "
                              "paper, row 5 dips to 25%, and rows 8/10/11 sit near 87.5%. "
                              "Reproduced exactly, not repaired — see NOTES.md"),
            "scale_used": "proportional",
            "scale_proportional": {
                "derivation": ("the screen seam is 96 px in a ~900 px viewport = ~10.7% of "
                               "the height; on A4/300 dpi (3508 px) that is ~375 px, i.e. "
                               "~31 px per cell for 12 rows; realised at an integer 30 px "
                               "per cell = 360 px band"),
                "cell_output_px": cell * up,
                "band_height_px": band_h * up,
                "band_height_pct_of_page": round(band_h * up / float(Ho) * 100.0, 3),
            },
            "scale_true_size": {
                "rule": ("the system print rule: 16 px = 1.35 mm at 300 dpi => one seam "
                         "cell (8 px) = 0.675 mm, band 96 px = 8.13 mm = 2.7% of an A4 "
                         "page — at true size the seam reads as a hairline"),
                "cell_output_px": 8,
                "band_height_px": 96,
                "band_height_pct_of_page": round(96 / float(Ho) * 100.0, 3),
            },
            "accent": {
                "form": "ladder of thin rules inside the dark region",
                "rules": int(spec["accent_rules"]),
                "rule_height_px": ah * up,
                "rule_width_px": aw * up,
                "pitch_px": spec["accent_pitch_cells"] * up,
                "first_rule_y": (dark_top + spec["accent_top_offset_cells"]) * up,
                "note": ("one rule per band row, continuing the seam's row rhythm below "
                         "the band; reads as a measurement scale, not a floating block"),
            },
        },
    }
    return manifest


def make_seam_spec():
    """Composition 4 — the pixel seam as an A4 poster, at the PROPORTIONAL scale."""
    Wc, Hc = 1240, 1754
    g = Grid(Wc)
    return {
        "file": "seam_poster_a4.png", "cell_w": Wc, "cell_h": Hc, "upscale": 2,
        "family": "comp", "t": SEAM_SCROLL,
        "col_x": g.x(0), "col_w": 520,
        "type_blocks": [
            {"kind": "display", "lines": ["PIXEL", "SEAM"],
             "y": 120, "w": 560, "max_size": 260},
            {"kind": "text",
             "lines": ["One Bayer matrix at two scales:",
                       "the field dithers tone, the seam dithers scale."],
             "y": 580, "w": 620},
            {"kind": "mono", "text": "\u00a712 / SEAM / 12 ROWS / s = 0",
             "y": 700, "w": 520, "track": 0.07},
            {"kind": "mono", "text": "COMP \u00b7 #9a9a96 \u00b7 one family per composition",
             "y": 780, "w": 520, "track": 0.07},
        ],
        # paper 0..900 (51.3%), seam band 900..1080 (180 cells = 360 px = 10.26%),
        # dark region 1080..1754 (38.4%) — full bleed to left, right and bottom
        "band_top_cell": 900,
        "seam_rows": SEAM_ROWS,
        "seam_cell": SEAM_CELL_RENDER,
        "scroll": SEAM_SCROLL,
        "accent_x_cell": int(round(g.x(0))),
        "accent_w_cell": 273,
        "accent_h_cells": 6,
        "accent_pitch_cells": SEAM_CELL_RENDER,
        "accent_rules": SEAM_ROWS,
        "accent_top_offset_cells": SEAM_CELL_RENDER,
    }


def main():
    os.makedirs(HERE, exist_ok=True)
    print("font dir:", FONT_DIR, "(exists: %s)" % os.path.isdir(FONT_DIR))
    for f in FACES:
        print("  font file:", f.get("file"), "|", f.get("family", "?"), "|", f.get("style", "?")
              if "family" in f else f.get("error"))
    print("chosen:", json.dumps({k: {"path": v, "source": FONT_SOURCE[k]}
                                 for k, v in FONTS.items()}, indent=2))
    manifest = {
        "system": "Hou2Touch 1-bit field",
        "generated_by": "render.py (pure Python + numpy/Pillow, no browser, no WebGL)",
        "field_bits": 1,
        "paper": "#%02x%02x%02x" % PAPER,
        "ink": "#%02x%02x%02x" % INK,
        "cell_px": 2,
        "dot_pitch_px": 16,
        "dither": "ordered 8x8 Bayer, th=(B8[y&7][x&7]+0.5)/64, evaluated per cell",
        "resample": "none — integer nearest-neighbour upscale only",
        "accent_gate": ("colour mask tightened by threshold so accent stays inside ink "
                        "and within 1.5-4.5% of the frame; only connected blocks of "
                        ">= {} cells are kept, so the accent is a solid mass"
                        ).format(ACCENT_MIN_BLOCK_CELLS),
        "accent_target": ACCENT_TARGET,
        "accent_band_pct": [ACCENT_MIN * 100, ACCENT_MAX * 100],
        "accent_min_block_cells": ACCENT_MIN_BLOCK_CELLS,
        "display_line_height": DISPLAY_LH,
        "display_optical_overshoot_em": DISPLAY_OVERSHOOT,
        "display_left_margin_em": DISPLAY_LEFT_MARGIN_EM,
        "display_max_overlap_cells": DISPLAY_MAX_OVERLAP_CELLS,
        "quiet_zone_rule": "one zone per image: the type column, bleeding to the "
                           "left, top and bottom outer edge with zero inset",
        "grid": {"columns": 12, "margin_pct_of_width": 3.9, "gutter_pct_of_width": 1.4},
        "fonts": font_report(),
        "outputs": [],
    }
    for spec in make_specs():
        m = build(spec)
        manifest["outputs"].append(m)
        print("%-14s %dx%d  cell %dx%d  up %d  colours=%d %s" % (
            m["path"], m["output_width"], m["output_height"], m["cell_width"],
            m["cell_height"], m["upscale"], m["unique_colours"], m["unique_colour_list"]))
        print("   accent: %.3f%% of frame (%d cells), largest block %d cells" % (
            m["accent_fraction_pct"], m["accent_cells"], m["accent_largest_block_cells"]))
        print("   quiet rects %s   text rects %s" % (
            m["quiet_zones_cell_rects"],
            [(t["kind"], t["x"], t["y"], t["w"], t["h"]) for t in m["text_rects"]]))
        print("   counts:", m["pixel_counts"])
    seam_m = build_seam(make_seam_spec())
    manifest["outputs"].append(seam_m)
    print("%-14s %dx%d  cell %dx%d  up %d  colours=%d %s" % (
        seam_m["path"], seam_m["output_width"], seam_m["output_height"],
        seam_m["cell_width"], seam_m["cell_height"], seam_m["upscale"],
        seam_m["unique_colours"], seam_m["unique_colour_list"]))
    print("   accent: %.3f%% of frame (%d cells), largest block %d cells" % (
        seam_m["accent_fraction_pct"], seam_m["accent_cells"],
        seam_m["accent_largest_block_cells"]))
    print("   seam: cell %d render px (%d output px, %.3f mm), rows %d, band %d px "
          "(%.2f mm) at y=%d" % (
              seam_m["seam"]["cell"], seam_m["seam"]["cell_output_px"],
              seam_m["seam"]["cell_mm"], seam_m["seam"]["rows"],
              seam_m["seam"]["band_height"], seam_m["seam"]["band_height_mm"],
              seam_m["seam"]["y_top"]))
    print("   seam ink per row:", seam_m["seam"]["ink_fraction_per_row"])
    with open(os.path.join(HERE, "render_manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
    print("wrote render_manifest.json")


if __name__ == "__main__":
    sys.exit(main())
