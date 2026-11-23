# Hou2Touch — Motion Examples

**Status:** MEASURED recipes. Each example is a self-contained specification that can be rebuilt in
TouchDesigner, Three.js, After Effects or Blender without consulting the original site.

---

## 1. Recipe — "hero entrance" (complete, reproducible)

**Inputs:** a DOM/WebGL hero with a Bebas numeral, a Bebas title, a meta line, a canvas band and a footer.

**Timeline (seconds from `.in`):**

```
0.00  glyph 1 of the numeral starts rising       translateY(105%) → 0   | 1.10 s | ease(.19,1,.22,1)
0.05  glyph 2 starts
0.10  glyph 3 starts
0.25  canvas clip-path wipe starts                inset(0 100% 0 0) → inset(0) | 1.40 s | ease
0.35  meta / title / footer start rising+fading   opacity 0→1, translateY(8px)→0 | 0.80 s | ease
0.50  display title starts rising                 translateY(105%) → 0   | 1.10 s | ease
1.65  title knockout mask re-baked (halo lands)
```

**Verification marks:** at t = 1.2 s the numeral is fully up but the title is still 60 % risen; at t = 1.65 s
the title's halo appears in the shader's knockout texture.

---

## 2. Recipe — "ordered-dither field" (the core look)

**Steps:**

1. Compute a scalar ink field `f ∈ [0,1]` in the fragment shader (see `generative/algorithms.md`).
2. Compute the Bayer threshold at the **buffer pixel**:
   `th = b8(gl_FragCoord.xy) + 0.5/64.0`
   with
   ```glsl
   float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}
   float b4(vec2 a){return b2(.5*a)*.25+b2(a);}
   float b8(vec2 a){return b4(.5*a)*.25+b2(a);}
   ```
3. Output: `c = (f > th) ? INK : PAPER`, where
   `PAP = vec3(.914,.906,.878)`, `INK = vec3(.043,.043,.047)` (fine mode: `vec3(.075,.072,.068)`).
4. Accent: `if (colmask > 0.5 && f > th*0.6) c = K;`
5. Render the buffer at `round(width/2) × round(height/2)` (fine) and upscale with **nearest** filtering.

**Verification marks:** the dot pitch is 16 CSS px; solid areas show a regular 8×8 dot matrix; the accent
appears only as a slightly lighter tone inside the ink.

---

## 3. Recipe — "moving loupe"

**Spec:**

| Property | Value |
|---|---|
| Magnification | ×3.2 |
| Radius | 0.17 UV |
| Centre orbit | `lx = .7 + .16·sin(t·.13)`, `ly = .5 + .1·sin(t·.17 + 1)` |
| Avoidance | push the centre away from the title bbox when the aspect > 1.4 |
| Pointer override | blend toward the pointer with weight `PA` when `PA > .02` |
| Follow smoothing | `.08` per frame |
| Draw | a circle at `RL`, a dashed circle at `RL+.022` (24 dashes), a crosshair from `RL+.012` to `RL+.075`, and a centre dot in the family colour |

**Implementation:** compute the motif **twice** per fragment — once normally, once at
`LC + (uv − LC)/3.2` — and select by `distance < RL`. The second call must be unconditional so that
`fwidth` derivatives are valid.

---

## 4. Recipe — "paper dots + registration grid" (fine mode only)

**Spec:**
- Paper dots: every 7th pixel in x and y, if `mod(floor(px.x),7.) < .5` → mix paper with graphite `.55`.
- Vertical grid: 12 lines at `GR.x + k·GR.y` for `k = 0…11`, plus a line at `GR.z`; drawn as 1-px
  vertical dashes every 5th row.
- Horizontal rules at `y = 1/3` and `y = 2/3`, thickness 4 cells, only within 4 cells of a vertical line.
- All in graphite `vec3(.42,.41,.39)`, except the crossing rules which are pure INK.

**Why it matters:** this is what turns a texture into an *instrument*.

---

## 5. Recipe — "title knockout"

**Spec:**
1. Create an offscreen canvas at buffer resolution.
2. Walk the text nodes of the title block.
3. For each word: `font = '700 ' + computedFontSize + 'px "H2T Bebas"'`, `letterSpacing` from the computed style.
4. `strokeText` with `lineWidth = max(2*CELL, fontSize * (FINE ? .075 : .05))`, then `fillText`.
5. Upper-case the text.
6. Upload as an RGBA texture; in the shader, `if (HT > .5 && texture2D(TX, uv).a > .5) c = PAPER;`
7. Re-bake on resize and once at t ≈ 1.65 s so the halo lands with the letters.

---

## 6. Recipe — "signal streams" (motif 1) in another engine

```
for i in 0..6:
    y = .16 + i*.115
      + .06*sin(x*(1.3+.17i) - t*(.3+.025i) + 1.9i)
      + .02*sin(x*5 - t*1.1 + i)
    y += lens*.06*sin(i*2 + t)
    w  = (i == 3) ? .022 : (.0045 + .002*(i mod 2))
    draw a horizontal line at y with half-width w
    pk = step(.7, fract(x*(2.2+.9i) - t*(.22+.06i) + .37i))
    draw a halo of weight .32*pk around the line, width w+.035
colour: lines 1 and 5 are accent-eligible
```

---

## 7. Recipe — "video wall" (motif 2) in another engine

```
grid: 4 rows, columns = max(3, round(aspect*4*0.5625))
for each tile:
    period = 1.3 + 3.4*hash(tile)
    phase  = hash(tile)*period
    age    = ((t + phase) mod period)
    wipe   = min(age/0.28, 1)
    content = generator(hash(tile, cue))   # ramp | bars | disc | fbm feed
    blend old/new by the wipe line, and draw a bright line at the wipe edge
```

---

## 8. Recipe — "node chain" (motif 23), the system's signature form

```
base line at y = .17, 1-px
for i in 0..8:
    x  = (i+.5)/9
    grow = clamp(t*.30 - i*.07, 0, 1)
    h  = (.09 + .40*hash(i)) * grow
    draw a circle of radius .015 at (x, base+h)
    draw a vertical stem from base to base+h
    draw a diagonal segment from (x, base+h) to (x2, base+h2)   # x2 = (i+1.5)/9
colour: nodes that have grown past 40 %
```

**This is also the `.mods` list component** (`tools/landing.css`) rendered in shader form. The component
and the motif are the same idea — use one or the other consistently, never a hybrid.

---

## 9. Recipe — "modular rack" (motif 17)

```
3 rows at y = .10 + .28i, height .24
per row:
    moduleCount = 4 + floor(hash(row)*4)
    seam lines at every module boundary (1.2-px grid line)
    per module: two knobs (circles r=.085) and a slider slot
3 patch cables:
    xa = hash*0.9; xb = xa + .10 + hash*.22
    ya = .22 + j*.26; yb = ya + .16
    cy = mix(ya,yb,u) + sin(pi*u)*(0.09 + 0.05*hash)   # the sag
    draw the cable as a 2.2-px line
```

---

## 10. Recipe — "radial spectrum" (motif 28)

```
48 angular bins
amp(bin) = .14 + .30*(.5+.5*sin(bin*1.7 + t*1.8))*(.5+.5*sin(bin*.53 - t*.65))
for each pixel:
    angle -> bin, fractional position f within the bin
    bar = (r < .34+amp) && (r > .150) && (f in [.08,.92])
    cap = a bright line at r = .34+amp
always draw a reference circle at r = .34
```

---

## 11. Example sequence for a 30-second brand film (derived, not extracted)

**Flagged as a derived composition, not extracted from the site.** It is built strictly from the
documented primitives and durations.

| t | Beat | Source primitive |
|---|---|---|
| 0.0–1.4 s | black field, a single dithered rule wipes in | T2 clip wipe, 1.4 s |
| 1.4–4.0 s | numeral rises, glyph by glyph | T3, 1.1 s, .05 s stagger |
| 4.0–6.0 s | title rises | T3 at .5 s delay |
| 6.0–12.0 s | motif field at full strength, loupe orbiting | generative loop, `t = 6.0` |
| 12.0–14.0 s | pointer enters; the lens disturbs the field | T11, .08 lerp |
| 14.0–16.0 s | loupe tracks the pointer | T12 |
| 16.0–18.0 s | title knockout halo re-bakes | mask bake at 1.65 s equivalent |
| 18.0–22.0 s | family colour accent appears (mask > .5) | composite rule |
| 22.0–24.0 s | copy rises (meta + footer) | T1 |
| 24.0–30.0 s | hold, field continues | generative loop is continuous |

**All timings above use the site's own durations and the same easing** — the composition is new, but it
does not introduce a single new motion value.

---

## 12. Anti-patterns — what breaks the illusion

| Wrong | Why | Right |
|---|---|---|
| Smooth gradients in the field | The system is 1-bit | Threshold against Bayer |
| Colour bleeding over bare paper | Accent must be inside ink | `m.y>.5 && m.x>th*.6` |
| Blurring or scaling the dither canvas | destroys the pixel grid | nearest upscaling only |
| A spring or bounce ease | one easing only | `cubic-bezier(.19,1,.22,1)` |
| Random per-frame noise | ordered dither is deterministic | Bayer / hash-seeded |
| A colour field larger than the accent chip | accent is ≤ 5 % of the frame | keep it sparse |
| Text on paper that is not `#0b0b0c` | contrast rule | ink only |
