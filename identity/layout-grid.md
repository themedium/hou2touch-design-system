# Hou2Touch — Layout & Grid

**Status:** MEASURED from `tools/hero_index_mock.html`, `tools/landing.css`, `src/template.html`.
No browser was launched; all values are read from source.

---

## 1. The 12-column grid

The hero band and every landing section use the same grid:

```css
.wrap{padding:0 var(--pad);display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--gut)}
```
`tools/hero_index_mock.html:39` — verbatim.

Landing sections use the identical structure without the `.wrap` class:
```css
.sec{counter-increment:sec;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--gut);
  padding:clamp(56px,8vw,128px) var(--pad);border-top:1px solid var(--line)}
```
`tools/landing.css` — verbatim.

### Gutters and margins

| Token | Value | Where |
|---|---|---|
| `--pad` | `clamp(16px,3.9vw,56px)` | `hero:28` / `template:43` |
| `--gut` | `clamp(12px,1.4vw,20px)` | `hero:28` (hero gutter) |
| `--gap` | `clamp(10px,1.4vw,20px)` | `template:43` (site gutter) |
| section padding block | `clamp(56px,8vw,128px)` | `landing.css` |

Note the naming split: **`--gut` in the hero mock and the published pages, `--gap` in the site template** — same 1.4 % rate, different minimum (12 px vs 10 px), different names. Both clamp to a 20 px ceiling: above a ~1429 px viewport the gutter is a fixed 20 px, not 1.4 %. `--pad` likewise ceilings at 56 px above ~1436 px.
The hero band top tick rail uses its own gap: `.band .tk{display:grid;grid-template-columns:repeat(12,1fr);column-gap:var(--gut)}` (`hero:73`).

---

## 2. Hero band structure

```css
.hero{--k:var(--top);position:relative;background:var(--paper);min-height:max(760px,100svh);max-height:1080px;display:grid;
  grid-template-rows:auto auto auto 1fr auto;overflow:hidden;isolation:isolate}
```
`tools/hero_index_mock.html:31` — verbatim.

Five rows, in order:
1. `nav` — 64 px tall (`hero:41`)
2. `meta` — mono meta line (`hero:45`)
3. `lock` — number + title (`hero:55`)
4. `band` — **the generative canvas** (`grid-row:4`, `hero:70`)
5. `foot` — facts / offer / CTA (`hero:85`)

Column assignments (MEASURED, `hero`):

| Element | Column |
|---|---|
| `.nav .brand` | `1/4` (mock) → `1/7` on landing (`landing.css`) |
| `.nav ul` | `5/10` |
| `.nav .sign` | `10/13` |
| `.meta .a` | `1/4` |
| `.meta .b` | `5/9` |
| `.meta .c` | `9/13` |
| `.tt` (title block) | `1/8` mock, `1/13` landing |
| `.tt h1` | `1/8` mock, `1/8` landing |
| `.tt .lead` | `8/13` (landing only) |
| `.foot .fx` | `1/7` mock, `1/10` landing |
| `.foot .off` | `7/10` mock, `1/13` on phone |
| `.foot .cta` | `10/13` |

---

## 3. Section grid (landing)

```css
.sec .sh{grid-column:1/5;position:relative}
.sec .sb{grid-column:6/13;...}
```
`landing.css` — verbatim. Rule: **heading column 1–5, body column 6–13**, with the H2 sticky at `top:24px`.

Section counter — `landing.css`:
```css
.sec .sh::before{content:counter(sec,decimal-leading-zero);display:block;font:500 11px/16px var(--mono);letter-spacing:.07em;color:var(--k,var(--top));margin-bottom:18px}
```
So section numbers are mono, uppercase-tracked, and painted in the page's family colour.

---

## 4. Module chain

```css
.mods{list-style:none;counter-reset:mod;border-top:1px solid var(--ink)}
.mods li{counter-increment:mod;display:grid;grid-template-columns:52px 1fr auto;align-items:baseline;gap:14px;padding:18px 0;border-bottom:1px solid var(--line)}
.mods li::before{content:counter(mod,decimal-leading-zero);font:500 11px/1 var(--mono);color:var(--mute);letter-spacing:.07em}
```
`landing.css` — verbatim.
Grid = **52 px index / flexible title / auto meta**, baseline-aligned. Borders are `--ink` on the outer
chain and `--line` between rows — the outer chain reads as a printed table.

Same pattern in the dark shell for `.dat li` — `src/template.html:137`:
```css
.dat li{counter-increment:c;display:grid;grid-template-columns:44px minmax(0,1fr);...}
.dat li::before{content:counter(c,decimal-leading-zero);font:500 12px var(--mono);color:var(--mute);border-right:1px solid var(--line);margin-right:14px;align-self:stretch;...}
```

---

## 5. Cards & panels

| Component | Grid | Source |
|---|---|---|
| `.pn` node panel | `border:1px solid var(--line2);border-radius:6px` + header/footer rows | `template:117-126` |
| `.cv` review list | `grid-template-columns:96px minmax(0,1fr);gap:18px` | `template:303` |
| `.hero .hf` (dark shell) | `minmax(0,6fr) minmax(0,6fr)` | `template:190` |
| `.hero .hm` (dark shell meta) | `repeat(5,minmax(0,1fr))` | `template:167` |
| `.aud .chips` | flex wrap, `gap:8px` | `landing.css` |
| `.foot dl` (landing facts) | `1fr 1fr 2.4fr 1fr 1fr` | `landing.css` |
| `.pl` plus icon | `14px × 14px`, two 1 px bars | `landing.css` |

Radius vocabulary is tiny: **6 px** panels (`--card-r:6px`), **2 px** chips/tags (`template:349`),
**999 px** pills only on buttons and audience chips (`hero:86`, `landing.css`).

---

## 6. The generative band geometry

```css
.band{position:relative;grid-row:4;min-height:clamp(380px,54svh,640px);border-top:1px solid var(--ink);border-bottom:1px solid var(--line2)}
.band canvas{position:absolute;inset:0;width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges}
```
`tools/hero_index_mock.html:70-71` — verbatim.

The canvas is **absolutely positioned and fills the band**, so the band height is set by CSS
(`min-height` clamp) and the shader is stretched to fit. `image-rendering:pixelated` is what makes the
dither cells hard-edged instead of interpolated.

Band overlays are absolutely positioned in the band coordinate space:
- `.tk` — 12-cell tick rail at the very top (`left:var(--pad);right:var(--pad);top:0;height:7px`)
- `.tl/.tr` labels at `top:16px`, `.bl/.br` at `bottom:12px`
- `.ttl` title block at `bottom:clamp(24px,4.6vh,56px)`

Landing overrides band height — `landing.css`:
```css
.band{min-height:clamp(360px,50svh,600px)}
```

---

## 7. Responsive rules (MEASURED)

**Tablet ≤ 1080 px** (`hero:106-113`): nav links hidden, `.meta .c` → `6/13`, `.tt` → `1/13`,
`.lock` aligns to start, `.foot .fx` → `1/13`.

**Phone ≤ 640 px** (`hero:114-124`):
```css
  :root{--num:clamp(96px,27vw,150px);--ttl:clamp(76px,21vw,140px);--h1:19px}
  .hero{min-height:max(720px,100svh);max-height:none}
  .nav{height:56px}.nav .sign{display:none}
  .meta .c{display:none}.meta .a{grid-column:1/13}
  .band{min-height:104vw}
  .band .tr{display:none}
  .foot .fx .opt{display:none}
  .foot .off{grid-column:1/13;margin-bottom:16px;display:flex;align-items:baseline;gap:12px}
  .foot .cta{grid-column:1/13;justify-self:stretch}
  .foot .cta .btn{flex:1;justify-content:center;padding:0 16px}
```
Note `.band{min-height:104vw}` — on phones the band becomes square-ish rather than a wide strip.

---

## 8. Grid rules to carry into new work

1. **12 columns, fluid gutters, `clamp()` margins** — never fixed px page margins.
2. **Asymmetric splits are the norm**: 1/4–1/5 for labels, 6–8/13 for text. Never 6/6 except in the dark shell's hero.
3. Section headings are **sticky** in column 1–5 while the body scrolls in 6–13.
4. Hairlines are structural: `--ink` for the outer frame of a chain, `--line` between rows.
5. Everything that enumerates uses a **mono decimal-leading-zero counter**.
