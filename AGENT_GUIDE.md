# AGENT_GUIDE.md — how to work with this design system

> **This file is not a rulebook.** The rules live in `MASTER_DESIGN_SYSTEM.md`.
> This file tells you **where to look** and **how to read** the material that the
> rules were extracted from — so that your output satisfies the checklist and
> still looks like the site.

---

## 1. What this file is for

The system documents *what* is true: colour tokens, type register, the grid,
the dither, the seam, plates, states, the network diagram, responsive behaviour.
It does **not** document *where* that truth came from. Every rule in
`MASTER_DESIGN_SYSTEM.md` was extracted by accident — an agent opened the right
line of the right file by luck, and wrote down what it saw. An agent arriving
later has no map: it can satisfy every documented rule and still produce work
that reads as generic. The rules tell you what; **this file tells you where to
look and how to read what you find**. An agent that ignores this file will
produce technically compliant, aesthetically wrong work.

**The one-line version:** the docs are the map, the site is the territory, and
the site's own comments are the field notes.

---

## 2. Read order

Work through these in order. Do not skip to the generative folder.

1. **`MASTER_DESIGN_SYSTEM.md`** — pillars P1–P6, rules M1–M15, forbidden
   X1–X12, plus the deviation register in §11. This is the canon and the
   vocabulary.
2. **`identity/`** — colour (`color-system.md`), typography, layout grid,
   composition principles. This is where the token semantics live.
3. **`generative/`** — the 29 motifs with verbatim GLSL. Copy the code; do not
   paraphrase the algorithms.
4. **`motion/`** — the three curves with their roles, the duration vocabulary.
5. **`production/<your-medium>.md`** — the file that governs the medium you
   are actually producing (video / social / print / prompts). Read this *after*
   the identity and motion files, because it is written in their terms.
6. **Then the site** — §3 below. Before producing anything, read the source
   this system was extracted from.

> Where the docs and the site disagree, **`MASTER_DESIGN_SYSTEM.md` §11
> (Deviation register) is authoritative about the difference**. Do not "fix"
> the site to match the docs without an owner decision.

---

## 3. How to explore the site

### 3.1 Where the truth lives

| Location | What it is |
|---|---|
| `en/*.html` | The 33 **green** published pages (the EN set). `en/index.html` is the homepage and the densest single source of truth in the project. |
| `en/index.html` | One file, ~4500+ lines: inline CSS starts at `:54`, inline JS starts at `:2988`. |
| `design-system/` | This repo — the extracted canon. |
| `src/template.html` | The site template (the source the 33 pages are built from). Still carries one known legacy value — see §5. |

### 3.2 Start with the hero — what does it sample?

The single highest-value question when arriving at this site is: **what texture does the hero
shader read?**

```bash
grep -n 'HERO_TEX' en/index.html
# → HERO_TEX = IMG("hero_school")
```

The answer changes everything: the hero is a **halftoned photograph**
(`img/hero_school.webp`), **not** a procedural motif. An agent that assumes "generative field"
will produce a vector-looking result and miss the site's printed-photograph feel entirely.

> **This was a real failure.** Renders produced from the docs alone used procedural motifs and
> did not match the site's character — because the docs describe the 29 motifs, while the hero
> uses a photograph. See `references/renders/NOTES.md` → *Comparison against the live site*.

**The second lesson.** The seam carries **type**: `mix-blend-mode:difference` inverts a line of
display type across the boundary. The seam is not only a boundary — it is a carrier.

```bash
grep -n 'mix-blend-mode' en/index.html
# → three uses; one of them is the seam text
```

Read all three before deciding how a surface crosses a dark↔light junction.

### 3.3 Read the comments first, not the rules

**The site's own comments are in Russian and they are the single most
informative artefact in the project.** They record decisions, dates and
rejected alternatives. They are not noise. A rule says *what*; the comment
says *why*, *when*, and *what was tried first*.

Use these recipes from the site root (`hou2touch_redesign/`):

```bash
# decision records — "реш. 8", "правка заказчика", "согласовано"
grep -n 'реш\.\|согласовано\|правка заказчика' en/index.html

# every block comment opens a section; the comment names the feature and its history
grep -n '/\*' en/index.html

# analogy statements — these carry the design intent ("как в TD", "как у", "как в")
grep -n 'как в TD\|как у\|как в' en/index.html
```

The decision markers in use: `реш. N` (decision number), `правка заказчика`
(client amendment, often with a date), `согласовано` (agreed), and the rule
IDs `C-09`, `T-18`, `M-02`, `f-lc`, `f-seamh` and friends.

Representative comments, verbatim:

- `en/index.html:85` — «доступность: общий фокус — 2 px цветом текста секции
  (крем на тьме, чернила на бумаге); skip-link»
- `en/index.html:1005` — «нажатие — кнопки и ноды на 1 px вниз (у нод рамка
  1 → 1,5 px), фото — scale(.99); системная вспышка тапа выключена;
  hover — только под (hover:hover)»
- `en/index.html:387` — «сумма непрозрачностей = 1 в каждом кадре»
- `en/index.html:1123–1124` — «цвет = семейство (op.color в TD): Hou2Touch →
  SOP, Extreme I и II → CHOP, GLSL → TOP; route1 — DAT; теги Houdini → SOP,
  TouchDesigner → TOP; "песок" не используется.»

### 3.4 Trace a component through its four layers

To understand any component, walk it in **this order**. Skipping a layer is
how you end up with something that satisfies the checklist but behaves wrong.

1. **markup** — the HTML,
2. **CSS rule** — the rule that styles it,
3. **JS behaviour** — what happens on interaction,
4. **the comment that explains it** — why it is like that.

**Worked example — `.pn`, the node panel.**

| Layer | Where | What you find |
|---|---|---|
| Comment | `en/index.html:150` | «хром панелей: `.pn` = средний (шапка `.ph` + подвал `.pf`); `.pn.full` = полный (+ порты, флаги `.fl`); `.pn.lite` = лёгкий (линия-заголовок)» — i.e. **three tiers**, and the tier is a modifier, not a variant class |
| CSS | `en/index.html:151–169` | the `.pn` block and its three modifiers; note the `.pn>.pf` hover rule is inside `@media (hover:hover)` |
| Markup | `en/index.html:2433` and following | `<article class="pn cc rv" … style="--c:var(--sop)">` — the family colour arrives as a **custom property**, not as a colour class |
| Behaviour | in the inline JS | reveal transitions, `.rv` reveal timing |

Two things that example teaches and that no rule table would:

* the tier is expressed by **one** class with a modifier (`pn`, `pn.full`,
  `pn.lite`) — not by three parallel class families;
* family colour is set **per instance** via `--c`, so the same panel can be
  SOP, CHOP or TOP without new CSS.

### 3.5 Look for what is NOT there

Absence is a decision. Before you add a component, check whether the system
deliberately omitted it.

The site currently has:

* **zero real form fields** — no `<input>`, no `<select>`, no `<textarea>`;
* **zero modals**;
* **zero `prefers-color-scheme`** (dark mode is a fixed decision, not a media
  query — see the deviation register);
* exactly **one `:disabled`** rule (a single disabled button, `:1355`).

If a task requires a form or a modal, that is a **new design decision**, not a
reusable pattern. Say so, do not quietly invent one.

### 3.6 Measure, don't guess

Every value in these docs came from a `file:line` in the source. If you need a
number — a radius, a duration, a gap, a contrast ratio — **find it in the
source**. Do not invent a plausible one. A number with a citation is usable by
the next agent; a plausible number is a rumour.

### 3.7 The places where the "feel" is implemented

| What | Where | Note |
|---|---|---|
| Seam generator (live Bayer seam) | `en/index.html:3845–3857` | cell 8 px / 4 px, 12 / 8 rows, scroll-driven in **32 quantised steps** |
| Photo → canvas dither contract | every `<img>` has a sibling `<canvas>` | hover sets `canvas{opacity:0}`; mobile serves a pre-baked `wd*.png` |
| Network dive | `.nw-o` / `.nw-i` | complementary cross-fade; opacity sum = 1 |
| Family colour mapping | `en/index.html:1123` | Hou2Touch → SOP, Extreme I/II → CHOP, GLSL → TOP, route1 → DAT |
| Type register | `en/index.html:1070` | «регистр подписей, как в TD: имена операторов, пути, почта, ники и строки данных — строчными, трекинг 0; суффикс семейства — капс .06em 12 px» |

---

## 4. Recovering the "feel" — the checklist

A compliant piece of work still has to *feel* like this site. These are the
details that carry the feel. Check each one against the source before you
claim your output is on-system.

| Detail | Where | Why it matters |
|---|---|---|
| **Interaction query** | every `:hover` sits inside `@media (hover:hover)` | hover is never a mobile affordance; touch devices get the pressed/active state instead |
| **Press vocabulary** | chrome `translateY(1px)`, photo `scale(.99)` | exactly two opposite motions — chrome sinks, image settles. Never a third motion. |
| **Focus ring** | `2px solid` + `offset 2px`, colour = the section's text colour | one ring, system-wide. Ad-hoc overrides are debt. |
| **Colour as hover reward** | `img` grayscale + sibling `canvas` dither; hover reveals the photo | colour is *earned* by hovering, never given for free. |
| **Dive invariant** | sum of opacities = 1 in every frame | the network dive never loses or double-counts transparency |
| **Numeric register** | `tabular-nums` everywhere | counters never jitter when they tick |
| **Type register** | lowercase for operator names, paths, mail, nicks, data strings; tracking 0; family suffix in caps, `.06em`, 12 px | this is exactly what makes the site read as an *instrument* rather than a website |
| **Touch minimums** | 44 / 48 / 56 px | three tiers for three densities; do not invent a fourth |
| **State classes** | `.on .open .stuck .dv .rt .paused .in` | state is always a class, never an inline style — otherwise it cannot be transitioned or asserted on |
| **Mobile dither off** | `.wt canvas{display:none}` + pre-baked `wd*.png` | there is no hover on touch, so the halftone is baked at build time |
| **Seam ramp is not monotone** | by construction | see §5 — do not "correct" it |

---

## 5. Traps — do not "fix" these

Each of these looks like a bug and is not. Fixing them without an owner
decision breaks the system.

| Trap | What an agent might wrongly do | Correct action |
|---|---|---|
| `#8a63c9` (purple TOP) | "correct" it to the canonical TOP colour `#65a30d` everywhere | `#8a63c9` is **RU legacy, retired**. The canonical TOP is `#65a30d`. `src/template.html` still carries the old value — that is a known deviation, recorded, not an oversight to patch. |
| `--gut` vs `--gap` | merge them into one token | Two different tokens on purpose: `--gut` (hero, min 12 px) vs `--gap` (site template, min 10 px). One **1.4 %** rate distinguishes them. Merging loses it. |
| `--sand:#b8a88a` | "use the sand colour" somewhere | `--sand` is declared and **unused** — a **dead token**, must-remove. It is also explicitly excluded by the family-colour rule («"песок" не используется»). |
| `--dim:#5a5956` | ship it as a body text colour | `--dim` is **below WCAG AA** (3.2:1). Recorded as defect D1. Do not use it for text that must be read; raise it or leave the defect documented. |
| Seam ramp not monotone | sort/fix the ramp so it brightens evenly | The ramp is **NOT monotone by construction** — that is the intended texture. |
| `.edge` / `--dedge` | look for a sprite file to edit | `.edge` **is** present at `src/template.html:587`, and there is **no sprite file** — `--dedge` is a runtime `toDataURL()`. Edit the generator, not an asset. |
| Legacy pages | treat them as broken | `publish.py` publishes the 33 green EN pages and marks legacy pages `noindex` — that is intentional. |
| No dark mode | add `prefers-color-scheme` | The site has **zero `prefers-color-scheme`**. Dark mode is a fixed decision (defect D5), not a missing feature. |

---

## 6. Before you claim work is done

Run both gates and quote their output in your report:

```bash
node tools/verify_docs.mjs                 # → GATE_PASS  (docs canon, 42 checks)
node references/renders/verify_render.mjs  # → GATE_PASS  (4 canon renders, 15 gates)
node references/renders/photo_field_verify.mjs  # → GATE_PASS  (photographic path)
node references/renders/parity_hero_verify.mjs  # → GATE_PASS  (hero parity vs GPU)
```

Then state explicitly:

1. **Which checks you did NOT verify** — typically: the rendered look, live
   browser behaviour, measured contrast. Do not imply they were checked.
2. **The medium you produced for** and **which `production/<medium>.md`
   governed it**.
3. **Any decision you made that the source did not settle** — with the
   `file:line` you based it on, or an explicit statement that you chose.

If you changed nothing under `design-system/`, say so and quote the gate output
that proves the canon is still intact.

---

## 7. Honest limits of this system

Stated plainly, because an agent that does not know these will over-promise:

* **No particle simulation exists.** The engine is stateless per-pixel: the
  output is a pure function of position and parameters. There is no history,
  no state, no integrator.
* **No audio anywhere.** Not in the generative engine, not in the video
  guidelines, not in the site.
* **Blender and After Effects portability is principles-only.** No resolutions,
  no fps, no export settings, no codec — translate the *rules*, then decide the
  technical settings yourself.
* **The renders in `references/renders/` HAVE been compared to the live site**
  (2026-11-23, see `references/renders/NOTES.md`). Two results, both load-bearing:
  * **The seam matches exactly.** The live canvas at 1377 px viewport is 173×12
    at CSS 96 px; solving the scroll offset in 1/32 steps reproduced all 12 rows
    with error 0 at `s = 2/32`. The canonical renders use `s = 0` because §12
    requires a static state for print.
  * **The hero does not match in kind, and cannot.** The site's hero samples a
    photograph and is **not 1-bit**: 795 unique colours, exact `#e9e7e0` on
    0.09 % of pixels, exact `#0b0b0c` on 0.00 % (the darkest value ever written
    is `#16191f`), plus 4.5 % orange. The canonical 1-bit system and the live
    hero are **two different aesthetic objects**. Both are reproducible:
    `parity_hero_1439x739.png` reproduces the site (MAE 4.02 per channel, 94.7 %
    of pixels within 12); the four canon renders reproduce the system.

And the deepest limit of all: this system was extracted from one site, by
agents, in the absence of a designer-of-record. Where it is silent, the site
is the tiebreaker — and where the site is silent too, ask.

---

## 8. If you are producing a render

Everything above is about reading. This section is about making, and it exists
because every trap below was hit for real while building `references/renders/`.

### 8.1 A passing gate is not a good picture
The verifier checks tone count, upscale integrity, accent coverage, quiet zones,
seam fidelity. It does **not** judge composition. Four renders passed every gate
while being visually wrong in ways only the eye caught:

| Symptom | What it looked like | Root cause |
|---|---|---|
| straight vertical field edge | a paper column butted against the field | the field was cut, not dissolved — violates P6 |
| symmetric accent | a literal cross, or a perfect bar | the accent was *drawn*, not *carved from the field* |
| slab instead of contour | rectangular blocks with right angles | motif produced wide solid bands, not thin lines |
| barcode ladder | 12 evenly pitched rules | pitch ignored the density it was meant to encode |

**Always look at the output.** Open the PNG. If you cannot describe the
composition in one sentence, it is not finished.

### 8.2 The gates that catch these (and why they exist)
`verify_render.mjs` now enforces, in addition to the tonal rules:

1. **No straight field edge** — fails if one x-index is the paper→field
   transition on >25 % of rows spanning ≥30 % of the height. The fix is a
   **Bayer dissolve**: raise the threshold 1→0 over ~16 cells so the field
   enters cell by cell through the ordered matrix.
2. **Large form** — at least one connected ink region ≥2000 cells. A field that
   dissolves into speckle is not a composition.
3. **Accent symmetry, no aspect loophole** — fails at ≥95 % self-similarity
   under 180° rotation or either mirror, *regardless of bbox shape*. A long thin
   symmetric bar is as geometric as a cross.
4. **Seam is proved, not asserted** — within the seam band, the first-ink row
   index per column must have std-dev ≥1 cell. A real Bayer ramp varies
   (measured 20.9); a straight cut would be constant.

### 8.3 Choose the motif by form, not by subject
Motif choice is a **composition** decision. The catalogue maps motifs to courses;
it does not tell you which survives at your size.

| Motif | Gives | Use it when |
|---|---|---|
| `shader` (interference) | large closed rings, thin stroke | A4 poster, hero-scale surfaces — anything needing one big form |
| `chladni` | large lobes, or nodal bands | square/vertical formats; accent can follow a nodal line |
| `terrain` | many small closed contours | small carriers only — at A4 it reads as broken blocks |
| photographic halftone | printed-photograph feel | when the surface must feel like a print, not a diagram |

A4 poster built on `terrain` failed twice — first as CRT scanlines, then as
rectangular blocks — before the motif was replaced with interference. **Fixing
the transcription was not the fix; changing the motif was.**

### 8.4 Never sweep parameters
A previous attempt burned its entire budget across 16 tuning scripts and left
the poster with **zero accent cells**. Pick one principled value by arithmetic,
render once, read the printed numbers, adjust by reasoning. If three attempts
fail, report with numbers instead of brute-forcing.

Example of arithmetic that worked: field 655 cells wide ÷ 5 rings = 131 cells
per period → nodal lines ~64 cells apart.

### 8.5 Colour space: the reference is Display-P3
Screenshots and canvas captures of the site store **Display-P3** bytes, not
sRGB. Verified arithmetically: P3→sRGB of the reference returns the shader's own
constants `PAP=(.914,.906,.878)` and `mix(PAP,ORG,.9)` exactly.

Consequence: if you sample a colour from a site screenshot with an sRGB tool you
will get the wrong number. Convert before comparing, and apply the same encode
when reproducing the hero.

### 8.6 Capturing the site as a reference
The local dev server (`127.0.0.1:8898`) and GitHub Pages both served the hero
canvas uninitialised (300×150) because the page's hero block runs on a timer
that a background tab throttles. What worked instead: **execute the site's own
fragment shader** in a fresh canvas, with uniforms read from the page
(`C = max(3, round(H/170))`, `P = .6`, `B` = bottom of the facts row + 12).

Do not fake a reference by screenshotting a fallback state. Verify the canvas is
at its real size (`canvas.width` equals `clientWidth`) before trusting it.
