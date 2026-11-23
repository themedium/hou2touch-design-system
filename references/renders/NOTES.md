# Hou2Touch 1-bit field — pure-Python renders

Proof that the design system is producible **outside the browser**: no WebGL, no canvas,
no page. `render.py` re-implements the documented GLSL pipeline in NumPy and writes PNGs
directly; `verify_render.mjs` re-opens those PNGs with its own decoder and gates them.

## Files

| file | what |
|---|---|
| `render.py` | the renderer (numpy + Pillow) |
| `render_manifest.json` | per-output geometry, palette, colour counts, accent share, `text_rects[]`, `quiet_zones[]`, `display_lines[]`, font report |
| `verify_render.mjs` | independent gate (Node stdlib only, own PNG decoder via `zlib.inflateSync`) |
| `poster_a4.png` | 2480×3508 — terrain motif — SOP `#3d7fd6` |
| `still_16x9.png` | 1920×1080 — shader motif — CHOP `#45a654` |
| `square_1080.png` | 1080×1080 — chladni motif — TOP `#65a30d` |
| `seam_poster_a4.png` | 2480×3508 — **pixel seam (§12)** — COMP `#9a9a96` |

## Reproduce

```
cd design-system/references/renders
python3 render.py
node verify_render.mjs        # -> GATE_PASS
```

## Pipeline (as implemented)

1. **Cell resolution only.** The field is evaluated on a `target/2` grid (cell = 2 px).
   The finished cell buffer is upscaled by an integer factor (2) with `np.repeat`
   (nearest neighbour). Nothing is ever resampled or blended.
2. **Ordered 8×8 Bayer dither.** `M' = [[4M, 4M+2], [4M+3, 4M+1]]` from `[[0]]`, threshold
   `th = (B8[y&7][x&7] + 0.5)/64`, evaluated per cell. The Bayer row index uses the
   GL bottom-up convention: `(H-1-row) & 7`.
3. **Motifs** are transcribed from `design-system/generative/shaders.md`:
   * `terrain` (M==3) — 16 fBm contour levels, every 5th an index contour, hillshade from the
     horizontal gradient, one elevation band `[0.53, 0.72]` is the colour mask
     (a gaussian ridge on elevation around `0.62`).
   * `shader` (M==18) — posterised radial interference (6 steps), scanlines at `uv.y*820`,
     vignette; the colour field is the bright tone away from the posterised edges.
   * `chladni` (M==0) — `cos(nx)cos(my) - cos(mx)cos(ny)` nodal lines with a sand
     halo, beat ring at 120 bpm (`fract(t*2)`, `exp(-6·beat)`); the ring is the colour mask.
   All are pure functions of `(uv, aspect, t)` — no state, no integration, no feedback.
4. **Composite** — `ink` first (`m.x > th`), then accent **only where the cell was already
   inked**. See §Accent below for the exact gate.
5. **Type** is drawn as a binary mask at cell resolution and always in pure ink
   ("type stays pure ink"). The field is forced to pure paper in hard, cell-aligned
   **quiet zones** around the type lockup (§Quiet zone).

## Type — real project faces

`hou2touch_redesign/fonts/` was scanned at run time (`render.py` prints the scan and the
manifest records it under `fonts`). It contains exactly **four** files:

| file | family / style | used as |
|---|---|---|
| `h2t-bebas.otf` | **H2T Bebas**, Bold | **display voice** — loaded by PIL `ImageFont.truetype`, no fallback needed |
| `bac5026d1c2ab786d3abee509cddf656.ttf` | Bebas Neue, Regular | *not used* (Bebas Neue, not H2T Bebas) |
| `c07b757a71a19ac97cc9364f87e15d46.otf` | Bebas Neue, Bold | *not used* (Bebas Neue, not H2T Bebas) |
| `h2t-bebas.woff2` | — | skipped: PIL cannot load WOFF2 |

**Fallbacks that had to be used (no matching face in the repo):**

* text voice → **Inter Tight is not in `fonts/`** → falls back to
  `/System/Library/Fonts/Supplemental/Arial.ttf` (closest available sans).
* mono voice → **JetBrains Mono is not in `fonts/`** → falls back to
  `/System/Library/Fonts/Menlo.ttc`.
* Both fallbacks are recorded in `render_manifest.json` (`fonts.chosen.*.source = "system"`).

### Display voice: H2T Bebas, lh 0.8, optical overshoot

The system's M8 is `lh .8`, uppercase, tracking ~0. Implemented in `render.py`:

* lines are set on a **baseline rhythm of `0.8 × size`** (`DISPLAY_LH = 0.8`);
* **optical overshoot**: the glyph box (font ascent + descent, ~1.25 em for a condensed
  grotesque) is *larger* than the 0.8 em line box, so the glyph box is allowed to overflow
  its line box — nothing is cropped, the glyphs are positioned on the baseline and the cap
  tops sit exactly on the block top. `DISPLAY_OVERSHOOT = 0.06` em is the slack kept for that
  overflow, and the quiet zone is derived from the *actual* rasterised ink bbox, so the
  overshoot can never collide with the field;
* **negative left margin of −0.03 em** (`DISPLAY_LEFT_MARGIN_EM`) to compensate the condensed
  sidebearing, so the headline sits optically flush with the column edge;
* tracking 0, uppercase;
* **the rhythm is measured, not assumed.** The tight ink bbox of every display line is taken
  from the real rasterised glyphs, and if two consecutive lines would touch, the lower line is
  pushed down by exactly the amount of the collision minus the allowed
  `DISPLAY_MAX_OVERLAP_CELLS = 2`. The overshoot is therefore still there, but it can no
  longer become a collision. Measured result: **declared overlap −23 cells (poster),
  −9 cells (16:9), −10 cells (square)**, and **0 measured ink rows** in the overlap band of
  any pair of display lines.

## Accent — inside ink only, ≤ 5 % of the frame

Two independent rules are enforced in `render.py` and re-checked in `verify_render.mjs`:

1. **Inside ink only.** Accent cells are drawn only where the cell was *already* inked, and
   candidates are additionally restricted to the **1-cell interior of the ink mass** (all four
   4-neighbours are ink), so an accent cell always sits inside solid ink.
2. **A solid mass, never a hairline.** The thresholded colour region is decomposed into
   4-connected components at cell resolution and **only components of ≥ 9 cells are kept**.
   The accent is therefore a solid region inside the ink mass. (The previous rule — "the
   accent is the 1-cell *shell* of the thresholded colour region" — produced exactly the
   1-cell green hairline that `square_1080.png` showed; the shell rule and the "solid block"
   requirement are mutually exclusive, and the block is what the eye reads.)
3. **Coverage.** The colour-mask threshold is scanned (9 candidate thresholds over the colour
   field) and the candidate whose accent share is closest to the 3 % target — and inside the
   1.5–4.5 % band whenever such a candidate exists — is kept. The motif parameters themselves
   are searched too (`motif_variants`): each variant is rendered, measured, and the one that
   lands in the band wins. This is deterministic — same inputs, same PNG.

**Measured accent coverage (share of all pixels of each PNG):**

| output | accent px | accent share | largest solid block |
|---|---|---|---|
| `poster_a4.png` | 253 028 | **2.908 %** | 18 687 cells |
| `still_16x9.png` | 61 288 | **2.956 %** | 1 339 cells |
| `square_1080.png` | 34 876 | **2.990 %** | 6 128 cells |

All three are inside the 1.5–4.5 % band and under the 5 % ceiling.
Containment violations (accent cell floating on paper): **0 / 0 / 0**.
Accent regions not touching any ink cell: **0 / 0 / 0**.

### Poster accent: the mass, not the ribbon

The poster's accent used to be the interior *ribbon* of the contour strokes — its length was
a geometric ceiling of the motif, which is why it stalled at 0.989 %. With the shell rule
dropped and the solid-block rule in force, the accent is the **solid interior of the
elevation band** (the band the motif already inks solid), so the share is set by the
threshold scan and lands at 2.908 % inside the target band. The `shader` motif needed one
structural addition for the same reason: its posterised tone was dithered everywhere and had
no solid interior, so the brightest posterised band is now inked **solid**
(`step(0.82, v) * (0.55 + 0.45 * vig)`) and hosts the accent.

## Quiet zone — text on quiet paper

Implemented as **hard rectangles on the cell grid**, not as a soft falloff:

* the grid is 12 columns, margin 3.9 % of width, gutter 1.4 % of width (`Grid`);
* the field inside a quiet rectangle is forced to **paper** — no ink, no accent
  (`apply_quiet`); the renderer asserts afterwards that *zero* ink cells remain inside a
  quiet zone, and raises if any do;
* **one quiet zone per image**, the *type column*, which is merged from the headline and the
  dek/label zones so that **no internal horizontal seam exists**. The zone bleeds to the
  **left, top and bottom outer edge with zero inset**, so it reads as a margin of the page
  and never as a white rectangle pasted on top of the field;
* the zone's right edge sits `QUIET_PAD_CELLS = 6` cells to the right of the widest text
  bbox, so the type never touches the field;
* the rectangles are integer cell coordinates, so the nearest-neighbour upscale stays provably
  aligned (the verifier's "no colour change off an upscale boundary" gate still passes with
  0 violations);
* the type itself is drawn *after* the field, in pure ink on top of that paper;
* the manifest now publishes the geometry: `text_rects[]` (x, y, w, h in output px) and
  `quiet_zones[]` (x, y, w, h in output px), both cell-aligned.

Quiet-zone rects actually used (cell coordinates) and the padding actually measured:

```
poster_a4.png   [0,0,585,1754]   text padding  L42 T157  R6  B1396 cells
still_16x9.png  [0,0,394,540]    text padding  L35 T48   R6  B407  cells
square_1080.png [0,0,257,540]    text padding  L21 T48   R6  B219  cells
```

Every zone touches three outer edges with zero inset (L0 T0 B0), i.e. it bleeds.

## What the verifier proves

`verify_render.mjs` does not trust the manifest: it walks the PNG chunks, inflates the
IDAT stream with `zlib.inflateSync`, un-filters scanlines (filter types 0–4) and re-derives
everything from the pixels.

1. `upscale` is an integer ≥ 2 and `cell_width * upscale == output_width` exactly
   (same for height).
2. Unique RGB colours per image ≤ 4 — **all three are exactly 3**:
   paper `#e9e7e0`, ink `#0b0b0c`, and one family colour.
3. Zero pixels outside {paper, ink, declared accent}.
4. Zero horizontal colour changes that are not on an `upscale` boundary — i.e. the upscale
   is provably nearest-neighbour, not bilinear.
5. **NEW — accent coverage**: accent pixels / total pixels must be ≥ 0.5 % and ≤ 5 %.
   The measured percentage is printed for every image.
6. **NEW — accent containment (at CELL resolution)**: the PNG is sampled down to the cell
   grid and every accent cell is checked: it may not float on paper (all four neighbours
   paper), and every connected accent region must touch at least one **ink** cell.
   Violation count is printed (0 / 0 / 0).
7. **NEW — text is inside a quiet zone**: every declared `text_rects[]` entry must lie inside
   a declared `quiet_zones[]` entry with **≥ 2 cells of padding on every side** (measured in
   cells, printed per rect), must contain **no accent pixel** (a clipped/overprinted text),
   no foreign pixel, and at least one ink pixel (the text is really there).
8. **NEW — nothing but text inside the quiet zone**: every ink pixel inside a quiet zone that
   is *outside* the declared text rects is a violation. This is the check that would have
   caught the field's "K"-shaped mass and any oversized background glyph sitting behind the
   headline. Measured: **0 px** on all three images.
9. **NEW — no display-line overlap**: consecutive display line boxes must overlap by ≤ 2
   cells (declared boxes from the manifest) *and* the PNG's own ink profile must show ≤ 2
   ink rows in the overlap band. Measured: declared **−23 / −9 / −10 cells**, measured ink
   rows **0 / 0 / 0**.
10. **NEW — the accent is a solid block**: the largest 4-connected accent region at cell
    resolution must be ≥ 9 cells, and no region may be unembedded. Measured largest block:
    **18 687 / 1 339 / 6 128 cells**.
11. **NEW — quiet zones bleed**: every quiet zone must touch at least one outer edge of the
    image with zero inset. Measured insets: poster L0 T0 R1310 B0, still L0 T0 R1132 B0,
    square L0 T0 R566 B0 — all bleed left + top + bottom.
12. **NEW — no oversized display glyph**: the largest display size must equal the headline
    size, and no display text rect may be taller than the headline rect. Measured: 280/280,
    118/118, 118/118.

For the fourth composition (`seam_poster_a4.png`) the same twelve global checks run
unchanged, and five seam-specific ones are added — they run **only** for the output that
declares a `seam` block, so the three earlier images are untouched by them:

13. **Seam band geometry**: the manifest declares `seam: {cell, rows, band_height, y_top}`;
    the gate asserts `rows == 12`, `band_height == rows * cell * upscale`, that the band is
    cell-aligned, and that the band's **pixel height in the PNG** is exactly that value —
    the row above the band is pure paper, the row below it is solid ink.
14. **Bayer fidelity**: the verifier builds its **own** recursive 8×8 Bayer matrix (it does
    not import anything from `render.py`), recomputes `v`, `t` and the threshold from
    scratch, and compares the resulting mask with the rendered image **pixel for pixel at
    cell resolution**. Measured: **0 mismatching cells** of 32 640.
15. **Monotonic ramp**: the ink fraction of each of the twelve band rows must be
    non-decreasing (equality allowed) — a ramp, not noise.
16. **Direction**: band row 0 must be **100 % paper**, band row 11 must be **≥ 95 % ink**.
    Measured: 0.0 % and 100.0 %.
17. **Print scale**: the declared `seam.cell_mm` must be **0.675 mm** (the system's own rule
    "16 px = 1.35 mm at 300 dpi" ⇒ 8 px = 0.675 mm) and must agree with the geometry
    (`cell * upscale` output pixels at 300 dpi).

Current output:

```
accent: 253028 px = 2.908% of frame   accent containment: 63257 accent cells, 0 violations
accent:  61288 px = 2.956% of frame   accent containment: 14919 accent cells, 0 violations
accent:  34876 px = 2.990% of frame   accent containment:  8719 accent cells, 0 violations
accent: 208000 px = 2.391% of frame   accent containment: 52000 accent cells, 0 violations
GATE_PASS
```

## Defects fixed in this pass (the old numeric gate passed while the pictures were wrong)

| # | defect | cause | fix |
|---|---|---|---|
| 1 | `square_1080.png` dek rendered as unreadable garbage and overlapped a big background glyph | the dek was fitted to a 245-cell measure → a **5-cell font**; the field's chladni mass also reached into the type column | the square's type has a real measure (dek 240 cells → 20-cell font, mono 260 cells) and the **whole type column is one quiet zone**, so no field mass can reach the type. The declared text rects and the stray-ink gate (8) now prove it |
| 2 | `poster_a4.png` "HOU2" collided with "TOUCH" at `lh 0.8` | the 0.8 rhythm was applied blindly; the cap overshoot closed the gap | the glyph boxes are measured and a per-line gap is inserted (gate 9) — measured overlap −23 cells |
| 3 | quiet zones read as pasted white rectangles | three separate zones with a hard horizontal step at mid-page | one merged zone per image, bleeding left + top + bottom with zero inset (gate 11) |
| 4 | the square's accent was a 1-cell hairline | the accent was defined as the 1-cell *shell* of the colour region | the accent is now a **solid** connected block ≥ 9 cells inside the ink mass (gate 10) |

The old gate could not see any of these because it only counted colours and checked the
upscale. Gates 7–12 (declared geometry, re-measured on the pixels) are what close the gap.

## Composition 4 — the pixel seam (§12) as a poster

`seam_poster_a4.png` — 2480×3508 (A4 at 300 dpi). Here the **seam is the subject**: the
three earlier compositions cover the field, none of them covers the seam.

### The rule (from `en/index.html`, the "pixel edge" canvas)

```
cell   = 8 px desktop  (12 rows, 96 px band)
rows   = 12
cols   = ceil(width / cell)
v      = (r + 0.5) / rows
t      = clamp(v*1.3 - 0.3 + s, 0, 1) * 64
ink if t > B8[(r % 8) * 8 + (i % 8)]
```

`B8` is the same recursive 8×8 matrix the field uses (`M' = [[4M,4M+2],[4M+3,4M+1]]`
from `[[0]]`, three steps → values 0…63). `s` is the scroll offset; **print and video are
static, so `s = 0`** — the seam is painted from the ramp alone.

### Print scale mapping — one seam cell = 0.675 mm

The seam's 8 px cell is a **screen** unit. The system's own print rule is
*"16 px = 1.35 mm at 300 dpi"*, so half of it — one seam cell — is **8 px = 0.675 mm**.
(Exactly: 8 px ÷ 300 dpi = 0.677 mm; the design system's 1.35 mm for 16 px is the rounded
canonical figure and is what the manifest carries.)

Therefore on this poster one seam cell = **8 output pixels** = 4 render cells × upscale 2,
and the 12-row band is **96 output px = 8.13 mm** tall. Both numbers are declared in
`render_manifest.json` (`seam.cell_mm`, `seam.cell_mm_exact_300dpi`, `seam.band_height_mm`).
The poster keeps the field's discipline: rendered at cell resolution (1240×1754) and then
upscaled ×2 with `np.repeat` — never resampled.

### The one deviation, and why

Applied verbatim, the realised density of band row *r* is
`#{B8 values in row (r % 8) below t} / 8`. The eight Bayer **rows** have different
histograms, so that density is **not a ramp**:

| r | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| live rule, verbatim | 0 | 0 | 0 | 0 | .500 | **.125** | .500 | .500 | .750 | **.500** | 1.000 | **.875** |
| as rendered | 0 | 0 | 0 | .125 | .250 | .250 | .375 | .500 | .625 | .750 | .875 | 1.000 |

The live rule makes row 5 (12.5 %) *lighter* than row 4 (50 %) and row 11 (87.5 %) lighter
than row 10 (100 %) — the band reads as noise, not as a seam, and it is not monotone.

The threshold is therefore **quantised to the row's own Bayer values**: row *r* keeps the
`k = floor(t/8 + 0.5)` **smallest** of its eight values. The density becomes exactly the
spec's ramp `t/64` quantised to one eighth, and the band is monotone by construction.
Everything else is verbatim: the ramp `v`, `t`, the matrix, the row phase `(r % 8)`, the
column phase `(i % 8)`, `s = 0`.

Measured on the rendered PNG (verifier output):

| row | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ink | 0.0 % | 0.0 % | 0.0 % | 12.4 % | 25.3 % | 25.3 % | 37.1 % | 50.0 % | 62.9 % | 75.3 % | 87.6 % | 100.0 % |

(the middle rows wobble ≤ 0.6 % from the exact `k/8` because the band is 170 seam cells
wide, not a whole number of 8-cell Bayer tiles; row 0 is exactly 0 %, row 11 exactly 100 %).

The verifier reports **both** numbers: **0 mismatching cells** against the quantised rule,
and **3408 cells of 32640 (10.4 %)** where the live rule verbatim would paint differently.

### Layout

* Paper above, dark below: the dark region starts at 60 % of the page height, so it
  occupies the bottom 40 %. The seam band sits on the junction at `y = 2008 px`, 96 px
  tall, running from the quiet column's right edge (`x = 1120 px`) to the page's right edge.
* The quiet zone is the type column (bleeds to the left, top and bottom outer edge, zero
  inset). The dark region and the band start at its right edge — so the band is never
  buried under type, and no field ink intrudes into the quiet zone.
* Type, three voices, never mixed in a line: display `PIXEL SEAM` (H2T Bebas, lh 0.8,
  optical overshoot), text voice — *"One Bayer matrix at two scales: the field dithers
  tone, the seam dithers scale."* — and the mono label
  `§12 / SEAM / 8 PX CELL / 12 ROWS / s = 0`.
* Accent: **COMP `#9a9a96`** — deliberately the neutral family, so it does not compete
  with the seam. One solid block of 260×200 cells (52 000 cells = **2.391 %** of the
  frame), entirely inside the ink of the dark region.
* Exactly three tones: `#e9e7e0` / `#0b0b0c` / `#9a9a96`.

### Simplifications in this composition

* The top three band rows are pure paper: the spec's ramp gives `t = 0` for r = 0…2, and
  `t = 5.07` for r = 3 — below the smallest value in Bayer row 3 (20), so the live rule
  leaves that row blank as well.
* The band does not run under the type column: the quiet column is paper by rule.
* The quiet column's right edge is snapped **up** to a whole seam cell, so the band never
  ends on a half cell at the page's right edge.

## Simplifications taken (and why)

* **Type is rasterised at cell resolution** (then upscaled ×2 with `np.repeat`) so the field
  and the type share one grid and the nearest-neighbour proof holds. The consequence is that
  the headline is rendered with 2-px "pixels" — legible, but visibly stepped. Rasterising the
  type at output resolution would break the "no colour change off an upscale boundary" gate.
* **Contour strokes are inked solid and wider than in the original shader** (`stroke` /
  `stroke_hi` parameters). A 1-cell-wide dithered contour has no interior, so an accent
  inside it would necessarily touch paper. The strokes had to become solid masses to host the
  accent ribbon; the same was done for the chladni nodal lines and the beat-ring annulus.
* **The shader's radial core is shifted right** (`center_cx = 0.72…0.80`) so it survives the
  quiet margin column — otherwise the bright core (and therefore the accent) would be killed
  by the quiet zone.
* **`terrain` field zoom is searched (1.6–2.4) instead of fixed at 2.0**, together with the
  colour sigma and the stroke width, so the accent lands in its band.
* **`fwidth` approximation.** `fwidth2()` is computed as `|Δlv/Δcell| + |Δlv/Δrow|` with a
  central difference instead of the GPU's screen-space derivative. Same semantics (a
  per-cell derivative), slightly different constant factor at cell boundaries.
* **Static frame.** `t` is fixed per composition (poster & 16:9 use the shader's own start
  value `t = 6.0`; the square uses `t = 6.05` so the beat ring is alive). There is no
  animation loop; the motif is still a pure function of `t`.
* **No fine-mode instrument layer.** The 12-column registration grid, paper dots, reticle
  and loupe from `shaders.md §5` are *instrument* overlays drawn in graphite, which would
  introduce a fourth tone. They are deliberately omitted so the field stays exactly
  paper + ink + one accent. The 12-column grid is honoured by the **type layout** and by the
  quiet-zone edges (margin 3.9 % of width, gutter 1.4 % of width), not by a drawn rule.
* **Tracking is per-glyph** (`draw.text` per character), so kerning between letters is lost
  in the tracked mono label. The display face has tracking 0 and is drawn as a whole string.
* **The two other faces in `fonts/` are Bebas Neue variants**, not H2T Bebas; they are
  deliberately *not* used for the display voice, and no other family (Inter Tight, JetBrains
  Mono) exists in that directory, hence the Arial / Menlo fallbacks noted above.
* **The seam's threshold is quantised to its own Bayer row** (`k = floor(t/8 + 0.5)` of the
  eight values in B8 row `r % 8`) instead of the live site's global `t > B8[…]`. Applied
  verbatim the band's realised density is not a ramp (row 5 → 12.5 %, row 9 → 50 %,
  row 11 → 87.5 %); quantised it is the spec's own ramp `t/64` to one eighth and the band
  is monotone. See §Composition 4 above for the full table and the cost
  (10.4 % of the band's cells differ from the verbatim rule).

## Composition 4 — the pixel seam (`seam_poster_a4.png`)

### Scale: proportional, not true size
The seam's screen cell is 8 px. At the system's own print rule (16 px = 1.35 mm at
300 dpi) that is 0.675 mm, and a 12-row band is 96 px = 8.13 mm = **2.7 % of an A4
page** — the seam collapses into a hairline and the poster stops being about it.

On screen the seam is 96 px of a ~900 px viewport = **~10.7 % of the height**. This
poster preserves that proportion: on A4/300 dpi (3508 px) it gives ~375 px, i.e.
~31 px per cell for 12 rows. Realised at an integer **30 px per cell**
(15 render cells at up = 2) → band **360 px = 10.26 % of the page = 30.48 mm**.

Both numbers are in the manifest: `scale_proportional` (used) and
`scale_true_size` (the system print rule, for reference).

### The ramp is NOT monotone — by construction, and reproduced exactly
The live rule is applied verbatim and unquantised:

```
v   = (r + 0.5) / rows
t   = clamp(v*1.3 - 0.3 + s, 0, 1) * 64        s = 0 (static)
ink if t > B8[(r % 8) * 8 + (i % 8)]
```

The realised density of a row is `#{B8 values in that row below t} / 8`, and the
eight Bayer rows have different histograms, so the band is not a ramp:

| row | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| t | 2.7 | 7.7 | 12.7 | 17.7 | 22.7 | 27.7 | 32.7 | 37.7 | 42.7 | 47.7 | 52.7 | 57.7 |
| ink % | 0 | 0 | 0 | 0 | 50.4 | 12.1 | 50.4 | 49.6 | 75.8 | 49.6 | 100.0 | 87.9 |

An earlier attempt quantised the threshold per row to force a monotone ramp. That
changed 10.4 % of cells away from the live rule and was reverted: **a monotone gate
was testing a rule the site never ran.** The verifier now asserts exact agreement
with the live rule (0 mismatching cells of 223 200) and only that the band reads as
a band overall (rows 0–3 pure paper, last three rows ≥ 75 % ink, band average
35–65 %).

### Composition
- Paper from y=0 to the seam; the band full width edge to edge; the dark region
  full bleed to left, right and bottom. Nothing overlaps the band.
- Type in one quiet zone on the paper, bleeding to the left and top edges with zero
  inset, so it reads as a page margin and not as a pasted box.
- Accent is COMP `#9a9a96` as a **ladder of 12 thin rules** inside the dark region,
  one per band row, continuing the seam's row rhythm. 0.904 % of the frame.
  Chosen over a floating block, which read as a bug.
- Exactly 3 tones: `#e9e7e0`, `#0b0b0c`, `#9a9a96`.

### Honest notes
- The accent ladder currently reads closer to a barcode than to a measurement
  scale, because its 12 rules are evenly pitched. A graduated pitch would tie it
  to the seam's density curve more explicitly.
- `s = 0` is the static state required by §12 for print and video. The live site
  drives `s` from scroll in 32 quantised steps; that motion cannot be shown on a
  static poster.

## Comparison against the live site (2026-11-23)

**Method.** Live Chrome at `127.0.0.1:8898`, screenshots at a **1377 px** viewport; the seam
canvas was read **pixel-by-pixel** via `getImageData`.

### Seam: exact match

The live seam canvas is **173 × 12** at CSS **96 px** — i.e. **12 rows × 8 px**, and
`cols = ceil(1377 / 8) = 173`. Solving `s` in **1/32 steps** gave an **exact match of all 12
rows at `s = 2/32`**, error **0**.

| row | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| live (`s = 2/32`) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 50.3 % | 24.9 % | 50.3 % | 49.7 % | 100.0 % | 75.1 % | 100.0 % | 100.0 % |
| this render (`s = 0`) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 50.4 % | 12.1 % | 50.4 % | 49.6 % | 75.8 % | 49.6 % | 100.0 % | 87.9 % |

The live band was captured mid-scroll, at `s = 2/32`; this render is the **static** state
`s = 0` required by §12 for print and video. Same rule, same matrix, same geometry — the ramp
position differs only because the live state is scroll-driven.

### Field: did not match in character

The site's hero is a **halftoned photograph** (`HERO_TEX = IMG("hero_school")`); these renders use
the **procedural motifs**. Technically compliant, aesthetically different: a **printed
photograph** versus a **vector diagram**.

### Missing device found

The seam carries **type**, inverted across the boundary with `mix-blend-mode:difference` — a
device that was **not** documented until this comparison. It is now specified in
`MASTER_DESIGN_SYSTEM.md` §12.11 and §12.12.

### Conclusion

The seam rule is **VERIFIED** against the live site (exact row-for-row match). The field renders
are a faithful implementation of the **motif path** but **not** a reproduction of the site's hero.
