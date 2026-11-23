# Hou2Touch — Animation Specifications

**Status:** MEASURED. Exact CSS declarations, exact durations, exact delays.

---

## 1. Hero entrance — complete spec

**File:** `tools/hero_index_mock.html:110-120`
**Trigger:** `document.fonts.ready` → 2nd `requestAnimationFrame` → `.in` class on every `.hero`
(`hero:822-826`).

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

### 1.1 Element-by-element table

| Element | Initial | Final | Duration | Delay | Easing |
|---|---|---|---|---|---|
| `.num em` (per glyph) | `translateY(105%)` | `translateY(0)` | 1.1 s | 0 / .05 / .1 s | `var(--ease)` |
| `.ttl h2 > span` | `translateY(105%)` | `translateY(0)` | 1.1 s | .5 s | `var(--ease)` |
| `.tt`, `.meta`, `.foot > *` | `opacity 0`, `translateY(8px)` | `opacity 1`, `none` | .8 s | .35 s | `var(--ease)` |
| `.band canvas` | `clip-path: inset(0 100% 0 0)` | `inset(0 0 0 0)` | 1.4 s | .25 s | `var(--ease)` |
| mask texture bake | — | halo baked | — | 1650 ms (0 if reduced motion) | — |

The `.js` class is added at load (`hero:202`: `document.documentElement.classList.add('js')`) so that
the pre-state only applies when JS is present — no-JS users get the finished state.

### 1.2 Clip boxes

```css
.num span{display:inline-block;clip-path:inset(-.3em -.1em 0 -.1em)}
.band .ttl h2{...clip-path:inset(-.4em -.2em -.15em -.2em);text-wrap:balance}
```
(`hero:57, 81`)

- The numeral's clip box is **open at the top** (`-.3em`) and **closed at the bottom** (`0`) → the glyph
  rises *out of* its own baseline, like a print being pulled up.
- The title's box is open on all sides except a small bottom (`-.15em`) — the caps have room to breathe.

---

## 2. Hover transitions

| Element | Property | Duration | Easing | Source |
|---|---|---|---|---|
| `.btn` | `background`, `color` | .3 s | `var(--ease)` | `hero:86` |
| `.btn:hover` | → `background:var(--hou)`, `color:#fff` | .3 s | `var(--ease)` | `hero:88` |
| `.sq` | `background`, `color` | .3 s | **linear** | `template:353` |
| `.mx-r` | `background` | .3 s | **linear** | `template:370` |
| `.pl::before/::after` | `transform` (90°→0°) | .4 s | `var(--ease)` | `landing.css` |

The hover state is **always the brand orange** `#e5501e` with white text — one hover colour across the
whole site.

---

## 3. Scroll / sticky transitions

| Element | Property | Duration | Easing | Source |
|---|---|---|---|---|
| `.tlb` timeline strip | `transform: translateY(100%) → 0` | .8 s | `var(--ease)` | `template:215` |
| `.nav.stuck` | background / blur / padding-block | (not captured) | — | `template:144` |
| `.cv li` entrance | `animation: lpin .5s var(--ease) both` | .5 s | `var(--ease)` | `wave_bc.py:189` |

---

## 4. Generative field timing

| Parameter | Value | Source |
|---|---|---|
| Clock origin | `t = 6.0 + (now − t0)/1000` | `hero:809` |
| Clock rate (fine) | ×0.72 | `hero:809` |
| Clock rate (coarse) | ×1.0 | `hero:809` |
| Random phase offset | `t0 = performance.now() − Math.random()*4000` | `hero:788` |
| Pointer smoothing | `.08` per frame | `hero:812` |
| Loupe orbit x | `.7 + .16·sin(t·.13)` | `hero:815` |
| Loupe orbit y | `.5 + .1·sin(t·.17 + 1)` | `hero:815` |
| Loupe radius | `RL = 0.17` UV | `hero:814` |
| Loupe magnification | ×3.2 | `hero:296` |
| Frame-counter readout | `f` + 6-digit `floor(t*60)` | `hero:822` |

### 4.1 Per-motif cue rates (all MEASURED from `shaders.md`)

| Motif | Cue / beat | Period |
|---|---|---|
| 0 chladni | `fract(t·2.)` | 0.5 s (120 bpm) |
| 9 barcode | `floor(t·2.)` | 0.5 s |
| 5 frame | `floor(t·.8)` | 1.25 s |
| 11 fold | `floor(t·.6)` | 1.67 s |
| 20 channels | `fract(t·.35 + …)` | 2.86 s |
| 19 storyboard | `floor(t·.12)` | 8.33 s |
| 27 light | `sin(t·1.05 + …)` | 0.95 s |
| 2 wall | per-tile `1.3 + 3.4·hash` s | 1.3–4.7 s |
| 28 avperf | `sin(bi·1.7 + t·1.8)` | fast flutter |

**Design rule:** slow cues (0.5–8 s) dominate; nothing blinks faster than 0.5 s except the light pools and
the spectrum bars.

---

## 5. CSS `@keyframes` inventory

| Name | Where | Duration | Easing |
|---|---|---|---|
| `lpin` | applied to `.cv li` (`wave_bc.py:189-190`) | .5 s | `var(--ease)` |

**The body of `@keyframes lpin` was not captured** — flagged in the audit. Given the class name
("list pin") and the `.cv li` usage, it is almost certainly `opacity 0 → 1` + `translateY(…)`, but that is
an **inference, not a measurement**.

---

## 6. The generative loop as an animation spec

For a video export (25/50/60 fps), the shader time must be driven explicitly:

```
frame n:  T = 6.0 + n / fps * rateScale      (rateScale = 0.72 in fine mode)
```

This reproduces the live behaviour exactly, including the "start at a successful phase" rule.
At 60 fps, `T` increments by `1/60` per frame; the readout `f 000000` increments at exactly `floor(T*60)`.

---

## 7. Frame budget notes

- One full-screen triangle, one fragment shader invocation per cell.
- At a 1440 px wide band in fine mode: `1440/2 = 720` cells wide × ~(400/2 = 200) cells high = **144 000
  fragments** — trivial for any GPU, but note motifs 15 and 16 evaluate `b8` per fragment and motif 12
  evaluates `vedge` (a 3×3 neighbourhood with 2 hash calls each = 18 hashes per fragment).
- The loupe evaluates the motif **twice** (once for the normal field, once magnified) — motif 12 therefore
  costs 36 hashes/fragment in fine mode.
- `IntersectionObserver` skips offscreen heroes (`hero:797`), so a page with 5 stacked heroes renders
  one at a time.
