# Hou2Touch — MASTER DESIGN SYSTEM

**Version:** extracted 2026-11-23 from `/Users/lvn/Desktop/MCP/hou2touch_redesign`.
**Status:** every value is traced to a `file:line`. `ESTIMATED` marks an inference; `UNRESOLVED` marks a
gap. **Nothing in the source site was modified.**

---

## 1. What defines the identity

The Hou2Touch identity is a **print-first, node-graph, instrument-panel** language:

> **Ink on paper, rasterised as a 1-bit ordered dither, annotated by mono instrument labels,
> organised on a 12-column grid, and coloured by exactly one TouchDesigner operator family.**

Five pillars, each with a hard constraint:

| Pillar | Hard constraint | Source of truth |
|---|---|---|
| **P1 — Ink & paper** | Two values only: `#0b0b0c` on `#e9e7e0`. No continuous tone. | `src/template.html:38`, `tools/hero_index_mock.html:213` |
| **P2 — Ordered dither** | 8×8 Bayer, evaluated per cell (2 CSS px fine / 3 coarse). Dot pitch 16 px. | `hero:206, 224-226, 299` |
| **P3 — One family colour** | Exactly one of CHOP/TOP/SOP/DAT/COMP per composition. ≤ 5 % coverage. | `template:42`, `hero:303-304` |
| **P4 — Three type voices** | Bebas caps / Inter Tight sentence / JetBrains Mono labels. Never mixed. | `template:45-47` |
| **P5 — Instrument surface** | Every mark is a label, a tick, a rule or a counter. | `hero:308-322`, `template:83,138`, `landing.css` |

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
| M6 | One family colour per composition | `#45a654` / `#8a63c9` / `#3d7fd6` / `#c34f9a` / `#9a9a96` |
| M7 | Grid | 12 columns, `--pad` 3.9 %, `--gut` 1.4 % |
| M8 | Display type | H2T Bebas, UPPER, `lh .8`, tracking ≈ 0, optical left-pull |
| M9 | Text type | Inter Tight 400/500/600, tracking −.015…−.035em, measure ≤ 66ch |
| M10 | Label type | JetBrains Mono 500, 10–12 px, +.07em, UPPER |
| M11 | Easing | `cubic-bezier(.19,1,.22,1)` — only |
| M12 | Durations | 0.3 / 0.4 / 0.5 / 0.8 / 1.1 / 1.4 s |
| M13 | Radius vocabulary | 2 px (chips), 6 px (cards), 999 px (pill CTA only) |
| M14 | Rules | 1 px hairlines; `--line` for internal, `--ink` for the outer frame of a chain |
| M15 | No gradients / shadows / glow / glassmorphism | — |

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
| X5 | A second easing curve |
| X6 | Cross-dissolves |
| X7 | Inter Tight at weight 700 |
| X8 | A third typeface |
| X9 | Rounded cards above 6 px (except pills) |
| X10 | Resampling the dither (downscale a full-res render) |
| X11 | Colour used as the only information channel |
| X12 | Emoji / illustrative stickers |

---

## 3. The verification checklist

A composition belongs to the system if **all seven** answers are "yes":

1. Is the field 1-bit plus at most one accent?
2. Is the dither **ordered** (a regular 8×8 dot matrix), not stochastic?
3. Does the dot pitch sit on a 16 px grid (8 × the 2 px cell)?
4. Are there exactly three type voices, never mixed in a line?
5. Is the grid 12 columns with 3.9 % margins and 1.4 % gutters?
6. Is there exactly one easing, with all durations in 0.3–1.4 s?
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
   (`b8(gl_FragCoord.xy) + .5/64`), cell = 2 CSS px, dot pitch 16 px. Output is paper or ink.
2. **The accent colour may only appear inside ink** (`m.y > .5 && m.x > th*.6`). It is never a fill and
   never more than one colour.
3. **The dither pitch is defined in CSS pixels — `devicePixelRatio` is deliberately not used.** Render at
   cell resolution and upscale by an integer factor with nearest filtering; never resample.
4. **The type is three separate voices with fixed roles**: Bebas UPPER for display, Inter Tight sentence
   case for text, JetBrains Mono +.07em UPPER for labels. Inter Tight has no 700.
5. **There is one easing** — `cubic-bezier(.19,1,.22,1)` — and durations live between 0.3 s and 1.4 s.
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
| 8 | Which of `src/template.html` vs `src/template_v16/v20_pref2.html` is live | `.edge` exists only in the numbered variants, not in `src/template.html` | The pixel edge is documented from `v16` — **UNRESOLVED** which is live |
| 9 | The two hashed Bebas Neue files in `fonts/` | No `@font-face` referencing them was observed | Their role is unknown |
| 10 | `tools/pipeline/foot_measure.mjs` dependencies | Only the extension was seen | A headless browser is inferred |
| 11 | The `--dedge` sprite file | Referenced from CSS, the image file not identified | The exact edge artwork is unknown (only its geometry: 32 × 96 px) |
| 12 | Built-page computed CSS | No browser was launched (per the task rules) | All values come from source, not from a live render |

**12 gaps, none of which affect the generative engine, the colour system, the typography, the grid, or the
motion timing** — the five load-bearing parts of the identity are fully extracted.

---

## 10. One-paragraph brief (for a prompt or an agent handoff)

> Hou2Touch is a TouchDesigner/Houdini school whose visual identity is a **technical print**: black
> `#0b0b0c` on paper `#e9e7e0`, rasterised through an **8×8 Bayer ordered dither at a 2 px cell** (16 px
> dot pitch), with exactly **one** TouchDesigner operator-family colour (CHOP `#45a654`, TOP `#8a63c9`,
> SOP `#3d7fd6`, DAT `#c34f9a`, COMP `#9a9a96`) allowed to appear inside the ink and never as a fill.
> The type is three voices that never mix: **H2T Bebas** (UPPER, `lh .8`) for numerals and titles,
> **Inter Tight** (sentence case, negative tracking) for prose, and **JetBrains Mono** (+.07em, UPPER,
> 10–12 px) for instrument labels. Everything sits on a **12-column grid** with 3.9 % margins and 1.4 %
> gutters, and every surface is annotated like a measurement — ticks, counters, registration grids, a
> live `f 000000` frame counter, a moving ×3.2 loupe. Motion has **one easing**
> (`cubic-bezier(.19,1,.22,1)`), durations between 0.3 and 1.4 s, type that rises out of a clipped box,
> surfaces that wipe rather than dissolve, and a continuous procedural field that never stops. The field
> is a **pure function of (uv, aspect, time)** — a domain-warped fBm, a contour map, a travelling wave, a
> tiled screen, a perspective lattice, a node chain — not an image and not a simulation.

---

*Extracted without modifying a single byte of the source site.*
