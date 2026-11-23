# Hou2Touch — Typography

**Status:** font files MEASURED (fontTools `name` table), weights/scale MEASURED, tracking values MEASURED where quoted.

---

## 1. The three families

| Role | CSS stack | Source |
|---|---|---|
| Display | `--disp:"H2T Bebas","Bebas Neue",Impact,sans-serif` | `src/template.html:45` |
| Text | `--sans:"Inter Tight",system-ui,sans-serif` | `src/template.html:46` |
| Label / mono | `--mono:"JetBrains Mono",ui-monospace,monospace` | `src/template.html:47` |

The hero mock uses the same stacks minus the Bebas Neue fallback:
`--disp:"H2T Bebas",Impact,sans-serif;` (`tools/hero_index_mock.html:26`).

---

## 2. Font files on disk — `fonts/` (MEASURED via fontTools)

| File | Family name | Subfamily | unitsPerEm |
|---|---|---|---|
| `fonts/h2t-bebas.woff2` | H2T Bebas | — | (woff2; metrics identical to the .otf) |
| `fonts/h2t-bebas.otf` | **H2T Bebas** | Bold | **1000** |
| `fonts/c07b757a71a19ac97cc9364f87e15d46.otf` | **Bebas Neue** | Bold | **1000** |
| `fonts/bac5026d1c2ab786d3abee509cddf656.ttf` | Bebas Neue | Regular | **1000** |

`@font-face` declaration — `src/template.html:31` (verbatim):
```css
@font-face{font-family:"H2T Bebas";src:url({{FONTS}}h2t-bebas.woff2) format("woff2"),url({{FONTS}}h2t-bebas.otf) format("opentype");font-weight:100 900;font-display:swap}
```
Hero mock variant — `tools/hero_index_mock.html:20` (verbatim):
```css
@font-face{font-family:"H2T Bebas";src:url(../fonts/h2t-bebas.woff2) format("woff2");font-weight:700;font-display:block}
```
Note the difference: the site uses `font-display:swap` with a **variable weight range `100 900`**;
the hero mock pins `font-weight:700` and uses `font-display:block` (so the numeral never flashes in a fallback).

**upem = 1000** for all display faces → 1 unit = 1/1000 em. This matters when re-creating
display type: cap heights and tracking must be scaled against 1000-unit em, not 2048.

### Web fonts loaded from Google (network) — `tools/hero_index_mock.html:17`
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
```
→ Inter Tight 400/500/600, JetBrains Mono 400/500. Only 400/500/600 exist — **never set 700 on Inter Tight**.

---

## 3. Type scale

### 3.1 Static scale — `en/build.py:110-116` (MEASURED, verbatim)

```python
FS_SCALE = (
    '--fs-2xs:11px;--fs-xs:12px;--fs-s:14px;--fs-m:16px;--fs-l:20px;'
    '--fs-xl:24px;--fs-2xl:28px;--fs-3xl:32px;--fs-4xl:40px;--fs-5xl:56px;'
    '--fs-6xl:88px;--fs-7xl:112px;'
    '--lh-tight:1.15;--lh-body:1.5;'
    '--card-r:6px;--chip-h:24px;--carmin:#b3122e;--hou-hover:#f0602d'
)
```
Injected on every page that does not already carry it — `en/build.py:2093-2094`:
```python
if '--fs-2xs:' not in t:
    t = t.replace('</head>', FS_SCALE_STYLE + '\n</head>', 1)
```

| Token | px | Typical use |
|---|---|---|
| `--fs-2xs` | 11 | mono micro-labels |
| `--fs-xs` | 12 | tags, chips |
| `--fs-s` | 14 | secondary |
| `--fs-m` | 16 | body |
| `--fs-l` | 20 | |
| `--fs-xl` | 24 | |
| `--fs-2xl` | 28 | |
| `--fs-3xl` | 32 | |
| `--fs-4xl` | 40 | |
| `--fs-5xl` | 56 | |
| `--fs-6xl` | 88 | section headline |
| `--fs-7xl` | 112 | hero display |

**Active use vs defined-but-unused.** `FS_SCALE` defines **twelve** steps (11 → 112 px), while the site
header comment claims "6 ступеней" — the real scale is wider than that comment says. **In active use:**
`--fs-2xs` (11 px, mono micro-labels), `--fs-xs` (12 px, tags/chips), `--fs-s` (14 px, secondary),
`--fs-m` (16 px, body). **Defined but not observed in active use** on the pages inspected: `--fs-l`
(20), `--fs-xl` (24), `--fs-2xl` (28), `--fs-3xl` (32), `--fs-4xl` (40), `--fs-5xl` (56) — the large
display sizes are handled by the fluid clamps in §3.2 / §3.3, not by these static steps. Keep all twelve
defined (a new composition may use them), but do not treat the unused six as part of the live
vocabulary.

Line heights: `--lh-tight:1.15` for display headings, `--lh-body:1.5` for body.
Radius `--card-r:6px`, chip height `--chip-h:24px`, brand hover `--hou-hover:#f0602d`.

### 3.2 Hero fluid scale — `tools/hero_index_mock.html:28-32` (MEASURED, verbatim)

```css
  /* type scale (fluid, 390 → 1440 → 1920) */
  --num:clamp(104px,11.5vw,220px);
  --ttl:clamp(96px,15vw,280px);
  --h1:clamp(22px,2.3vw,36px);
  --ease:cubic-bezier(.19,1,.22,1);
```
Phone overrides — `tools/hero_index_mock.html:120`:
```css
  :root{--num:clamp(96px,27vw,150px);--ttl:clamp(76px,21vw,140px);--h1:19px}
```

### 3.3 Landing-page fluid scale — `tools/landing.css` (MEASURED, verbatim)

```css
.tt h1{font:500 clamp(28px,3.1vw,48px)/1.08 var(--sans);letter-spacing:-.035em;color:var(--ink);max-width:22ch}
.tt .lead{margin-top:clamp(14px,1.8vh,22px);font:400 clamp(16px,1.25vw,19px)/1.5 var(--sans);color:var(--txt);max-width:58ch;letter-spacing:-.005em}
.sec h2{font:500 clamp(30px,3.3vw,52px)/1.02 var(--sans);letter-spacing:-.035em;color:var(--ink);text-wrap:balance;max-width:12ch;position:sticky;top:24px}
.sec .sb{grid-column:6/13;font:400 clamp(16px,1.2vw,18px)/1.6 var(--sans);color:var(--txt);max-width:66ch}
.sec h3{font:600 clamp(18px,1.4vw,21px)/1.25 var(--sans);letter-spacing:-.015em;color:var(--ink);margin-top:1.8em}
.mods .mt{font:500 clamp(18px,1.6vw,24px)/1.2 var(--sans);letter-spacing:-.02em;color:var(--ink)}
.prog summary h3{margin:0;font:500 clamp(20px,1.9vw,28px)/1.15 var(--sans);letter-spacing:-.025em}
```

---

## 4. Tracking and case rules (MEASURED)

| Context | Declaration | Tracking | Case |
|---|---|---|---|
| Mono micro-label | `.mono{font:500 11px/16px var(--mono);letter-spacing:.07em;text-transform:uppercase}` (`hero:37`) | `.07em` | UPPER |
| Hero band label | `.band .lb{...font:500 10px/14px var(--mono);letter-spacing:.07em;text-transform:uppercase}` (`hero:77`) | `.07em` | UPPER |
| Node panel header | `.pn>.ph{...font:500 12px/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase}` (`template:118`) | `.06em` | UPPER |
| Node panel footer | `.pn>.pf{...letter-spacing:.06em;text-transform:uppercase}` (`template:126`) | `.06em` | UPPER |
| Buttons | `.btn{...font:500 12px/1 var(--mono);letter-spacing:.07em;text-transform:uppercase}` (`hero:86`) | `.07em` | UPPER |
| Marquee | `.marq-t span{font:700 40px/1 var(--disp);text-transform:uppercase;padding-right:.3em}` (`template:311`) | padding `.3em` | UPPER |
| Hero display title | `.band .ttl h2{font:700 var(--ttl)/.8 var(--disp);letter-spacing:.004em;text-transform:uppercase}` (`hero:81`) | `.004em` | UPPER |
| Hero numeral | `.num{font:700 var(--num)/.8 var(--disp);letter-spacing:-.005em;...font-variant-numeric:tabular-nums}` (`hero:57`) | `-.005em` | tabular |
| H1 sans | `.tt h1{font:500 var(--h1)/1.2 var(--sans);letter-spacing:-.025em}` (`hero:58`) | `-.025em` | sentence |
| Body | `body{font:400 16px/1.5 var(--sans)}` (`hero:36`) | default | sentence |
| Landing h2 | `letter-spacing:-.035em` | tight | sentence |
| Landing h3 | `letter-spacing:-.015em` | tight | sentence |

### Two tracking families — the core typographic idea
1. **Display = positive/neutral tracking, ALL CAPS, tight leading (`.8`)** — Bebas is a condensed
   caps face, so leading is set *below* 1 (`.8`) and tracking ≈ 0.
2. **Text = negative tracking (`-.015em` → `-.035em`), sentence case** — Inter Tight gets tighter
   as size grows.
3. **Labels = `+.07em` tracking, UPPER, mono, 10–12 px** — a third voice, always machine-like.

**Never** set a positive-tracking body paragraph or a negative-tracking mono label.

---

## 5. Weight policy

| Family | Weights used | Source |
|---|---|---|
| Inter Tight | 400, 500, 600 | Google Fonts URL (`hero:17`) |
| JetBrains Mono | 400, 500 | Google Fonts URL (`hero:17`) |
| H2T Bebas | 700 (hero mock), 100–900 declared | `hero:20`, `template:31` |

`font-weight:700` is used on display type (`hero:57, 81`), on the marquee (`template:311`) and on the
mask renderer (`x.font=\`700 ${fs}px "H2T Bebas"\``).

---

## 6. Optical adjustments (MEASURED, do not skip)

These are not decoration — they are what makes the caps look right:

```css
/* numeral: pull left, kill the sidebearing, clip so descenders aren't cut */
.num{...margin:0 0 clamp(10px,1.6vh,20px) -.035em;font-variant-numeric:tabular-nums;display:block;white-space:nowrap}
.num span{display:inline-block;clip-path:inset(-.3em -.1em 0 -.1em)}
.num span em{display:inline-block;font-style:normal}
/* title: clip generous box, pull left by 3% of em */
.band .ttl h2{...margin-left:-.03em;clip-path:inset(-.4em -.2em -.15em -.2em);text-wrap:balance}
```
(`tools/hero_index_mock.html:57-58, 81` — verbatim)

The `clip-path` insets exist because Bebas at `line-height:.8` clips its own ascenders/descenders.
Any re-implementation in AE/Blender must add equivalent overshoot.

---

## 7. Line-length rules (MEASURED)

| Element | max-width | ch |
|---|---|---|
| Hero H1 (mock) | `30ch` | `hero:58` |
| Landing H1 | `22ch` | `landing.css` |
| Landing H2 | `12ch` | `landing.css` |
| Landing lead | `58ch` | `landing.css` |
| Landing section body | `66ch` | `landing.css` |

Section H2 uses `text-wrap:balance`; body copy does not.

---

## 8. What to reproduce in a new composition

- Display numeral/title in **Bebas caps**, `lh .8`, tracking ≈ 0, optical left-pull `-.03em`.
- Body in **Inter Tight 400/500**, tracking `-.015`…`-.035em`, leading `1.5–1.6`, measure ≤ 66ch.
- Every label in **JetBrains Mono 500, 10–12 px, UPPER, +.07em** — mono labels are the "instrument readout" layer.
- Never mix the three families in one line.
