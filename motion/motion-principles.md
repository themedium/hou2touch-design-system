# Hou2Touch — Motion Principles

**Status:** MEASURED. All durations and easings are quoted from source with `file:line`.

---

## 1. The easing vocabulary — three curves, three roles

| Token | Curve | Role | Band |
|---|---|---|---|
| `--ease` | `cubic-bezier(.19,1,.22,1)` | general — the default for everything that moves | 0.3–1.4 s |
| `--rx-em` | `cubic-bezier(.22,1,.36,1)` | entrance — elements arriving | 0.3–1.4 s |
| `--rx-es` | `cubic-bezier(.2,0,0,1)` | exit / state change | 0.16–0.25 s |

The general curve is quoted in both files:
```css
--ease:cubic-bezier(.19,1,.22,1);
```
`src/template.html:48` and `tools/hero_index_mock.html:32` — **the same value in both files.**

This is a strong ease-out with a tiny initial push:
- `y1 = 1` → the value reaches the target quickly (ease-out).
- `x1 = .19` → it starts with a slight *anticipation* (a small initial move in the "wrong" direction is
  not present; rather, the curve leaves the origin fast).
- `x2 = .22` → the control point near the target is at 22 % of the duration, so the last stretch is long.

**Every animated thing in the site uses one of the three curves above, or a plain `.3s`/`.8s` linear
default.** Three curves are the whole vocabulary: there is no spring, no `steps()`, no per-component
custom cubic-bezier. The entrance and exit curves are a deliberate decision, recorded in the source
(`en/index.html:1206` — "реш. 9 … 120 мс cubic-bezier(.2,0,0,1)"), not an accident. The canonical
statement of the three roles lives in `MASTER_DESIGN_SYSTEM.md §2.4`.

Exceptions that do **not** use `var(--ease)` (MEASURED):
- `transition:background .3s,color .3s` on `.sq` (`src/template.html:353`) — linear 300 ms.
- `transition:background .3s,color .3s` on `.mx-r` (`src/template.html:370`).

---

## 2. Duration vocabulary

| Duration | Where | Source |
|---|---|---|
| **0.3 s** | button hover colour, square-button hover | `hero:86`, `template:353`, `template:370` |
| **0.4 s** | accordion plus-icon rotate | `landing.css` (`.pl::after`) |
| **0.5 s** | review row entrance (`lpin`) | `wave_bc.py:189-190` |
| **0.8 s** | sticky nav, timeline strip reveal, hero copy entrance, marquee | `template:144`, `template:215`, `hero:113-118` |
| **1.1 s** | numeral + display-title letter rise | `hero:113` |
| **1.4 s** | hero canvas clip-path wipe | `hero:119` |
| **1.65 s** | mask bake delay after fonts ready | `hero:826` |
| **0.16 / 0.18 / 0.24 / 0.25 s** | exits and state changes (`--rx-es`) | live EN set |

State transitions live between 0.3 s and 1.4 s. Outside that band there are only the named exceptions:
exits (0.16–0.25 s), the 1.65 s mask bake, and the continuous loops — the marquee, the 1.4 s dashed-path
cycle and the loupe orbit (37 s / 48 s). The loops are not transitions and never were.

---

## 3. The four motion behaviours

### 3.1 Rise-and-fade (the primary entrance)
```css
.in .tt,.in .meta,.in .foot>*{opacity:1;transform:none;transition:opacity .8s .35s var(--ease),transform .8s .35s var(--ease)}
```
`tools/hero_index_mock.html:115` — the element moves **8 px up** while fading in, over .8 s, delayed .35 s.

Site-wide variant — `src/template.html:1641` (verbatim):
```js
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add("in");io.unobserve(e.target)}),{rootMargin:"0px 0px -10% 0px"});
```
Every `.rv`/reveal element gets `.in` once, when it crosses the viewport minus 10 % of the viewport
height. `io.unobserve` makes it one-shot.

### 3.2 Clip wipe (the canvas reveal)
```css
.js .band canvas{clip-path:inset(0 100% 0 0)}
.in .band canvas{clip-path:inset(0 0 0 0);transition:clip-path 1.4s .25s var(--ease)}
```
`tools/hero_index_mock.html:113, 119` — the generative band **wipes in from the left**, 1.4 s, .25 s delay.
The wipe is a `clip-path` inset animation, so it is GPU-composited and stays pixel-crisp.

### 3.3 Letter rise (masked type)
```css
.js .num em,.js .ttl h2>span{transform:translateY(105%)}
.in .num em,.in .ttl h2>span{transform:none;transition:transform 1.1s var(--ease)}
.in .num span:nth-child(2) em{transition-delay:.05s}.in .num span:nth-child(3) em{transition-delay:.1s}
.in .ttl h2>span{transition-delay:.5s}
```
`tools/hero_index_mock.html:113-116` — each numeral glyph is its own `<span><em>` and rises **105 % of its
own height** out of a clip:
```css
.num span{display:inline-block;clip-path:inset(-.3em -.1em 0 -.1em)}
```
Stagger: glyph 2 at +.05 s, glyph 3 at +.1 s, title at +.5 s.

### 3.4 Continuous generative motion
The band itself never stops: `requestAnimationFrame(loop)` runs forever (`hero:824`). The clock starts at
`t = 6.0` and runs at `.72×` in fine mode (`hero:809`).

**There is no "reduced motion" freeze for the band.** The source is explicit — `hero:809` comment:
```js
const t=(6.0+(now-sc.t0)/1000)*(FINE?.72:1);   /* 20.11.2026 (решение владельца): полоса анимируется ВСЕГДА — старт с удачной фазы 6.0 + реальное время; заморозка по системной настройке снята */
```
and `hero:824`:
```js
function loop(now){for(const sc of scenes)if(sc.vis)draw(sc,now);requestAnimationFrame(loop)}   /* 20.11.2026: цикл полосы ВСЕГДА — заморозка по системной настройке снята (иначе рисуется ровно один кадр) */
```
Owner decision, 20.11.2026: the freeze under `prefers-reduced-motion` was removed because otherwise
**exactly one frame** would be rendered. The only residual `reduce` usage is the mask-bake delay:
`setTimeout(()=>scenes.forEach(sc=>sc.mask()),reduce?0:1650);` (`hero:826`).

---

## 4. CSS entrance choreography (verbatim, `hero:110-120`)

```css
@media (prefers-reduced-motion:no-preference){
  .js .num em,.js .ttl h2>span{transform:translateY(105%)}
  .js .tt,.js .meta,.js .foot>*{opacity:0;transform:translateY(8px)}
  .js .band canvas{clip-path:inset(0 100% 0 0)}
  .in .num em,.in .ttl h2>span{transform:none;transition:transform 1.1s var(--ease)}
  .in .num span:nth-child(2) em{transition-delay:.05s}.in .num span:nth-child(3) em{transition-delay:.1s}
  .in .ttl h2>span{transition-delay:.5s}
  .in .tt,.in .meta,.in .foot>*{opacity:1;transform:none;transition:opacity .8s .35s var(--ease),transform .8s .35s var(--ease)}
  .in .band canvas{clip-path:inset(0 0 0 0);transition:clip-path 1.4s .25s var(--ease)}
}
```

**Timeline of the hero entrance (t = 0 at `.in`):**

| t | Event |
|---|---|
| 0 s | numeral glyph 1 rises (1.1 s) |
| .05 s | numeral glyph 2 starts |
| .1 s | numeral glyph 3 starts |
| .25 s | canvas clip-path wipe begins (1.4 s) |
| .35 s | meta / title / footer rise-and-fade begin (.8 s) |
| .5 s | display title rises (1.1 s) |
| 1.1–1.5 s | all type settled |
| 1.65 s | mask bake (halo lands with the letters) |

Note the `.in` class is added on the **second animation frame** after `document.fonts.ready`:
```js
document.fonts.ready.then(()=>{
 requestAnimationFrame(loop);
 requestAnimationFrame(()=>document.querySelectorAll('.hero').forEach(s=>s.classList.add('in')));
 setTimeout(()=>scenes.forEach(sc=>sc.mask()),reduce?0:1650); // halo lands with the letters
});
```
(`hero:822-826`) — the type only starts moving once the webfonts have loaded, so there is no reflow jump.

---

## 5. Scroll behaviour

| Mechanism | Parameters | Source |
|---|---|---|
| Reveal observer | `rootMargin:"0px 0px -10% 0px"`, one-shot, `.in` added | `template:1641` |
| Generic `onView` | `threshold` default 0; visible when `intersectionRatio ≥ th·.98`; `rootMargin` default `"0px"` | `template:1226-1227` |
| Wake observer | `rootMargin:"100px 0px"` — pre-loads content 100 px early | `template:1215` |
| Hero canvas visibility | `IntersectionObserver(...,{threshold:0})` → `sc.vis`; offscreen heroes are not drawn | `hero:797` |
| Nav stuck | class `.stuck` added on scroll | `template:144` |
| Timeline strip | `transform:translateY(100%)` → 0 over .8 s `var(--ease)` | `template:215` |
| Author-block observer | tracks hero presence + blocked targets | `template:1615` |

`onView` verbatim — `src/template.html:1226-1227`:
```js
function onView(el,cb,o){o=o||{};const th=o.threshold||0;
  const io=new IntersectionObserver(es=>es.forEach(e=>{const v=e.isIntersecting&&e.intersectionRatio>=th*.98;if(o.once){if(v){io.disconnect();cb(true,e)}}else cb(v,e)}),{threshold:th?[0,th]:0,rootMargin:o.margin||"0px"});io.observe(el);return io}
```
The `th*.98` tolerance avoids the classic "threshold flicker" at exactly the threshold value.

---

## 6. Pointer behaviour

| Rule | Value | Source |
|---|---|---|
| Pointer position | normalised to the band, `pointermove` on `.band` | `hero:790-791` |
| Pointer influence smoothing | `sc.pa += (sc.pat − sc.pa) · .08` (per frame, ≈ 200 ms) | `hero:812` |
| Pointer leave | `sc.pat = 0` → the lens decays smoothly, it does not snap | `hero:792` |
| Lens shape | `PA·exp(−dot(d,d)·18.)` — a Gaussian of radius ≈ .236 UV | `hero:237` |
| Pointer overrides the title-avoid rule for the loupe | `if(sc.pa>.02){...}` | `hero:817` |

**Design principle:** the pointer never *moves* the composition; it *disturbs* it locally, and the
disturbance is always damped and always radial.

---

## 7. Motion rules for new work

1. **Three easings, by role.** `--ease` (general), `--rx-em` (entrance), `--rx-es` (exit / state change).
   A fourth curve is forbidden; `.3s` linear is allowed only for hover colour.
2. **State transitions live in the 0.3–1.4 s band.** Below .3 s feels cheap; above 1.4 s feels slow. The
   named exceptions are exits (0.16–0.25 s), the mask bake (1.65 s) and the continuous loops.
3. **Reveals are one-shot** and triggered by a 10 %-inset IntersectionObserver.
4. **Type rises, it does not fade.** Rise = `translateY(100%)` → `0` from a clipped box.
5. **Generative fields never stop.** They are time functions, not timelines.
6. **Pointer = local Gaussian disturbance**, smoothed at `.08`/frame.
7. **Stagger in small increments** — `.05 s` between glyphs, `.5 s` to the title.
8. **Wipe, don't slide, for large surfaces** — `clip-path: inset()` keeps the pixel grid intact.
