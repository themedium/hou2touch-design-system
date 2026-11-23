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

Current output:

```
accent: 253028 px = 2.908% of frame   accent containment: 63257 accent cells, 0 violations
accent:  61288 px = 2.956% of frame   accent containment: 14919 accent cells, 0 violations
accent:  34876 px = 2.990% of frame   accent containment:  8719 accent cells, 0 violations
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
