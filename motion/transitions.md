# Hou2Touch — Transitions

**Status:** MEASURED. This document covers *how one state becomes another* — the site has no page
transitions, so "transitions" here means state changes: scroll reveals, hover, accordion, sticky nav,
the canvas wipe, and the modal/overlay layer.

---

## 1. Inventory of transitions

| # | Transition | Trigger | Property | Duration | Easing | Source |
|---|---|---|---|---|---|---|
| T1 | Reveal on scroll | `IntersectionObserver` | `opacity`, `translateY(8px)` | .8 s | `var(--ease)` | `template:1641` |
| T2 | Canvas clip wipe | `.in` class | `clip-path: inset()` | 1.4 s (+.25 s delay) | `var(--ease)` | `hero:113, 119` |
| T3 | Letter rise | `.in` class | `translateY(105%)` | 1.1 s | `var(--ease)` | `hero:113-116` |
| T4 | Button hover | `:hover` | `background`, `color` | .3 s | `var(--ease)` | `hero:86, 88` |
| T5 | Square-button hover | `:hover` | `background`, `color` | .3 s | linear | `template:353` |
| T6 | Matrix-row hover | `:hover` | `background` | .3 s | linear | `template:370` |
| T7 | Accordion open | `<details open>` | `transform: rotate(90deg→0)` | .4 s | `var(--ease)` | `landing.css` |
| T8 | Timeline strip show | scroll | `translateY(100%→0)` | .8 s | `var(--ease)` | `template:215` |
| T9 | Sticky nav | scroll | bg/blur/padding | not captured | — | `template:144` |
| T10 | Review row entrance | animation | `lpin` | .5 s | `var(--ease)` | `wave_bc.py:189` |
| T11 | Pointer lens decay | `pointerleave` | `PA` lerp `.08`/frame | ≈ .2 s | exponential | `hero:792, 812` |
| T12 | Loupe reposition | continuous | `LC` lerp toward pointer | ≈ .2 s | exponential | `hero:817` |
| T13 | Loupe orbit | continuous | `sin`/`cos` | 48 s / 37 s periods | sinusoidal | `hero:815` |

---

## 2. T1 — the scroll reveal (the site's fundamental transition)

`src/template.html:1641` (verbatim):
```js
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add("in");io.unobserve(e.target)}),{rootMargin:"0px 0px -10% 0px"});
```

**Parameters and why they matter**

| Parameter | Value | Effect |
|---|---|---|
| `rootMargin` bottom | `−10%` | The element must cross 90 % of the viewport height before revealing — so it is already well in frame when it appears. |
| `unobserve` | — | One-shot. A second pass does not re-animate. |
| Class | `.in` | A single class drives every reveal style in the CSS. |

The generic helper — `src/template.html:1226-1227` (verbatim):
```js
function onView(el,cb,o){o=o||{};const th=o.threshold||0;
  const io=new IntersectionObserver(es=>es.forEach(e=>{const v=e.isIntersecting&&e.intersectionRatio>=th*.98;if(o.once){if(v){io.disconnect();cb(true,e)}}else cb(v,e)}),{threshold:th?[0,th]:0,rootMargin:o.margin||"0px"});io.observe(el);return io}
```
Two details to copy:
- `th*.98` — the `.98` tolerance prevents a flicker when the ratio sits exactly on the threshold.
- `io.disconnect()` on `once` — frees the observer.

A separate "wake" observer pre-loads content 100 px early — `template:1215`:
```js
const vio=new IntersectionObserver(es=>es.forEach(e=>{e.target.__vis=e.isIntersecting;(e.target.__lt||[]).forEach(t=>t.vis=e.isIntersecting);if(e.isIntersecting)wake()}),{rootMargin:"100px 0px"});
```

---

## 3. T2 — the canvas clip wipe

```css
.js .band canvas{clip-path:inset(0 100% 0 0)}
.in .band canvas{clip-path:inset(0 0 0 0);transition:clip-path 1.4s .25s var(--ease)}
```
`tools/hero_index_mock.html:113, 119`.

Why `clip-path` and not a scale/opacity:
- The canvas has `image-rendering:pixelated` — a transform would resample the pixel grid and break the
  dither. A clip-path does not touch the rasterisation.
- The wipe direction (left → right) matches the reading direction of the band.
- 1.4 s is the longest transition in the system, and it is given to the largest surface.

---

## 4. T3 — the letter rise

```css
.js .num em,.js .ttl h2>span{transform:translateY(105%)}
.in .num em,.in .ttl h2>span{transform:none;transition:transform 1.1s var(--ease)}
.in .num span:nth-child(2) em{transition-delay:.05s}.in .num span:nth-child(3) em{transition-delay:.1s}
.in .ttl h2>span{transition-delay:.5s}
```
`tools/hero_index_mock.html:113-116`.

The DOM structure that makes it possible (`hero:207`):
```js
<div class="num" aria-hidden="true">${[...(c.n||id)].map(d=>`<span><em>${d}</em></span>`).join('')}</div>
```
Every glyph is wrapped in `<span><em>` — the outer span provides the clip box, the inner `em` does the
transform. This is the standard "masked text rise" pattern.

`aria-hidden="true"` on the numeral — the accessible name comes from the `<h2 aria-label=…>`.

---

## 5. T7 — the accordion

```css
.pl::before,.pl::after{...transition:transform .4s var(--ease)}
.pl::after{transform:rotate(90deg)}
details[open]>summary .pl::after{transform:rotate(0)}
```
`tools/landing.css`.

Native `<details>`/`<summary>` — no JS, and the browser's own height animation is left to the platform.
Only the icon is animated. **The site's rule: animate the indicator, not the container.**

The same pattern in the dark shell — `school.px.html:770-772`:
```css
.fq-l summary i::after{transform:translate(-50%,-50%) rotate(90deg)}
.fq-l details[open] summary i{transform:rotate(45deg);background:var(--fg);color:#000;box-shadow:none}
```
Here the icon rotates 45° and inverts its colours on open.

---

## 6. T8 — the timeline strip

```css
.tlb{position:fixed;left:0;right:0;bottom:0;z-index:55;height:34px;...;transform:translateY(100%);transition:transform .8s var(--ease)}
```
`src/template.html:215`.

A fixed lower-third that slides up from below the fold. It reads as a **broadcast timeline / status bar**,
matching the "instrument" voice of the design system.

---

## 7. T11/T12 — pointer-driven transitions

The site's only *continuous* transitions. Both are exponential decays implemented as per-frame lerps:

```js
 sc.pa+=(sc.pat-sc.pa)*.08;                       // pointer influence
 ...
 if(sc.pa>.02){const mx=...,my=...; lx+=(mx-lx)*sc.pa; ly+=(my-ly)*sc.pa;} // loupe toward pointer
```
`tools/hero_index_mock.html:812, 817`.

With `.08` at 60 fps, the time constant is ≈ `1/.08 ≈ 12.5 frames ≈ 208 ms` — a soft, weighty follow.
**Do not use a hard cutoff**: `pointerleave` sets `pat = 0` and the lens decays smoothly.

---

## 8. Transition vocabulary rules

1. **Three named easings, by role** — `cubic-bezier(.19,1,.22,1)` general, `cubic-bezier(.22,1,.36,1)` entrance, `cubic-bezier(.2,0,0,1)` exit / state change. Hover colour changes are the only linear exceptions.
2. **Longest transition = largest surface** (canvas 1.4 s, type 1.1 s, blocks .8 s, indicators .4 s,
   colours .3 s).
3. **Clip, don't scale, anything that is pixel-dithered.**
4. **One-shot reveals** driven by a 10 %-inset IntersectionObserver.
5. **Indicators animate; containers don't.**
6. **Pointer influence decays exponentially** and never snaps.

---

## 9. Not present (do not invent)

- No page-load route transitions, no view-transition API, no FLIP animation.
- No scroll-jacking, no parallax on the hero canvas (the canvas is `position:absolute` inside a fixed-height band).
- No spring physics, no elastic easing.
- No scroll-linked shader time (the shader clock is wall-clock, not scroll-linked).
