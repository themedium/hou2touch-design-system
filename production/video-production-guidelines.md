# Hou2Touch — Video Production Guidelines

**Status:** MEASURED inputs, plus clearly-flagged derived production procedure.

---

## 1. What is verified and what is not

| Claim | Status |
|---|---|
| The hero renders at `round(cssSize/CELL)` cells and upscales with nearest filtering | **VERIFIED** (`hero:781-783`, `hero:71`) |
| The WebGL context has `preserveDrawingBuffer:true` → the canvas is capturable | **VERIFIED** (`hero:770`) |
| The clock formula is `T = 6.0 + elapsed * rateScale`, rateScale = `.72` (fine) / `1` (coarse) | **VERIFIED** (`hero:809`) |
| The frame readout is `f 000000` = `floor(T*60)` | **VERIFIED** (`hero:822`) |
| The pointer lens is a Gaussian of radius ≈ .236 UV | **VERIFIED** (`hero:237`) |
| There is **no existing video-export tool** in the repo | **VERIFIED** — no capture/render script was found in the file listing |
| A "reels/" directory exists at the repo root | **OBSERVED** in the directory listing — its contents were **not inspected** (read budget exhausted). Flagged. |

**No claim is made that a particular export pipeline was ever used.** Everything below is a *derived*
procedure built from the verified primitives.

---

## 2. The frame contract

For a deterministic render, drive time from the frame index, never from the wall clock:

```
T(n) = 6.0 + n / fps * rateScale
```
with `rateScale = 0.72` in fine mode (the production default).

This preserves the two decisions the owner made on 20.11.2026 (`hero:809` comment):
1. the band **starts at a successful phase** (`6.0`), never on a dead frame;
2. the band **always animates** — there is no reduced-motion freeze.

**The `t0` randomisation** (`hero:788`: `performance.now()-Math.random()*4000`) is a *live-page* device to
desynchronise stacked heroes. For a single-asset video, set the phase explicitly (e.g. `T(0) = 6.0`).

### 2.1 Frame-count table

| fps | 1 s | 5 s | 10 s | 30 s | 60 s |
|---|---|---|---|---|---|
| 25 | 25 | 125 | 250 | 750 | 1500 |
| 30 | 30 | 150 | 300 | 900 | 1800 |
| 50 | 50 | 250 | 500 | 1500 | 3000 |
| 60 | 60 | 300 | 600 | 1800 | 3600 |

Use **25 or 30 fps** for a European-school look; the field's internal motion rates (0.5–2 Hz) are
comfortable at both.

---

## 3. Resolution and the dither pitch

The dither cell is **2 CSS px** in fine mode → the Bayer matrix repeats every **16 CSS px**.

| Master | Render the canvas at | Upscale |
|---|---|---|
| 1920 × 1080 | 960 × 540 | ×2 nearest |
| 3840 × 2160 | 1920 × 1080 | ×2 nearest |
| 1080 × 1080 | 540 × 540 | ×2 nearest |
| 1080 × 1920 (vertical) | 540 × 960 | ×2 nearest |

**Do not render at the master resolution and downscale** — that resamples the dot matrix and produces
moiré. Render at cell resolution and upscale by an integer factor.

If the delivery spec needs a different dot pitch, change `CELL` (2 → 1 for a 8 px pitch, 3 for 24 px) and
render at `master/CELL`. Do not resample.

---

## 4. Rendering routes, ranked by fidelity

### Route A — the browser (highest fidelity, lowest effort)
1. Open the built page (`en/<page>.html`) — the shader is already inlined.
2. Force deterministic time: override `performance.now()` in a small injected script, or drive
   `T` from a query parameter.
3. Capture the canvas at its **buffer** resolution (`canvas.width` × `canvas.height`) and upscale ×`CELL`
   with nearest neighbour in a compositor (or capture the CSS-sized canvas directly — the browser already
   upscales it with `image-rendering:pixelated`).
4. Force `P`/`PA` to a fixed value for reproducibility (or animate them deliberately per shot).

**Caveat:** the built page's `draw()` reads `performance.now()` internally. Patching it requires editing
the page — **not allowed on the source site**. Instead, capture from a *copy* or drive the export via a
separate harness that imports the same shader string.

### Route B — TouchDesigner (best for motion pieces)
1. Copy the FS string into a GLSL TOP.
2. Add uniforms: `R` (from the TOP resolution), `T` (an absolute-time or CHOP-driven float), `M` (constant
   int), `K` (the family colour as a RGB), `P`, `PA`, `TX` (a texture), `HT`, `FN`, `BX`, `LC`, `RL`, `GR`.
3. Set the TOP resolution to `round(width/2) × round(height/2)` (fine) and set the *Viewer* / final
   Constant TOP to **Nearest** filtering.
4. Drive `T` from `absTime` (or a `Time` CHOP) so it matches the web formula.
5. Render with a **Movie Output TOP** at 25/30 fps.

**Watch out:** TouchDesigner's `gl_FragCoord` origin is bottom-left, same as GL — but the site's shader
flips `uv.y = 1. - uv.y` explicitly, so the copy is correct as-is.

### Route C — Three.js
1. `RawShaderMaterial` with the FS verbatim; a plane with the VS verbatim.
2. Render to a `WebGLRenderTarget` of the reduced size with `NearestFilter`, then draw that target to the
   canvas with a second `NearestFilter` material.
3. Uniform names map 1:1 (`R`, `T`, `M`, `K`, `P`, `PA`, `TX`, `HT`, `FN`, `BX`, `LC`, `RL`, `GR`).

### Route D — After Effects / NLE
- **Only composite.** Render the field in B/C as a PNG/EXR sequence, then lay the type and the DOM overlay
  labels over it.
- Do **not** rebuild the dither in AE — its Halftone effect is not the site's ordered Bayer and will not
  match.
- The type animation ports cleanly (all durations and the bezier are explicit — see
  `motion/animation-specifications.md`).

### Route E — Blender
- Render the field via a GLSL node or an external renderer; do the Bayer threshold in the compositor with a
  Math node against a pre-baked 8×8 image in **cell space**; scale up with *Nearest*.
- Use the Bebas fonts for 3D type.

---

## 5. The overlay layer (DOM labels)

The band's four corner labels and the tick rail are DOM, not shader. To reproduce them in video:

| Label | Content | Position |
|---|---|---|
| top-left `.tl` | `<op> <u>COMP</u>` | `left:var(--pad); top:16px` |
| top-right `.tr` | `f 000000 · 60 fps` | `right:var(--pad); top:16px` |
| bottom-left `.bl` | (unused in the mock layout) | `left:var(--pad); bottom:12px` |
| bottom-right `.br k` | `● <FAM> · <motif>` | `right:var(--pad); bottom:12px` |
| loupe readout `.ret` | `×3.2 · 0.700 / 0.500` | tracks the loupe centre (fine mode only) |
| tick rail `.tk` | 12 cells with 1 px ink borders | `left/right:var(--pad); top:0; height:7px` |

Style: `font: 500 10px/14px var(--mono); letter-spacing:.07em; text-transform:uppercase; padding:3px 7px;
background:var(--paper); color:var(--ink)`.

In video: burn them in, or generate them per frame from the same values. The frame counter is
`floor(T*60)` — use the real frame number for a truthful readout.

---

## 6. Editing grammar for a video in this language

| Beat | Technique |
|---|---|
| Cut on a cue | the shader's own cue rates (0.5–8 s) give natural cut points |
| Transition | the site's clip wipe (`inset`, 1.4 s) — never a cross-dissolve |
| Type entry | the masked rise (1.1 s, `.05 s` glyph stagger) |
| Accent beat | let the family colour appear for exactly one motif cue |
| Negative space | the band is 1/2 to 3/4 of the frame; the rest is paper |
| Sound design | 120 bpm (`fract(t*2.)`) is the site's implicit pulse — motifs 0 and 9 run at 2 Hz |

**Rules**
- Never dissolve between two generative fields — cut or wipe.
- Never add a colour that is not the family colour.
- Never let a solid fill reach pure black in fine mode (`m.x ≤ .95`).

---

## 7. Checklist for a delivered asset

- [ ] Rendered at cell resolution and upscaled by an integer factor with nearest filtering.
- [ ] Output is 1-bit + at most one accent colour.
- [ ] Dot pitch is a multiple of 16 px (fine) / 24 px (coarse).
- [ ] Time formula matches `T = 6.0 + n/fps * 0.72`.
- [ ] Type is Bebas (H2T Bebas) for display, Inter Tight for text, JetBrains Mono for labels.
- [ ] Labels are mono 10 px, `.07em`, UPPER, on a paper chip.
- [ ] All easing is `cubic-bezier(.19,1,.22,1)`; durations are in the 0.3–1.4 s band.
- [ ] Text on paper is `#0b0b0c`.
- [ ] The overlay frame counter matches the actual frame number.

---

## 8. Honest limitations

- **No export tool exists in the repo** — the procedures above are derived, not recovered.
- The `reels/` directory at the repo root was **not inspected**; it may contain a prior pipeline. This is
  the single highest-value follow-up.
- The web route requires patching `performance.now()`; on the **live** source that is forbidden by the
  task rules. Work on a copy or use Route B/C.
- There is no audio anywhere in the system. "Sound-reactive" is a narrative, not an implementation.
