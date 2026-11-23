# Hou2Touch — Graphic Production Guidelines

**Status:** MEASURED inputs, derived production procedure for posters, print, and stills.

---

## 1. The core production principle

> **Everything is one field + one accent + a grid of type.**

The site is a **print-first** design that happens to run in a browser:
- 1-bit ordered dither at a fixed cell size
- a 16 px dot pitch
- ink `#0b0b0c` on paper `#e9e7e0`
- one family colour
- Bebas display / Inter Tight text / JetBrains Mono labels

A poster is therefore **not** a new design problem. It is the same problem with a different aspect ratio.

---

## 2. Print resolution model

The dither cell is a physical unit. For print:

| Print size | Master | Cell | Render at | Dot pitch |
|---|---|---|---|---|
| A4 (210 × 297 mm) | 2480 × 3508 @ 300 dpi | 2 px | 1240 × 1754 | 16 px = 1.35 mm |
| A3 (297 × 420 mm) | 3508 × 4961 @ 300 dpi | 2 px | 1754 × 2480 | 16 px = 1.35 mm |
| A2 | 4961 × 7016 | 2 px | 2480 × 3508 | 16 px = 1.35 mm |
| Screen 1080 sq | 1080 × 1080 | 2 px | 540 × 540 | 16 px |
| Screen 1920 × 1080 | 1920 × 1080 | 2 px | 960 × 540 | 16 px |

**Rule:** render the field at `master / CELL` and upscale by an integer factor with nearest neighbour.
Never downsample a full-res render — it destroys the Bayer matrix.

At 300 dpi, a 16 px pitch = 1.35 mm — a coarse newsprint-style screen. If you need a finer screen
(0.4 mm), use `CELL = 1` and render at `master` with a 1-cell Bayer — the portrait halftone already does
exactly this (`school.px.html:3697`: `bakeDither(...,52,65,1,[.5,.5],2,.6)`).

---

## 3. Poster templates (derived from the site's components)

### 3.1 "Course poster" — portrait A-series
```
┌───────────────────────────────┐
│ ● Course 302 / SOP            │  mono 11px, .07em, UPPER
│                               │
│  302                          │  Bebas 124 px+ (scaled to A4)
│  GEOMETRY                     │  Bebas, UPPER
│  SHADER TUBES                 │
│  ──────────────────────────   │  --ink hairline (band top)
│  ▓▓▒▒░░▓▓▒░▓░▒▒▓▓░░▒▓▒░▒░▓▓  │
│  ▒░▓▒▓░░▒▓▓▒░▒▓░▒▓▒░▓▒░▓▒░▒▓  │  dithered field
│  ──────────────────────────   │  --line2 hairline
│  [geo302 COMP]                │  label chip, mono 10px on paper
│                               │
│  27 videos · 7.4 h             │  Inter Tight
│  Intermediate                  │
│  €375                          │
│                     [ENROLL]  │  pill CTA, ink fill
└───────────────────────────────┘
```

### 3.2 "Motif plate" — pure generative plate
- Field only, edge to edge, at `master / CELL` upscaled ×`CELL`.
- One family colour accent, only where the motif's colour mask allows.
- No type, or one mono label in a corner chip.
- **This is the poster that best demonstrates the identity** — because the site itself proves that the
  field carries the whole brand.

### 3.3 "Instrument sheet"
Add the fine-mode instrument layer to the plate:
- paper dots on a 7 px grid (`mod(floor(px.x),7.)<.5`)
- a 12-column registration grid
- a reticle circle with a dashed inner ring and a crosshair
- a family-coloured centre dot

This is the "technical drawing" variant and it is the strongest link to the TouchDesigner/Houdini subject
matter.

---

## 4. Layer stack (must be reproduced exactly)

```
1. PAPER            #e9e7e0
2. FIELD            ink density → Bayer threshold → INK (#0b0b0c) or graphite (.075,.072,.068) in fine mode
3. ACCENT           family colour, only where colourMask>.5 AND ink>threshold*.6
4. INSTRUMENT       paper dots / registration grid / reticle (fine mode only)
5. KNOCKOUT         the title glyphs + halo clear the field back to PAPER
6. DOM OVERLAY      the corner label chips, the tick rail, the frame counter
```

Steps 5 and 6 are DOM on the site. In print/video, render them as layers:
- knockout = a separate vector layer, `multiply` over the field, with a halo in the family or graphite tone;
- overlay = text in mono, on paper chips.

---

## 5. Colour separations for print

For a print shop, the artwork naturally separates into:

| Plate | Content |
|---|---|
| **Paper** | the stock — `#e9e7e0` is the paper tint, not a printed ink |
| **Ink (K)** | the dithered field — `#0b0b0c` |
| **Accent (C/M/Y)** | the family colour, ≤ 5 % coverage |
| **Graphite** | fine mode's ink `.075,.072,.068` → a 2nd black at ~20 % (or a rich black) |

**Do not** convert the field to a photographic continuous-tone image — the ordered dither *is* the
separation.

---

## 6. Typography for print

| Role | Face | File | Spec |
|---|---|---|---|
| Display | H2T Bebas | `fonts/h2t-bebas.otf` (or `.woff2` for screen) | `upem 1000`, weight 700, UPPER, `lh .8`, tracking ≈ 0 |
| Display fallback | Bebas Neue | `fonts/c07b757a…otf` (Bold), `fonts/bac5026d…ttf` (Regular) | same metrics (`upem 1000`) |
| Text | Inter Tight | Google Fonts / self-hosted 400, 500, 600 | `lh 1.5–1.6`, tracking `−.015…−.035em` |
| Labels | JetBrains Mono | Google Fonts 400, 500 | 10–12 px, `.07em`, UPPER |

**Optical rules that must be reproduced in print:**
- Numeral: left-pull `−.035em`, `tabular-nums`.
- Display title: left-pull `−.03em`, `clip-path: inset(-.4em -.2em -.15em -.2em)` → in print, add ~4 %
  overshoot top and sides to prevent cap clipping.
- Never set Inter Tight at 700 — only 400/500/600 exist.
- Set the numeral and title on the **same last baseline** (`hero:55`: `.lock{align-items:end}`).

---

## 7. Grid for print

Use the site's own grid, scaled:

| Token | Screen | A4 @ 300 dpi (2480 px wide) |
|---|---|---|
| `--pad` | `clamp(16px,3.9vw,56px)` | 97 px (3.9 % of the width) |
| `--gut` | `clamp(12px,1.4vw,20px)` | 35 px (1.4 %) |
| Columns | 12 | 12 |

The margins and gutters are **proportional to the format**, not fixed — that is why the site uses
`clamp()` with `vw`. For print, scale the same percentages.

---

## 8. Composition rules for a still

1. **One field.** Never two motifs side by side.
2. **The type sits on paper, not on the field** — the field is knocked out under the title.
3. **The accent is ≤ 5 % of the frame.**
4. **The band is a band** — a horizontal strip, not a full-bleed background, unless the piece is a
   "motif plate".
5. **A hairline frame.** The band has an `--ink` top rule and a `--line2` bottom rule.
6. **A label chip in at least one corner** — the mono chip on paper is the system's signature object.
7. **Whitespace over density.** The system's empty paper is a feature.

---

## 9. Production checklist

- [ ] Rendered at `master / CELL`, upscaled by an integer factor with nearest filtering.
- [ ] 1-bit + at most one accent colour.
- [ ] Type from the three families, with the optical pulls applied.
- [ ] Grid margins at 3.9 %, gutters at 1.4 %, 12 columns.
- [ ] The accent is ≤ 5 % coverage.
- [ ] No gradient, no drop shadow, no blur, no glassmorphism.
- [ ] Radius vocabulary: 2 px (chips), 6 px (cards), 999 px (pill CTA only).
- [ ] The paper is the paper — `#e9e7e0` is the sheet, not an ink.

---

## 10. Honest limitations

- No print/PDF export tool was found in the repository. The procedures are derived.
- The `reels/`, `logo/`, `img/`, `review/`, `out/`, `artifact/` directories at the repo root were **not
  inspected** (read budget exhausted) — they may contain existing print assets and templates that would
  refine these guidelines.
- The exact `.edge` pixel-sprite file (`--dedge`, 32 × 96 px) was located in CSS but the image file itself
  was not identified.
