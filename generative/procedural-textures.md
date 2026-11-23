# Hou2Touch — Procedural Textures

**Status:** MEASURED. This document covers the texture-generation primitives used across the site:
the WebGL hero field, the canvas **ordered dither / halftone** rasteriser (`bakeDither` / `ditherInto`),
the pixel-stepped section edges (`.edge`), and the canvas portrait halftone.

---

## 1. Texture inventory

| Texture | Where | Technique |
|---|---|---|
| Hero generative field | `tools/hero_index_mock.html` | WebGL fragment shader + Bayer threshold |
| Title knockout mask | `hero:786-806` | Canvas 2D text rasterisation → `sampler2D` |
| Image halftone | `school.px.html:2527-2600` / `tools/prev_stack.html:2269-2340` | `bakeDither` — ordered dither to 2 levels |
| Portrait halftone | `school.px.html:3599, 3697` | `bakeDither` at cell = 1 px, 2 levels |
| Pixel-stepped section edge | `src/template_v16.html:555-556` | CSS `background` sprite, `image-rendering:pixelated` |
| Concept divider dots | `tools/pipeline/wave_look.py:155-156` | CSS radial-gradient dot row, 9 px pitch |

---

## 2. The Bayer matrix (the site's core texture primitive)

### 2.1 GLSL implementation — `tools/hero_index_mock.html:224-226` (verbatim)

```glsl
float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}
float b4(vec2 a){return b2(.5*a)*.25+b2(a);}
float b8(vec2 a){return b4(.5*a)*.25+b2(a);}
```

This is the **recursive Bayer construction**: `B(2n) = ¼·B(n) at (2i,2j) + ¼·B(n) at (2i+1,2j+1) + …`,
implemented as `b4 = b2(.5a)*.25 + b2(a)` and `b8 = b4(.5a)*.25 + b2(a)`.

Base `b2` is the analytic 2×2 matrix:
```
.0  .5
.5  .25     →  fract(dot(floor(a), vec2(.5, a.y*.75)))
```
`dot(a, vec2(.5, .75·a.y))` for integer `a` yields `0, .5, .75, .25` depending on parity — the classic
2×2 Bayer values.

The resulting **8×8 threshold matrix** is:
```
 0 32  8 40  2 34 10 42
48 16 56 24 50 18 58 26
12 44  4 36 14 46  6 38
60 28 52 20 62 30 54 22
 3 35 11 43  1 33  9 41
51 19 59 27 49 17 57 25
15 47  7 39 13 45  5 37
63 31 55 23 61 29 53 21
```
(standard 8×8 Bayer; the GLSL recursion reproduces it)

### 2.2 Threshold use — `hero:299` and `:303` (verbatim)

```glsl
 float th=b8(px)+.5/64.;
 ...
 if(m.x>th)c=ink;
 if(m.y>.5&&m.x>th*.6)c=K;
```

- `px = gl_FragCoord.xy` — the Bayer matrix is evaluated **per buffer pixel**, i.e. per dither cell.
- `+.5/64` is a half-step of the finest Bayer level: it de-quantises the comparison so a field value
  exactly equal to the threshold still resolves to ink (avoiding a systematic "half-grey" band).
- The colour mask is compared against `th*.6` — **the accent requires 60 % of the ink threshold**, which is
  why accents read as slightly lighter than solid black.

### 2.3 Cell size and output resolution

`tools/hero_index_mock.html:206` (verbatim):
```js
const CELL=FINE?2:3; // css px per dither cell (fine: 2 px — print grain instead of pixel crunch)
```
`hero:781-783` (verbatim):
```js
cv.width=Math.max(1,Math.round(r.width/CELL));
cv.height=Math.max(1,Math.round(r.height/CELL));
gl.viewport(0,0,cv.width,cv.height);
```
and `hero:71`:
```css
.band canvas{...image-rendering:pixelated;image-rendering:crisp-edges}
```

**Consequences:**
- One shader pixel = one dither cell = 2 CSS px (fine) or 3 CSS px (coarse).
- The 8×8 Bayer matrix therefore repeats every `8 × CELL` CSS px = **16 px (fine) / 24 px (coarse)**.
- `devicePixelRatio` is **not** consulted: the buffer is sized from `getBoundingClientRect()` (CSS px),
  so the dither pitch is identical on retina and non-retina. This is the "print, not screen" behaviour.

---

## 3. The canvas halftone — `bakeDither` / `ditherInto`

### 3.1 Location and function signature

| Function | File:line | Signature |
|---|---|---|
| `bakeDither` | `school.px.html:2527` and `:3682`; `tools/prev_stack.html:2269` | `bakeDither(img,bw,bh,cell,pos,lv,lev)` |
| `ditherInto` | `school.px.html:2589`; `tools/prev_stack.html:2330` | `ditherInto(im,c,box,lv,o)` |

The source is duplicated between `school.px.html` and `tools/prev_stack.html` (the latter carries the
comment `/* ↓ вынуто of school/src/template.html: onView, Байер, bakeDither, fitBmp, dcd, очередь печати DQ, маски cook */`
— `prev_stack.html:2261`).

### 3.2 The algorithm, as documented in the source

`school.px.html:2583` (comment, verbatim):
```
   ditherInto: кадр img → дизер в canvas c; клетка = целое число пикселей экрана (≈ cs CSS px), холст по размеру клеток — «cover» по центру box;
```
`school.px.html:3681` (comment, verbatim):
```
/* дизер — как bakeDither главной (r1 · C-07): кадр cover под bw×bh клеток, уровни по перцентилям 2–98 (медиана → lev), 2 уровня: чернила / крем листа */
```

### 3.3 Reconstructed algorithm (from the documented contract)

```
bakeDither(img, bw, bh, cell, pos, lv, lev):
  w = round(bw / cell);  h = round(bh / cell)          // canvas is sized in CELLS
  ctx = rdCtx(w, h)                                    // an offscreen canvas of w×h pixels
  draw img into ctx with 'cover' fit, centred at pos    // pos = [px, py] focal point, default [.5,.5]
  read the w×h pixel data
  for each cell:
      compute the luminance L of that cell's pixel
      choose level 0 or 1 by comparing L against the threshold matrix
      write INK or PAPER
  return an ImageData of the dithered canvas
```

**Threshold levels:** the comment says levels are computed by **percentiles 2–98** of the luminance
distribution, with the **median** mapped to `lev`. `lv` is the number of levels to quantise to
(2, 3 or 4 in the call sites) and `lev` is the level count/contrast parameter.

**Two-level output:** "2 уровня: чернила / крем листа" — ink / cream-of-paper. Exactly the same
two-value contract as the WebGL hero, but with the *image* as the source instead of a procedural field.

**Call sites (MEASURED):**

| Call | Source | Cell | Levels | `lev` | Purpose |
|---|---|---|---|---|---|
| `bakeDither(img,box.clientWidth,box.clientHeight,3,[.5,.22])` | `school.px.html:2647` | 3 px | default 4 | — | main works-wall halftone |
| `bakeDither(im,cw,ch,1,o.pos||[.5,.5],lv||4,o.lev)` | `school.px.html:2593` | 1 px | `lv` | `o.lev` | generic `ditherInto` inner call |
| `bakeDither(img,box.clientWidth,box.clientHeight,2,{pos:[.5,.3],lev:.6,cs:1})` | `school.px.html:3262` | 2 px | 2 | `.6` | "print" toggle mode |
| `bakeDither(focusCrop(im,FOC[n],104,130),52,65,1,[.5,.5],2,.6)` | `school.px.html:3697` | 1 px | 2 | `.6` | **portrait halftone**, 52×65 cells, focus-cropped |
| `ditherInto(im,c,box,lv,o)` with `lev:4,{pos:[1,.5],lev:.42}` | `school.px.html:3205` | 1 px | 4 | `.42` | list-row halftone |

**The `pos` parameter** is a focal point for the "cover" crop — `[1,.5]` right-aligned, `[.5,.3]` upper,
`[.5,.22]` top-ish — used to keep faces/subjects in frame when cropping to a cell grid.

**`cs` (cell size)**: `school.px.html:2583` states "клетка = целое число пикселей экрана (≈ cs CSS px)" —
the cell is an integer number of screen pixels, so the halftone pitch is device-independent.

### 3.4 45° dot rotation

**No 45° rotation was found in the dither code.** The Bayer matrix is evaluated in the cell's own
coordinate frame, so the dots form an axis-aligned 8×8 ordered pattern, not a 45°-rotated screen.

The `rotate(45deg)` / `rotate(90deg)` occurrences in the codebase are **UI affordances**, not dither
rotation:
- `.fq-l summary i::after{transform:translate(-50%,-50%) rotate(90deg)}` (`school.px.html:770`)
- `details[open]>summary .pl::after{transform:rotate(0)}` (`landing.css`) — the accordion plus/minus
- `.pgd2 details[open] .s-ic{transform:rotate(45deg)}` (`prev_stack.html:1043`) — a close icon

**Do not claim a 45° halftone rotation for this project** — it is not there.

---

## 4. Pixel-stepped section edges

`src/template_v16.html:555-556` (MEASURED, verbatim):
```css
.edge{position:absolute;left:0;right:0;height:var(--edge);pointer-events:none;background:var(--dedge,none) 0 0/32px 96px repeat-x,var(--bg);image-rendering:pixelated}
.edge.t{top:0}.edge.b{bottom:0;transform:scaleY(-1)}
```
Mobile override — `src/template_v16.html:600`:
```css
  .edge{background-size:24px 72px,auto}
```

- The edge is a **repeating 32 × 96 px PNG sprite** (`--dedge`) laid along the horizontal axis.
- `image-rendering:pixelated` keeps the sprite's hard pixel steps.
- `.edge.b` flips it vertically with `scaleY(-1)` — one sprite serves both the top and the bottom edge.
- The tile is **32 px wide = 2 × the 16 px fine dither pitch**, so the edge steps align with the dither
  rhythm of the hero band.

Earlier template versions used the same sprite with a different offset —
`src/template_v4.html:480-481`, `v8:584`, `v10:610`, `v11:645`:
```css
.edge{...height:96px;...background:var(--dedge) 0 0/32px 96px repeat-x;image-rendering:pixelated}
.edge.t{top:-95px}.edge.b{bottom:-95px;transform:scaleY(-1)}
```
The current `src/template.html` does **not** contain an `.edge` rule (it was not found by grep over
`src/template.html`); the rule survives in `src/template_v16.html` and `src/template_v20_pref2.html`.
**Flagged as unresolved: which of the numbered template variants is the live one.**

### 4.1 The concept divider dots — `tools/pipeline/wave_look.py:155-156` (MEASURED, verbatim)

```css
html body #concept .ab-it:not(:last-child)::before{content:"";position:absolute;z-index:0;left:0;right:calc(-1*var(--gap));top:calc(clamp(20px,2vw,28px) + clamp(52px,4.6vw,68px)*.41 - 1px);height:9px;transform:translateY(-4px);background:radial-gradient(circle at 4.5px 4.5px,var(--paper) 2.6px,var(--ab) 3px 4.5px,transparent 5px) right 2px top/9px 9px no-repeat,linear-gradient(var(--ab),var(--ab)) left center/calc(100% - 11px) 1.5px no-repeat}
html body #concept .ab-it:last-child::before{content:"";position:absolute;z-index:0;left:0;right:0;top:calc(clamp(20px,2vw,28px) + clamp(52px,4.6vw,68px)*.41 - 1px);height:1.5px;transform:translateY(-.75px);background:linear-gradient(90deg,var(--ab),transparent)}
```
A row of 9 px **halftone dots** (paper core 2.6 px, colour ring 3–4.5 px) marching along a 1.5 px rule.
This is the site's smallest texture unit: a **9 px dot grid**.

---

## 5. Procedural texture rules (the identity in one paragraph)

A texture belongs to the system if:

1. It resolves to **two values** — ink and paper — optionally with **one** accent colour.
2. Its grain is **ordered**, 8×8 Bayer, at a **2 CSS px cell** (fine) or 3 px (coarse).
3. Its dot pitch is **16 px** (fine) on screen.
4. Solid areas never reach dead black in fine mode (`m.x ≤ .95`); they keep a print texture.
5. Edges that meet the hero band use the **32 × 96 px pixel-stepped sprite**, aligned to the 16 px grid.

---

## 6. Reproducing the halftone in another tool

**TouchDesigner**
- Render the image into a GLSL TOP that samples it at cell resolution, computes luminance, and compares
  against a Bayer matrix computed in-shader (the same `b8` function). Output paper/ink.
- Set the TOP resolution to `round(w/2) × round(h/2)` and upscale with a Constant/Filter TOP set to
  *Nearest*.
- For the percentile levels, compute them in a CHOP: sample the image histogram, find the 2nd and 98th
  percentile, drive the threshold with a Constant.

**After Effects**
- Use a **Halftone effect** (Colour/Colour) with a 45° screen angle and ~2–4 px cell size, or better:
  a *Bayer* generator via a pre-baked LUT applied as a Set Matte, so the result is ordered rather than
  stochastic. AE's built-in Halftone is stochastic-ish per type; the project's Bayer order will not match
  exactly. **This is a known non-exact port.**

**Three.js**
- A full-screen shader plane as in the hero; sample the source texture at cell resolution
  (`floor(uv*cells)`), compute luminance, threshold against `b8`.

**ImageMagick / GIMP**
- `-ordered-dither` (ImageMagick) with an 8×8 Bayer threshold map produces a comparable result;
  GIMP has no built-in ordered dither and needs a Bayer matrix plugged in as a "Cie XYZ ramp".
