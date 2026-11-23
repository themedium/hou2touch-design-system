# Hou2Touch — Particle Systems

**Status:** MEASURED. **Important finding up front: the site contains no simulated particle system.**
Everything that looks like particles is either an analytic per-cell instance or a static line field.
This document documents that honestly and then specifies how to build a *faithful* particle version that
still belongs to the system.

---

## 1. What the codebase actually has

| Look | Implementation | Simulation? |
|---|---|---|
| Boid needles (motif 15) | Per-cell oriented segment, `u5sg`, one needle per 12 px cell | **No** — analytic, hash-seeded |
| Cell tiles (motifs 2, 17, 19, 20) | `floor(uv*g)` + hash | **No** |
| Instances (motif 24) | Per-cell square, hash-sized and hash-rotated | **No** |
| Light pools (motif 27) | 5×5 hash-phased rings | **No** |
| Physarum filaments (motif 12) | `vedge()` — cellular F2−F1 over a jittered lattice | **No** — but the closest to an agent system |
| Chladni "sand" (motif 0) | A soft halo around the nodal zero set | **No** |

**There is no emitter, no integration, no state array anywhere in `tools/hero_index_mock.html`.**
The renderer is stateless per frame: `motif(uv, asp, T)` is a pure function of time.

That is a deliberate design decision and it is the single most important constraint for new work:
> **The system's motion is "a function of time", not "a simulation".**

---

## 2. The one place where particles appear — motif 15 `swarm13`

`tools/hero_index_mock.html:412-431`, verbatim:

```glsl
 if(M==15){ // swarm13 — myxomycete transport veins + oriented boid needles (from ?x=up13, U5M=0)
  float dth=b8(gl_FragCoord.xy)+.5/64.;
  vec2 p=q-vec2(asp*.52,.48);
  vec2 w=p*vec2(2.2,3.4)+vec2(-t*.35,0.);
  w+=.42*vec2(sin(w.y*2.4+t*.5),cos(w.x*2.1-t*.4));
  w+=.22*vec2(cos(w.y*5.1-t*.8),sin(w.x*4.8+t*.7));
  float v1=abs(sin(w.y*2.6+sin(w.x*1.9)*1.4));
  float v2=abs(sin(w.y*5.2-cos(w.x*3.7)*.9));
  float vein=pow(clamp(1.-min(v1,v2*1.15)*1.8,0.,1.),2.2);
  float cS=12.;vec2 PX=q*R.y;
  vec2 cI=floor(PX/cS),cL=PX-(cI+.5)*cS;
  float ang=-.35*cos(w.x*2.1-t*.4)*2.6;
  vec2 dir=vec2(cos(ang),sin(ang));
  float dNeedle=u5sg(cL,-dir*cS*.34,dir*cS*.34);
  float dHead=length(cL-dir*cS*.34);
  float boid=max(clamp(1.35-dNeedle,0.,1.),step(dHead,2.1))*step(.32,h1(cI*1.7));
  float ink=0.,col=0.;
  if(vein>.62){float f=1.-boid*.75;ink=f;col=(vein>.82?0.:1.)*f;}
  else if(vein>.22){float pD=(vein-.22)/.40;ink=mix(pD,1.,boid);col=mix(dth>=pD*.45?1.:0.,0.,boid);}
  else{ink=boid*.85;col=(vein>.1?1.:0.)*step(.02,ink);}
  return vec2(ink,col);
 }
```

### 2.1 Anatomy of the needle
1. **Cell grid** — `cS = 12` cells per buffer *height* (`PX = q*R.y`, so the cell is square in pixels).
2. **Orientation** — `ang = −.35·cos(w.x·2.1 − t·.4)·2.6`, i.e. the needle direction is driven by the
   **vein field's horizontal gradient**, not by a simulation. Range ≈ ±0.91 rad (±52°).
3. **Body** — a segment from `−dir·cS·.34` to `+dir·cS·.34` centred on the cell, distance via `u5sg`.
   Ink = `clamp(1.35 − dNeedle, 0, 1)` → a 1.35-cell-long tapered needle.
4. **Head** — `step(dHead, 2.1)` adds a round head at the leading end (2.1 px radius).
5. **Occupancy** — `step(.32, h1(cI·1.7))`: **68 %** of cells contain a needle, hash-seeded per cell so the
   layout is stable across frames (no flicker).
6. **Vein masking** — needles are *suppressed* where the vein is dense (`f = 1 − boid·.75`), so they read
   as free agents in the gaps and as embedded structure in the vein cores.

### 2.2 The vein field
```glsl
  vec2 p=q-vec2(asp*.52,.48);
  vec2 w=p*vec2(2.2,3.4)+vec2(-t*.35,0.);
  w+=.42*vec2(sin(w.y*2.4+t*.5),cos(w.x*2.1-t*.4));
  w+=.22*vec2(cos(w.y*5.1-t*.8),sin(w.x*4.8+t*.7));
```
- Anisotropic scale `(2.2, 3.4)` → vertical elongation (myxomycete veins run up the branch).
- Global drift `−t·.35` on x.
- Two successive sine warps at `.42` and `.22` amplitude → the "organic" wander.
- Then `v1/v2` ridge extraction with `min(v1, 1.15·v2)` and `pow(..., 2.2)` → thin filaments.

### 2.3 The colour coin
```glsl
  col=mix(dth>=pD*.45?1.:0.,0.,boid);
```
`dth = b8(gl_FragCoord.xy) + .5/64.` is the **Bayer threshold used as a per-cell random bit**.
This is the one place where the ordered dither is used stochastically instead of as a tone ramp.

---

## 3. How to build a *real* particle version that still reads as Hou2Touch

If a new composition needs actual particles (motion graphics, video), the following rules keep it inside
the system. These are **derived design constraints**, not extracted code — marked as such.

### 3.1 Hard rules
1. **Render particles as ink, not as sprites.** Each particle contributes to a scalar `ink` field
   (a line segment or a disc), which is then dithered. Never draw a particle directly in colour.
2. **Colour only where ink already exists** — the accent must satisfy `ink > threshold * 0.6`.
3. **Particles must be monochrome ink** (`#0b0b0c` coarse / `vec3(.075,.072,.068)` fine) plus at most
   **one** family colour.
4. **Hash-seeded occupancy, not random per frame** — otherwise the composition flickers and leaves the
   "printed" feel.

### 3.2 Particle shape vocabulary
| Shape | How to draw | Existing precedent |
|---|---|---|
| Needle | segment + round head, `u5sg` | motif 15 |
| Dot / node | ring or filled disc, radius `.015–.04` | motifs 23, 27 |
| Short tick | `hline`/`gline` fragment | motifs 7, 22 |
| Cable | sagging `mix` + `sin(πu)` | motif 17 |
| Packet | travelling `step(.7, fract(...))` block with a halo | motif 1 |

### 3.3 Motion vocabulary for particles
The site's motion vocabulary is small and reusable:

| Motion | Formula | Where |
|---|---|---|
| Travelling wave | `sin(k·x − ω·t + φ)` | motifs 1, 6, 8, 13 |
| Orbital | `c + A·(sin(ωt), cos(ωt'))` | motifs 7, 13, 14, 27 |
| Beat-gated | `fract(t·2)`, `exp(−beat·6)` | motifs 0, 9 |
| Cue-driven re-roll | `floor(t·rate)` as a hash seed | motifs 2, 5, 11, 19, 20 |
| Damped growth | `clamp(t·r − i·d, 0, 1)` | motif 23 |
| Pointer-attracted | `mix(target, pointer, PA·k)` | motif 14 |
| Pointer-displaced | Gaussian lens `PA·exp(−d²·18)` | all |

### 3.4 Recommended particle spec (for a faithful extension)
- 200–1200 particles, hash-seeded per index.
- Positions analytic: `p_i(t) = f(i, t)` — no integration, no state.
- Each particle drawn as a **needle** of length ≈ 1.3 cells with a 2 px head, oriented by the local
  field gradient.
- Occupancy probability `step(.32, h1(i·1.7))` — copy motif 15.
- Global drift in the vein direction, not random walk.
- Output to the same `vec2(ink, colmask)` contract, then the shared Bayer threshold.

---

## 4. TouchDesigner implementation notes

- A GLSL TOP with `u` uniforms reproduces motifs 1:1 — no CHOPs needed.
- For a true particle system, drive a **SOP/CHOP** array of positions and render with a **GLSL MAT** or a
  point cloud — but then the dither must be applied in a **post GLSL TOP**:
  read the particle layer's luminance, threshold against `b8(gl_FragCoord.xy)`, output paper/ink/K.
  This preserves the look but costs one extra pass.
- The `CELL` concept maps to the TOP's **pixel size**: set the GLSL TOP resolution to
  `round(width/2) × round(height/2)` and use *Nearest* upscaling in the viewer or a Constant TOP.
- `fwidth` requires derivatives support; TouchDesigner GLSL TOPs on the GPU path support them.

---

## 5. Honest limitations

- The site has **no** particle count, no emitter, no velocity integration — nothing to extract.
- Motif 15's "boids" are not boids: they do not flock, avoid or seek. They are needles aligned to a field.
  Any new work that claims to "continue the boid system" is extrapolating, not extracting.
- The only genuine stochastic element in the whole engine is the Bayer matrix itself, and it is
  deterministic and ordered.
