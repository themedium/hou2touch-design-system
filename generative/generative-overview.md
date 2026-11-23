# Hou2Touch — Generative Overview

**Status:** MEASURED from `tools/hero_index_mock.html` and `en/adapt_1611.py`.

---

## 1. The thesis

> **"One engine, one technique (1-bit ordered dither, ink + family colour on paper); the course only supplies number, title, family colour, motif."**

This is the project's own statement, `tools/hero_index_mock.html:9-10` (verbatim comment):
```
  One engine, one technique (1-bit ordered dither, ink + family colour on paper); the course only supplies number, title, family colour, motif.
```

Every hero on the site is the **same WebGL fragment shader** with a different `M` (motif id) and a different
`K` (family colour). There is no second engine, no raster image, no video loop.

---

## 2. The three inputs

A page supplies exactly four things to the engine:

| Input | Source | Mechanism |
|---|---|---|
| **Number** | course id / path name | DOM `.num` (Bebas) + a knockout mask |
| **Title** | course title | DOM `.ttl h2` + knockout mask |
| **Family colour** | `MOTIF[page] → fam` in `en/adapt_1611.py:14-44` | CSS var `--k` → `gl.uniform3fv(u.K,…)` |
| **Motif** | `MOTIF[page] → motif name` | `M` int uniform |

The engine reads the family colour out of CSS at runtime — `hero:781`:
```js
const k=rgb(getComputedStyle(s).getPropertyValue('--k'));
```
where `rgb()` (`hero:687`) creates a temporary `<i>` element, reads `getComputedStyle().color`, and converts
the `rgb()` string to 0–1 floats. **This is how the shader stays in sync with the CSS palette.**

---

## 3. The motif table

`tools/hero_index_mock.html:203` (verbatim):
```js
const MOTIF={chladni:0,streams:1,wall:2,terrain:3,warp:4,frame:5,lissajous:6,beams:7,feedback:8,barcode:9,opart:10,fold:11,physarum:12,plotter:13,rings:14,swarm13:15,moire:16,rack:17,shader:18,storyboard:19,channels:20,atlas:21,bundle:22,foundations:23,procedural3d:24,interactive:25,path3d:26,light:27,avperf:28};
```

29 motifs, ids 0–28, contiguous. **All 29 are implemented** in the `FS` shader — every id has a matching
`if(M==N){...}` block (verified by reading the whole `FS` template literal).

### 3.1 Page → (family, motif) — `en/adapt_1611.py:14-44` (MEASURED, verbatim)

```python
MOTIF = {'101': ('chop', 'chladni'), '102': ('chop', 'frame'), '103': ('chop', 'swarm13'), '201': ('chop', 'lissajous'), '202': ('top', 'streams'),
         '203': ('top', 'wall'), '204': ('chop', 'beams'), '205': ('top', 'feedback'), '206': ('chop', 'barcode'),
         '207': ('sop', 'terrain'), '301': ('top', 'shader'), '302': ('sop', 'opart'), '304': ('sop', 'fold'), '305': ('sop', 'physarum'),
         '204_preproduction': ('chop', 'storyboard'), '204_production': ('chop', 'channels'),
         'modulardesign': ('top', 'rack'),
         'course': ('sop', 'atlas'),
         'av': ('chop', 'plotter'), 'me': ('top', 'rings'), 'vj': ('top', 'moire'),
         'impressum': ('sop', 'opart'), 'agb': ('chop', 'physarum'),
         'widerruf': ('top', 'rings'), 'privacy-policy': ('sop', 'fold'),
         'extreme': ('chop', 'bundle'), 'ru/extreme-bundle': ('chop', 'bundle'),
         'course/1-foundations': ('sop', 'foundations'),
         'course/2-procedural-3d': ('sop', 'procedural3d'),
         'course/3-interactive-systems': ('sop', 'interactive'),
         '3d': ('sop', 'path3d'), 'light': ('chop', 'light'),
         'ru/av-performance': ('top', 'avperf'),
         'ru/extreme': ('chop', 'chladni'), 'ru/extreme2': ('chop', 'frame'),
         'ru/course': ('sop', 'atlas'), 'ru/glsl': ('top', 'shader')}
```

### 3.2 Motif → pages (derived, MEASURED by inverting the table above)

| Id | Name | Family | Pages using it |
|---|---|---|---|
| 0 | `chladni` | chop | 101, ru/extreme |
| 1 | `streams` | top | 202 |
| 2 | `wall` | top | 203 |
| 3 | `terrain` | sop | 207 |
| 4 | `warp` | — | **fallback only** (default in `adapt_1611.py:750`: `MOTIF.get(slug, ('top','warp'))`) |
| 5 | `frame` | chop | 102, ru/extreme2 |
| 6 | `lissajous` | chop | 201 |
| 7 | `beams` | chop | 204 |
| 8 | `feedback` | top | 205 |
| 9 | `barcode` | chop | 206 |
| 10 | `opart` | sop | 302, impressum |
| 11 | `fold` | sop | 304, privacy-policy |
| 12 | `physarum` | sop | 305, agb |
| 13 | `plotter` | chop | av |
| 14 | `rings` | top | me, widerruf |
| 15 | `swarm13` | chop | 103 |
| 16 | `moire` | top | vj |
| 17 | `rack` | top | modulardesign |
| 18 | `shader` | top | 301, ru/glsl |
| 19 | `storyboard` | chop | 204_preproduction |
| 20 | `channels` | chop | 204_production |
| 21 | `atlas` | sop | course, ru/course |
| 22 | `bundle` | chop | extreme, ru/extreme-bundle |
| 23 | `foundations` | sop | course/1-foundations, ru/course/1-foundations |
| 24 | `procedural3d` | sop | course/2-procedural-3d, ru/course/2-procedural-3d |
| 25 | `interactive` | sop | course/3-interactive-systems |
| 26 | `path3d` | sop | 3d |
| 27 | `light` | chop | light |
| 28 | `avperf` | top | ru/av-performance |

### 3.3 The mock's own course table — `tools/hero_index_mock.html:205-221`
The mock is a self-contained demo with its own `COURSES` object. It maps ids to a slightly different
vocabulary than `adapt_1611.py` — e.g. mock `'201'` → `lissajous` (op `rig201`), mock `'vj'` → `rings`
while `adapt_1611.py` maps `'vj'` → `moire` and `'me'` → `rings`. **The production table
(`adapt_1611.py`) is authoritative for the built site.**

---

## 4. The one technique — ordered dither

All 29 motifs reduce to a **single scalar field** `m.x ∈ [0,1]` (ink density). That field is
thresholded against an **8×8 Bayer matrix** evaluated per buffer pixel:

```glsl
 float th=b8(px)+.5/64.;
 ...
 if(m.x>th)c=ink;
```
(`hero:299, 303`)

`b8` is built recursively (`hero:224-226`):
```glsl
float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}
float b4(vec2 a){return b2(.5*a)*.25+b2(a);}
float b8(vec2 a){return b4(.5*a)*.25+b2(a);}
```

**Consequences to preserve in any new work:**
- Output is effectively **1-bit** (paper or ink) plus a single accent colour.
- The dither is *ordered*, not random → it produces the characteristic **screen/print dot matrix**, never
  film grain.
- The `+.5/64` offset de-quantises the threshold so that a cell value exactly equal to the Bayer value
  still resolves to ink.
- Cell size is **2 CSS px** (fine) or **3 CSS px** (coarse) — see `shaders.md §4.3`.

---

## 5. Two ink values

| Mode | Ink | Note |
|---|---|---|
| Coarse (`FN=0`) | `INK = vec3(.043,.043,.047)` = `#0b0b0c` | full black |
| Fine (`FN=1`) | `vec3(.075,.072,.068)` | **graphite** — "type stays pure ink" (`hero:305`) |

Fine mode also caps solid areas: `m.x=min(m.x,.95)` — "no dead-black slabs: solids keep a print texture"
(`hero:306`).

---

## 6. The instrument layer (fine mode only)

`hero:308-322` adds, on paper areas only:
1. **Paper dots** — a 7×7 px grid of faint graphite dots (`mod(floor(px.x),7.)<.5`).
2. **Registration grid** — 12 vertical lines derived from the DOM tick rail (`GR`), with thicker rules at
   the left and right edges, plus horizontal rules at `y = 1/3` and `2/3`.
3. **Reticle** — a circle at the loupe radius, a dashed inner circle, and a crosshair extending from
   `RL+.012` to `RL+.075`.
4. The reticle centre dot is drawn in the **family colour** (`c=K`).

This layer is what makes the band read as a **technical instrument readout / printed registration sheet**
rather than a decorative texture.

---

## 7. The title knockout (mask)

The DOM title is rasterised into an offscreen canvas at buffer resolution and used as a **knockout texture**
(`HT`/`TX`):

```glsl
 if(HT>.5&&texture2D(TX,uv).a>.5)c=PAP;
```
(`hero:322`)

The mask is built by walking the DOM text nodes of `.ttl` (`hero:789-806`):
- font is forced to `700 ${fs}px "H2T Bebas"` regardless of the computed family;
- the text is **upper-cased** (`mt[0].toUpperCase()`);
- it is drawn twice — `strokeText` with `lineWidth = max(2*CELL, fs*(FINE?.075:.05))` then `fillText` —
  producing a **halo** around the glyphs;
- the same pass measures the title bbox (`sc.bx`) and the tick-rail geometry (`sc.gr`).

The mask is (re)baked on resize and once more after the entrance animation:
```js
 setTimeout(()=>scenes.forEach(sc=>sc.mask()),reduce?0:1650); // halo lands with the letters
```
(`hero:826`) — 1650 ms, matching the 1.1 s letter transition + 0.5 s delay + margin.

---

## 8. The loupe

Fine mode only. Radius `RL = 0.17` UV, magnification **×3.2**:
```glsl
 vec2 mz=motif(LC+(uv-LC)/3.2,asp,T);            // loupe: same field at ×3.2 — computed unconditionally (derivatives)
 if(inL)m=mz;
```
(`hero:296-297`)

The centre orbits and avoids the title:
```js
  let lx=.7+.16*Math.sin(t*.13),ly=.5+.1*Math.sin(t*.17+1);
  const r=RL/asp;
  if(bx[2]<.72&&asp>1.4){lx=Math.max(lx,bx[2]+r+.03);ly=Math.min(Math.max(ly,RL+.11),1-RL-.1);}
  else{ly=Math.min(Math.max(ly,RL+.11),bx[1]-RL-.06);lx=Math.min(Math.max(lx,r+.04),1-r-.04);}
  if(sc.pa>.02){const mx=..., my=...; lx+=(mx-lx)*sc.pa; ly+=(my-ly)*sc.pa;} // pointer wins over the title-avoid rule
```
(`hero:815-818`)

The loupe is the system's most distinctive interaction: **the band contains a moving magnifier that shows
the same generative field at 3.2×, in the same dither.** In a still composition, render it as a fixed
circular detail with a crosshair.

---

## 9. Rendering pipeline summary

```
DOM (.hero section)
  ├─ CSS var --k  ──► rgb() ──► uniform K (family colour)
  ├─ data-m       ──► MOTIF[name] ──► uniform M (motif id)
  └─ .ttl text    ──► canvas mask ──► uniform TX / HT
pointermove on .band ──► uniform P, PA
requestAnimationFrame ──► uniform T ──► motif() ──► Bayer threshold ──► RGB
```

Render loop (`hero:809-819`):
```js
function draw(sc,now){
 const {gl,u}=sc;const t=(6.0+(now-sc.t0)/1000)*(FINE?.72:1);
 sc.pa+=(sc.pat-sc.pa)*.08;
 ...
 gl.drawArrays(gl.TRIANGLES,0,3);
 if(sc.fc)sc.fc.textContent='f '+String(Math.floor(t*60)).padStart(6,'0');
}
function loop(now){for(const sc of scenes)if(sc.vis)draw(sc,now);requestAnimationFrame(loop)}
```

Two details worth stealing:
- **`sc.vis`** — an `IntersectionObserver` with `threshold:0` skips offscreen heroes entirely
  (`hero:797`). Zero-cost scrolling on a page with 5 stacked heroes.
- **`fc` readout** — a live frame counter rendered as `f 000000` in the band's top-right label
  (`hero:822`, `hero:203`). This is the "instrument" voice of the system.

---

## 10. Variants / query flags (`hero:196-202`)

| Flag | Effect |
|---|---|
| `?c=101` etc. | show only one course (mock demo) |
| `?k=1` | number rendered in the family colour instead of ink |
| `?x=raw` | coarse 3 px dither instead of the default fine 2 px |
| `?x=up13` | historical variant of motif 15 (referenced in the `M==15` comment) |

The production site uses the **fine** look by default: `const FINE=!(q.get('x')||'').split(',').includes('raw');`
(`hero:201`) — "fine is default since 16.11; ?x=raw — previous coarse look".

---

## 11. What is NOT in the generative system

- No particle system in the classic sense (no emitters, no integration). The only "agents" are the
  boid needles in `M==15`, and they are **analytic** (drawn from a per-cell hash), not simulated.
- No 3D. Every motif is 2D UV maths; `M==24` and `M==26` only *fake* 3D.
- No audio input. `M==0` "chladni" is described as sound-reactive but is driven by `T` alone.
- No post-processing chain in the hero — the scanlines/vignette of `M==18` are hand-written per motif.
