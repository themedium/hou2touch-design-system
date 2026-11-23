# PARITY — the site's own hero shader, reproduced in Python

## What this is

`parity_hero_1439x739.png` is a **parity render**, not a canon render. It reproduces what the
live site actually does in its hero: the fragment shader from `en/index.html` (the `fs` template
literal, line ~4119), transcribed to Python/NumPy and rendered against the site's own texture
`img/hero_school.webp`.

The shader source is kept verbatim in **`parity_shader.glsl`** (extracted byte-for-byte from
`en/index.html`, 3078 characters) so the transcription can be audited against it.

Reproduced uniforms (identical to the GPU reference capture):

| uniform | value | meaning |
|---|---|---|
| `R` | (1439, 739) | viewport / canvas |
| `I` | (1440, 900) | `hero_school.webp` native size |
| `M` | (0.5, 0.5) | loupe centre |
| `t` | 6.0 | time (static frame) |
| `h` | 0.0 | loupe strength (off) |
| `A` | 0.0 | audio level (off) |
| `C` | 4 | cell size in px = `max(3, round(739/170))` |
| `P` | 0.6 | image centre x |
| `K` | 1.0 | halftone reveal (fully revealed) |
| `B` | 197.0 | cloud mask baseline (bottom of the facts row + 12) |

## Measured statistics — reference vs render

| metric | GPU reference | this render | delta | gate |
|---|---|---|---|---|
| size | 1439×739 | 1439×739 | — | pass |
| unique colours | 795 | 896 | +101 (+12.7 %) | ±15 % → pass |
| `#e9e7e1` (paper) | 82.107 % | 81.568 % | −0.539 pp | ±2 pp → pass |
| `#e9e7e0` exact | 0.087 % | 0.000 % | −0.087 pp | reported |
| `#0b0b0c` exact (INK) | 0.000 % | 0.000 % | 0.000 pp | < 0.1 % → pass |
| orange (R>150, G<120, B<90) | 5.107 % | 5.101 % | −0.006 pp | ±1.5 pp → pass |
| within ±8 of paper | 84.223 % | 83.972 % | −0.251 pp | reported |
| **MAE per channel** | — | **4.018** | — | ≤ 12 → pass |
| max channel difference | — | 211 | — | reported |
| **pixels with max channel diff ≤ 12** | — | **94.672 %** | — | ≥ 60 % → pass |

`node parity_hero_verify.mjs` → **GATE_PASS**.

(The brief quoted 5.16 % for "orange presence"; the verifier measures 5.107 % with
`R>150, G<120, B<90` — the same predicate, one pixel-row of rounding difference in the reference
file. The render matches the measurement, not the quoted figure.)

## Colour space of the reference file

The reference PNG stores **Display-P3 encoded bytes**, not sRGB bytes. This was verified
arithmetically before anything was rendered: converting the reference's three characteristic
colours from Display-P3 back to sRGB returns the shader's own constants exactly —

| reference byte | Display-P3 → sRGB | shader constant |
|---|---|---|
| `(233, 231, 225)` | `(233.45, 230.92, 224.36)` | `PAP = (.914, .906, .878)` |
| `(22, 25, 31)` | `(21.28, 25.12, 31.58)` | `dc = mix(INK, vec3(.16,.2,.27), .35)` |
| `(214, 103, 63)` | `(230.24, 94.45, 49.01)` | `mix(PAP, ORG, .9)` |

So the render applies the same sRGB → Display-P3 encode before writing the PNG
(`srgb_to_display_p3()` in `parity_hero.py`). Without that step the whole palette would be
wrong (paper would come out `#e9e7e0`, orange `#e55f31`).

## The hero is not 1-bit — and the site's own hero breaks the design system

The reference (and this render) is **not** a two-value print:

* 795 unique colours (ref) / 896 (render);
* exact paper `#e9e7e1` = 82.11 %, exact ink `#0b0b0c` = **0.00 %**;
* the darkest value that ever appears is `#16191f` — the shader never writes `INK` itself,
  because the dot colour is `dc = mix(INK, vec3(.16,.2,.27), .35)`;
* a third family colour (orange, `mix(PAP, ORG, .9)`) is present at 4.5 % of pixels, plus
  antialiased dot edges everywhere else.

Therefore the design system's P1/M1 rule ("two values only") is **violated by the site's own
hero** — the hero is a continuous-tone halftone with an orange accent, not the canonical
1-bit system. §11 of `MASTER_DESIGN_SYSTEM.md` records this.

What this work proves: the canonical 1-bit system (the previous renders in this folder) and the
site's actual hero (this render) are **two different aesthetic objects**, and **both are now
reproducible**. The earlier renders were technically compliant but not a reproduction of the
site's hero — that gap is now closed with a numeric parity gate rather than an eyeball
comparison.

## Honest limits of the parity

Bit-exact equality across a GPU and a CPU float path is not achievable, and was not attempted.
The measured residuals, and their causes:

1. **Float precision.** The GPU evaluates the shader in IEEE binary32 (`highp float`); NumPy
   here is float64, with the two most precision-sensitive helpers (`pk()`, `b2()`) explicitly
   rounded to binary32 to emulate the GPU. `pk()` evaluates `fract(sin(dot(c, vec2(12.9898,
   78.233))) * 43758.5453)` with `dot` reaching ~1.2·10⁵ on the rotated halftone grid; at that
   magnitude a float32 argument carries ~0.008 of error, so cells whose dot radius sits near
   the threshold land on the other side of it. This is the dominant residual: the differences are
   individual cells inside the ink cloud, not whole regions.
2. **Bilinear filtering.** The GPU filters textures with fixed-point subtexel weights; here the
   weights are exact float. Quantising them to 8/6/4 bit changed the MAE by < 0.005 — i.e. below
   the noise floor at this scale.
3. **`sin()` differences** between GPU `sinf` and NumPy's double-precision `sin` — same family as
   (1).
4. **Texture upload orientation.** `UNPACK_FLIP_Y_WEBGL` is a property of the capture pipeline,
   not of the shader. Both conventions were rendered: upright (file row 0 = texture v = 0)
   gives MAE 4.018, flipped gives MAE 14.265. The upright one is used and recorded in the
   manifest.
5. **WebP decoding** is identical across decoders (PIL/libwebp and macOS `sips` agree bit-for-bit
   on `hero_school.webp`), so it is not a source of error here.
6. **Texture resolution / capture scale** was tested: rendering at 2× or 3× and downsampling
   (the DPR-2 hypothesis) makes the match *worse* (MAE 14.3 / 14.6), so the reference is a 1×
   render.

Residual MAE **4.018** per channel, **94.67 %** of pixels within a max channel difference of 12.
The disagreements are visually indistinguishable side by side except for individual halftone
cells at the cloud's tonal edges (compare a 3× crop of the reference and the render: the dot
grid, the orange mid-tone band and the mask edge coincide; a small minority of cells flip).

## Files

| file | role |
|---|---|
| `parity_shader.glsl` | the shader, verbatim from `en/index.html` |
| `parity_hero.py` | the NumPy transcription + the render |
| `parity_hero_1439x739.png` | the parity render (1439×739, 8-bit RGB, Display-P3 byte values) |
| `parity_hero_manifest.json` | uniforms, conventions, statistics, reference comparison |
| `parity_hero_verify.mjs` | independent stdlib-only Node verifier (own PNG decoder) |
| `PARITY_NOTES.md` | this file |

Reproduce: `python3 parity_hero.py && node parity_hero_verify.mjs` → `GATE_PASS`.

Nothing outside these files was modified; nothing was committed.
