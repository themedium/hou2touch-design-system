# Hou2Touch — Rendering Technologies

**Status:** MEASURED. How pixels actually get made, and what that means for each target.

---

## 1. The rendering stack

```
DOM section.hero
  ├── <canvas>  → WebGL 1 context (antialias:false, preserveDrawingBuffer:true)
  │     ├── full-screen triangle (3 verts, no index buffer)
  │     ├── VS: attribute vec2 p → gl_Position = vec4(p,0,1)
  │     ├── FS: motif() → ink field → Bayer threshold → RGB
  │     ├── uniform sampler2D TX  ← the title knockout mask
  │     └── viewport = (cv.width, cv.height) = (cssWidth/CELL, cssHeight/CELL)
  ├── .ov overlay (pointer-events:none)  ← DOM labels on top
  └── .ttl title block                   ← DOM type on top
```

The canvas is `position:absolute; inset:0` inside the band (`hero:71`), and is upscaled by CSS with
`image-rendering:pixelated`.

---

## 2. Resolution model

| Quantity | Formula | Source |
|---|---|---|
| Buffer width | `round(cssWidth / CELL)` | `hero:781` |
| Buffer height | `round(cssHeight / CELL)` | `hero:781` |
| `CELL` | `FINE ? 2 : 3` CSS px | `hero:206` |
| Viewport | `(cv.width, cv.height)` | `hero:782` |
| CSS size | `100%` of the band | `hero:71` |
| Bayer pitch | `8 × CELL` = 16 px (fine) / 24 px (coarse) | derived from `b8` |

**`devicePixelRatio` is not used.** The dither grid is defined in **CSS pixels**, so a 2× retina display
shows the same 16 px dot pitch, just with sharper edges. This is intentional ("print grain", not
"pixel crunch", `hero:206` comment).

**Consequence for export:** to make a video whose dot pitch matches a 1080p master, render the canvas at
`1920/2 = 960` cells wide and upscale ×2 with nearest neighbour. The dot pitch is then 16 output pixels.

---

## 3. The dither pipeline, end to end

```
f(uv, t)  ──▶ ink density   [0,1]
g(uv, t)  ──▶ colour mask   [0,1]
th        ──▶ b8(gl_FragCoord.xy) + 0.5/64      (per buffer pixel)
c = PAPER
if (f > th)       c = INK
if (g > .5 && f > th*.6) c = K
```

Then, in fine mode only:
```
if (FN > .5) ink = graphite;  f = min(f, .95);  f *= quietZone(f);  g *= step(.015, dist_to_title)
draw paper dots, registration grid, reticle
if (HT > .5 && texture2D(TX, uv).a > .5) c = PAPER     ← title knockout
```

**Everything is 1-bit + 1 accent.** There is no anti-aliasing, no sub-pixel coverage, no soft grey.
That is the identity.

---

## 4. Antialiasing — where it exists and where it must not

| Element | AA? | Why |
|---|---|---|
| Dithered field | **No** | the dither *is* the anti-aliasing |
| `gline()` lines | Yes — via `fwidth2(v)` | screen-space line width |
| `hline()` lines | Yes — via `smoothstep(w*.5, w, abs(dy))` | |
| The mask canvas | Yes — `strokeText` + `fillText` | the halo is soft |
| Canvas upscale | **No** — `pixelated` | must stay hard |

`gline` verbatim — `hero:231`:
```glsl
float gline(float v,float w){float f=fract(v);return 1.-smoothstep(0.,w*fwidth2(v),min(f,1.-f));}
```
`hline` verbatim — `hero:232`:
```glsl
float hline(float dy,float w){return 1.-smoothstep(w*.5,w,abs(dy));}
```

**The `gline` width is in *screen* units** (`w*fwidth2(v)`) — so a line stays ~1 px wide regardless of
zoom. `hline`'s width is in *UV* units — so it scales with the composition. Both conventions coexist;
copy the right one for the job.

---

## 5. The mask texture

- Offscreen `<canvas>` at buffer resolution (`hero:787-788`).
- 2D context, `clearRect`, then `scale(mk.width/br.width, mk.height/br.height)` to map CSS px → buffer px.
- `font = '700 ' + fs + 'px "H2T Bebas"'` — forced, regardless of the element's computed family.
- `letterSpacing` copied from the computed style.
- `lineWidth = max(2*CELL, fs*(FINE?.075:.05))` → the halo grows with the cell size and the type size.
- `lineJoin='round'`.
- Text is **upper-cased** before drawing.
- Uploaded with `gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mk)`.
- Texture params: `NEAREST` min/mag, `CLAMP_TO_EDGE` wrap — **no mipmaps, no linear filtering**.

Baked on resize and at t ≈ 1.65 s after fonts load (`hero:826`).

---

## 6. Performance model

| Cost | Where | Notes |
|---|---|---|
| 1 draw call per visible hero | `hero:818` | one triangle |
| Fragment cost | `720 × 200` cells (fine, 1440 px band) ≈ 144 k fragments | trivial |
| Loupe doubles the motif evaluation | `hero:296` | `mz` is computed unconditionally |
| `vedge` = 18 hash calls/fragment | motif 12 | the most expensive motif |
| `b8` = ~6 hash-ish ops | motifs 15, 16, and every fragment's threshold | |
| Offscreen heroes are skipped | `hero:797` | `sc.vis` |
| Canvas resize is debounced by `ResizeObserver` | `hero:783` | |

**Practical note for video export:** the shader's cost is dominated by fragment count, and the loupe
doubles it. At 4K (3840 × 640 cells in fine mode) that is ~4.9 M fragments × 2 = 10 M motif evaluations
per frame — fine on any discrete GPU, but on a laptop iGPU it will drop frames.

---

## 7. Rendering technologies by output type

### 7.1 Web (as built)
- HTML + CSS + inline WebGL 1. No bundler. The shader is inlined into every built page.

### 7.2 Video (frames from the web)
- `preserveDrawingBuffer:true` is already set (`hero:770`), so the canvas can be captured.
- Drive time deterministically: `T = 6.0 + n/fps * rateScale`. Do **not** rely on `performance.now()`.
- Capture at buffer resolution and upscale ×`CELL` with nearest neighbour, or capture the CSS-sized canvas
  with the browser's pixelated scaling.
- The pointer lens must be forced to a fixed `P`/`PA` for reproducible frames.

### 7.3 TouchDesigner
- GLSL TOP with the shader verbatim; uniforms as GLSL TOP parameters.
- Set the TOP resolution to `round(w/CELL) × round(h/CELL)`; use a Null/Constant for `K`, `M`, `T`.
- `fwidth` works in TouchDesigner GLSL TOPs on the GPU path.
- `b8(gl_FragCoord.xy)` maps to `gl_FragCoord` in a GLSL TOP — same semantics.
- The title knockout: a Text TOP (or a rendered image) sampled as a second texture.

### 7.4 Three.js
- `RawShaderMaterial` with the FS verbatim (GLSL ES 1.00 → `glslVersion: null`).
- `NearestFilter` on a `WebGLRenderTarget` of the reduced size, then a full-screen quad upscaled with a
  second orthographic pass (or just size the canvas down and use CSS `image-rendering:pixelated`).
- `texture2D` → `texture2D` is fine in GLSL 1; in GLSL 3 use `texture()`.
- `attribute` → `in`, `varying` → `out/in`, `gl_FragColor` → a declared `out vec4`.

### 7.5 After Effects
- Render the field in a real renderer (Blender/TD/Three.js) to a PNG/EXR sequence, then composite the
  type in AE.
- **Do not** try to rebuild the Bayer threshold in AE: its Halftone effect is a stochastic screen and
  will not match. Use a pre-baked 8×8 Bayer LUT as a matte if you must.
- The type animation (rise, stagger, wipe) ports cleanly: the durations and the bezier are explicit.

### 7.6 Blender
- Compositor: render the field with a GLSL node or an external render, then apply a Bayer threshold
  (Math → Greater Than) against a pre-baked 8×8 image texture in cell space.
- Render the scene at cell resolution and scale up with *Nearest* in the Output node.
- The 3D text uses the same two display fonts; `upem 1000` means scale accordingly.

### 7.7 Print
- Render at the target print resolution with `CELL` = 2 device px at the print scale, or 1 for a
  higher-frequency look (the portrait halftone uses cell = 1, `school.px.html:3697`).
- Two-level output only: ink or cream of paper.

---

## 8. What the rendering system forbids

1. **No continuous-tone output.** Any 8-bit grey that is neither paper nor ink breaks the identity.
2. **No antialiasing on the field.** AA is the dither's job.
3. **No linear filtering on the upscale.**
4. **No devicePixelRatio scaling.** The dither pitch is in CSS px by design.
5. **No more than one accent colour per composition.**
