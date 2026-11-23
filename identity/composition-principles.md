# Hou2Touch — Composition Principles

**Status:** MEASURED inputs, derived principles. Every rule traces back to a source line.

---

## 1. The one-line identity

> **Black ink on paper, one node-family colour, ordered dither, a 12-column grid, three type voices,
> and a lot of empty space.**

Everything below elaborates that.

---

## 2. Principle 1 — The field is the brand

`tools/hero_index_mock.html:9-10` (the project's own words):
> `One engine, one technique (1-bit ordered dither, ink + family colour on paper); the course only supplies number, title, family colour, motif.`

The generative band is **the largest single element** of every hero:
```css
.band{...min-height:clamp(380px,54svh,640px);...}
```
(`hero:70`) — 54 % of the viewport height at desktop.

**Rules**
- One field per composition. Never two side by side.
- The field is 2D and analytic; it is not an image, not a video, not a render.
- The type sits **on paper above the band**, not inside it.

---

## 3. Principle 2 — Two values, one accent

The shader's entire output space:
```glsl
if(m.x>th)c=ink;
if(m.y>.5&&m.x>th*.6)c=K;
```
(`hero:303-304`)

- `PAP` = paper, `INK` = ink, `K` = the family accent.
- The accent requires 60 % of the ink threshold → it can never flood.
- Fine mode caps solid ink at `.95` — "no dead-black slabs" (`hero:306`).

**Rules**
- Never introduce a third colour into a field.
- Never let the accent exceed ~5 % of the frame.
- Never render continuous grey.

---

## 4. Principle 3 — Print, not screen

The engine is designed around a fixed physical dot:
- cell = 2 CSS px (`CELL`, `hero:206`)
- Bayer matrix at the cell, not the pixel (`b8(gl_FragCoord.xy)`, `hero:299`)
- `devicePixelRatio` deliberately unused
- `image-rendering:pixelated` on upscale (`hero:71`)
- the paper-dot grid at 7 px (`hero:312`)
- the section-edge sprite at 32 px = 2 × the 16 px Bayer pitch (`src/template_v16.html:555`)

**Rules**
- Dither pitch is a design constant (16 px), not an accident.
- Upscale by integer factors only.
- Anything that touches the band must align to the 16 px grid.

---

## 5. Principle 4 — The node metaphor is structural, not decorative

The five family colours (`src/template.html:42`) are:
`--chop #45a654`, `--top #8a63c9`, `--sop #3d7fd6`, `--dat #c34f9a`, `--comp #9a9a96`.

They are used as:
- an 8 px square in the meta line (`hero:47`)
- the numeral colour in the `?k=1` variant (`hero:57`)
- the bottom-right label chip (`hero:83`)
- the node-panel family badge (`template:124`)
- the section counter on landing pages (`landing.css`)

**The metaphor is deeper than colour.** The **content** is a node graph:
- motif 23 draws a chain of nodes on a baseline with connectors;
- the `.mods` list is the same chain as a UI component;
- the `.pn` panel is a TouchDesigner node mock;
- motif 17 is a modular rack;
- motif 20 is a DMX console;
- motif 2 is a media-server output wall.

**Rules**
- A page owns one family. It never switches.
- Graphic elements that "mean something" should read as node-graph structure: chains, panels, links,
  cables, grids of instances.

---

## 6. Principle 5 — Three type voices, never mixed

| Voice | Face | Role | Tracking |
|---|---|---|---|
| Display | H2T Bebas | numerals, titles, marquee | ≈ 0, UPPER, `lh .8` |
| Text | Inter Tight | body, headings, prices | `−.015`…`−.035em`, sentence case |
| Label | JetBrains Mono | every machine readout | `+.07em`, UPPER, 10–12 px |

**Rules**
- One voice per line.
- The mono voice is the "instrument readout" — it labels, counts, and annotates. It never carries prose.
- Display is always UPPER. Text is always sentence case.

---

## 7. Principle 6 — Instrument the surface

Fine mode adds a layer of technical marks (`hero:308-322`):
- paper dots
- a 12-column registration grid
- a horizontal rule at 1/3 and 2/3
- a reticle circle with a dashed inner ring and a crosshair
- a live frame counter `f 000000`

The whole site does the same in other media:
- the label chips at the band's corners
- the 12-cell tick rail
- the fixed timeline strip (`.tlb`, `template:215`)
- the mono `decimal-leading-zero` counters (`.dat li`, `.mods li`, `.sec .sh::before`)
- the node panel header/footer strips

**Rule:** a surface should look *measured*, not decorated. Every mark on it should be a label, a tick, a
rule, or a counter.

---

## 8. Principle 7 — Layering is physical

Three layers are stacked with real z-order and real material behaviour:

| Layer | Technique | Source |
|---|---|---|
| The field | WebGL canvas, `position:absolute; inset:0` | `hero:70-71` |
| The knockout | the title's glyphs + halo clear the field back to paper | `hero:322` |
| The overlay | DOM chips with `background:var(--paper)` on top | `hero:77` |

**Rules**
- The label chip is a *paper sticker* on a print — it has a paper background, not a translucent tint.
- The title is knocked out of the field, not laid over it.
- Nothing is blurred except the two `backdrop-filter` surfaces (the sticky nav and the timeline strip).

---

## 9. Principle 8 — Enumerate, don't bullet

Everything countable uses a mono, decimal-leading-zero, tracked counter:
```css
.dat li::before{content:counter(c,decimal-leading-zero);font:500 12px var(--mono);color:var(--mute);border-right:1px solid var(--line);margin-right:14px;align-self:stretch;display:flex;align-items:center}
```
(`template:138`)

**Rules**
- Numbered lists get a counter, not a bullet.
- The counter is separated by a hairline rule (`border-right:1px solid var(--line)`).
- The counter is mute-coloured; the item is ink.

---

## 10. Principle 9 — Whitespace is a component

The site's empty paper is load-bearing:
- the hero has a 5-row grid with a `1fr` row for the band (`hero:31`);
- section padding is `clamp(56px,8vw,128px)` (`landing.css`);
- headings are limited to `12ch` (`landing.css`) and `22ch` for the H1;
- body copy is capped at `66ch`.

**Rules**
- Measure caps: 12ch for a heading, 22ch for an H1, 58ch for a lead, 66ch for a body.
- Do not fill the frame. The band's own field is half the page; the type is a numeral and a title.

---

## 11. Principle 10 — One motion language

One easing (`cubic-bezier(.19,1,.22,1)`), durations 0.3–1.4 s, reveals one-shot, type rises, large
surfaces wipe, pointer = local Gaussian disturbance. See `motion/motion-principles.md`.

**Rules**
- Never introduce a second easing.
- Never dissolve.
- Never let the field stop.

---

## 12. The composite check

A composition belongs to the system if all seven answers are yes:

1. 1-bit field + at most one accent?
2. Ordered (not stochastic) dither?
3. Dot pitch on a 16 px grid?
4. Exactly three type voices?
5. 12 columns, 3.9 % margins, 1.4 % gutters?
6. One easing, durations 0.3–1.4 s?
7. Accent ≤ 5 %; text on paper exactly `#0b0b0c`?

---

## 13. Anti-principles — what the system would never do

| Anti-pattern | Why it breaks the identity |
|---|---|
| A gradient anywhere in the palette | The palette is flat: paper, ink, one accent |
| A soft shadow on a card | The site uses `inset` rings, not shadows |
| A colour photo or 3D render in the band | The field is procedural and flat |
| A glassmorphic panel | The only `backdrop-filter` is on two chrome strips |
| Rounded cards above 6 px | The radius vocabulary is 2 / 6 / 999 (pill only) |
| A second easing | One curve defines the whole motion |
| A continuous-tone gradient image | 1-bit only |
| Motion that loops with a visible jump | The field's cues are continuous |
| Colour used as an information channel | The accent is decorative-at-most; hierarchy is made with weight and size |
