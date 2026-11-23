# Hou2Touch — Prompt Guide

**Status:** Derived from the extracted system. This document gives an AI agent (or a human) a prompt that
produces original work in the Hou2Touch visual language — with the exact values, so the model does not
invent its own.

---

## 1. The master prompt (use this for any new composition)

```
Create a Hou2Touch-style visual composition.

SURFACE
- Background: paper #e9e7e0 (the sheet) or ink #0b0b0c (the panel). Never pure black or white.
- Ink: #0b0b0c. Secondary text on paper: #2b2a28. Muted labels: #6d6b65. Dim: #9a988f.
- Hairlines on paper: rgba(11,11,12,.12) (.line) and rgba(11,11,12,.28) (.line2).
- Exactly ONE accent colour, taken from the TouchDesigner node families:
  CHOP #45a654 | TOP #8a63c9 | SOP #3d7fd6 | DAT #c34f9a | COMP #9a9a96.
  Brand orange #e5501e is reserved for the CTA hover and the brand square — never as a field.
- The accent occupies at most 5% of the frame and never fills a large area.

FIELD
- One procedural field per composition, built from 2D maths:
  contour lines from fBm, travelling sine waves, a tiled grid of 16:9 cells, a radial
  spectrum, a perspective lattice, a domain-warped noise ramp, or a chain of nodes.
- The field is rasterised as a 1-BIT ORDERED DITHER: an 8x8 Bayer matrix compared against a
  scalar ink field (0..1), evaluated at the cell, not the pixel.
- Bayer threshold: th = b8(gl_FragCoord.xy) + 0.5/64.
- Output is paper OR ink, never continuous grey.
- The accent may only appear where ink already exists (ink > th * 0.6).
- Cell size: 2 CSS px (fine, print-grain) or 3 CSS px (coarse). Dot pitch = 8 x cell = 16 px or 24 px.
- Render at cell resolution and upscale with nearest-neighbour filtering. Never resample.

TYPE
- Display: "H2T Bebas" (Bebas Neue Bold, upem 1000), ALL CAPS, line-height 0.8,
  letter-spacing +0.004em, margin-left -0.03em, overshoot the cap box by 4%.
- Numerals: same face, tabular-nums, letter-spacing -0.005em, margin-left -0.035em.
- Text: "Inter Tight" 400/500/600, sentence case, letter-spacing -0.015em to -0.035em, line-height 1.5-1.6,
  measure 40-66 characters.
- Labels: "JetBrains Mono" 500, 10-12 px, line-height 14-16px, letter-spacing +0.07em, ALL CAPS.
  Three voices only: display / text / mono label. Never mix two in one line.

GRID
- 12 columns, fluid gutters. Page margin = 3.9% of the width (clamp 16px-56px).
  Gutter = 1.4% of the width (clamp 12px-20px).
- Asymmetric splits: labels in columns 1-5, body in columns 6-13.
- The generative band is a horizontal strip: min-height clamp(380px, 54svh, 640px),
  with an ink hairline on top and a line2 hairline below.

OBJECTS
- Mono label chips: paper background, 3px 7px padding, 10px/14px mono, uppercase, .07em.
- A row of 12 hairline ticks along the top of the band, 7px tall.
- Pills only for CTAs: height 52px, padding 0 26px, radius 999px, 12px mono uppercase.
- Cards: radius 6px, 1px border. Tags: radius 2px, height 24px, inset 1px ring.

MOTION (if the composition moves)
- One easing only: cubic-bezier(0.19, 1, 0.22, 1).
- Durations: 0.3s colour hover, 0.4s indicator rotate, 0.8s block reveal, 1.1s type rise, 1.4s band wipe.
- Type rises from translateY(105%) out of a clipped box, with a 0.05s stagger between glyphs.
- Large surfaces wipe in with clip-path inset(), never a cross-dissolve.
- The field animates continuously from t = 6.0 (never a dead first frame) at 0.72x speed.
- Pointer influence is a Gaussian of radius 0.236 UV, smoothed at 0.08 per frame.

FORBIDDEN
- No gradients, no drop shadows, no glassmorphism, no glow, no bloom.
- No continuous-tone photography or illustration inside the field.
- No more than one accent colour. No third easing. No emoji. No third typeface.
- Do not fill solid areas with dead black in the fine mode: cap ink at 0.95.
```

---

## 2. Prompt fragment — "generate a new motif"

```
Write a GLSL fragment function with the signature
    vec2 motif(vec2 uv, float asp, float t)
that returns x = ink density (0..1) and y = colour mask (0..1).

Use these helpers:
    float h1(vec2 p)            // hash: fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453)
    float vn(vec2 p)            // value noise (smoothstep-interpolated h1)
    float fbm3(vec2 p)          // 3-octave fBm, normalised to 0..1
    float fbm(vec2 p)           // 5-octave fBm
    float b2/b4/b8(vec2 a)      // Bayer 2/4/8 threshold, from the cell coordinate
    float u5sg(vec2 p, vec2 a, vec2 b)  // distance to segment
    float fwidth2(float x)      // max(1e-4, fwidth(x))
    float gline(float v, float w)       // antialiased grid line
    float hline(float dy, float w)      // antialiased horizontal line
    float vedge(vec2 p, float t)        // animated Worley F2-F1 edge distance

Set up:
    vec2 q = vec2(uv.x*asp, uv.y);
    vec2 d = q - vec2(P.x*asp, P.y);
    float lens = PA * exp(-dot(d,d)*18.);   // pointer disturbance, use it locally

Your motif must:
- be a pure function of (uv, asp, t) — no state, no simulation, no randomness beyond h1;
- move continuously, with cue periods between 0.5 and 8 seconds;
- use h1(cell + floor(t*rate)) for per-cell behaviour, so re-rolls are stable;
- produce an ink field that is either crisp lines or a smooth field, never noise;
- reserve the colour mask for a SMALL, SPARSE region (one band, one node, one row, one blob);
- use lens to perturb the field locally, never to brighten globally.

Composite afterwards (do not change it):
    float th = b8(gl_FragCoord.xy) + .5/64.;
    if (ink > th) c = INK;
    if (colmask > .5 && ink > th*.6) c = K;
```

---

## 3. Prompt fragment — "the fine instrument layer"

```
Add a technical-instrument layer over the paper areas only (fine mode):
- paper dots: if mod(floor(px.x),7.) < .5 and mod(floor(px.y),7.) < .5, mix paper with
  graphite vec3(.42,.41,.39) at 0.55
- a 12-column registration grid from the uniform GR = vec3(originX, cellWidth, rightEdge):
  vertical 1px lines at GR.x + k*GR.y for k = 0..11, plus a line at GR.z, drawn as dashes
  every 5th row
- horizontal rules at y = 1/3 and y = 2/3, 4 cells thick, but only within 4 cells of a vertical line
- a reticle: a circle at the loupe radius, a dashed circle 0.022 inside it (24 dashes),
  a crosshair from RL+0.012 to RL+0.075, and a centre dot in the accent colour
- keep every one of these inside the loupe's mask off (do not draw them inside the loupe)
```

---

## 4. Prompt fragment — "hero layout"

```
Build a 12-column hero:
  row 1  nav, 64px: brand (Inter Tight 600, 17px, -0.02em) | links | sign-in, all mono 11px
  row 2  meta line, mono 11px/16px, +0.07em, UPPER: an 8px square in the family colour, then
         "Course NNN / FAM" | software | level
  row 3  lockup: a giant Bebas numeral (tabular-nums) and a display title in Bebas UPPER,
         both on the same last baseline
  row 4  the generative band, full-bleed, with four mono label chips at the corners and a
         12-cell tick rail along the top
  row 5  footer: three facts (mono labels + Inter Tight values) | price | two CTA pills

The band is a horizontal strip with an ink hairline on top and a line2 hairline below.
Label chips: paper background, mono 10px/14px, +0.07em, UPPER, 3px 7px padding.
The bottom-right chip reads: a filled dot in the family colour, then FAM, then the motif name.
The top-right chip reads: "f 000000" then "60 fps" in mute.
```

---

## 5. Prompt fragment — "a module chain"

```
Build a programme as a numbered chain:
- a table with 12 columns; the number in column 1 (52px), the title in column 2, the metadata
  in the last column
- rows separated by 1px rgba(11,11,12,.12) hairlines; the top and bottom rules are full ink
- row numbers are decimal-leading-zero, JetBrains Mono 500 11px, +0.07em, in mute
- the title is Inter Tight 500, 18-24px, -0.02em, ink
- the metadata is mono 500 11px, +0.07em, UPPER, mute, right aligned
- the section heading is a sticky Inter Tight 500 heading, -0.035em, ink, max 12 characters wide
```

---

## 6. Negative prompts (what to forbid explicitly)

```
Do not use: gradients, drop shadows, glow, bloom, glassmorphism, frosted panels, emoji,
photographic imagery inside the field, continuous grey, more than one accent colour,
rounded cards above 6px (except the 999px pill CTA), more than three typefaces,
a bounce or elastic easing, a cross-dissolve transition, a third easing curve,
pure #000 or pure #fff as a field, Inter Tight at weight 700, a third language voice.
```

---

## 7. Prompt recipes by deliverable

| Deliverable | Prompt recipe |
|---|---|
| Static poster | §1 + §3 (instrument layer optional) + §4 (hero layout) |
| Motion loop | §1 + §2 (pick or write a motif) + the timing rules in §1's MOTION block |
| Social square | §1 + §4, band at 54 % height, use the site's phone `--num` clamp (96–150px) if small |
| Course card | §1 + §4, single course, price in Inter Tight 500 24px -0.03em |
| Type specimen | §1's TYPE block only — Bebas caps / Inter Tight sentence / JetBrains Mono labels |
| Motion system test | §1 + §2, render a 6-second loop with a cue change every 2 seconds |

---

## 8. Verification checklist for a generated output

Before accepting any composition, check it against these seven questions. They are the identity.

1. **Is it 1-bit plus at most one accent?** Any continuous grey or a second accent = fail.
2. **Is the dither ordered (a regular 8×8 dot matrix), not stochastic grain?** Fail if it looks like film grain.
3. **Does the dot pitch sit on a 16 px grid?** (8 × the 2 px cell.)
4. **Is the type exactly three voices — Bebas caps, Inter Tight sentence, JetBrains Mono labels?**
5. **Is the grid 12 columns with 3.9 % margins and 1.4 % gutters?**
6. **Is there exactly one easing and are all durations between 0.3 s and 1.4 s?**
7. **Is the accent under 5 % of the frame, and is the text on paper exactly #0b0b0c?**

If any answer is "no", the composition is in the neighbourhood of the system but not in it.

---

## 9. A caution for the prompting model

The site is a **print-first technical instrument**: 1-bit, gridded, mono-labelled, sparse. Models
default to "premium tech landing page" — glossy, gradient-heavy, glowing. Explicitly forbid gradients and
shadows, and give the hex values, because a model asked for "Hou2Touch style" without them will produce
a generic dark-mode SaaS page.

Also: **the field is the brand.** Do not let the type dominate. In the site's own heroes, the band is
roughly half the viewport and the type is a numeral and a title. A poster that is 90 % type is not in this
system.
