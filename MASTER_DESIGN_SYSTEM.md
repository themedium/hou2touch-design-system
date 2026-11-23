# Hou2Touch — MASTER DESIGN SYSTEM

**Version:** extracted 2026-11-23 from `/Users/lvn/Desktop/MCP/hou2touch_redesign`.
**Status:** every value is traced to a `file:line`. `ESTIMATED` marks an inference; `UNRESOLVED` marks a
gap. **Nothing in the source site was modified.**

---

## 1. What defines the identity

The Hou2Touch identity is a **print-first, node-graph, instrument-panel** language:

> **Ink on paper, rasterised as a 1-bit ordered dither, annotated by mono instrument labels,
> organised on a 12-column grid, and coloured by exactly one TouchDesigner operator family.**

Six pillars, each with a hard constraint:

| Pillar | Hard constraint | Source of truth |
|---|---|---|
| **P1 — Ink & paper** | Two values only: `#0b0b0c` on `#e9e7e0`. No continuous tone. | `src/template.html:38`, `tools/hero_index_mock.html:213` |
| **P2 — Ordered dither** | 8×8 Bayer, evaluated per cell (2 CSS px fine / 3 coarse). Dot pitch = CELL × 8 → **16 px** (fine) / **24 px** (coarse). | `hero:206, 224-226, 299` |
| **P3 — One family colour** | Exactly one of CHOP/TOP/SOP/DAT/COMP per composition. ≤ 5 % coverage. | `template:42`, `hero:303-304` |
| **P4 — Three type voices** | Bebas caps / Inter Tight sentence / JetBrains Mono labels. Never mixed. | `template:45-47` |
| **P5 — Instrument surface** | Every mark is a label, a tick, a rule or a counter. | `hero:308-322`, `template:83,138`, `landing.css` |
| **P6 — Pixel seam** | Every dark↔light junction is a Bayer seam, never a straight edge and never a blur. | `en/index.html:3845-3857`, `template:587` |

---

## 2. Mandatory vs variable

### 2.1 MANDATORY — a composition is invalid without these

| # | Rule | Exact value |
|---|---|---|
| M1 | Ink on paper | `#0b0b0c` on `#e9e7e0` |
| M2 | Field is 1-bit ordered dither | `b8(gl_FragCoord.xy) + .5/64` |
| M3 | Cell size | 2 CSS px (fine) / 3 CSS px (coarse) |
| M4 | Upscale | integer factor, nearest neighbour, `image-rendering:pixelated` |
| M5 | Accent rule | colour only where `ink > th*.6` |
| M6 | One family colour per composition | `#45a654` / `#65a30d` / `#3d7fd6` / `#c34f9a` / `#9a9a96` |
| M7 | Grid | 12 columns; `--pad:clamp(16px,3.9vw,56px)`; gutters `--gut:clamp(12px,1.4vw,20px)` (hero / landing) **and** `--gap:clamp(10px,1.4vw,20px)` (site template) — two token names, one 1.4 % rate |
| M8 | Display type | H2T Bebas, UPPER, `lh .8`, tracking ≈ 0, optical left-pull |
| M9 | Text type | Inter Tight 400/500/600, tracking −.015…−.035em, measure ≤ 66ch |
| M10 | Label type | JetBrains Mono 500, 10–12 px, +.07em, UPPER |
| M11 | Easing | exactly three named curves, by role — see §2.4 |
| M12 | Durations | state transitions 0.3–1.4 s (0.3 / 0.4 / 0.5 / 0.8 / 1.1 / 1.4); named exceptions: exits 0.16–0.25 s, mask bake 1.65 s; continuous loops are not transitions |
| M13 | Radius vocabulary | 2 px (chips), 6 px (cards), 999 px (pill CTA only) |
| M14 | Rules | 1 px hairlines; `--line` for internal, `--ink` for the outer frame of a chain |
| M15 | No gradients / shadows / glow / glassmorphism | — |

**TOP colour (canonical).** The canonical `--top` is **`#65a30d`** (green) — the value carried by the
33 published EN pages. `#8a63c9` (purple) was the **RU-legacy** value, retired 2026-11: the RU legacy
set (`index.html`, `school.html`, `src/template.html`, `courses/*`) still declares it, and
`tools/pipeline/publish.py` marks those pages `noindex`. `#8a63c9` stays documented as legacy so that
old screenshots remain explicable — never use it in new work.

**Grid tokens.** There are two gutter token names and they are not interchangeable in the source:
`--gut:clamp(12px,1.4vw,20px)` in ~50 published and hero HTML files, `--gap:clamp(10px,1.4vw,20px)`
in `src/template.html`. Same 1.4 % rate, different minimum (12 px vs 10 px). Both **clamp to a
ceiling**: the gutter ceiling (20 px) engages above a ~1429 px viewport, and the margin ceiling
(`--pad`, 56 px) above ~1436 px — from there on the gutters and the margins are **fixed pixels**, not
a percentage of the viewport.

### 2.2 MAY VARY — the freedom of the system

| # | Variable | Range | Notes |
|---|---|---|---|
| V1 | Motif | 29 available, all interchangeable | `generative/shaders.md` |
| V2 | Family colour | 5 | one per composition |
| V3 | Field scale / frequency | motif-specific | e.g. 46 op-art lines, 48 spectrum bins, 28 faders |
| V4 | Field density | motif-specific | the "print grain" density |
| V5 | Cue rates | 0.5–8 s | the system's tempo range |
| V6 | Type sizes | within the `--fs-*` scale or the fluid clamps | `build.py:110-114`, `hero:28-31` |
| V7 | Layout splits | any 12-column split | the asymmetry rule (labels 1–5, body 6–13) |
| V8 | Copy | free | but the three type voices are fixed |
| V9 | Section count and order | free | each section gets an ink hairline |
| V10 | The pointer behaviour | optional | the site has it; a poster need not |

### 2.3 MUST NOT

| # | Forbidden |
|---|---|
| X1 | Pure `#000` / `#fff` as a field |
| X2 | A second accent colour |
| X3 | Continuous-tone imagery inside a generative field |
| X4 | Stochastic/film grain instead of ordered dither |
| X5 | A **fourth** easing curve — the three named curves in §2.4 are the whole vocabulary |
| X6 | Cross-dissolves |
| X7 | Inter Tight at weight 700 |
| X8 | A third typeface |
| X9 | Rounded cards above 6 px (except pills) |
| X10 | Resampling the dither (downscale a full-res render) |
| X11 | Colour used as the only information channel |
| X12 | Emoji / illustrative stickers |

### 2.4 The easing vocabulary — three curves, three roles

| Token | Curve | Role | Duration band |
|---|---|---|---|
| `--ease` | `cubic-bezier(.19,1,.22,1)` | **General** — the default for everything that moves | 0.3–1.4 s |
| `--rx-em` | `cubic-bezier(.22,1,.36,1)` | **Entrance** — elements arriving (rise-and-fade, masked type rise) | 0.3–1.4 s |
| `--rx-es` | `cubic-bezier(.2,0,0,1)` | **Exit / state change** — elements leaving or swapping state | 0.16–0.25 s (120–240 ms) |

The general curve is the one quoted in `src/template.html:48` and `tools/hero_index_mock.html:32`.
The third curve is a deliberate decision, not a slip — it is recorded in the source as a 120 ms
`cubic-bezier(.2,0,0,1)` for state change (`en/index.html:1206`). A **fourth** curve is forbidden (X5):
three is the whole vocabulary, and each curve has exactly one job.

### 2.5 The duration vocabulary

State transitions live in **0.3–1.4 s**: 0.3 / 0.4 / 0.5 / 0.8 / 1.1 / 1.4 s.

Named exceptions — deliberately outside the band, and each of them named:

| Duration | What | Why it exists |
|---|---|---|
| 0.16 / 0.18 / 0.24 / 0.25 s | **Exits** — elements leaving, state changes | a state change should feel immediate, not stately |
| 1.65 s | **Mask bake** delay after `document.fonts.ready` | the halo has to land together with the letters |
| 1.4 s (loop) | the **dashed-path** cycle | a continuous loop, not a transition |
| 37 s / 48 s | the **loupe orbit** periods | continuous loops, not transitions |
| continuous | the **marquee** scroll | a loop, not a transition |

Only the first two rows are transitions; the rest are continuous motion.

---

## 3. The verification checklist

A composition belongs to the system if **all seven** answers are "yes":

1. Is the field 1-bit plus at most one accent?
2. Is the dither **ordered** (a regular 8×8 dot matrix), not stochastic?
3. Does the dot pitch sit on the cell grid — 16 px (8 × the 2 px cell, fine) or 24 px (8 × the 3 px cell, coarse)?
4. Are there exactly three type voices, never mixed in a line?
5. Is the grid 12 columns with 3.9 % margins (`--pad`) and 1.4 % gutters (`--gut` in the hero and the published pages, `--gap` in the site template)? Remember the clamp ceilings: the gutters fix at 20 px above a ~1429 px viewport and the margins fix at 56 px above ~1436 px — on large screens they are fixed pixels, not 1.4 % / 3.9 %.
6. Is every easing one of the three named curves (general / entrance / exit, §2.4), and every state transition inside 0.3–1.4 s? The named exceptions are exits (0.16–0.25 s), the mask bake (1.65 s) and the continuous loops — loops are not transitions.
7. Is the accent ≤ 5 % of the frame and is text on paper exactly `#0b0b0c`?

**Plus, for anything generative:** the field must be a pure function of `(uv, aspect, time)` — no state, no
integration, no frame-to-frame feedback.

---

## 4. The generative engine — the compact brief

For an agent that has never seen the site, this is everything needed to make a new field.

### 4.1 The contract

```glsl
vec2 motif(vec2 uv, float asp, float t)   // x = ink density [0..1], y = colour mask [0..1]
```

### 4.2 The shared preamble (verbatim)

```glsl
vec2 q=vec2(uv.x*asp,uv.y);
vec2 d=q-vec2(P.x*asp,P.y);float lens=PA*exp(-dot(d,d)*18.);
```

### 4.3 The composite (verbatim)

```glsl
float th=b8(px)+.5/64.;
vec3 c=PAP;vec3 ink=INK;
if(m.x>th)c=ink;
if(m.y>.5&&m.x>th*.6)c=K;
```

### 4.4 The uniforms

`R` (buffer size), `T` (seconds), `M` (motif id), `K` (family colour), `P` (pointer uv), `PA` (pointer
amount), `TX` (knockout mask), `HT` (has-mask), `FN` (fine flag), `BX` (title bbox), `LC` (loupe centre),
`RL` (loupe radius `.17`), `GR` (registration grid).

### 4.5 The helpers

`h1`, `vn`, `fbm3`, `fbm`, `b2/b4/b8`, `u5sg`, `fwidth2`, `vedge`, `gline`, `hline` — all quoted verbatim in
`generative/shaders.md §2` and `technical/reusable-code.md §3`.

### 4.6 The 29 motifs

All 29 are implemented and all 29 are documented with their GLSL quoted, their technique explained, and
their parameters listed. See `generative/shaders.md` and `generative/algorithms.md`.

---

## 5. Document map

### `identity/`
| File | Contains |
|---|---|
| `color-system.md` | every token, the two palettes, the 5 family colours, the contrast rule |
| `typography.md` | the 3 families, the 4 font files, the `--fs-*` scale, tracking rules, optical adjustments |
| `layout-grid.md` | the 12-col grid, hero rows, section splits, card grids, responsive rules |
| `composition-principles.md` | the 10 principles and the anti-patterns |

### `generative/`
| File | Contains |
|---|---|
| `generative-overview.md` | the thesis, the 4 inputs, the motif table, the dither, the loupe, the mask, the pipeline |
| `algorithms.md` | per-motif algorithm sheet with all parameters and cue rates |
| `particle-systems.md` | the honest finding: no simulation; how to build a faithful particle version |
| `shaders.md` | **the full GLSL of all 29 motifs + helpers + `main()`, verbatim** |
| `procedural-textures.md` | Bayer matrices, the canvas halftone, the pixel edges, the dot rules |
| `reusable-components.md` | hero, labels, node panels, accordion, chain, reviews, marquee, timeline |

### `motion/`
| File | Contains |
|---|---|
| `motion-principles.md` | the easing, the duration vocabulary, the 4 behaviours, the scroll model |
| `animation-specifications.md` | element-by-element timings, the full entrance timeline, the field clock |
| `transitions.md` | 13 transitions with exact parameters and the reasons |
| `motion-examples.md` | 11 reproducible recipes + a 30-second film beat sheet |

### `technical/`
| File | Contains |
|---|---|
| `architecture.md` | the repo shape, the build pipeline, the engine architecture, the constants table |
| `dependencies.md` | runtime/build deps, the font files, a per-target portability checklist |
| `rendering-technologies.md` | the resolution model, the dither pipeline, AA rules, the 5 render routes |
| `reusable-code.md` | **the copy-paste layer — verbatim GLSL + verbatim JS** |

### `production/`
| File | Contains |
|---|---|
| `video-production-guidelines.md` | the frame contract, resolution tables, 5 render routes, an editing grammar |
| `social-media-guidelines.md` | format specs, the static-post layout, story templates, per-platform checks |
| `graphic-production-guidelines.md` | print resolution tables, poster templates, colour separations |
| `prompt-guide.md` | the master prompt + motif/prompt fragments + negative prompts |

### `references/`
| File | Contains |
|---|---|
| `visual-catalog.md` | the indexed catalogue: S/C/T/K/M elements, all 29 motifs, visual families, the negative catalogue |

---

## 6. Source file map — where each fact comes from

| Source file | What it owns | Read here |
|---|---|---|
| `tools/hero_index_mock.html` | **The generative engine**: 29 motifs, the GLSL, the WebGL harness, the hero CSS, the DOM structure | `generative/shaders.md`, `technical/reusable-code.md`, `identity/layout-grid.md` |
| `src/template.html` | the site's base CSS: tokens, type, the dark shell, the components, the core JS (reveals, `onView`) | `identity/color-system.md`, `identity/typography.md`, `motion/*` |
| `en/adapt_1611.py` | the page → (family, motif) table; `hero_assets()`; `index_hero()`; page CSS | `generative/generative-overview.md` |
| `en/build.py` | `FS_SCALE` (the type scale); the `META` table; the page assembly | `identity/typography.md`, `technical/architecture.md` |
| `family/family.py` | family nav, author block, works wall, reviews, `URLS`, `NAV` | `generative/reusable-components.md` |
| `tools/landing.css` | the landing hero adjustments and all section styles | `identity/layout-grid.md`, `generative/reusable-components.md` |
| `tools/pipeline/wave_*.py` | post-processing CSS waves (`lpin`, the concept dots, the author photo) | `motion/animation-specifications.md`, `generative/procedural-textures.md` |
| `school.px.html`, `tools/prev_stack.html` | the canvas halftone (`bakeDither`, `ditherInto`), the portrait halftone, the pixel edge | `generative/procedural-textures.md` |
| `src/template_v16.html` | the `.edge` pixel-stepped section edge | `generative/procedural-textures.md` |
| `fonts/` | the four font files | `identity/typography.md`, `technical/dependencies.md` |
| `en/*.html` | the built output — ground truth for the final computed CSS | used to verify tokens |

---

## 7. The five facts a future agent must not get wrong

1. **The field is 1-bit ordered dither, not a gradient and not grain.** 8×8 Bayer at the cell
   (`b8(gl_FragCoord.xy) + .5/64`), cell = 2 CSS px fine / 3 CSS px coarse, dot pitch 16 px (fine) /
   24 px (coarse). Output is paper or ink.
2. **The accent colour may only appear inside ink** (`m.y > .5 && m.x > th*.6`). It is never a fill and
   never more than one colour.
3. **The dither pitch is defined in CSS pixels — `devicePixelRatio` is deliberately not used.** Render at
   cell resolution and upscale by an integer factor with nearest filtering; never resample.
4. **The type is three separate voices with fixed roles**: Bebas UPPER for display, Inter Tight sentence
   case for text, JetBrains Mono +.07em UPPER for labels. Inter Tight has no 700.
5. **There are three easing curves, each with a role** — `cubic-bezier(.19,1,.22,1)` (general),
   `cubic-bezier(.22,1,.36,1)` (entrance), `cubic-bezier(.2,0,0,1)` (exit / state change) — and state
   transitions live between 0.3 s and 1.4 s (exits 0.16–0.25 s, mask bake 1.65 s).
   The generative field never stops; it starts at `t = 6.0` so the first frame is never dead.

*(A sixth, if it helps: the whole site is generated by Python into static HTML, and the shader is
injected verbatim into every page — so "the site" and "the engine" are the same artefact.)*

---

## 8. How to extend the system (the sanctioned path)

1. **Add a motif.** Write the `if(M==N){...}` block in `tools/hero_index_mock.html`, add the name → id
   mapping to `const MOTIF={...}`, and add the slug → (family, motif) entry to `MOTIF` in
   `en/adapt_1611.py`. Follow the algorithm rules in `generative/algorithms.md §4`.
2. **Add a page.** Give it a family, a motif, a numeral and a title; nothing else changes.
3. **Add a component.** Follow the rules in `generative/reusable-components.md`.
4. **Add motion.** Use only `var(--ease)` and only durations in the 0.3–1.4 s band.
5. **Never** introduce a new colour, a new font, a new easing, a new radius, or a new grid.

---

## 9. Audit — what could not be extracted

| # | Gap | Why | Impact |
|---|---|---|---|
| 1 | `reels/`, `logo/`, `img/`, `review/`, `out/`, `artifact/`, `landing/`, `courses/`, `getcourse/`, `school/` contents | Read budget (5 calls) exhausted before inspection | The highest-value follow-up: an existing export pipeline may exist in `reels/` |
| 2 | The full `bakeDither` / `ditherInto` bodies | Located at `school.px.html:3682` / `:2589` but the body lines were not captured | The algorithm is documented from its own verbatim contract comments; the body is **reconstructed**, and flagged as such in `technical/reusable-code.md §13` |
| 3 | `@keyframes lpin` body | Not captured | The review-row entrance is known by name, duration (`.5s`) and easing; its transform is an **inference** |
| 4 | The marquee JS scroll driver | `.marq-t{will-change:transform}` found at `template:311`, the driver not captured | A marquee must be built from the CSS contract; the exact speed is unknown |
| 5 | `--ink-250` / `--ink-300` panel gradient stops | The `:root` grep captured `:38-48`; these live in a rule not printed | The node panel's exact gradient is unknown |
| 6 | `.tier` / `.tp` price card CSS, `.ix-buycard`, `.ix-buycap`, `.rc-m`, `.tbar` | Selectors known from `adapt_1611.py:47-58`; rules not captured | Price-card recreation is approximate |
| 7 | `family/family.py` CSS for family nav / author block / works wall | Only the author-image rule was captured (via `wave_l9new.py:131`) | Those three components are under-documented |
| 8 | Which of `src/template.html` vs `src/template_v16/v20_pref2.html` is live | Previously believed `.edge` existed only in the numbered variants | **RESOLVED 2026-11** — `.edge` IS present in `src/template.html:587`; `template_v16` / `v20_pref2` do **not** carry it. The pixel edge is documented from the live `src/template.html` |
| 9 | The two hashed Bebas Neue files in `fonts/` | No `@font-face` referencing them was observed | Their role is unknown |
| 10 | `tools/pipeline/foot_measure.mjs` dependencies | Only the extension was seen | A headless browser is inferred |
| 11 | The `--dedge` sprite file | Referenced from CSS, the image file not identified | **RESOLVED 2026-11** — `--dedge` is a runtime `toDataURL()` (`src/template.html:1617-1620`); there is **no sprite file**. The 32 × 96 figure is the `background-size`, not the image dimensions |
| 12 | Built-page computed CSS | No browser was launched (per the task rules) | All values come from source, not from a live render |

**These 12 gaps are not all benign.** Gap #2 (the `bakeDither` body is reconstructed, not quoted) touches
the **generative engine**; gap #5 (`--ink-250` / `--ink-300` panel gradient stops) touches the **colour
system**; gap #8 (which of `src/template.html` and `src/template_v16/v20_pref2.html` is live)
is now **RESOLVED** — `.edge` is in `src/template.html:587`, so the `template:NN` citations stand;
gap #12 means no value was ever checked
against a live render. The typography, the grid and the motion timing are unaffected.

The load-bearing parts of the identity are therefore *mostly* extracted, not *fully*. And the live site
departs from this system in ways this audit did not and could not reconcile — see **§11**.

---

## 10. One-paragraph brief (for a prompt or an agent handoff)

> Hou2Touch is a TouchDesigner/Houdini school whose visual identity is a **technical print**: black
> `#0b0b0c` on paper `#e9e7e0`, rasterised through an **8×8 Bayer ordered dither at a 2 px cell** (16 px
> dot pitch fine, 24 px coarse), with exactly **one** TouchDesigner operator-family colour (CHOP
> `#45a654`, TOP `#65a30d`,
> SOP `#3d7fd6`, DAT `#c34f9a`, COMP `#9a9a96`) allowed to appear inside the ink and never as a fill.
> The type is three voices that never mix: **H2T Bebas** (UPPER, `lh .8`) for numerals and titles,
> **Inter Tight** (sentence case, negative tracking) for prose, and **JetBrains Mono** (+.07em, UPPER,
> 10–12 px) for instrument labels. Everything sits on a **12-column grid** with 3.9 % margins and 1.4 %
> gutters, and every surface is annotated like a measurement — ticks, counters, registration grids, a
> live `f 000000` frame counter, a moving ×3.2 loupe. Motion has **three named easings**
> (`.19,1,.22,1` general, `.22,1,.36,1` entrance, `.2,0,0,1` exit), state-transition durations between
> 0.3 and 1.4 s, type that rises out of a clipped box,
> surfaces that wipe rather than dissolve, and a continuous procedural field that never stops. The field
> is a **pure function of (uv, aspect, time)** — a domain-warped fBm, a contour map, a travelling wave, a
> tiled screen, a perspective lattice, a node chain — not an image and not a simulation.

---

## 11. Deviation register — where the live site departs from this system

**This system is canon.** Everything above is the standard a new composition is judged against. The live
site is **not** a conforming implementation of it — it is a richer, non-conforming variant. The rows
below are a *register, not a licence*: they exist so that the live pages (and old screenshots of them)
stay explicable. They do not amend the rules above, and a new composition built to this system must
still obey them. The live hero in particular **cannot be reproduced outside WebGL** — it is a
fragment-shader construction with its own colour model, its own dither geometry and its own cell
derivation, and no static description of it reproduces it.

| # | System rule | Live behaviour (file:line) | Consequence | Status |
|---|---|---|---|---|
| 1 | P1 / M2 — the field is 1-bit: `if(m.x>th)c=ink;` | The live hero anti-aliases: `dm=smoothstep(rad+.7,rad-.7,length(rp-hq))*gate(...)` (`en/index.html:4021-4040`) | Continuous tone, not 1-bit — the "one technique" reading no longer holds literally | Deviation — accepted, not reproducible |
| 2 | P2 / §4.3 — axial 8×8 Bayer (`b8`), evaluated per cell | The live hero is a **rotated halftone**: `rp=rt*fc` (45° rotation matrix), `hq=(floor(rp/hc)+.5)*hc` (`en/index.html:4021-4040`) | The dot matrix sits at 45° to the pixel grid; the Bayer recursion is not what draws the field | Deviation — accepted |
| 3 | P2 / M3 — fixed dot pitch of 16 px (fine) | The live hero derives the cell from the viewport height: `C=max(3,round(H/170))`, cell = `mix(C,max(2.,floor(C*.5)),inl)` (`en/index.html:4021-4040`) | The pitch is **height-derived**, not fixed at 16 px — it changes with the band height | Deviation — accepted |
| 4 | P3 / M5 — one accent, only inside ink, never a fill | Solid accent fills in the live build: `--hou` as a button background (`en/index.html:146`), hardcoded `fillStyle="#e5501e"` (`en/index.html:3823`), plus an orange Bayer grid `ORG=vec3(.898,.314,.118)` in the cloud mask; the accent is gated by hash noise `pk()`, not by `th*.6` | Four colours in play (paper, ink, blue-black `dc=mix(INK,vec3(.16,.2,.27),.35)`, orange) and an accent that is *not* confined to the ink | Deviation — accepted |
| 5 | M11 / X5 — one easing curve | Three curves in production: `--ease:cubic-bezier(.19,1,.22,1)`, `--rx-em:cubic-bezier(.22,1,.36,1)`, `--rx-es:cubic-bezier(.2,0,0,1)` (120–240 ms; the decision is recorded in the source at `en/index.html:1206`) | The system must name three curves with roles, not one | **Resolved in this revision** — §2.4 defines the three roles |
| 6 | M12 — durations 0.3–1.4 s | Exits run 0.16 / 0.18 / 0.24 / 0.25 s and the mask bake waits 1.65 s (live EN set; `en/index.html:1206`, `hero:826`) | The band must be stated as "transitions 0.3–1.4 s" plus a named exception list | **Resolved in this revision** — §2.5 states the band and the exceptions |

The remaining live-only detail, for completeness: the Bayer value is computed by recursion
(`b2`/`b4`/`b8` over `fract(dot(...))` hashes) rather than from a 64-value table — that is an
implementation detail of the same routine, not a different outcome.

---

## 12. The pixel seam

### 12.1 What it is

The seam is the **pixelated transition at a dark↔light boundary**. It is built from the **same
recursive 8×8 Bayer matrix `B8` as the field**, but at **4× the tonal cell**:

> **The field dithers tone; the seam dithers scale. One matrix, two scales.**

The field's tonal cell is 2 CSS px (fine) / 3 px (coarse) — the seam's cell is **8 px desktop /
4 px mobile**, i.e. exactly 4 × the 2 px tonal cell. There is no second dithering algorithm and no
second matrix: the seam is the field's matrix re-sampled at a coarser cell, which is why a seam
and a field look like the same material at two magnifications.

Live implementation: `en/index.html:3845-3857` — a `<canvas class="pxd" id="edge">` at the bottom
of a `.sec.edge-sec` paper section. Legacy variant in `src/template.html:1617-1620` uses the
runtime `--dedge` image.

### 12.2 Geometry

| Parameter | Desktop | Mobile |
|---|---|---|
| Cell | **8 px** | **4 px** |
| Rows | **12 rows** | **8 rows** |
| Band height | **96 px** | **32 px** |
| Columns | `cols = ceil(sectionWidth / cell)` | same formula |
| Upscale | CSS `image-rendering: pixelated` (+ `crisp-edges`) | same |

The canvas is **1 canvas-pixel per cell** and is upscaled by CSS. **Integer only** — the canvas is
already at cell resolution, so no resampling ever happens (M4, X10). The band is 12 rows × 8 px =
**96 px** on desktop; the mobile band is 8 rows × 4 px = **32 px**.

### 12.3 The dither rule

Identical to the field, with `s` (scroll offset) as the only extra term:

```
t = clamp(v*1.3 - 0.3 + s, 0, 1) * 64      v = (r + 0.5) / rows
ink if t > B8[(r%8)*8 + (i%8)]
```

### 12.4 Ink polarity — the rule read in two directions

The seam paints **the ink of the section it BELONGS to**, on a transparent canvas, so the
neighbouring surface shows through the holes.

| Live case | Painted ink | Host section | Reads as |
|---|---|---|---|
| `en/index.html:3845-3857` | `#0B0B0C` | paper section | dark neighbour bleeds **into** the paper |
| `src/template.html:1617-1620` (`--dedge`) | `#E9E7E0` | dark section | cream bleeds **out of** the dark onto paper |

These are **the same rule read in opposite directions** — not two variants. A seam is always
drawn in the ink of its own side.

### 12.5 Direction

**One generator serves both directions.** The seam is a single canvas routine; placement decides
its polarity and its flip:

| Selector | Placement | Flip |
|---|---|---|
| `.edge.b` | bottom of a paper section (dark above) | `transform: scaleY(-1)` |
| `.edge.t` | top of a paper section (dark below) | none |

### 12.6 Motion

Ink density is driven by scroll position:

```
paint(Math.round((p - .5) * .44 * 32) / 32)
```

— **32 quantised steps** across the scroll range. Redraw happens in the **shared rAF loop**, only
**while the seam is on screen**, and only **when the step changes**. Under `prefers-reduced-motion`
the seam is **static**: a single state at `s = 0` (the mid-ramp).

**Static default: `s = 0`.** Any non-interactive render (print, video, still) uses `s = 0`.

### 12.7 Mandatory placement

**Every junction between a dark surface and paper MUST have a seam. A straight edge is a
violation.** The existing lint enforces it: `tools/check_total.py:209` requires a `.seam` /
`.edge` at every light/dark junction (page 203 is whitelisted), and `:195` requires
`padding-top >= 96 + --r-air` on sections carrying `.edge.t`.

### 12.8 Forbidden substitutions

| Forbidden | Why |
|---|---|
| A soft gradient fade | continuous tone — breaks the 1-bit premise (M2) |
| A blurred edge | continuous tone, same reason, plus it breaks the integer-upscale rule (M4) |
| A torn-paper PNG | a bitmap, not the matrix; it cannot hold the 4× cell relationship |
| A `mask-image` feather | continuous tone at the boundary |

All four break the premise that **the seam is the same dither as the field, at a known cell
ratio**.

### 12.9 The second family — `--edge-img`

On course pages the seam also ships as an **inline base64 8×24 PNG**, tiled with
`background-size: 32px 96px repeat-x` (×4), used together with `.tf>.edge` and `.seam`. The
32 × 96 figures here are the **background size**, not the image dimensions (the PNG itself is
8 × 24).

### 12.10 Other media

- **Print and video:** the seam is rendered at the **same 4× cell relationship** (8 px seam cell
  against the 2 px tonal cell) and is **STATIC** — no scroll. Pick **`s = 0`** and state it in
  the render manifest.
- **3D / Blender:** the seam is a **texture, not geometry** — a plane or shader mask carrying the
  baked Bayer ramp, never a modelled jagged edge.

---

## 13. Plate policy

### 13.1 Principle

> **A plate is a stamp on paper, not a container.**

The system separates by **whitespace and hairline**, not by boxes. Therefore a plate is permitted
**only where the content is a *label, a control, or a datum*** — **never** to group content that
whitespace could group.

This is a **decision rule**, not a style guide: it tells you whether to draw a plate at all.

### 13.2 Closed vocabulary — exactly four permitted families

| # | Family | Radius | Size / fill | For |
|---|---|---|---|---|
| 1 | **Chip** | **2 px** | height **24 px**, inset hairline `--line2`, mono 10–12 px, `.07em`, UPPER, optional 7–9 px family-colour square | operator tags, audience/level labels, flags |
| 2 | **Card** | **6 px** | 1 px border, **NO fill** except the node-panel gradient | a simulated node, an end-of-list link. **Maximum one per screen region** |
| 3 | **Pill CTA** | **999 px** | height **56 px** | the **primary call to action only**. Never a label, never a nav item, never a tag |
| 4 | **Bare plate** | **0** | no border, no fill | price columns, table-like data — anything that is a *column of content*, not a box |

The four families map to the live classes: chip = `.op` / `.tag` / `.tag.key`; card = `.pn` / `.enl` /
`.sq`; pill CTA = `.btn.pill`; bare plate = `.tier` / `.seg` / `.inp button`.

### 13.3 Forbidden

- Any radius outside `{0, 2, 6, 999}`.
- A plate with a **drop shadow**.
- A plate with `backdrop-filter`.
- A plate whose fill is a **gradient** (except the node panel).
- A plate **at a dark↔light junction** — the seam does that job; a plate there is a double
  statement.

### 13.4 The junction rule

At a dark↔light boundary the **only** permitted device is the **pixel seam**. No plate, no card,
no divider, no gradient may be used to mark that boundary.

> **Two devices for one boundary is a violation.**

The seam already states "the value changes here". A box, rule or fade stating it again is a
**double statement** on the same edge, and it breaks the 1-bit reading (§12).

### 13.5 Density budget

Observed reality on `en/index.html`: **≈130 plate surfaces** (≈45 `.btn`, ≈30 `.tag`, 13 `.op`,
~8 `.pn`, ~25 circles, ~15 media frames) against **~20 course cards that are pure open paper**
(`.cc` has no background, no border, no radius). The site is therefore **plate-heavy at the
control layer and plate-light at the container layer** — which is the correct axis.

The budget rule:

- Plates must not exceed roughly **one per 6 lines of text** in any viewport-height of content.
- A section that needs **more than three chips in a row is a list, not a plate cluster**.

The test:

> **If you can remove the plate and the content still separates, remove the plate.**

### 13.6 Remediation register

Observed in the live source. Every radius outside the vocabulary is a **must-fix** against M13/X9.

| Current value | Where | Target | Status |
|---|---|---|---|
| **8 px** | `.mp-bx`, `.mp-h2t`, `.f-fam .mp-h2t::before` | 6 px (container) or 2 px (control) | must-fix |
| **10 px** | `.aud-yes`, `.aud-no`, `.aud-no>.ph` | **6 px** — these are cards, 4 px over the X9 limit | must-fix |
| **4 px** | `.mn`, `.mp-en`, `.ni-go`, `.mpm .in-m`, `.mr`, `.mpd`, `.sp-b`, `.n3-nx`, `.n3-b>button` | **2 px** for controls, **6 px** for containers | must-fix |
| **3 px** | `.prv`, `.en`, `.plt`, `.lb img`, `.vc .fr`, `.sp-fr`, `.n3-ch>li`, `.n3-md>div`, `.cc-vw-box` | **2 px** for controls, **6 px** for containers | must-fix |
| **5 px** | `.f-net3 .n3-r` | **2 px** (control) | must-fix |
| gradient fill `--pnb:linear-gradient(180deg,#141416,#111113)` | `.pn`, ~8× per page | node panel is the **one permitted gradient fill** | **permitted exception** (M15, family 2) |
| gradient fill | `.aud-yes` surface gradient | node-panel family only | must-fix |
| `drop-shadow` ×3 | `.aud-yes`, `.cc-vw-box`, `.f-net3 .n3-q::before` | remove | must-fix (M15) |
| `backdrop-filter: blur()` ×4 | `.nav.stuck`, `.tlb`, `.f-nav3 .nav.lt`, `.f-mstack .mbar` | permitted **only** for sticky chrome — see §13.7 | **permitted exception** (sticky chrome) |
| radius **0**, no border | `.tier` price column | 0 is in the vocabulary (family 4) | **permitted exception** (bare plate) |
| `.btn` declares neither height nor radius in `en/index.html:140` | — | must match `src/template.html:104` (`height:48px; border-radius:2px`) | must-fix (source inconsistency) |

### 13.7 The `backdrop-filter` contradiction — resolved

M15 forbids glassmorphism, yet four live rules use `backdrop-filter: blur()`. **This document
permits it in exactly one case:**

> **`backdrop-filter` is permitted ONLY for sticky chrome that floats over content** — nav,
> timeline bar, stack bar.

**Justification:** a sticky bar over a 1-bit field cannot use a solid fill, because an opaque
fill would hide the field the bar is floating over. Translucency is the only honest option.
The conditions are strict:

- **`rgba` + blur only** — never an opaque colour.
- **Never a shadow** (M15 still holds).
- **Never on a static element** — only on something that is actually sticky and floating.

Everything else — a card, a chip, a modal, a static header — is forbidden.

---

*Extracted without modifying a single byte of the source site.*
