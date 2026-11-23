# Hou2Touch — Colour System

**Status:** MEASURED from source. Every value below is quoted with `file:line`.
Rule for the whole system: **ink on paper, never ink-on-ink**.

---

## 1. Two palettes, one system

The site has **two contexts** that must never be confused:

| Context | Background | Text | Source |
|---|---|---|---|
| **Site shell** (dark) | `--bg:#0b0b0c` | `--fg:#efeee9` | `src/template.html:38-40` |
| **Hero band / landing page** (paper) | `--paper:#e9e7e0` | `--ink:#0b0b0c` | `tools/hero_index_mock.html:22-23` |

`tools/landing.css:2-3` forces the *entire* landing page to paper:
```css
html{background:var(--paper)}
body{background:var(--paper)}
```
So course landing pages are **paper-first**; the dark shell is the marketing/utility layer.

---

## 2. Site shell tokens — `src/template.html:38-48` (MEASURED, verbatim)

```css
:root{
  --bg:#0b0b0c; --bg2:#121214; --bg3:#17171a; --paper:#e9e7e0; --paper2:#f4f2ec; --ink:#0b0b0c;
  --fg:#efeee9; --fg8:rgba(239,238,233,.8); --txt:#cfcec9; --mute:#8f8e8a; --dim:#5a5956;
  --line:rgba(239,238,233,.11); --line2:rgba(239,238,233,.22);
  --hou:#e5501e; --td:#7fe7ff;
  --sop:#3d7fd6; --top:#8a63c9;/*RU legacy — retired 2026-11*/ --chop:#45a654; --dat:#c34f9a; --comp:#9a9a96; --sand:#b8a88a;
  --pad:clamp(16px,3.9vw,56px); --gap:clamp(10px,1.4vw,20px);
  --disp:"H2T Bebas","Bebas Neue",Impact,sans-serif;
  --sans:"Inter Tight",system-ui,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,monospace;
  --ease:cubic-bezier(.19,1,.22,1);
}
```
(`src/template.html:38-48`; line 44 not printed in the extraction — treat any `--hgap/--pgap` there as ESTIMATED.)

**Note on `--top`.** The block above is quoted verbatim from `src/template.html`, which is the **RU-legacy**
shell; its `--top` is the retired RU-legacy purple `#8a63c9`. The **canonical** `--top` is **`#65a30d`** (green) —
the value the 33 published EN pages carry. `tools/pipeline/publish.py` marks the RU legacy pages
(`index.html`, `school.html`, `src/template.html`, `courses/*`) as `noindex`. Keep `#8a63c9` documented as legacy so old screenshots remain explicable; never use it in new work.

### Role assignment (MEASURED mapping, roles inferred from usage)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0b0b0c` | page background (near-black, not pure black) |
| `--bg2` / `--bg3` | `#121214` / `#17171a` | raised panels / chip fills (`.op` uses `--bg2`, `src/template.html:84`) |
| `--paper` / `--paper2` | `#e9e7e0` / `#f4f2ec` | hero band paper / raised paper surfaces |
| `--ink` | `#0b0b0c` | **text on paper** — always |
| `--fg` | `#efeee9` | **text on dark** — always |
| `--fg8` | `rgba(239,238,233,.8)` | 80 % fg — secondary text on dark |
| `--txt` | `#cfcec9` | body copy on dark |
| `--mute` | `#8f8e8a` | labels/meta on dark |
| `--dim` | `#5a5956` | tertiary/disabled on dark |
| `--line` | `rgba(239,238,233,.11)` | hairline rule, dark context |
| `--line2` | `rgba(239,238,233,.22)` | stronger rule / inset ring |
| `--hou` | `#e5501e` | **brand orange** — primary CTA hover, brand square, `.btn:hover` |
| `--td` | `#7fe7ff` | TouchDesigner cyan — technical accent (rare) |
| `--sand` | `#b8a88a` | warm neutral, `--k-h2t` accent |
| `--carmin` | `#b3122e` | carmine — only in `en/build.py:115` (`FS_SCALE`) |

### Paper-context line tokens — `tools/hero_index_mock.html:22-23` (MEASURED)
```css
--paper:#e9e7e0;--ink:#0b0b0c;--txt:#2b2a28;--mute:#6d6b65;--dim:#9a988f;
--line:rgba(11,11,12,.12);--line2:rgba(11,11,12,.28);--hou:#e5501e;
```
Same names, inverted semantics: on paper `--line` is **black at 12 %**, `--line2` black at 28 %.

---

## 3. The five node-family colours (MANDATORY)

TouchDesigner operator families are colour-coded. This is the site's structural metaphor.

| Family | Token | Value | Source |
|---|---|---|---|
| CHOP | `--chop` | `#45a654` | `src/template.html:42` |
| TOP | `--top` | `#65a30d` | **canonical** — the 33 published EN pages |
| SOP | `--sop` | `#3d7fd6` | `src/template.html:42` |
| DAT | `--dat` | `#c34f9a` | `src/template.html:42` |
| COMP | `--comp` | `#9a9a96` | `src/template.html:42` |
| — | `--hou` | `#e5501e` | brand orange, **not** a family |
| TOP (RU legacy, retired 2026-11) | `--top` | `#8a63c9` | RU legacy set only (`index.html`, `school.html`, `src/template.html`, `courses/*`; marked `noindex` by `tools/pipeline/publish.py`) |
| — | `--sand` | `#b8a88a` | warm neutral |

Rules:
1. A page/course **owns exactly one** family colour, injected as `--k` (`.hero{--k:var(--top)}`, `tools/hero_index_mock.html:31`).
2. Family colour is used as: the meta-line square (`.meta .a i{background:var(--k)}`, `:47`), the band corner label (`.band .lb.k{color:var(--k)}`, `:83`), the numeral when `?k=1` (`.k1 .num{color:var(--k)}`, `:57`), the section counter in landing CSS (`tools/landing.css:52`).
3. It is **never** used as a large fill. It is a 8–10 px square or a single label. (`src/template.html:84` chips use `--bg2` + `box-shadow` ring, not family colour.)

### Family ↔ course assignment (MEASURED, `en/adapt_1611.py:14-44`)
`chop` = 101, 102, 103, 201, 204, 206, 204_preproduction, 204_production, av, agb, extreme, light;
`top` = 202, 203, 205, 301, modulardesign, me, widerruf, ru/av-performance;
`sop` = 207, 302, 304, 305, course, impressum, privacy-policy, course/1-foundations, course/2-procedural-3d, course/3-interactive-systems.

---

## 4. Contrast rule (hard constraint)

> **Text on paper is always `#0b0b0c`. Text on dark is always `#efeee9`.**

Source: `tools/hero_index_mock.html:23` (`--ink:#0b0b0c`) and `src/template.html:39` (`--fg:#efeee9`).
The shader hard-codes the same pair:
```glsl
const vec3 PAP=vec3(.914,.906,.878),INK=vec3(.043,.043,.047);
```
(`tools/hero_index_mock.html:213`, verbatim) — `PAP = #e9e7e0` (0.914/0.906/0.878 = 233/231/224),
`INK = #0b0b0c` (0.043×255 = 11).

**Never** introduce a third text colour. Body copy on paper is `--txt:#2b2a28` (hero) / `--txt:#cfcec9` (dark shell).

---

## 5. Shader-side colour rules (MEASURED)

From `tools/hero_index_mock.html` `main()`:

| Constant | Value | Use |
|---|---|---|
| `PAP` | `vec3(.914,.906,.878)` | paper base |
| `INK` | `vec3(.043,.043,.047)` | pure ink (default black) |
| graphite | `vec3(.075,.072,.068)` | `FN` (fine) mode ink — "graphite field, type stays pure ink" |
| `gph` | `vec3(.42,.41,.39)` | instrument-layer grey (registration marks, paper dots, reticle ring 2) |
| `K` | family colour uniform | accent ink, applied **only** where `m.y>.5 && m.x>th*.6` |

Key composition rule: `if(m.y>.5&&m.x>th*.6)c=K;` — the accent colour may only appear **inside** dithered ink, never on bare paper. This is what makes the look "one technique".

---

## 6. Do / Do not

**DO**
- One family colour per composition; use it in ≤ 5 places.
- Use `--line` (11–12 %) for rules, `--line2` (22–28 %) for emphasis and inset rings.
- Keep large fields to two values: paper + ink (plus the single accent).

**DO NOT**
- Do not use pure `#000` or pure `#fff` as a field (the system uses `#0b0b0c` / `#e9e7e0`).
- Do not put the family colour on a large area.
- Do not mix `--fg` (light) text with `--paper` background.
- Do not introduce gradients in the palette; the only gradients in the codebase are panel fills
  (`background:linear-gradient(180deg,var(--ink-300),var(--ink-250))`, `src/template.html:117`).
