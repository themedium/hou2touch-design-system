# Hou2Touch — Visual Catalog

**Status:** MEASURED catalogue of the visual vocabulary, indexed for lookup. No screenshots are embedded —
this is a catalogue of *elements*, with the exact spec of each.

---

## 1. Index

### 1.1 Surfaces
| ID | Element | Spec | Source |
|---|---|---|---|
| S-01 | Paper field | `#e9e7e0` | `template:38` |
| S-02 | Dark panel | `#0b0b0c`, raised `#121214` / `#17171a` | `template:38` |
| S-03 | Raised paper | `#f4f2ec` | `template:38` |
| S-04 | Hairline (dark) | `rgba(239,238,233,.11)` | `template:40` |
| S-05 | Hairline (paper) | `rgba(11,11,12,.12)` | `hero:22` |
| S-06 | Strong hairline (paper) | `rgba(11,11,12,.28)` | `hero:22` |
| S-07 | Panel gradient | `linear-gradient(180deg,var(--ink-300),var(--ink-250))` | `template:117` |
| S-08 | Band field | WebGL canvas, 1-bit dither | `hero:70-71` |
| S-09 | Pixel edge | 32 × 96 px sprite, `pixelated` | `template_v16:555` |
| S-10 | Dot rule | 9 px radial-gradient dot row | `wave_look:155` |

### 1.2 Colours
| ID | Element | Value | Source |
|---|---|---|---|
| C-01 | Ink | `#0b0b0c` | `template:38` |
| C-02 | Foreground | `#efeee9` | `template:39` |
| C-03 | Text (paper) | `#2b2a28` | `hero:22` |
| C-04 | Text (dark) | `#cfcec9` | `template:39` |
| C-05 | Mute | `#8f8e8a` / `#6d6b65` | `template:39`, `hero:22` |
| C-06 | Dim | `#5a5956` / `#9a988f` | `template:39`, `hero:22` |
| C-07 | Brand | `#e5501e` | `template:41` |
| C-08 | TouchDesigner cyan | `#7fe7ff` | `template:41` |
| C-09 | Sand | `#b8a88a` | `template:42` |
| C-10 | Carmine | `#b3122e` | `build.py:115` |
| C-11 | CHOP | `#45a654` | `template:42` |
| C-12 | TOP | `#8a63c9` | `template:42` |
| C-13 | SOP | `#3d7fd6` | `template:42` |
| C-14 | DAT | `#c34f9a` | `template:42` |
| C-15 | COMP | `#9a9a96` | `template:42` |
| C-16 | Graphite ink (fine) | `vec3(.075,.072,.068)` | `hero:305` |
| C-17 | Instrument grey | `vec3(.42,.41,.39)` | `hero:310` |

### 1.3 Type
| ID | Element | Spec | Source |
|---|---|---|---|
| T-01 | Hero numeral | `700 var(--num)/.8 var(--disp)`, `clamp(104px,11.5vw,220px)`, `-.005em`, tabular | `hero:57` |
| T-02 | Hero display title | `700 var(--ttl)/.8 var(--disp)`, `clamp(96px,15vw,280px)`, `.004em`, UPPER | `hero:81` |
| T-03 | Hero H1 | `500 var(--h1)/1.2 var(--sans)`, `clamp(22px,2.3vw,36px)`, `-.025em`, ≤30ch | `hero:58` |
| T-04 | Landing H1 | `500 clamp(28px,3.1vw,48px)/1.08`, `-.035em`, ≤22ch | `landing.css` |
| T-05 | Landing H2 | `500 clamp(30px,3.3vw,52px)/1.02`, `-.035em`, ≤12ch, sticky | `landing.css` |
| T-06 | Section body | `400 clamp(16px,1.2vw,18px)/1.6`, ≤66ch | `landing.css` |
| T-07 | Mono micro-label | `500 11px/16px var(--mono)`, `.07em`, UPPER | `hero:37` |
| T-08 | Band label chip | `500 10px/14px var(--mono)`, `.07em`, UPPER, paper bg | `hero:77` |
| T-09 | Node panel header | `500 12px/1.4 var(--mono)`, `.06em`, UPPER | `template:118` |
| T-10 | Button | `500 12px/1 var(--mono)`, `.07em`, UPPER, h52, pill | `hero:86` |
| T-11 | Marquee | `700 40px/1 var(--disp)`, UPPER, `.3em` pad | `template:311` |
| T-12 | Tag | `500 12px/1 var(--mono)`, `.05em`, UPPER, h24, r2 | `template:349` |
| T-13 | Price | `500 24px/1 var(--sans)`, `-.03em` | `hero:87` |
| T-14 | Static scale | `--fs-2xs 11` … `--fs-7xl 112`, `--lh-tight 1.15`, `--lh-body 1.5` | `build.py:110-114` |

### 1.4 Components
| ID | Element | Spec | Source |
|---|---|---|---|
| K-01 | Hero band | `min-height:clamp(380px,54svh,640px)`, ink top rule, line2 bottom rule | `hero:70` |
| K-02 | Tick rail | 12 cells, 7 px, 1 px ink borders | `hero:73-74` |
| K-03 | Label chip | paper bg, `3px 7px` pad, 10/14 mono | `hero:77` |
| K-04 | CTA pair | filled ink + ghost, both pills, h52 | `hero:86-87` |
| K-05 | Section label `.lbl` | trailing `flex:1` 1 px `--line` rule, min 16 px | `template:83` |
| K-06 | Section counter | `counter(sec,decimal-leading-zero)` mono, family colour | `landing.css` |
| K-07 | Node panel `.pn` | r6, 1 px `--line2`, header/body/footer | `template:117-126` |
| K-08 | Family badge | 16 px square, r2, inset ring | `template:124` |
| K-09 | Module chain `.mods` | 52px/1fr/auto, ink outer rules, line inner | `landing.css` |
| K-10 | Accordion `.prog` | ink rules, 1fr/auto/28px grid, 14 px plus | `landing.css` |
| K-11 | Review row `.cv li` | 96px/1fr, `lpin .5s var(--ease)` | `template:303`, `wave_bc:189` |
| K-12 | Marquee | ink rules top+bottom, inline-flex row | `template:309-311` |
| K-13 | Timeline strip `.tlb` | fixed, h34, blur 12, `translateY(100%)` | `template:215` |
| K-14 | Sticky nav | blur 14, `padding-block:10px` when stuck | `template:144` |
| K-15 | Audience chips | pill, 1 px ink border, mono 12/`.06em` | `landing.css` |
| K-16 | Concept divider | 9 px dot row + 1.5 px rule | `wave_look:155` |
| K-17 | Author photo | 4:3, r6, `grayscale(1) contrast(1.06)` | `wave_l9new:131` |

### 1.5 Motion
| ID | Element | Spec | Source |
|---|---|---|---|
| M-01 | Easing | `cubic-bezier(.19,1,.22,1)` | `template:48`, `hero:32` |
| M-02 | Type rise | 1.1 s, `translateY(105%)`, `.05s` stagger | `hero:113-116` |
| M-03 | Block reveal | .8 s, `translateY(8px)` + fade, .35 s delay | `hero:115` |
| M-04 | Band wipe | 1.4 s, `clip-path inset()`, .25 s delay | `hero:113, 119` |
| M-05 | Scroll reveal | IO `rootMargin:"0px 0px -10% 0px"`, one-shot `.in` | `template:1641` |
| M-06 | Hover | .3 s bg+colour → brand orange | `hero:86-88` |
| M-07 | Indicator rotate | .4 s, 90°→0° | `landing.css` |
| M-08 | Timeline reveal | .8 s `translateY(100%)` | `template:215` |
| M-09 | Pointer lens | Gaussian σ≈.236 UV, `.08`/frame lerp | `hero:237, 812` |
| M-10 | Loupe | ×3.2, r=.17, orbit `.13`/`.17` Hz | `hero:296, 815` |
| M-11 | Field clock | `T=6.0+elapsed`, ×.72 fine | `hero:809` |
| M-12 | Frame readout | `f` + `floor(T*60)` 6 digits | `hero:822` |

---

## 2. The 29 motifs — visual index

Each row: id, name, what it *looks* like, family, page. Full GLSL in `generative/shaders.md`.

| Id | Name | Visual read | Family | Page |
|---|---|---|---|---|
| 0 | chladni | nodal sand lines on a plate, an expanding beat ring | chop | 101 |
| 1 | streams | 7 travelling signal lines with packets | top | 202 |
| 2 | wall | a grid of 16:9 output tiles cutting on their own clocks | top | 203 |
| 3 | terrain | a topographic map with index contours | sop | 207 |
| 4 | warp | domain-warped fBm posterised into tone steps | — | fallback |
| 5 | frame | a triangulated space-frame in perspective | chop | 102 |
| 6 | lissajous | two woven ribbons of threads, over/under | chop | 201 |
| 7 | beams | 5 moving-head fixtures throwing wedges onto a floor | chop | 204 |
| 8 | feedback | one scanline ribbon echoed back 10 times | top | 205 |
| 9 | barcode | 7 rows of Ikeda bars, one row inverting per beat | chop | 206 |
| 10 | opart | dense lines lifted by 4 moving Gaussian bumps | sop | 302 |
| 11 | fold | hairline grid where some cells fold to a new angle | sop | 304 |
| 12 | physarum | a slime-mould transport network: filaments + trunks | sop | 305 |
| 13 | plotter | contour plot with one dense accent blob | chop | av |
| 14 | rings | two-source interference rings and a solid disc | top | me |
| 15 | swarm13 | myxomycete veins with oriented boid needles | chop | 103 |
| 16 | moire | three drifting screens: rings × rotated grid × spokes | top | vj |
| 17 | rack | modular synth panels with knobs, sliders, patch cables | top | modulardesign |
| 18 | shader | posterised radial field with scanlines and vignette | top | 301 |
| 19 | storyboard | a 3×2 plan sheet of rough shot frames | chop | 204_preproduction |
| 20 | channels | 28 DMX faders with stepped notches | chop | 204_production |
| 21 | atlas | two nested contour systems, sparse and legible | sop | course |
| 22 | bundle | two signal tracks converging into one line | chop | extreme |
| 23 | foundations | a chain of nodes growing on one baseline | sop | course/1 |
| 24 | procedural3d | a grid of instanced boxes, each its own size/angle | sop | course/2 |
| 25 | interactive | a 6×6 sensor field with a permanent radial ripple | sop | course/3 |
| 26 | path3d | an isometric wireframe lattice opening over time | sop | 3d |
| 27 | light | 5×5 pools of light on a perspective stage floor | chop | light |
| 28 | avperf | a 48-bin radial spectrum analyser | top | ru/av-performance |

---

## 3. Visual families of the motifs

Grouping by what they *look* like — this is the fastest way to find a reference for a new piece:

| Look | Motifs | Shared construction |
|---|---|---|
| **Contour / map** | 3, 13, 21 | `fract(level)` + `fwidth2` for AA |
| **Tiled screen** | 2, 19, 20 | `floor(uv*g)` + per-cell hash + per-cell clock |
| **Wireframe / lattice** | 5, 11, 26, 17 | `gline()` on a transformed coordinate |
| **Waves / interference** | 0, 1, 6, 8, 9, 14 | `sin(kx ± wt)` |
| **Tone ramp** | 4, 10, 16, 18 | `floor(v*N)/N` + bright step edges |
| **Noise / organic** | 12, 13, 15 | domain-warped fBm, `vedge` |
| **Instrument** | 7, 20, 24, 27, 28 | perspective grids, bars, faders, pools, bins |
| **Diagram** | 22, 23, 25, 26 | chains, nodes, sensors, lattices |

---

## 4. The vocabulary of the site's *graphic* marks

| Mark | Where it appears | Purpose |
|---|---|---|
| An 8 px solid square in the family colour | meta line | identifies the operator family |
| A 16 px square badge with the family letter | node panel header | identifies the operator family |
| A 12-cell tick rail | band top | the grid, made physical |
| A mono chip on paper | band corners | an instrument label |
| `f 000000` | band top-right | a live readout |
| `×3.2 · 0.700 / 0.500` | loupe readout | a measurement |
| A decimal-leading-zero counter | every list | an index, not a bullet |
| A hairline rule with a label | section headers | a caption rail |
| A 9 px dot row | concept dividers | a halftone connector |
| A 32 px pixel-stepped edge | section boundaries | a torn print edge |

---

## 5. Negative catalogue — what does NOT appear

For completeness, the system contains **no**:
- gradients in the palette (only one panel fill gradient);
- drop shadows (only `inset` rings);
- glow, bloom, or lens flare;
- rounded corners above 6 px except the pill CTA;
- photographic or 3D-rendered imagery inside a generative band;
- continuous-tone imagery outside the halftone pipeline;
- animation curves other than `cubic-bezier(.19,1,.22,1)` (plus two 0.3 s linear colour hovers);
- scroll-linked time;
- audio.

---

## 6. Quick visual lookup by deliverable

| Need | Look at |
|---|---|
| A dithered field to imitate | K-01, S-08, §2 of `generative/shaders.md` |
| The instrument overlay | `generative/shaders.md` §5 (fine mode), M-10 |
| A poster layout | K-01, K-03, K-04, T-01…T-04, `production/graphic-production-guidelines.md` §3 |
| A motion timing | M-01…M-04, `motion/animation-specifications.md` |
| A colour choice | C-11…C-15 |
| A type size | T-01…T-14 |
| A component to reuse | K-01…K-17, `generative/reusable-components.md` |
