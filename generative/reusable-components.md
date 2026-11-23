# Hou2Touch — Reusable Components

**Status:** MEASURED. Every component below is documented from the source file and line given.
Components marked **★** are the load-bearing primitives — a new composition should reuse them verbatim.

---

## 1. The hero section (the signature component)

**Source:** `tools/hero_index_mock.html` (CSS `:31-124`, DOM template `:207-221`, JS `:686-826`).

### 1.1 Anatomy

```
<section class="hero" style="--k: var(--top)" data-m="streams" data-id="202">
  <nav class="wrap nav mono">        row 1 — brand | links | sign in        (64 px)
  <div class="wrap meta mono">       row 2 — ● Course 202 / TOP | software | level
  <div class="wrap lock">             row 3 — big numeral + title + lead
  <div class="band">                  row 4 — the generative canvas + overlay
      <canvas></canvas>
      <div class="ov">                 — pointer-events:none
        <div class="tk">              — 12-cell tick rail
        <span class="lb tl">          — top-left label:  <op> <u>COMP</u>
        <span class="lb tr">          — top-right label:  f 000000 · 60 fps
        <span class="lb ret">         — loupe readout (fine mode only)
        <span class="lb br k">        — bottom-right label: ● TOP · streams
      </div>
      <div class="ttl">               — numeral + display title, knocked out of the field
        <div class="num">…</div>
        <h2>…</h2>
      </div>
  </div>
  <div class="wrap foot">             row 5 — facts | price | CTA
  </div>
</section>
```

### 1.2 The five required layers
1. **Meta line** — family-coloured 8 px square + `Course 202 / TOP` in mono caps.
2. **Lockup** — a Bebas numeral (`--num`) with the title and lead.
3. **Generative band** — the canvas. The band's top border is `--ink` (stronger than the rest of the page);
   the bottom border is `--line2`.
4. **Overlay labels** — mono, paper-background chips, at all four corners.
5. **Footer** — three facts, the price, and the CTA pair.

### 1.3 Overlay label CSS (verbatim, `hero:73-83`)

```css
.band .tk{position:absolute;left:var(--pad);right:var(--pad);top:0;height:7px;display:grid;grid-template-columns:repeat(12,1fr);column-gap:var(--gut)}
.band .tk i{border-left:1px solid var(--ink);height:7px}
.band .tk i:last-child{border-right:1px solid var(--ink)}
.band .lb{position:absolute;padding:3px 7px;background:var(--paper);color:var(--ink);font:500 10px/14px var(--mono);letter-spacing:.07em;text-transform:uppercase}
.band .lb u{text-decoration:none;color:var(--mute)}
.band .tl{left:var(--pad);top:16px}.band .tr{right:var(--pad);top:16px}
.band .bl{left:var(--pad);bottom:12px}.band .br{right:var(--pad);bottom:12px}
.band .lb.k{color:var(--k)}
```

**The label is a paper chip** — `background:var(--paper)` on top of the generative field. It reads as a
physical sticker laid over a print. This is the site's signature "layering" device: DOM over shader.

The 12-cell tick rail is measured by JS and fed to the shader as `GR`, so the **instrument grid in the
shader lines up with the DOM rail** (`hero:800-802`):
```js
{const tk=s.querySelectorAll('.band .tk i');if(tk.length>1){const a=tk[0].getBoundingClientRect(),b=tk[1].getBoundingClientRect(),z=tk[tk.length-1].getBoundingClientRect();sc.gr=[(a.left-br.left)/br.width,(b.left-a.left)/br.width,(z.right-br.left-1)/br.width];}}
```

### 1.4 CTA pair (verbatim, `hero:86-89`)

```css
.btn{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 26px;border-radius:999px;font:500 12px/1 var(--mono);letter-spacing:.07em;text-transform:uppercase;border:1px solid var(--line2);color:var(--ink);text-decoration:none;white-space:nowrap;transition:background .3s var(--ease),color .3s var(--ease)}
.btn.rec{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.btn.rec i{width:7px;height:7px;background:var(--hou);border-radius:50%}
.btn:hover{background:var(--hou);border-color:var(--hou);color:#fff}
```
Two buttons: a **filled "recommended"** button (ink background, a 7 px orange dot inside) and a
**ghost** button. Both become orange on hover. Height 52 px, pill radius 999 px.

---

## 2. Section label `.lbl` ★

**Source:** `src/template.html:83` (verbatim):
```css
.lbl::after{content:"";flex:1;min-width:16px;height:1px;background:var(--line)}
```
A label whose trailing hairline extends to fill the remaining width (`flex:1`, min 16 px, 1 px,
`--line`). This is the "instrument readout" rule — used above every section in the dark shell.

The landing-page equivalent is the section counter — `tools/landing.css`:
```css
.sec .sh::before{content:counter(sec,decimal-leading-zero);display:block;font:500 11px/16px var(--mono);letter-spacing:.07em;color:var(--k,var(--top));margin-bottom:18px}
```
**Same idea, two expressions**: a rule in the dark shell, a number in the paper landing.

---

## 3. Node panel `.pn` ★

**Source:** `src/template.html:117-131` (verbatim excerpts):
```css
.pn{position:relative;border:1px solid var(--line2);border-radius:6px;background:linear-gradient(180deg,var(--ink-300),var(--ink-250))}
.pn>.ph{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);font:500 12px/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--txt);white-space:nowrap;min-width:0}
.pn>.ph .fl b{width:16px;height:16px;border-radius:2px;box-shadow:inset 0 0 0 1px var(--line2);font:500 12px/16px var(--mono);text-align:center;color:var(--mute)}
.pn>.pf{display:flex;justify-content:space-between;gap:12px;padding:8px 14px;border-top:1px solid var(--line);font:500 12px/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mute);white-space:nowrap}
.pn.lite>.ph{padding:0 0 10px;border-bottom:1px solid var(--line2)}
```
A TouchDesigner node mock: header with a **family badge** (`.fl b` — a 16 px square containing the family
letter, `CHOP`/`TOP`/`SOP`/`DAT`/`COMP`), a body, and a footer strip.

`--ink-300` / `--ink-250` are panel gradient stops not printed in the token extraction — **flagged as
unresolved** (they live in a rule not captured by the `:root` grep).

---

## 4. Programme accordion `.ix-mod` / `.prog details` ★

**Source:** `tools/landing.css` (verbatim):
```css
.prog details{border-top:1px solid var(--ink)}
.prog details:last-child{border-bottom:1px solid var(--ink)}
.prog summary,.faq summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:1fr auto 28px;align-items:baseline;gap:18px;padding:22px 0}
.prog summary::-webkit-details-marker,.faq summary::-webkit-details-marker{display:none}
.prog summary h3{margin:0;font:500 clamp(20px,1.9vw,28px)/1.15 var(--sans);letter-spacing:-.025em}
.prog .mm{font:500 11px/1 var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--mute);white-space:nowrap}
.pl{position:relative;width:14px;height:14px;align-self:center;justify-self:end}
.pl::before,.pl::after{content:"";position:absolute;left:0;top:6.5px;width:14px;height:1px;background:var(--ink);transition:transform .4s var(--ease)}
.pl::after{transform:rotate(90deg)}
details[open]>summary .pl::after{transform:rotate(0)}
```
Grid: **title (1fr) | meta (auto) | 28 px icon column**. The plus sign is two 1 px ink bars; the vertical
one rotates to 0° over **.4 s `var(--ease)`** when open. The `<details>` element is used natively — no JS.

The same accordion markup appears in the built page as `.ix-pl` (`tools/prev_stack.html:1425`).

---

## 5. Module chain `.mods` ★

`tools/landing.css` (verbatim):
```css
.mods{list-style:none;counter-reset:mod;border-top:1px solid var(--ink)}
.mods li{counter-increment:mod;display:grid;grid-template-columns:52px 1fr auto;align-items:baseline;gap:14px;padding:18px 0;border-bottom:1px solid var(--line)}
.mods li::before{content:counter(mod,decimal-leading-zero);font:500 11px/1 var(--mono);color:var(--mute);letter-spacing:.07em}
.mods .mt{font:500 clamp(18px,1.6vw,24px)/1.2 var(--sans);letter-spacing:-.02em;color:var(--ink)}
.mods .md{font:500 11px/1 var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--mute);white-space:nowrap}
```
The programme's table form. It is the **same grammar as the node chain in motif 23** (`foundations`):
a numbered chain of nodes on a baseline with connectors — the shader motif is a literal graphic
abstraction of this component. **This is the deepest conceptual link in the system and should be
preserved in any new composition.**

---

## 6. Price card `.tier` / `.ix-buycard`

`tools/landing.css` contains a `/* price */` section; the built markup uses `.tp` (price tier) and
`.ix-buycard` / `.ix-buycap`. The `adapt_1611.py:47-58` comment documents the price removal policy:
```
# Для таких слагов с собранной страницы убираются ВСЕ следы денежной строки:
# герой (.pr), тариф-карточка (.tp) и её дубль-билет (.ix-buycard), подпись
# билета (.ix-buycap), лента родственников (.rc-m), нижняя полоса (.tbar).
```
So the price surface has these selectors: `.pr` (hero price), `.tp` (tier card), `.ix-buycard` (ticket
duplicate), `.ix-buycap` (ticket caption), `.rc-m` (relatives ribbon), `.tbar` (bottom bar).
**The exact `.tier` CSS was not captured** — flagged in the audit.

---

## 7. Review carousel / reviews list `.cv`

`src/template.html:302-303` (verbatim):
```css
.cv{list-style:none;border-top:1px solid var(--line2);margin-bottom:22px}
.cv li{display:grid;grid-template-columns:96px minmax(0,1fr);gap:18px;padding:16px 0;border-bottom:1px solid var(--line)}
```
And the entrance animation from `tools/pipeline/wave_bc.py:189-190` (verbatim):
```python
    ('.cv li{display:grid;grid-template-columns:96px minmax(0,1fr);gap:18px;padding:12px 0;border-bottom:1px solid var(--line);animation:lpin .5s var(--ease) both}',
     '.cv li{display:grid;grid-template-columns:96px minmax(0,1fr);gap:20px;padding:12px 0;border-bottom:1px solid var(--line);animation:lpin .5s var(--ease) both}'),
```
So a review row **fades + slides in over .5 s with `var(--ease)`**, and the gap was later changed 18→20 px.

---

## 8. Marquee `.marq` / `.marq-t` ★

`src/template.html:309-312` (verbatim):
```css
.marq{margin-top:var(--hgap);padding:14px 0;border-block:1px solid var(--line);white-space:nowrap;overflow:hidden;user-select:none}
.marq-t{display:inline-flex;will-change:transform}
.marq-t span{font:700 40px/1 var(--disp);text-transform:uppercase;padding-right:.3em}
.marq-t em{font-style:normal;color:var(--mute);padding-right:.3em;font:700 40px/1 var(--disp)}
```
And `src/template.html:318`:
```css
  .marq{margin-top:32px;padding:12px 0}.marq-t span,.marq-t em{font-size:26px}
```
Structure: a strip rule top and bottom, a single flex row of Bebas caps items, alternate items in
`--mute` via `<em>`, `.3em` gap between items. `will-change:transform` — the row is transformed by JS
(horizontal scroll). **The JS scroll driver was not captured** — flagged in the audit.

---

## 9. Timeline strip `.tlb` / `.tlt`

`src/template.html:215-219` (verbatim):
```css
.tlb{position:fixed;left:0;right:0;bottom:0;z-index:55;height:34px;display:flex;align-items:center;gap:18px;padding:0 var(--pad);background:rgba(11,11,12,.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:1px solid var(--line);transform:translateY(100%);transition:transform .8s var(--ease)}
.tlt::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--line2)}
```
A **fixed 34 px bottom strip** (like a broadcast lower-third / timeline), hidden below the fold with
`translateY(100%)` and revealed with an **.8 s `var(--ease)`** transform transition.
The `::before` is a full-width 1 px rule at 50 % — the "timeline track".

---

## 10. Sticky nav `.nav.stuck`

`src/template.html:144` (verbatim):
```css
.nav.stuck{background:rgba(11,11,12,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom-color:var(--line);padding-block:10px}
```
On scroll, the nav gains a translucent blurred background and loses 10 px of block padding (it
**contracts** as it sticks).

---

## 11. Tags and chips `.tag` / `.op`

`src/template.html:349` and `:84` (verbatim):
```css
.tag{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:2px;font:500 12px/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;box-shadow:inset 0 0 0 1px var(--line2);color:#d9d8d3;white-space:nowrap}
.op{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:2px;background:var(--bg2);box-shadow:inset 0 0 0 1px var(--line2);color:#d9d8d3;font-style:normal;white-space:nowrap}
```
Both use **`box-shadow: inset 0 0 0 1px`** rather than a `border` — a 1 px inset ring. Height 24 px
(`--chip-h:24px`), radius 2 px.

---

## 12. Family nav / author block / works wall

`family/family.py` (564 lines) builds:
- **family nav** — the sibling-course ribbon (`family_blocks.json` is the data source, per
  `tools/pipeline/` listing);
- **author block** — `#author .au-pc img{...aspect-ratio:4/3;object-fit:cover;border-radius:6px;filter:grayscale(1) contrast(1.06)}`
  (`tools/pipeline/wave_l9new.py:131`) — the author photo is **desaturated** (`grayscale(1)`) with a slight
  contrast lift, in a 4:3 rounded-6 px frame;
- **works wall** — the tiled grid of halftoned project stills;
- **review components** — the `.cv` list.

`family/family.py` also exports `URLS` and `NAV` (per the dispatch brief) and a `js()` bundle that the
prev-stack file records as containing `onView, B4/bth/B8, rdCtx/SCR/bakeDither, fitBmp, dcd, dq, PIXBG`
(`tools/prev_stack.html:2524`).

**The exact CSS for these was not captured** — see the audit.

---

## 13. Section edge (`.edge`) ★

See `generative/procedural-textures.md §4`. 32 × 96 px pixel-stepped sprite, `image-rendering:pixelated`,
flipped for the bottom edge.

---

## 14. Component reuse matrix

| Component | Web/CSS | TouchDesigner | Three.js | After Effects | Blender |
|---|---|---|---|---|---|
| Hero band + overlay | ✔ native | GLSL TOP + text TOPs | shader plane + DOM/HTML overlay | shape layers over a rendered PNG | image plane + text objects |
| `.lbl` rule | ✔ native | — | SVG/HTML | shape layer | curve + text |
| `.pn` node panel | ✔ native | — | HTML/CSS | comp layers | mesh panels |
| `.mods` chain | ✔ native | — | HTML/CSS | — | — |
| `.ix-mod` accordion | ✔ native `<details>` | — | HTML/CSS | — | — |
| `.cv` review row | ✔ native | — | HTML/CSS | — | — |
| `.marq` marquee | ✔ native | — | — | — | — |
| `.tlb` timeline strip | ✔ native | — | — | — | — |
| `.edge` pixel edge | ✔ native | — | shader or sprite | sprite | image plane |
| Dither field | WebGL | GLSL TOP | shader | rendered PNG | render to texture |

---

## 15. Components that could NOT be extracted in this pass

- `.tier` / `.tp` price card CSS (selector known, rules not captured).
- The marquee JS scroll driver.
- The `family/family.py` CSS for family nav / author block / works wall (only the author image rule was
  captured, via `wave_l9new.py:131`).
- `--ink-250` / `--ink-300` panel gradient stops.
- `.ix-buycard` / `.ix-buycap` / `.rc-m` / `.tbar` rules.
