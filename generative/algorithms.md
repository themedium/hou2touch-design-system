# Hou2Touch — Algorithms

**Status:** MEASURED. GLSL quoted verbatim in `generative/shaders.md`; this document is the *index and
analysis* of those algorithms, sufficient to reimplement any of them from scratch in TouchDesigner or
Three.js.

---

## 1. The shared pipeline

Every motif follows the same four steps:

```
1. build a scalar field   f(uv, t) ∈ [0,1]      ← the motif
2. add a colour mask      g(uv, t) ∈ {0,1}       ← the motif (usually `step(...)`)
3. apply the pointer lens as a local perturbation
4. threshold against the Bayer matrix and colourise
```

Steps 3–4 are outside the motif, in `main()`. **A new motif only needs to implement step 1–2.**

---

## 2. Algorithm families in the corpus

| # | Family | Members | Mathematical core |
|---|---|---|---|
| A | **Periodic field / zero-set** | 0 chladni, 14 rings | `cos` products, radial `cos` interference |
| B | **Travelling wave / line** | 1 streams, 6 lissajous, 8 feedback | `sin(kx + wt)` evaluated along y |
| C | **Tiled cellular** | 2 wall, 19 storyboard, 17 rack, 20 channels | `floor(uv*g)` / `fract(uv*g)` + per-cell hash |
| D | **Contour / iso-line** | 3 terrain, 13 plotter, 21 atlas | `fract(level)`, `fwidth2(level)` for AA width |
| E | **Lattice / perspective grid** | 5 frame, 26 path3d | `gline()` on rotated/hex coordinates |
| F | **Posterised tone ramp** | 4 warp, 16 moire, 18 shader | `floor(v*N)/N` + bright step edges |
| G | **Domain-warped noise** | 4 warp, 12 physarum, 13 plotter | `fbm(p + k*fbm(p))` |
| H | **Cellular / Worley** | 12 physarum | `vedge()` — F2−F1 over a jittered lattice |
| I | **Radial histogram** | 28 avperf | angular binning of `atan` + amplitude |
| J | **Perspective grid** | 7 beams, 27 light | `1/yy` depth projection |
| K | **Instance field** | 24 procedural3d, 26 path3d, 19 storyboard | per-cell hash → size/rotation/colour |
| L | **Analytic boids** | 15 swarm13 | per-cell oriented segment via `u5sg` |

---

## 3. Per-motif algorithm sheet

Technique, key parameters and the reusable core. All ids are from `tools/hero_index_mock.html:203`.

### 0 · chladni — "sound-reactive plate"
- **Math:** Chladni nodal pattern `v = cos(n·x)·cos(m·y) − cos(m·x)·cos(n·y)`; nodal lines are the zero set.
- **Params:** `n = 2 + 1.5(1+sin(t·.09))`, `m = 5 + 1.5(1+cos(t·.7·.09))` → modes drift slowly.
  Centre at `x = asp·.66`. Scale `π·.95`.
- **Beat:** `beat = fract(t·2.)` (120 bpm), `env = exp(-beat·6.)`; a ring expands to radius `beat·1.25`.
- **Ink:** crisp line (`w = .05 + .05·env`) + a "sand" halo at `.38` weight; ring at `.9`.
- **Colour:** only the expanding ring (`step(.5, ring)`).

### 1 · streams — "parallel signals"
- **Math:** 7 lines; `y_i(x) = .16 + i·.115 + .06·sin(x(1.3+.17i) − t(.3+.025i) + 1.9i) + .02·sin(5x − 1.1t + i)`.
- **Carrier:** line 3 is 4× thicker (`w = .022` vs `.0045 + .002·(i mod 2)`).
- **Packets:** `pk = step(.7, fract(x(2.2+.9i) − t(.22+.06i) + .37i))`; the packet adds a `.32` halo.
- **Colour:** lines 1 and 5.

### 2 · wall — "media server outputs"
- **Math:** 4 rows of 16:9 tiles; grid width `max(3, floor(asp·4·.5625 + .5))`.
- **Timing:** per-tile period `1.3 + 3.4·h1(cell)`, per-tile phase `h1(cell)·period`.
- **Cut:** a new cue takes over with a top-to-bottom **0.28 s scan wipe** + a bright scan line at the edge.
- **Content generators (chosen by hash `k = floor(h1(cell+cue·7.13)·4)`):** ramp / bars / disc / fbm feed.
- **Live flag:** `lv = step(.88, h1(cell+cue·3.1))` → colour-eligible when the tile is "live".
- **Pointer:** inverts the tile (`mix(v, 1-v, lens·2)`).

### 3 · terrain — "topographic map"
- **Math:** height `hh = .7·fbm3(p) + .3·fbm3(1.9p + 3.7)`, 16 contour levels.
- **Index contours:** every 5th level gets a wider line (`idx = step(mod(floor(lv+.5),5.),.5)`).
- **AA width:** `dd = min(fract(lv), 1-fract(lv)) / fwidth2(lv)`.
- **Shading:** horizontal gradient → `clamp(-hx·38, 0, 1)·.24`.
- **Colour band:** one narrow elevation slice `.60–.64`.

### 4 · warp — domain-warped fBm (fallback)
- **Math:** two-level domain warp, strength `2.6`; `v = fbm(p + 2.6·b)`.
- **Posterisation:** 6 steps (`floor(sv·6)/6`), step edges drawn bright.
- **Colour:** the top step (`step(.8, st)`) excluding edges.

### 5 · frame — "space frame"
- **Math:** one-point perspective `z = .42/yy`; hexagonal lattice coords
  `a = g.y`, `b = g.x·.866 + g.y·.5`, `c = g.x·.866 − g.y·.5`.
- **Tilt:** rotation `.35 rad` baked into `g`; travel `Z = z + t·.3`.
- **Cues:** `floor(t·.8)` re-rolls per-cell hashes; `.86` → fill, `.94–.975` → colour.
- **Fade:** `smoothstep(.04,.3,yy)`.

### 6 · lissajous — woven ribbons
- **Math:** two ribbons; centre `cy = .5 + (.24−.06r)·sin(x(1.15+.5r) + t(.35+.12r) + 2.4r)`,
  width `w = (.15+.04r)·cos(x(1.9−.6r) − t(.5+.1r) + r)`.
- **Threads:** 13 horizontal lines per ribbon, positions `cy + w·s·2`, `s ∈ [−.5,.5]`.
- **Weave:** `over = step(.5, fract(x·1.6 + t·.05))` → over/under alternation.
- **Colour:** ribbon 1 only.

### 7 · beams — light truss
- **Math:** 5 fixtures on a rail; each is an angular wedge `|atan(dx,dy) − aim| < spread`.
- **Aim:** `.5·sin(t·.4 + 1.7i)` + a pointer-driven offset `lens·.25·sign(...)`.
- **Falloff:** `mix(.62,.12, smoothstep(0,1,L))` + a bright rim at the wedge edge.
- **Floor:** perspective grid from `uv.y = .7` (`zz = .18/fl`).

### 8 · feedback — video echo
- **Math:** 10 echoes of one ribbon, delay `.22 s` each, scale `1 − .015·fi`, density `mix(1,.28,fi/9)`.
- **Scanlines:** `step(.5, fract(gl_FragCoord.y*.5))` — a hard 2-row scanline on echoes.
- **Colour:** echoes with `fi mod 3 == 1`.

### 9 · barcode — Ikeda rows
- **Math:** 7 rows; bar frequency `f = mix(18,220, hr²)` (quadratic spacing), drift `sp = (hr−.5)·.6`.
- **Bars:** `on = step(threshold, h1(vec2(floor(x·f + t·sp·f·.2), rid)))`.
- **Beat inversion:** `inv = step(.86, h1(vec2(rid, floor(t·2.))))`, `on = abs(on−inv)` — one row inverts per beat.
- **Colour:** one fixed row (`h1(vec2(rid,5.)) > .8`).

### 10 · opart — topology
- **Math:** 4 Gaussian bumps (`exp(-d²·(9+3i))`), one negative (`−.8`).
- **Grid:** 46 horizontal lines displaced by `.11·hh`; weight `.18 + .5·clamp(hh,0,1)`.
- **Output:** hard `step(.5, l)` → binary, ideal for dither.
- **Colour:** where `hh > .55`.

### 11 · fold — folded environment
- **Math:** 45°-rotated cell grid `r = (x+y, x−y)·.7071·7`.
- **Fold:** 28 % of cells (`h1(cid + cue·2.3) > .72`) rotate by `hh·2π`; their hairlines are redrawn in
  the rotated frame (a real "fold" of the drawn content, not a UV fold).
- **Shade:** cells with `hh > .88` get a `.4` fill.

### 12 · physarum — transport network
- **Math:** coordinate warp by two fBm fields, then two `vedge` evaluations.
- **Scale:** `p = q·7 + warp·1.2` (filaments) and `p·.38 + 3.1` (trunks).
- **Line weights:** filament `1−smoothstep(.02,.07,e1)`; trunk `1−smoothstep(.02,.055,e2)`.
- **Colour:** trunks where `fbm3(q·1.3+2.) > .6`.
- Note: the `node` term is computed but zeroed (`*.0`) — dead code kept for reference.

### 13 · plotter — flow plotter
- **Math:** contour lines `gline(hh·30, 1)` from `hh = fbm3(p) + .3·fbm3(2.3p)`.
- **Accent body:** blob of radius `.2 + noise`, filled with tight rings `gline(rr·55 + noise·3 − t·.6, 1.4)`.
- **Travel:** the blob orbits `x = asp·.7 + .06·sin(t·.3)`, `y = .4 + .05·cos(t·.4)`.

### 14 · rings — interference
- **Math:** `wv = cos(r1·70 − t·3) + cos(r2·70 − t·3)`; lines at the zero set of `wv`.
- **Pointer:** source 2 is dragged toward the pointer (`mix(s2, pointer, PA·.6)`).
- **Disc:** source 1 has a solid `.55` disc of radius `.11` with a 1-pixel forced-zero halo.

### 15 · swarm13 — veins + needles (most complex)
- **Veins:** two sinusoidal domain warps of `w`, then `vein = pow(clamp(1 − min(v1, 1.15·v2)·1.8, 0, 1), 2.2)`
  where `v1 = |sin(w.y·2.6 + sin(w.x·1.9)·1.4)|`, `v2 = |sin(w.y·5.2 − cos(w.x·3.7)·.9)|`.
- **Needles:** 12 px cells; one needle per cell (probability via `h1(cI·1.7) > .32`);
  orientation `ang = −.35·cos(w.x·2.1 − t·.4)·2.6`; the needle is a segment `±dir·cS·.34` drawn with `u5sg`,
  plus a round head `step(dHead, 2.1)`.
- **Three-way ink mix** by vein band (`>.62`, `>.22`, else free needles); colour decided by the **Bayer
  threshold** as a stochastic per-cell coin flip.

### 16 · moire — three screens
- **Math:** rings `sin(r(52+lens·18) − t·.55)` × `.52`; rotated grid
  `sin(g.x(46+…)+t·.30)·sin(g.y(46+…)−t·.22)` × `.30`; spokes `sin(a1·18 + r·9 − t·.16)` × `.18`.
- **Posterise:** 5 steps.
- **Dithered falloff:** `ink = max(ink, step(.5, b8(fragcoord))·.10·fall)` — Bayer used as a stochastic
  dither in the vignette region.

### 17 · rack — modular panels
- **Math:** 3 rows; per-row module count `4 + floor(h1(fi,3.7)·4)`; per-row x offset `h1(fi,7.1)·n`.
- **Furniture:** two knobs per module (circle radius `.085` at `kc=(0,0)` and `(.40,0)`), a slider slot
  (`fm ∈ [.29,.345]`, `hh ∈ [.30,.72]`).
- **Cables:** 3 sagging curves `cy = mix(ya,yb,u) + sin(πu)·(0.09 + .05·h1)`, drawn with a `.0022` line width.

### 18 · shader — posterised field + post
- **Math:** `v = sin(r(22+lens·14) − t·.75 + fbm3(·)·7)·.5 + .5`, gamma `1.5`.
- **Posterise:** 6 steps; bright step edges.
- **Post:** scanlines `.78 + .22·(.5+.5·sin(uv.y·820))`; vignette `1 − smoothstep(.35,1.15,r)`.
- **Colour:** only the top tone, only away from the vignette edge.

### 19 · storyboard — plan sheet
- **Math:** 3×2 grid; per-cell 3 rough strokes `yy = .30 + .17i + .045·sin(x·7 + 2.3i + h1(cell)·2π + t·.25)`.
- **Cue:** one cell lights per `floor(t·.12)`.

### 20 · channels — DMX console
- **Math:** 28 faders; base level `.18 + .78·h1(ci,2.9)`; cue step `.55 + .45·step(.55, fract(t·.35 + h1(ci,5.3)))`.
- **Furniture:** stepped notches `gline(uv.y·26, 1.1)`; 3 diagonal crossfader strokes.

### 21 · atlas — nested contours
- **Math:** two systems, scales `1.15` and `3.05`, contour counts `7` and `16`, drifting in opposite
  directions (`t·(.018−.01i)`).
- **Weighting:** the outer system is drawn lighter (`.62` vs `.42`).

### 22 · bundle — signal convergence
- **Math:** two tracks from `±.26` separation converging via `smoothstep(.05,.78,uv.x)`.
- **Ticks:** `gline(uv.x·22 − t·.5·(1+i))` markers fading with convergence.
- **Accent:** a ring at `(0.84, 0.5)`, radius `.075`, colour on the right half only.

### 23 · foundations — node chain
- **Math:** 9 nodes on a baseline `y = .17`; each grows `grow = clamp(t·.30 − i·.07, 0, 1)`.
- **Height:** `.09 + .40·h1(fi, 7.1)` scaled by `grow`.
- **Connectors:** vertical stems (`hline`) + diagonal segments (`u5sg`) between consecutive nodes.

### 24 · procedural3d — instanced boxes
- **Math:** 13×13 grid; per-instance size `.16 + .46·hs`, rotation `t·.10 + hs2·2π`.
- **Geometry:** outer square outline, a `.34`-weight fill, and an inner square at `.58` of the size.

### 25 · interactive — sensor field
- **Math:** 6×6 grid of rings (`radius .27`) + grid lines at `.30` weight.
- **Ripple:** `(.5+.5·sin(rd·26 − t·2.2))·exp(−rd·1.5)` from the centre — **always running**, no pointer needed.
- **Colour:** the ripple crest (`.62`).

### 26 · path3d — isometric lattice
- **Math:** `u = x·.866 + y·.5`, `v = −x·.866 + y·.5`, `w = y`; spacing `.105`.
- **Drift:** `dr = t·.05` opens the lattice; depth fade `smoothstep(.10,.92,uv.x)`.

### 27 · light — stage floor pools
- **Math:** 5×5 pools; rows at `y = .20 + .155i`, perspective squash `persp = .55 + .34i`,
  x positions `x = .5 + (j−2)·.30/(1+.40i)`.
- **Pool:** crisp ring at radius `.150` + glow `.46`; pulse `.5+.5·sin(t·1.05 + .9i + 1.3j)`.

### 28 · avperf — radial spectrum
- **Math:** 48 angular bins; amplitude `.14 + .30·(.5+.5·sin(1.7bi + 1.8t))·(.5+.5·sin(.53bi − .65t))`.
- **Bars:** from radius `.150` to `.34+amp`, with a bright cap; a permanent reference circle at `.34`.

---

## 4. Reusable algorithm recipes for new work

| Want | Recipe | Source motif |
|---|---|---|
| Ink field with hard edges | compute `f`, then `step(.5, 1-smoothstep(w*.5-.05, w*.5+.05, abs(fract(f)-.5)))` | 10 |
| Contour lines with AA | `min(fract(lv),1-fract(lv)) / fwidth2(lv)` then `1-smoothstep(w, w+.55, dd)` | 3, 21 |
| Dithered tone ramp | `st = floor(v*N)/N`, `e = fract(v*N)`, draw `st·k` plus a bright line at `e≈0` | 4, 16, 18 |
| Perspective floor | `z = c/(uv.y - horizon)`, `gx = (uv.x - cx)·z` | 5, 7, 27 |
| Per-cell behaviour | `id = floor(uv*g)`, `hash = h1(id + cue)`, re-roll with `floor(t/rate)` | 2, 17, 20, 24 |
| Stochastic per-cell dither | `step(.5, b8(gl_FragCoord.xy))` as a per-cell coin flip | 15, 16 |
| Screen-space line weight | `w * fwidth2(v)` inside `smoothstep` | `gline` |
| Segment distance | `u5sg(p, a, b)` | 15, 17, 23 |
| Pointer perturbation | `lens = PA * exp(-dot(q-pointer, q-pointer)*18.)` | all |

---

## 5. Time constants worth stealing (MEASURED)

| Motion | Rate | Source |
|---|---|---|
| Global clock | `t = 6.0 + elapsed` (fine runs at `.72×`) | `hero:809` |
| Chladni beat | `2 Hz` (120 bpm) | motif 0 |
| Barcode beat | `2 Hz` | motif 9 |
| Frame cues | `0.8 Hz` | motif 5 |
| Fold cues | `0.6 Hz` | motif 11 |
| Channels cues | `0.35 Hz` | motif 20 |
| Storyboard cues | `0.12 Hz` | motif 19 |
| Light pulse | `1.05 Hz` | motif 27 |
| Pointer smoothing | `.08` per frame (≈ 200 ms time constant) | `hero:812` |
| Terrain scroll | `t·.025` | motif 3 |
| Terrain contour levels | 16 | motif 3 |
| Atlas contour levels | 7 / 16 | motif 21 |
| Op-art line count | 46 | motif 10 |
| Spectrum bins | 48 | motif 28 |
| Barcode rows | 7 | motif 9 |
| DMX channels | 28 | motif 20 |
| Loupe magnification | ×3.2, radius `.17` | `hero:296, 815` |
