# Hou2Touch — Social Media Guidelines

**Status:** MEASURED inputs (tokens, type, motion), derived social adaptations.

---

## 1. The system's behaviour at small sizes — the core problem

The dither pitch is **16 CSS px** (fine). At a 1080 × 1080 square, the band region gives roughly
40–60 visible Bayer cells across — enough to read the motif, but the *fine* dot grid becomes the dominant
texture rather than a surface.

**Rule for social:** at ≤ 600 px wide, switch to the **coarse** look (`CELL = 3`, 24 px pitch) or keep
fine but accept that the image is mostly dots. The site's own `?x=raw` flag exists precisely for this
(`hero:201`).

---

## 2. Format specs

| Format | Canvas | Band treatment | Type |
|---|---|---|---|
| Square 1:1 | 1080 × 1080 | band as a horizontal strip, ~54 % height (matches `clamp(380px,54svh,640px)`) | numeral + title |
| Vertical 9:16 | 1080 × 1920 | band occupies the middle; the label chips stay at the corners | numeral only, title in the caption |
| Landscape 16:9 | 1920 × 1080 | full-bleed band; the 12-cell tick rail reads clearly | numeral + title + labels |
| Story / reel 9:16 | 1080 × 1920 | band at 104 vw (the site's phone rule, `hero:117`) | numeral only |

The site's phone rule — `tools/hero_index_mock.html:117`:
```css
  .band{min-height:104vw}
```
Use that ratio for vertical formats.

---

## 3. Static post composition (the most reliable format)

### 3.1 Grid — use the site's own 12-column grid
```css
.wrap{padding:0 var(--pad);display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--gut)}
```
with `--pad: clamp(16px,3.9vw,56px)` and `--gut: clamp(12px,1.4vw,20px)` (`hero:28`).

At 1080 px wide: `--pad` = `3.9vw` = 42 px; `--gut` = 15 px. **Use 42 px margins and 15 px gutters.**
That is the site's own proportion at this width — do not invent a new one.

### 3.2 Structure of a static post

```
┌──────────────────────────────────────┐
│ ● Course 302 / SOP     TouchDesigner  │  ← meta line, mono 11px, .07em, UPPER, mute
│                                      │
│  302                                │  ← Bebas, --num, tabular-nums
│  GEOMETRY                           │  ← Bebas, --ttl, UPPER
│  SHADER TUBES                       │
│  ──────────────────────────────────  │  ← band top border: --ink
│  ▓▓░▒▓░▒▓▓░▒░▓▓▓▒░▓░▒▓▒▓▓░▒░▓▓░▒▓▒▓  │  ← the dithered field
│  ▒▓░▒░▓▒▒▓░▒▓░▒░▓▓░▒▒▓▓▒░▒▓▓░▒░▒▓░▒  │
│  ░▒▓▒░▓▓▒▓░▒░▓▓░▒▓▒░▒░▓░▒▓▓░▒░▓▒░▒▓  │
│  ──────────────────────────────────  │  ← band bottom border: --line2
│  [geo302 COMP]        f 000000 ·60fps│  ← overlay chips, mono 10px, paper background
│                                      │
│  FORMAT          VIDEO          PRICE│  ← facts dl, mono labels
│  Self-paced      5 videos · 6.1 h  €340│
│                          [● ENROLL]  │
└──────────────────────────────────────┘
```

### 3.3 Type for a static post

| Element | Spec | Source |
|---|---|---|
| Numeral | `font: 700 var(--num)/.8 var(--disp)`, `letter-spacing:-.005em`, `font-variant-numeric:tabular-nums`, `margin-left:-.035em` | `hero:57` |
| Title | `font: 700 var(--ttl)/.8 var(--disp)`, `letter-spacing:.004em`, UPPER, `margin-left:-.03em` | `hero:81` |
| Meta / labels | `font: 500 10–11px/16px var(--mono)`, `letter-spacing:.07em`, UPPER | `hero:37, 77` |
| Body | `font: 400 16px/1.5 var(--sans)`, `letter-spacing:-.005em` | `hero:36` |
| H1 (landing) | `font: 500 clamp(28px,3.1vw,48px)/1.08 var(--sans)`, `letter-spacing:-.035em` | `landing.css` |

**For a 1080 px post**, the fluid clamps resolve as:
- `--num` = `clamp(104px, 11.5vw, 220px)` → 11.5 % of 1080 = **124 px**
- `--ttl` = `clamp(96px, 15vw, 280px)` → **162 px**
- `--h1` = `clamp(22px, 2.3vw, 36px)` → **25 px**

Use those exact numbers.

---

## 4. Caption and copy rules

- **Sentence case for body, UPPER for display and labels.** Never the reverse.
- Body measure ≤ 58 ch (the landing lead) — `landing.css`.
- Section/lesson counters are `decimal-leading-zero` in mono — `landing.css`.
- Emphasis is **weight + ink colour**, never colour alone.

---

## 5. Story / reel templates

### 5.1 "Numeral card"
1. Full-bleed paper `#e9e7e0`.
2. The dithered field occupies the lower 55 % (`104vw` band rule for vertical).
3. The numeral sits above the band, top-left on the 12-column grid, at 124 px.
4. One label chip bottom-right: `● SOP · opart`.
5. Nothing else. **The system is sparse — resist adding badges, arrows, or emoji.**

### 5.2 "Motif loop"
1. Field only, full-bleed, no type.
2. A loupe in the corner? **No** — the loupe is the site's *fine-mode* feature and is not present in the
   coarse look. In a social loop, use the motif full-bleed.
3. 6–8 s loop: pick a duration that returns the field to a similar state (motifs with periodic cues:
   `chladni` 2 s beat, `barcode` 2 s, `channels` 2.86 s).

### 5.3 "Course card"
The site's own card grammar: an 8 px family-colour square + `Course NNN / FAM` in mono, the title, a
dithered band, the price in `font: 500 24px/1 var(--sans); letter-spacing:-.03em` (`hero:87`), and the
CTA pair (filled ink + ghost, both 52 px pills).

---

## 6. Colour for social

| Use | Value |
|---|---|
| Background | `#e9e7e0` (paper) |
| Text | `#0b0b0c` |
| Family accent | `--chop #45a654`, `--top #65a30d`, `--sop #3d7fd6`, `--dat #c34f9a`, `--comp #9a9a96` |
| Brand CTA | `#e5501e` |

**Never** place a family colour on a large area, and never use more than one family colour per post.
For a series, the family colour changes per post — that is the series' structure, not an inconsistency.

---

## 7. Motion for social (Reels / Stories)

Use only the site's own transitions:

| Beat | Duration | Easing |
|---|---|---|
| Band wipe-in | 1.4 s, `.25 s` delay | `cubic-bezier(.19,1,.22,1)` |
| Numeral rise | 1.1 s, `.05 s` glyph stagger | same |
| Title rise | 1.1 s, `.5 s` delay | same |
| Copy rise/fade | .8 s, `.35 s` delay | same |

**Nothing else.** No bounce, no zoom, no whip pan, no music-video cuts that are not on a cue.

---

## 8. Accessibility for social

- The numeral is `aria-hidden="true"` in the DOM (`hero:207`) — the accessible name comes from the `<h2
  aria-label>`. Keep this pairing in any web version.
- Text on paper is `#0b0b0c` on `#e9e7e0` — a contrast ratio far above AA. Do not substitute `#6d6b65`
  (mute) for body copy.
- The `f 000000` frame counter is decorative — exclude it from alt text.

---

## 9. Platform checklist

- [ ] Canvas at the platform's native resolution, rendered at cell resolution and upscaled ×2 nearest.
- [ ] Only paper + ink + one family colour.
- [ ] Type from the three families only, at the specified sizes/tracking.
- [ ] The band is the hero; the type is the caption.
- [ ] Labels are mono, UPPER, `.07em`, on paper chips.
- [ ] No third easing, no new motion primitive.
- [ ] No gradients, no shadows, no glassmorphism, no rounded-corner cards beyond 2/6 px (and the pill CTA).
