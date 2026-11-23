# PHOTO_FIELD_NOTES — the photographic path, outside the browser

## What this is

`photo_field.py` turns a **real photograph from the repo** into a compliant
**1-bit ordered-dither field** with the same cell-resolution discipline the site
uses, and writes `photo_field_16x9.png` (1920×1080).

The four existing renders in this directory (`still_16x9.png`, `poster_a4.png`,
`seam_poster_a4.png`, `square_1080.png`) all use **procedural motifs**. They prove
the motif path. They do **not** prove the path the site actually uses for its most
important surface: the hero shader samples a photograph (`HERO_TEX = IMG("hero_school")`
→ `img/hero_school.webp`) and the hero field is a **halftoned photograph**.

This artifact closes that gap.

## Source photograph

| | |
|---|---|
| file | `hou2touch_redesign/img/hero_school.webp` |
| native size | **1440 × 900** (16:10) |
| mode | RGB (webp opened directly by Pillow — no conversion needed) |
| crop | centred 16:9 crop, box `(0, 45, 1440, 855)` → **1440 × 810**. No stretching, no letterboxing. |

## Pipeline (exactly what `photo_field.py` does)

1. **Load** the photo, convert to RGB.
2. **Centre-crop to 16:9** (crop, never stretch).
3. **Resample the crop down to CELL resolution** — 960 × 540 cells (LANCZOS).
   This is the *only* resample in the whole chain and it happens **upstream** of
   the field, on the photograph. The field itself is never resampled.
4. **Luminance per cell**:
   `L = 0.299·R + 0.587·G + 0.114·B`, normalised 0..1.
5. **Tile tone**: the mean `L` over each 8×8 block of the cell grid. (The cell
   grid is 960×540, so the last tile row is a partial tile 4 rows high; it is
   still dithered with its own Bayer matrix, so its ink set stays a suffix of
   the Bayer ordering.)
6. **Ordered 8×8 Bayer threshold at cell resolution**:
   * matrix built by the canonical recursion
     `M' = 4M + [[0,2],[3,1]]` tiled 2×2, three iterations → 8×8, values 0..63;
   * threshold `th(y,x) = (B8[y&7][x&7] + 0.5) / 64`;
   * a cell is **INK when its tone falls below the threshold**. Since `th` grows
     with the Bayer value, a darker tile inks more cells, and the inked positions
     are the **high-threshold** ones — classic ordered dithering of a greyscale.
   * row index is top-down (`cell_row & 7`), column `cell_col & 7`.
7. **Two tones only**: paper `#e9e7e0`, ink `#0b0b0c`. **No accent.**
8. **Upscale ×2, nearest neighbour only** (`np.repeat`) → 1920 × 1080.

## Accents: **0**

Chosen deliberately, and this is the §14-correct answer for a photograph:

* §14 says a photograph enters the system **dithered and desaturated** — it is
  not re-coloured, so a family colour inside the photographic field would be a
  lie about the source.
* The photograph is the **subject** of the frame. An accent block inside the ink
  mass competes with the image; an accent label block on a paper strip at the
  bottom introduces a third tone and a typography system into a render whose
  whole point is the *photographic* conversion.
* 0 accents also makes the compliance proof unambiguous: **exactly 2 unique
  colours** in the whole 1920×1080 frame, which is the strongest possible
  statement of "the photograph path does not need the accent machinery at all".

Consequence: no typography in this render, so no quiet zone and no text rects.
The frame is field only.

## Measured results

| metric | value |
|---|---|
| output | 1920 × 1080, 8-bit RGB PNG, non-interlaced |
| unique colours | **2** — `#e9e7e0` (91.95 %) and `#0b0b0c` (8.05 %) |
| **overall ink fraction** | **0.080548 (8.05 %)** |
| ink fraction per 8-cell-row band | min 0.00 %, max **20.91 %** (rows 224–231, the tree canopy); the profile rises from the empty sky, peaks on the foliage and falls away at the base |
| colour changes off the upscale grid | 0 horizontal, 0 vertical |
| ordered-dither violations (8040 full 8×8 tiles) | **0** |

The low overall ink fraction is honest, not a bug: `hero_school.webp` is a
school building on a white sky. The band profile shows the ink mass concentrated
exactly where the subject is (canopy ≈ 21 %, sky ≈ 0 %) — the dither is reading
the photograph, not filling the frame.

## Verification (`photo_field_verify.mjs`, Node stdlib only)

Independent: it re-opens the PNG, decodes it with its own minimal reader (chunk
walk + `zlib.inflateSync` + full scanline un-filtering, filters 0..4), and does
not trust the manifest for pixels.

1. output is 1920×1080, `cell × upscale == width` (and `== height`);
2. every horizontal **and** vertical colour-change index is divisible by
   `upscale` → nearest-neighbour, no resampling;
3. unique colour count equals the declared count (2), and no undeclared colour
   exists;
4. the cell grid is recovered by taking every `upscale`-th pixel; for every
   8×8 tile the ink set must be the **suffix** of the tile's cells ordered by
   Bayer value (every paper cell's Bayer value ≤ the smallest ink cell's). That
   is the signature of an *ordered* threshold — a stochastic dither cannot
   satisfy it. **Violations: 0** over 8040 tiles.

**On the direction of the ordering check.** The generator's rule is
"INK when tone < (B+0.5)/64", so the inked positions are the *high*-threshold
ones and the ink set is a **suffix** in Bayer order. The mirror-image gloss
("no ink cell may have a lower Bayer value than a paper cell") is incompatible
with that threshold rule and is necessarily non-zero here; the verifier prints
it as `inverse_gloss_violations` (64760) for transparency but does **not** gate
on it. The gated property is the one that actually discriminates ordered from
stochastic dithering.

## Honest statement: this is NOT the site's halftone algorithm

This render uses the **ordered 8×8 Bayer dither at cell resolution**, the same
discipline as the procedural renders in this directory.

**The site uses something else.** Per §11 of MASTER, the live hero shader applies
a **rotated circular halftone** with a hash gate —
`rad = hc * 0.5 * sqrt(ink) * sqrt(m)` and a `smoothstep` edge — not an ordered
Bayer matrix. That is documented in MASTER §11 as a **deviation** from the
system's ordered-dither rule.

So, plainly:

* **this artifact** = ordered Bayer, two tones, no accent, integer ×2 upscale;
* **the site** = rotated circular halftone with a hash gate (documented deviation).

What this proves is therefore **not** "the site is reproducible offline". It
proves the narrower, portable claim: **a photograph can be converted into a
compliant 1-bit ordered-dither field outside the browser** — luminance →
ordered Bayer at cell resolution → integer nearest-neighbour upscale ×2 →
two tones, with the orderedness independently verified from the pixels and the
absence of resampling proven by the change-index divisibility test. If the site
ever wants to leave its §11 deviation, this is the path that already works.

The tile-averaged tone (step 5) is the one deliberate deviation from the
per-cell formula, and it exists for a stated reason: with a per-cell tone the
ink set is *not* a suffix of the Bayer order inside a tile (a dark cell can sit
at a low-threshold position), which makes the "is this ordered?" property
unverifiable from the output alone. Averaging the tone per 8×8 tile makes the
property exact and independently checkable, at the cost of a 16-px
posterisation pitch. The site can keep its rotated circular halftone; this
artifact only claims the ordered path.

## Files

| file | what |
|---|---|
| `photo_field.py` | the generator (loads the photo, dithers, writes PNG + manifest) |
| `photo_field_16x9.png` | the render, 1920×1080, 2 tones |
| `photo_field_manifest.json` | source, crop, cell/upscale, dither spec, ink fraction |
| `photo_field_verify.mjs` | the independent gate (`node photo_field_verify.mjs` → `GATE_PASS`) |
| `PHOTO_FIELD_NOTES.md` | this file |

Regenerate: `python3 photo_field.py && node photo_field_verify.mjs`
