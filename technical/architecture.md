# Hou2Touch — Technical Architecture

**Status:** MEASURED from the repository layout and the source files.

---

## 1. Repository shape

```
hou2touch_redesign/
├── src/
│   ├── template.html          # master page template (1869 lines) — all base CSS + core JS
│   ├── template_v4/v8/v10/v11/v16/v17/v20_pref2/pre_short.html   # historical template revisions
├── en/
│   ├── adapt_1611.py          # MOTIF table, hero_assets(), index_hero(), EXTRA_CSS/PROG_CSS/PATH_CSS
│   ├── build.py               # per-page assembly, FS_SCALE type scale
│   ├── flagship_assemble.py    # flagship page
│   ├── flagship_i18n.py
│   └── *.html                 # built output (ground truth)
├── family/
│   └── family.py              # family nav, author block, works wall, reviews, URLS, NAV
├── tools/
│   ├── hero_index_mock.html   # THE generative engine (826 lines)
│   ├── landing.css            # hero adjustments + section styles (140 lines)
│   ├── pipeline/wave_*.py     # post-processing waves (22 files)
│   └── prev_stack.html        # an extracted/previous stack, used as a reference bundle
├── fonts/
│   ├── h2t-bebas.woff2 / .otf
│   ├── c07b757a…otf           # Bebas Neue Bold
│   └── bac5026d…ttf           # Bebas Neue Regular
└── ...
```

**This is not a git repository** (per the workspace instructions), and `hou2touch_redesign/` contains
uncommitted work in the sibling `hou2touch_redesign` project — treat it as read-only source of truth.

---

## 2. The build pipeline

```
src/template.html  ──┐
en/adapt_1611.py    ──┤
en/build.py         ──┼──► en/<page>.html   (static output)
family/family.py    ──┤
tools/landing.css   ──┘
```

### 2.1 `en/build.py` — the assembler
- Holds `META` per page: `motif`, `n1`, `n2`, `px`, `u5m`, `defx`, colours, and the hero source file `hxf`.
- Injects the type scale if missing — `build.py:2093-2094`:
  ```python
  if '--fs-2xs:' not in t:
      t = t.replace('</head>', FS_SCALE_STYLE + '\n</head>', 1)
  ```
- Emits a page-level data blob — `build.py:2100-2103`:
  ```python
  data = 'const COURSE=%s;' % json.dumps(dict(
      slug=slug, fam='#' + F.HEX[M['fam']], motif=M['motif'], seed=0, px=M['px'], pxm=.5,
      n1=M['n1'], n2=M['n2'], u5m=M.get('u5m', 0), defx=M.get('defx', 'up14')
  ))
  ```
  → the page carries `fam`, `motif`, `px`, `n1/n2` (numeral parts), `u5m` (u5m flag) and `defx`
  (default motif variant) into the client.
- Calls `A16.postprocess(t, slug)` and appends `A16.EXTRA_CSS` + `A16.PATH_CSS` (`build.py:2110`).

### 2.2 `en/adapt_1611.py` — the page-layer generator
- `MOTIF` table (`:14-44`) maps slug → (family, motif).
- `hero_assets(slug)` (`:~740-757`) reads `tools/hero_index_mock.html`, extracts the `const MOTIF={...}`
  line with a regex and patches it if the page needs a new motif:
  ```python
  pre = re.search(r'const MOTIF=\{[^\n]*\};', mock).group(0)
  fam, motif = MOTIF.get(slug, ('top', 'warp'))
  if motif not in pre:
      pre = pre[:-2] + ',%s:16};' % motif
  if motif != 'moire':
      eng = _strip_motif_block(eng, 'if(M==16){')
  return ix_css, pre, eng, fam, motif
  ```
  **The hero engine is literally injected into every page's HTML.** That is why the built `.html` files
  contain the whole shader.
- `index_hero(slug, secs, cat, info, inline_md, price_html, offer, code)` (`:760+`) builds the hero:
  the H1 comes from the `m1` section, the lead from the rest of `m1`, and the facts header from `m15`:
  ```python
  if m1:
      h1 = m1[0].lstrip('# ').strip(); lead = ' '.join(m1[1:])
  else:
      h1 = (info or {}).get('title') or slug
      lead = (info or {}).get('pitch') or ''
  facts_h = next((l.lstrip('# ').strip() for l in m15 if l.startswith('#')), '')
  ```

### 2.3 `family/family.py`
Builds the family nav, the author block, the works wall and the review components, and owns `URLS` and
`NAV`. Its `js()` bundle exports (per `tools/prev_stack.html:2524`):
`{R,H,$,$$,reduce,fine,clamp,lerp,ease,MOTION,LOOP,onView,reveal,lock,digits,nav,blocks,dq,bakeDither,fitBmp,dcd,B8,bth,rdCtx,ditherInto,fit,PIXBG}`.

### 2.4 `tools/pipeline/wave_*.py`
Post-processing waves that mutate the built HTML/CSS. `wave_bc.py` contains literal CSS replacement
tuples, e.g. `:189-190`:
```python
    ('.cv li{display:grid;grid-template-columns:96px minmax(0,1fr);gap:18px;padding:12px 0;border-bottom:1px solid var(--line);animation:lpin .5s var(--ease) both}',
     '.cv li{display:grid;grid-template-columns:96px minmax(0,1fr);gap:20px;padding:12px 0;border-bottom:1px solid var(--line);animation:lpin .5s var(--ease) both}'),
```
So the waves are **CSS patch scripts**, not a templating engine. The built `en/*.html` files are the
ground truth for the final computed CSS.

---

## 3. The hero engine architecture

`tools/hero_index_mock.html` is a **self-contained demo page** that also serves as the engine source.

```
<script>
  COURSES{...}        // demo data (16 entries)
  MOTIF{...}          // name -> id map, 29 entries
  query flags: c, k, x
  build DOM sections
  ── engine ──
  CELL, VS, FS (the shader)
  rgb(css)            // CSS colour -> vec3
  scene setup loop:
      gl context, shaders, program, fullscreen triangle, uniforms
      mask canvas + sc_mask()
      ResizeObserver -> size()
      pointermove/leave -> sc.p/sc.pat
      IntersectionObserver -> sc.vis
  draw(sc, now)       // uniforms + drawArrays
  loop(now)           // rAF
  document.fonts.ready -> start
</script>
```

### 3.1 WebGL setup (verbatim, `hero:770-783`)

```js
 const cv=s.querySelector('canvas');const gl=cv.getContext('webgl',{antialias:false,preserveDrawingBuffer:true});
 if(!gl)continue;gl.getExtension('OES_standard_derivatives');
 ...
 const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 const lp=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,2,gl.FLOAT,false,0,0);
```

Key flags:
- `antialias:false` — the dither must not be smoothed by MSAA.
- `preserveDrawingBuffer:true` — **the canvas can be read back / screenshotted** (needed for video export).
- `OES_standard_derivatives` — required by `fwidth`/`fwidth2`.

### 3.2 Sizing (verbatim, `hero:781-783`)

```js
 const size=()=>{const r=cv.getBoundingClientRect();sc.W=r.width;sc.H=r.height;cv.width=Math.max(1,Math.round(r.width/CELL));cv.height=Math.max(1,Math.round(r.height/CELL));gl.viewport(0,0,cv.width,cv.height);if(sc.ht&&sc_mask)sc_mask()};
 size();new ResizeObserver(size).observe(cv);
```

### 3.3 The per-frame uniform upload (verbatim, `hero:810-816`)

```js
 gl.uniform2f(u.R,sc.cv.width,sc.cv.height);gl.uniform1f(u.T,t);gl.uniform1i(u.M,sc.m);gl.uniform3fv(u.K,sc.k);
 gl.uniform2f(u.P,sc.p[0],sc.p[1]);gl.uniform1f(u.PA,sc.pa);gl.uniform1i(u.TX,0);gl.uniform1f(u.HT,sc.ht);gl.uniform1f(u.FN,FINE?1:0); gl.uniform4fv(u.BX,sc.bx);
```

### 3.4 Failure handling
- `if(!gl)continue;` — if WebGL is unavailable, the section is simply left without a canvas.
- Shader compile errors are only `console.error`'d (`hero:772-774`); **there is no fallback render path.**
  A failed compile = a blank band.
- No WebGL2 path — WebGL 1 only.

---

## 4. Rendering technologies in the repo

| Technology | Where | Purpose |
|---|---|---|
| WebGL 1 fragment shader | `tools/hero_index_mock.html` | the hero band |
| Canvas 2D | `hero:786-806` | the title knockout mask |
| Canvas 2D `ImageData` | `school.px.html:2527-2600` | image halftone (`bakeDither`) |
| CSS `clip-path` | `hero:113, 119` | the canvas wipe |
| CSS `background` sprite + `image-rendering:pixelated` | `src/template_v16.html:555` | the pixel-stepped section edge |
| CSS `radial-gradient` dot row | `wave_look.py:155` | the concept divider dots |
| `IntersectionObserver` | `template:1641`, `hero:797` | reveals + offscreen culling |
| `ResizeObserver` | `hero:783` | canvas sizing |
| `document.fonts.ready` | `hero:822` | font-gated entrance |
| `backdrop-filter` | `template:144, 215` | the sticky nav and the timeline strip |
| Google Fonts CSS | `hero:17` | Inter Tight + JetBrains Mono |
| Python string templates | `build.py`, `adapt_1611.py` | static page generation |

**No build step, no bundler, no npm, no framework.** The pages are static HTML with inline CSS and JS.

---

## 5. The architecture rule that defines the identity

> **The shader is a per-page fragment, and the DOM is the layout.**

Consequences:
- Every built page contains its own copy of the shader and its own WebGL context.
- There is **no shared runtime** — 34 pages = 34 shader copies.
- A change to a motif requires editing `tools/hero_index_mock.html` and re-running the build.
- The shader has no knowledge of the DOM except through the uniforms `BX` (title bbox), `GR` (grid) and
  `TX`/`HT` (the mask).

This is the architecture to copy for a video pipeline: **one self-contained generator, injected per asset,
with parameters supplied as uniforms.**

---

## 6. Key constants table

| Constant | Value | Source |
|---|---|---|
| `CELL` | `FINE ? 2 : 3` CSS px | `hero:206` |
| `PAP` | `vec3(.914,.906,.878)` | `hero:213` |
| `INK` | `vec3(.043,.043,.047)` | `hero:213` |
| Graphite (fine ink) | `vec3(.075,.072,.068)` | `hero:305` |
| Instrument grey | `vec3(.42,.41,.39)` | `hero:310` |
| Paper-dot pitch | 7 px | `hero:312` |
| Loupe radius | `.17` | `hero:814` |
| Loupe magnification | `3.2` | `hero:296` |
| Bayer offset | `+.5/64.` | `hero:299` |
| Accent threshold | `th*.6` | `hero:304` |
| Clock origin | `6.0` | `hero:809` |
| Fine clock rate | `.72` | `hero:809` |
| Random phase | up to 4000 ms | `hero:788` |
| Pointer lerp | `.08` | `hero:812` |
| Mask bake delay | `1650` ms | `hero:826` |
| Grid columns | 12 | `hero:73` |
| Band min height | `clamp(380px,54svh,640px)` | `hero:70` |
| Hero min height | `max(760px,100svh)`, max `1080px` | `hero:31` |
