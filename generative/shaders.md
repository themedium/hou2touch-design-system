# Hou2Touch — Shaders

**Source of truth:** `tools/hero_index_mock.html`, the `FS` template literal (lines ~211–292) and the
`VS` vertex shader (line 207). **All GLSL below is quoted verbatim.** Nothing is paraphrased.

The engine is WebGL 1 (GLSL ES 1.00) with `OES_standard_derivatives` enabled.

---

## 1. Vertex shader — `tools/hero_index_mock.html:207` (verbatim)

```glsl
attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}
```
A full-screen triangle: the buffer is `[-1,-1, 3,-1, -1,3]` (`hero:776`), so three vertices cover clip space
with no index buffer. `drawArrays(gl.TRIANGLES,0,3)` (`hero:818`).

---

## 2. Fragment shader — preamble and helpers (verbatim, `hero:210-234`)

```glsl
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 R;uniform float T;uniform int M;uniform vec3 K;uniform vec2 P;uniform float PA;uniform sampler2D TX;uniform float HT;uniform float FN;uniform vec4 BX;uniform vec2 LC;uniform float RL;uniform vec3 GR;
const vec3 PAP=vec3(.914,.906,.878),INK=vec3(.043,.043,.047);
float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y);}
float fbm3(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s/.875;}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}
float b4(vec2 a){return b2(.5*a)*.25+b2(a);}
float b8(vec2 a){return b4(.5*a)*.25+b2(a);}
float u5sg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float qq=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);return length(pa-ba*qq);}
float fwidth2(float x){return max(1e-4,fwidth(x));}
float vedge(vec2 p,float t){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));
  vec2 h=vec2(h1(i+o),h1(i+o+19.7));vec2 r=o+.5+.42*sin(t*.35+6.2831*h)-f;float d=dot(r,r);
  if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
 return sqrt(d2)-sqrt(d1);}
float gline(float v,float w){float f=fract(v);return 1.-smoothstep(0.,w*fwidth2(v),min(f,1.-f));}
float hline(float dy,float w){return 1.-smoothstep(w*.5,w,abs(dy));}
```

### 2.1 Helper reference (semantics, MEASURED from the code)

| Helper | What it does | Reimplementation note |
|---|---|---|
| `h1(p)` | 2D hash → `[0,1)`. `fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453)` | Standard Dave Hoskins-style hash. **Not** noise — white noise per lattice cell. |
| `vn(p)` | Value noise: bilinear smoothstep interpolation of `h1` on the 4 corners | `f*f*(3-2f)` = smoothstep cubic. |
| `fbm3(p)` | 3-octave value-noise fBm, normalised to `[0,1]` (`/0.875`) | Octave gain `.5`, lacunarity `2.03`, offset `(1.7, 9.2)`. |
| `fbm(p)` | 5-octave fBm, **not** normalised (max ≈ 0.96875) | Same gain/lacunarity. |
| `b2(a)` | Bayer 2×2 threshold: `fract(dot(floor(a), vec2(.5, a.y*.75)))` | Recursive Bayer construction. |
| `b4(a)` | Bayer 4×4: `b2(.5*a)*.25 + b2(a)` | |
| `b8(a)` | Bayer 8×8: `b4(.5*a)*.25 + b2(a)` | Used as the ordered-dither threshold at **pixel** resolution (`gl_FragCoord.xy`). |
| `u5sg(p,a,b)` | Distance from point `p` to segment `a→b` | Used for cables / connector segments. |
| `fwidth2(x)` | `max(1e-4, fwidth(x))` — antialiased line width in screen units | Requires `OES_standard_derivatives`. |
| `vedge(p,t)` | Worley/cellular F2−F1 edge distance over a jittered 3×3 lattice, with the jitter animated by `sin(t*.35)` | Used by the physarum motif. Returns **distance**, not ink. |
| `gline(v,w)` | Antialiased grid line at fractional coordinate `v`, width `w` | Screen-space width via `fwidth2`. |
| `hline(dy,w)` | Antialiased horizontal line at vertical offset `dy`, half-width `w` | `1 - smoothstep(w*.5, w, abs(dy))`. |

---

## 3. The `motif()` function — dispatch and shared preamble (verbatim, `hero:235-243`)

```glsl
// returns x = ink density, y = colour mask
vec2 motif(vec2 uv,float asp,float t){
 vec2 q=vec2(uv.x*asp,uv.y);
 // pointer lens: local disturbance
 vec2 d=q-vec2(P.x*asp,P.y);float lens=PA*exp(-dot(d,d)*18.);
```

**The pointer lens** is a Gaussian bump centred on the pointer, radius ≈ `1/√18 ≈ 0.236` in aspect-corrected
UV, amplitude `PA`. `PA` is smoothed toward 1 at `.08` per frame (`hero:812`: `sc.pa+=(sc.pat-sc.pa)*.08`).
Every motif uses `lens` differently (displacement, brightness, angle shift, extra line weight) — but always
as a *local* distortion, never global.

---

## 4. Uniform contract (MEASURED)

From the uniform declarations (`hero:211`) and the per-frame upload (`hero:810-816`):

| Uniform | Type | Meaning | Set where |
|---|---|---|---|
| `R` | `vec2` | Render target size **in device pixels / dither cells** (`cv.width`, `cv.height`) | `gl.uniform2f(u.R,sc.cv.width,sc.cv.height)` |
| `T` | `float` | Global time in seconds, offset by a random phase | `t=(6.0+(now-sc.t0)/1000)*(FINE?.72:1)` (`hero:809`) |
| `M` | `int` | Motif id (0–28) | `gl.uniform1i(u.M,sc.m)` |
| `K` | `vec3` | Family colour of the page, linear 0–1 | `gl.uniform3fv(u.K,sc.k)` |
| `P` | `vec2` | Pointer position, normalised to the band (0–1, y down) | `gl.uniform2f(u.P,sc.p[0],sc.p[1])` |
| `PA` | `float` | Pointer influence amount, 0→1 smoothed | `gl.uniform1f(u.PA,sc.pa)` |
| `TX` | `sampler2D` | Knockout mask texture (the rendered title glyphs) | `gl.uniform1i(u.TX,0)` |
| `HT` | `float` | Has-texture flag: 1 when the mask has been baked | `gl.uniform1f(u.HT,sc.ht)` |
| `FN` | `float` | "Fine" mode flag (1 = fine/print-grain, 0 = coarse 3 px) | `gl.uniform1f(u.FN,FINE?1:0)` |
| `BX` | `vec4` | Title bounding box in band UV: `(x0,y0,x1,y1)` | `gl.uniform4fv(u.BX,sc.bx)` |
| `LC` | `vec2` | Loupe centre (UV) | `gl.uniform2f(u.LC,lx,ly)` |
| `RL` | `float` | Loupe radius (UV) = `0.17` | `gl.uniform1f(u.RL,RL)` |
| `GR` | `vec3` | Grid origin x, grid cell width, grid right edge — from the DOM tick rail | `gl.uniform3fv(u.GR,sc.gr)` |

### 4.1 Time (MEASURED, `hero:809`)
```js
const t=(6.0+(now-sc.t0)/1000)*(FINE?.72:1);
```
- Starts at **t = 6.0** so the first frame is already a "successful phase" (the band never opens on a dead frame).
- `sc.t0 = performance.now() - Math.random()*4000` → each hero starts at a **random phase within the first 4 s** of the loop, so multiple heroes on one page are desynchronised.
- Fine mode runs the clock at **0.72×** (slower, calmer).

### 4.2 The `vec2(ink, colmask)` return convention
Every motif returns a `vec2`:
- `.x` = **ink density** in `[0,1]`. `0` = bare paper, `1` = solid black.
- `.y` = **colour mask** in `[0,1]`. `1` means "this pixel may take the family colour K".

The composite step (`hero:298-303`) is:
```glsl
 float th=b8(px)+.5/64.;
 vec3 c=PAP;vec3 ink=INK;
 ...
 if(m.x>th)c=ink;
 if(m.y>.5&&m.x>th*.6)c=K;
```
i.e. **ink threshold first** (ordered dither), then **colour only where ink already exists** (at 60 % of the
threshold, so accent pixels must be at least marginally inked). This is why the accent never floods.

### 4.3 Dither cell size (MEASURED, `hero:206` and `hero:781`)
```js
const CELL=FINE?2:3; // css px per dither cell (fine: 2 px — print grain instead of pixel crunch)
```
```js
cv.width=Math.max(1,Math.round(r.width/CELL));
cv.height=Math.max(1,Math.round(r.height/CELL));
gl.viewport(0,0,cv.width,cv.height);
```
So the **canvas backing store is downscaled by CELL**, and the CSS scales it back up with
`image-rendering:pixelated`. Each shader pixel = one dither cell = 2 CSS px (fine) or 3 CSS px (coarse).
The Bayer threshold is evaluated at `gl_FragCoord.xy`, i.e. **per dither cell**, so the 8×8 Bayer matrix tiles
across the downscaled buffer — the visible dot pitch is `CELL × 8` CSS px (16 px fine / 24 px coarse).

`devicePixelRatio` is **not** used in this engine: the dither cell size is defined in CSS px and the buffer is
sized from `getBoundingClientRect()` (`hero:780-783`), so a retina display gets the same *logical* cell size.
This is a deliberate choice (print-like, resolution-independent dither), and it is worth preserving.

---

## 5. `main()` — the composite (verbatim, `hero:294-322`)

```glsl
void main(){
 vec2 px=gl_FragCoord.xy;vec2 uv=px/R;uv.y=1.-uv.y;
 float asp=R.x/R.y;
 vec2 m=motif(uv,asp,T);
 float dL=length((uv-LC)*vec2(asp,1.));
 bool inL=FN>.5&&dL<RL;
 vec2 mz=motif(LC+(uv-LC)/3.2,asp,T);            // loupe: same field at ×3.2 — computed unconditionally (derivatives)
 if(inL)m=mz;
 float th=b8(px)+.5/64.;
 vec3 c=PAP;vec3 ink=INK;
 if(FN>.5){
  ink=vec3(.075,.072,.068);                         // graphite field, type stays pure ink
  m.x=min(m.x,.95);                               // no dead-black slabs: solids keep a print texture
  vec2 cq=clamp(uv,BX.xy,BX.zw);float dq=length((uv-cq)*vec2(asp,1.));
  m.x*=mix(.62,1.,smoothstep(.0,.15,dq));         // quiet zone: field breathes around the lockup
  m.y*=step(.015,dq);
 }
 if(m.x>th)c=ink;
 if(m.y>.5&&m.x>th*.6)c=K;
 if(FN>.5){                                       // instrument layer: grid, registration, reticle, paper dots
  vec3 gph=vec3(.42,.41,.39);float cy=1./R.y,cx=1./R.x;
  bool paper=(c==PAP);
  if(paper&&!inL&&mod(floor(px.x),7.)<.5&&mod(floor(px.y),7.)<.5)c=mix(PAP,gph,.55);
  float gx=(uv.x-GR.x)/GR.y;float kx=floor(gx+.5);
  float onV=(kx>=0.&&kx<=11.)?step(abs(uv.x-(GR.x+kx*GR.y)),cx*.5):0.;
  onV=max(onV,step(abs(uv.x-GR.z),cx*.5));
  if(paper&&!inL&&onV>.5&&mod(floor(px.y),5.)<1.)c=gph;
  for(int j=1;j<3;j++){float yy=float(j)/3.;
   float nearV=max((kx>=0.&&kx<=11.)?step(abs(uv.x-(GR.x+kx*GR.y)),4.*cx):0.,step(abs(uv.x-GR.z),4.*cx));
   if(!inL&&step(abs(uv.y-yy),cy*.5)*nearV>.5)c=INK;
   if(!inL&&onV>.5&&step(abs(uv.y-yy),4.*cy)>.5)c=INK;}
  float ring=step(abs(dL-RL),cy*.6);
  float ring2=step(abs(dL-RL-.022),cy*.5)*step(.5,fract(atan(uv.y-LC.y,(uv.x-LC.x)*asp)*24./6.2831));
  float ch=step(abs(uv.y-LC.y),cy*.5)*step(RL+.012,dL)*step(dL,RL+.075);
  float cv2=step(abs((uv.x-LC.x)*asp),cy*.5)*step(RL+.012,dL)*step(dL,RL+.075);
  if(ring+ch+cv2>.5)c=INK;
  if(ring2>.5)c=gph;
  if(dL<3.*cy)c=K;
 }
 if(HT>.5&&texture2D(TX,uv).a>.5)c=PAP;
 gl_FragColor=vec4(c,1.);
}
```

### 5.1 The loupe (MEASURED)
- Fine mode only (`FN>.5`). Radius `RL = 0.17` UV.
- Inside the loupe the field is recomputed at **×3.2 magnification**:
  `motif(LC+(uv-LC)/3.2, asp, T)`.
- `mz` is computed **unconditionally** — the comment says so explicitly — because `fwidth`/`fwidth2` inside
  the motif must have valid derivatives from a single, unbranched call.
- Outside the loupe, ink is dimmed by a "quiet zone" around the title bbox `BX`:
  `m.x*=mix(.62,1.,smoothstep(.0,.15,dq))`, and the colour mask is killed near the title:
  `m.y*=step(.015,dq)`.
- The loupe centre `LC` orbits on a slow Lissajous (`lx=.7+.16*sin(t*.13)`, `ly=.5+.1*sin(t*.17+1)`,
  `hero:815`) and **avoids the title bbox** (`bx[2]<.72&&asp>1.4` branch), except when the pointer is active
  (`if(sc.pa>.02){...}` — "pointer wins over the title-avoid rule").

### 5.2 Fine-mode differences (MEASURED)
| Coarse (`FN=0`) | Fine (`FN=1`) |
|---|---|
| cell = 3 CSS px | cell = 2 CSS px |
| ink = `INK` `#0b0b0c` | ink = `vec3(.075,.072,.068)` **graphite** — "type stays pure ink" |
| solid slabs allowed | `m.x=min(m.x,.95)` — "no dead-black slabs: solids keep a print texture" |
| no instrument layer | paper dots, 12-column registration grid, reticle + crosshair |
| no loupe | loupe with ×3.2 magnification |
| no title quiet-zone | quiet zone around `BX` |

---

## 6. Full motif source (verbatim)

Every motif below is quoted exactly as it appears in `tools/hero_index_mock.html`. The
`if(M==N){...}` blocks are reproduced in the file order in which they appear.

### M==0 — chladni (`hero:244-257`)
```glsl
 if(M==0){ // chladni — sound-reactive plate, crisp nodal lines, beat ring at 120 bpm
  float beat=fract(t*2.);float env=exp(-beat*6.);
  float ph=t*.09;float n=2.+1.5*(1.+sin(ph)),m=5.+1.5*(1.+cos(ph*.7));
  vec2 c=(q-vec2(asp*.66,.5))*3.14159*.95;
  float v=cos(n*c.x)*cos(m*c.y)-cos(m*c.x)*cos(n*c.y);
  v+=lens*.9*sin(length(d)*36.-t*6.);
  float w=.05+.05*env;
  float line=1.-smoothstep(w*.5,w,abs(v));
  float sand=(1.-smoothstep(w,w*3.2,abs(v)))*.38;
  float r=length(q-vec2(asp*.66,.5));
  float ring=(1.-smoothstep(.0,.012,abs(r-beat*1.25)))*env;
  return vec2(max(line,sand)+ring*.9,step(.5,ring));
 }
```
Chladni plate: `cos(nx)cos(my) - cos(mx)cos(ny)`, mode numbers `n,m` drift on slow sines.
Nodal lines are the zero set; a "sand" halo (`.38` weight) is added around them.
A beat ring expands at 120 bpm (`fract(t*2.)` = 2 beats/s) with exponential decay `exp(-beat*6.)`.

### M==1 — streams (`hero:258-270`)
```glsl
 if(M==1){ // streams — parallel signals, one carrier, solid packets
  float best=0.,col=0.;
  for(int i=0;i<7;i++){float fi=float(i);
   float y=.16+fi*.115+.06*sin(q.x*(1.3+fi*.17)-t*(.3+fi*.025)+fi*1.9)+.02*sin(q.x*5.-t*1.1+fi);
   y+=lens*.06*sin(fi*2.+t);
   float w=(i==3?.022:.0045+.002*mod(fi,2.));
   float dist=abs(uv.y-y);
   float l=1.-smoothstep(w*.6,w*1.4,dist);
   float pk=step(.7,fract(q.x*(2.2+fi*.9)-t*(.22+fi*.06)+fi*.37));
   float halo=(1.-smoothstep(w,w+.035,dist))*.32*pk;  // packet: dithered body around the line
   float v=max(l,halo);
   if(v>best){best=v;col=(i==1||i==5)?pk*l:0.;}
  }
  return vec2(best,col);
 }
```
7 parallel signal lines; each is a sum of two travelling sine waves (a carrier + a ripple).
Line index 3 is the **carrier** (4× wider: `w=.022` vs `.0045`).
Packets travel along each line (`step(.7, fract(...))`) and produce a dithered halo body.
Lines 1 and 5 are colour-eligible.

### M==2 — wall (`hero:271-289`)
```glsl
 if(M==2){ // wall — media server outputs, 16:9 tiles; every tile cuts on its own clock, with a short scan wipe
  vec2 g=vec2(max(3.,floor(asp*4.*.5625+.5)),4.);
  vec2 cell=floor(uv*g);vec2 f=fract(uv*g);
  float gap=step(.04,f.x)*step(f.x,.96)*step(.07,f.y)*step(f.y,.93);
  float per=1.3+3.4*h1(cell*1.71+.3);float ph=h1(cell*2.37+.9)*per;
  float tt=(t+ph)/per;float cue=floor(tt);float age=fract(tt)*per;   // seconds since this tile's last cut
  float wipe=clamp(age/.28,0.,1.);float sel=step(1.-wipe,f.y);         // new picture scans in from the top
  float vv[2];float lv[2];
  for(int s2=0;s2<2;s2++){float cu=cue-float(s2);float r=h1(cell+cu*7.13);float k=floor(r*4.);float v;
   if(k<1.)v=f.x*.9;                                   // ramp
   else if(k<2.)v=step(.55,fract(f.x*4.+t*.4+r*3.))*.9; // bars
   else if(k<3.)v=1.-smoothstep(.18,.22,length((f-.5-vec2(r-.5,0.)*.3)*vec2(1.78,1.)));// disc
   else v=smoothstep(.35,.75,fbm(f*2.5+cell+cu+t*.15));  // feed
   vv[s2]=v;lv[s2]=step(.88,h1(cell+cu*3.1));}
  float v=mix(vv[1],vv[0],sel),live=mix(lv[1],lv[0],sel);
  float edge=(1.-step(.999,wipe))*(1.-smoothstep(0.,.035,abs(f.y-(1.-wipe))));  // bright scan line during the cut
  v=max(v,edge);
  v=mix(v,1.-v,clamp(lens*2.,0.,1.));
  return vec2(v*gap,live*gap*step(.5,v));
 }
```
Video wall: `4` rows of 16:9 tiles; the grid width adapts to the aspect (`floor(asp*4.*.5625+.5)`).
Each tile has its own period (`1.3 + 3.4*hash`) and phase, and **cuts on its own clock** with a 0.28 s
top-to-bottom scan wipe plus a bright scan line at the wipe edge.
Tile content is chosen by a hash into 4 generators: ramp / bars / disc / fbm feed.
Pointer inverts the tile (`v=mix(v,1.-v,...)`).

### M==3 — terrain (`hero:290-297`)
```glsl
 if(M==3){ // terrain — topographic map: contours, index contours, one elevation band
  vec2 p=q*1.15+vec2(t*.025,0.);
  float hh=.7*fbm3(p)+.3*fbm3(p*1.9+3.7)+lens*.18;
  float lv=hh*16.;float fl=fract(lv);float dd=min(fl,1.-fl)/fwidth2(lv);
  float idx=step(mod(floor(lv+.5),5.),.5);
  float line=1.-smoothstep(.5+idx*.9,1.2+idx*1.1,dd);
  float hx=fbm3(p+vec2(.01,0.))-fbm3(p);
  float shade=clamp(-hx*38.,0.,1.)*.24;
  float band=step(.6,hh)*step(hh,.64);
  return vec2(max(line,shade)+band*.45,band);
 }
```
Topographic map: 16 contour levels from 3-octave fBm; every 5th level is an **index contour** (wider).
Hypsometric tint from the horizontal gradient; one narrow elevation band (`.60–.64`) is colour-eligible.
The field scrolls left at `t*.025`.

### M==5 — space frame (`hero:298-308`)
```glsl
 if(M==5){ // space frame — tilted triangulated lattice in perspective, cells switching on cues
  float hz=.02;float yy=uv.y-hz;if(yy<=0.)return vec2(0.);
  float z=.42/yy;float X=(q.x-asp*.6)*z*.5;float Z=z+t*.3;
  float cr=cos(.35),sr=sin(.35);vec2 g=vec2(cr*X-sr*Z,sr*X+cr*Z)*6.5;
  float a=g.y,b=g.x*.866+g.y*.5,cc=g.x*.866-g.y*.5;
  float fade=smoothstep(.04,.3,yy);
  float ln=max(gline(a,1.2),max(gline(b,1.2),gline(cc,1.2)))*fade;
  vec3 id=floor(vec3(a,b,cc));float cue=floor(t*.8);float hh=h1(id.xy*1.3+id.z*3.1+cue*1.7);
  float fill=step(.86,hh)*(hh>.94?.9:.5)*fade;float col=step(.94,hh)*step(hh,.975)*fade;
  return vec2(max(ln,fill)+lens*.2*ln,col);
 }
```
A triangulated lattice (hexagonal coords `a,b,cc`) in one-point perspective (`z=.42/yy`), tilted by
`.35 rad`. Individual cells switch on/off per cue (`floor(t*.8)`), with a rare bright "col" cell.

### M==6 — lissajous (`hero:309-320`)
```glsl
 if(M==6){ // woven lissajous — two twisting ribbons of threads, over/under
  float px=1.15/R.y;float ink=0.,cl=0.;
  for(int r=0;r<2;r++){float fr=float(r);
   float x=q.x+lens*.08;
   float cy=.5+(.24-.06*fr)*sin(x*(1.15+.5*fr)+t*(.35+.12*fr)+fr*2.4);
   float w=(.15+.04*fr)*cos(x*(1.9-.6*fr)-t*(.5+.1*fr)+fr);
   for(int i=0;i<13;i++){float s2=float(i)/12.-.5;
    float yi=cy+w*s2*2.;float l=hline(uv.y-yi,px*(1.3+.0*fr));
    if(r==0)ink=max(ink,l);else cl=max(cl,l);}
  }
  float over=step(.5,fract(q.x*1.6+t*.05));
  float v=max(ink,cl);float colm=cl*(over+(1.-ink));
  return vec2(v,step(.5,colm));
 }
```
Two ribbons, each built from **13 horizontal thread lines** whose centres follow a sine curve and whose
half-widths oscillate. Ribbon 0 is ink, ribbon 1 is the colour ribbon; the weave alternates via
`over = step(.5, fract(q.x*1.6+t*.05))` — a checkerboard over/under.

### M==7 — beams (`hero:321-337`)
```glsl
 if(M==7){ // beam lattice — five fixtures on a truss throw wedges of light onto a stage grid
  float v=0.,col=0.;
  float tr=max(hline(uv.y-.06,2.4/R.y),hline(uv.y-.085,1.2/R.y));
  for(int i=0;i<5;i++){float fi=float(i);
   vec2 o=vec2((fi+.5)/5.*asp,.07);vec2 dd=q-o;
   if(dd.y<=0.)continue;
   float ang=atan(dd.x,dd.y);float aim=.5*sin(t*.4+fi*1.7)+lens*.25*sign(P.x*asp-o.x);
   float spread=.1+.03*sin(t*.33+fi);
   float edge=abs(ang-aim);float L=length(dd);
   float body=(1.-smoothstep(spread*.85,spread,edge))*mix(.62,.12,smoothstep(.0,1.,L));
   float rim=1.-smoothstep(.0,1.6/R.y/max(L,.05),abs(edge-spread));
   float b=max(body,rim*.95);
   if(b>v){v=b;col=(i==2)?step(.2,body):0.;}
   v=max(v,1.-smoothstep(.012,.02,L));
  }
  float fl=uv.y-.7;
  if(fl>0.){float zz=.18/fl;float gx=(q.x-asp*.5)*zz;
   float grid=max(gline(gx*1.5,1.),gline(zz*1.2,1.))*smoothstep(0.,.1,fl);v=max(v,grid*.95);}
  return vec2(max(v,tr),col);
 }
```
Five moving-head fixtures on a truss (two horizontal rails at `.06`/`.085`). Each throws a wedge defined by
an angular aim (`sin(t*.4+fi*1.7)`), a spread, a distance falloff `.62→.12`, and a bright rim.
A perspective floor grid starts at `uv.y = .7`. Fixture 2 is colour-eligible.

### M==8 — feedback (`hero:338-350`)
```glsl
 if(M==8){ // video feedback — a scanline ribbon echoed back in time
  float v=0.,col=0.;
  for(int i=9;i>=0;i--){float fi=float(i);float tt=t-fi*.22;
   float x=q.x*(1.-fi*.015)+fi*.035;
   float cy=.46+.2*sin(x*1.5-tt*.8)+.07*sin(x*4.1+tt*1.3)-fi*.018+lens*.05;
   float th=.075-fi*.004;float dy=abs(uv.y-cy);
   float inside=1.-step(th,dy);
   float scan=step(.5,fract(gl_FragCoord.y*.5));
   float dens=mix(1.,.28,fi/9.);
   float b=inside*(i==0?1.:dens*scan);
   if(inside>.5){v=b;col=(mod(fi,3.)==1.)?1.:0.;}
  }
  return vec2(v,col*step(.5,v));
 }
```
Ten echoes of one ribbon, each delayed by `.22 s` and scaled slightly (`.015` per echo), with density
decaying `.28`→1 and a **scanline modulation** every 2 buffer rows (`fract(gl_FragCoord.y*.5)`).
Echoes with `fi % 3 == 1` are colour-eligible. The pointer thickens the ribbon (`lens*.05`).

### M==9 — barcode (`hero:351-362`)
```glsl
 if(M==9){ // ikeda barcode — rows of data at different rates, inversions on the beat
  float rows=7.;float rid=floor(uv.y*rows);float ry=fract(uv.y*rows);
  float hr=h1(vec2(rid,3.));
  float f=mix(18.,220.,hr*hr);float sp=(hr-.5)*.6;
  float cx=floor(q.x*f+t*sp*f*.2);float on=step(.5+.3*(h1(vec2(rid,9.))-.5),h1(vec2(cx,rid)));
  float gap=step(.06,ry)*step(ry,.94);
  float beat=floor(t*2.);float inv=step(.86,h1(vec2(rid,beat)));
  on=abs(on-inv);
  float thin=step(abs(ry-.5),.08)*step(.5,fract(q.x*f*2.));
  float colrow=step(.8,h1(vec2(rid,beat*.0+5.)));
  float v=on*gap;
  return vec2(v+lens*.0,colrow*v);
 }
```
7 rows, each with its own bar frequency (`18…220`, quadratically distributed by row hash) and drift speed.
Bar on/off by hashing the bar index. On every beat (`floor(t*2.)`) one row **inverts** (`abs(on-inv)`),
which is the "Ikeda" visual signature. One row is the colour row.

### M==10 — op-art (`hero:363-373`)
```glsl
 if(M==10){ // op-art topology — dense lines lifted by moving bumps
  float hh=0.;
  for(int i=0;i<4;i++){float fi=float(i);
   vec2 c=vec2(asp*(.2+.22*fi)+.18*sin(t*.2+fi*2.),.5+.28*sin(t*.27+fi*1.7));
   hh+=exp(-dot(q-c,q-c)*(9.+fi*3.))*(fi==1.?-.8:1.);}
  hh+=lens*.6;
  float y=uv.y-.11*hh;float N=46.;float f=fract(y*N);
  float w=.18+.5*clamp(hh,0.,1.);
  float l=1.-smoothstep(w*.5-.05,w*.5+.05,abs(f-.5)*1.);
  float v=step(.5,l);
  return vec2(v,step(.55,hh)*v);
 }
```
4 Gaussian bumps (one inverted, weight `-.8`) displace a **46-line** horizontal grid. The displacement is
`.11*hh`; line weight grows with the bump height. Output is a hard `step(.5,l)` → pure black/white
posterisation, ideal for the dither.

### M==11 — fold (`hero:374-385`)
```glsl
 if(M==11){ // folded environment — hairlines, some diamond cells folded to a new angle
  vec2 r=vec2(q.x+q.y,q.x-q.y)*.7071*7.;vec2 cid=floor(r);vec2 cf=fract(r);
  float cue=floor(t*.6);float hh=h1(cid+cue*2.3);
  float ang=step(.72,hh)*(hh*6.28);
  float ca=cos(ang),sa=sin(ang);
  vec2 lp=vec2(ca*q.x-sa*q.y,sa*q.x+ca*q.y);
  float ln=gline(lp.y*38.,1.1);
  float edge=step(.72,hh)*max(gline(r.x,1.2),gline(r.y,1.2));
  float folded=step(.72,hh);
  float shade=folded*step(.88,hh)*.4;
  return vec2(max(max(ln,edge),shade)+lens*.3*ln,folded*step(.93,hh)*ln);
 }
```
A rotated 45° cell grid (`* .7071 * 7.`) where ~28 % of cells (`hh > .72`) are **rotated to a random angle**
and their hairlines are re-drawn in the rotated frame. Some cells get a shade fill (`hh > .88`).

### M==12 — physarum (`hero:386-393`)
```glsl
 if(M==12){ // physarum — transport network: fine filaments + thick trunks
  vec2 p=q*7.+vec2(fbm3(q*2.+t*.05),fbm3(q*2.+4.-t*.04))*1.2+lens*.6;
  float e1=vedge(p,t),e2=vedge(p*.38+3.1,t*.7);
  float fil=1.-smoothstep(.02,.07,e1);
  float trunk=1.-smoothstep(.02,.055,e2);
  float node=1.-smoothstep(.0,.12,length(fract(p)-.5))*.0;
  float v=max(fil*.9,trunk);
  return vec2(v,trunk*step(.6,fbm3(q*1.3+2.)));
 }
```
Slime-mould transport network: the input coordinate is warped by two fBm fields, then two `vedge`
(cellular) evaluations give **fine filaments** (`e1`) and **thick trunks** (`e2`, at 1/2.6 the scale).
Trunks are colour-eligible where the underlying fBm exceeds `.6`.
Note `float node=...*.0;` — the node term is computed but multiplied to zero (dead code, kept for reference).

### M==13 — plotter (`hero:394-402`)
```glsl
 if(M==13){ // flow plotter — fine contour plot with one dense accent body
  vec2 p=q*1.1+vec2(t*.02,0.);float hh=fbm3(p)+.3*fbm3(p*2.3);
  float ln=gline(hh*30.,1.)*.95;
  vec2 c=vec2(asp*.7+.06*sin(t*.3),.4+.05*cos(t*.4));vec2 dd=q-c;
  float rr=length(dd*vec2(1.,1.25));float edgeN=fbm3(dd*5.+t*.1)*.1;
  float blob=1.-step(.2+edgeN,rr);
  float rings=gline(rr*55.+fbm3(dd*9.)*3.-t*.6,1.4);
  float v=mix(ln,max(rings,.25),blob)+lens*.3*ln;
  return vec2(v,blob*step(.5,rings));
 }
```
Pen-plotter look: dense contour lines from fBm (`hh*30`), plus **one dense accent body** — a blob whose
radius is noise-modulated, filled with tight concentric rings (`rr*55 + noise*3 - t*.6`).
The blob travels on a slow ellipse.

### M==14 — rings / interference (`hero:403-411`)
```glsl
 if(M==14){ // interference — two moving sources, rings and a solid disc
  vec2 s1=vec2(asp*.68+.08*sin(t*.3),.48+.06*cos(t*.37)),s2=vec2(asp*.38+.1*cos(t*.25),.55+.08*sin(t*.31));
  s2=mix(s2,vec2(P.x*asp,P.y),PA*.6);
  float r1=length(q-s1),r2=length(q-s2);
  float wv=cos(r1*70.-t*3.)+cos(r2*70.-t*3.);
  float ln=1.-smoothstep(.0,.35,abs(wv));
  float disc=1.-step(.11,r1);
  float halo=1.-step(.125,r1);
  float v=disc>.5?.55:(halo>.5?0.:ln);
  return vec2(v,disc);
 }
```
Two wave sources; interference pattern `cos(r1*70 - t*3) + cos(r2*70 - t*3)`. The second source is
**dragged toward the pointer** (`mix(s2, pointer, PA*.6)`). The disc of source 1 is a solid `.55` ink,
and a 1-pixel halo around it is forced to zero (a clean cut).

### M==15 — swarm13 (`hero:412-431`)
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
The most complex motif. Two layers:
1. **Myxomycete veins** — a domain-warped field `w` (two sinusoidal warps) whose `abs(sin)` ridges are
   combined into a vein mask (`pow(...,2.2)`).
2. **Oriented boid needles** — a 12 px grid; each cell may host one needle, oriented by the local vein
   gradient (`ang`), drawn as a segment via `u5sg`, with a round head (`step(dHead,2.1)`).
The ink value is a **three-way mix** (vein core / vein body / free needles) and the colour mask uses the
Bayer threshold `dth` as a stochastic dither to decide per-cell colour.

### M==22 — bundle (`hero:432-448`)
```glsl
 if(M==22){ // bundle — two tracks of one signal, converging into a single line
  float ink=0.,col=0.;
  float conv=smoothstep(.05,.78,uv.x);
  for(int i=0;i<2;i++){
   float fi=float(i);
   float sgn=fi*2.-1.;
   float y0=.5+sgn*(.26-.245*conv);
   float wv=.010*sin(uv.x*8.5-t*.6+fi*3.14159);
   float y=y0+wv;
   ink=max(ink,hline(uv.y-y,.0030));
   float mk=gline(uv.x*22.-t*.5*(1.+fi),1.3)*step(abs(uv.y-y),.014);
   ink=max(ink,mk*.30*(1.-conv));
  }
  vec2 c=vec2((uv.x-.84)*asp,uv.y-.5);
  float r=length(c);
  float ring=1.-smoothstep(.0012,.0038,abs(r-.075));
  ink=max(ink,ring);
  col=ring*step(.5,uv.x);
  return vec2(min(ink,1.),col);
 }
```
Two signal tracks converge from `±.26` separation to a single line (`conv=smoothstep(.05,.78,uv.x)`).
Each carries vertical tick marks (`gline(uv.x*22 - t*.5*(1+fi))`) that fade out as they converge.
A small ring at `(0.84, 0.5)` is the colour accent.

### M==23 — foundations (`hero:449-470`)
```glsl
 if(M==23){ // foundations — a chain of nodes standing on one baseline
  float ink=0.,col=0.;
  float base=.17;
  ink=max(ink,hline(uv.y-base,.0024));
  for(int i=0;i<9;i++){
   float fi=float(i);
   float x=(fi+.5)/9.;
   float grow=clamp(t*.30-fi*.07,0.,1.);
   float hh=(.09+.40*h1(vec2(fi,7.1)))*grow;
   float y=base+hh;
   float r=length(vec2((uv.x-x)*asp,uv.y-y));
   float node=1.-smoothstep(.0016,.0042,abs(r-.015));
   ink=max(ink,node);
   ink=max(ink,hline(uv.x-x,.0014)*step(base,uv.y)*step(uv.y,y)*(1.-node));
   col=max(col,node*step(.4,grow));
   if(fi<8.){
    float x2=(fi+1.5)/9.;
    float grow2=clamp(t*.30-(fi+1.)*.07,0.,1.);
    float hh2=(.09+.40*h1(vec2(fi+1.,7.1)))*grow2;
    float y2=base+hh2;
    float seg=u5sg(vec2(uv.x*asp,uv.y),vec2(x*asp,y),vec2(x2*asp,y2));
    ink=max(ink,(1.-smoothstep(.0008,.0020,seg))*step(.15,min(grow,grow2)));
   }
  }
  return vec2(min(ink,1.),col);
 }
```
9 nodes on a baseline at `y=.17`. Each grows up over time (`grow = clamp(t*.30 - fi*.07, 0, 1)`) — a
**staggered chain reaction**. Nodes are circles (radius `.015`); vertical stems connect node to baseline;
diagonal connectors (`u5sg`) join adjacent nodes.

### M==24 — procedural3d (`hero:471-484`)
```glsl
 if(M==24){ // procedural 3d — instanced cells, each sized and turned by its own data
  float ink=0.,col=0.;
  vec2 g=q*13.;
  vec2 id=floor(g);vec2 f=fract(g)-.5;
  float hs=h1(id*1.7+3.1);
  float hs2=h1(id*.7+9.4);
  float rot=t*.10+hs2*6.2831;
  vec2 r=vec2(f.x*cos(rot)-f.y*sin(rot),f.x*sin(rot)+f.y*cos(rot));
  float sz=.16+.46*hs;
  float box=max(abs(r.x),abs(r.y));
  float sq=1.-smoothstep(.0022,.0055,abs(box-sz*.5));
  float fill=step(box,sz*.5)*.34;
  float sq2=1.-smoothstep(.0018,.0042,abs(box-sz*.5*.58));
  ink=max(max(sq,fill),sq2*.55);
  col=max(sq,fill*.8)*step(.72,hs);
  return vec2(min(ink,1.),col);
 }
```
A 13×13 grid of instances. Each instance is a **square outline** (a fake 3D box), sized by its own hash
(`.16… .62`) and rotated by `t*.10 + hash*2π`. A filled variant at `.34` weight and an inner square
(`*.58`) create the "3D" read. Instances with `hs > .72` are colour-eligible.

### M==25 — interactive (`hero:485-498`)
```glsl
 if(M==25){ // interactive — a sensor field answering the pointer
  float ink=0.,col=0.;
  vec2 g=q*6.;
  vec2 gf=fract(g)-.5;
  float nodes=1.-smoothstep(.0020,.0052,abs(length(gf)-.27));
  ink=max(ink,nodes*.72);
  ink=max(ink,gline(g.x,1.1)*.30);
  ink=max(ink,gline(g.y,1.1)*.30);
  // волна всегда: без указателя расходится от центра — поле живёт само
  vec2 dc=vec2((uv.x-.5)*asp,uv.y-.5);
  float rd=length(dc);
  float ripple=(.5+.5*sin(rd*26.-t*2.2))*exp(-rd*1.5);
  ink=max(ink,ripple*.85);
  col=max(col,ripple*step(.62,ripple));
  return vec2(min(ink,1.),col);
 }
```
A 6×6 sensor grid (rings + grid lines at `.30` weight) plus a **radial ripple that always runs from the
centre**, even without a pointer ("поле живёт само"). The ripple's crest (`.62`) is colour-eligible.

### M==26 — path3d (`hero:499-510`)
```glsl
 if(M==26){ // 3d path — an isometric wireframe lattice
  float u=(q.x*.866+q.y*.5);
  float v=(-q.x*.866+q.y*.5);
  float w=q.y;
  float sp=.105;
  float dr=t*.05;
  float l1=gline(u/sp+dr,1.25);
  float l2=gline(v/sp-dr,1.25);
  float l3=gline(w/sp*.92,1.10);
  float ink=max(max(l1,l2)*.55,l3*.30);
  ink*=.30+.70*smoothstep(.10,.92,uv.x);
  float col=l1*step(.80,uv.x)*step(.5,fract(u/sp+dr));
  return vec2(min(ink,1.),col);
 }
```
Isometric projection: `u = x*cos30 + y*sin30`, `v = -x*cos30 + y*sin30`, `w = y`.
Three families of lines (two horizontal, one vertical) at spacing `.105`, drifting apart over time (`dr=t*.05`).
Fade with depth (`smoothstep(.10,.92,uv.x)`); the right-hand fifth is colour-eligible.

### M==27 — light (`hero:511-525`)
```glsl
 if(M==27){ // light — pools of light on a stage floor, in perspective
  float ink=0.,col=0.;
  for(int i=0;i<5;i++){
   float fi=float(i);
   float y=.20+fi*.155;
   float persp=.55+fi*.34;
   for(int j=0;j<5;j++){
    float fj=float(j);
    float x=.5+((fj-2.)*.30)/(1.+fi*.40);
    float r=length(vec2((uv.x-x)*asp,(uv.y-y)*persp));
    float pulse=.50+.50*sin(t*1.05+fi*.9+fj*1.3);
    float ring=1.-smoothstep(.0030,.0075,abs(r-.150));
    float glow=(1.-smoothstep(.0,.270,r))*.46;
    ink=max(ink,max(ring,glow)*pulse);
    col=max(col,ring*step(.68,pulse));
   }
  }
  return vec2(min(ink,1.),col);
 }
```
A 5×5 grid of light pools on a floor, in **perspective** (rows are spaced `.155` and vertically compressed by
`persp = .55 + i*.34`). Each pool = a crisp ring at radius `.150` + a soft radial glow (`.46`), pulsing at
`t*1.05` with a per-cell phase. Bright pulses become colour.

### M==28 — avperf (`hero:526-540`)
```glsl
 if(M==28){ // av performance — a radial spectrum around the centre
  float ink=0.,col=0.;
  vec2 c=vec2((uv.x-.5)*asp,uv.y-.5);
  float a=atan(c.y,c.x);
  float r=length(c);
  float bins=48.;
  float an=a/6.2831853+.5;
  float bi=floor(an*bins);
  float f=fract(an*bins);
  float amp=.14+.30*(.5+.5*sin(bi*1.7+t*1.8))*(.5+.5*sin(bi*.53-t*.65));
  float inBar=step(.08,f)*step(f,.92);
  float bar=step(r,.34+amp)*inBar*step(.150,r);
  float cap=hline(r-(.34+amp),.0080)*inBar*step(.150,r);
  ink=max(bar*.72,cap);
  ink=max(ink,(1.-smoothstep(.0030,.0075,abs(r-.34)))*.85);
  col=bar*step(.70,amp/.44);
  return vec2(min(ink,1.),col);
 }
```
A **radial spectrum analyser**: 48 angular bins, each with an amplitude from two beating sines
(`sin(bi*1.7 + t*1.8)` × `sin(bi*.53 - t*.65)`). Bars radiate from radius `.150` to `.34+amp` with a bright
cap line. A static circle at `.34` is always drawn (the "outer ring" instrument reference).

### M==4 — warp (`hero:541-550`, explicit block)
```glsl
if(M==4){ // warp — domain-warped fbm, posterised into dithered tone steps (явный блок; раньше жил как fallback)
  vec2 p=q*.95;vec2 a=vec2(fbm(p+t*.04),fbm(p+vec2(5.2,1.3)-t*.035));
  vec2 b=vec2(fbm(p+2.6*a+vec2(1.7,9.2)+t*.025),fbm(p+2.6*a+vec2(8.3,2.8)));
  float v=fbm(p+2.6*b+lens*1.5);
  float sv=smoothstep(.3,.8,v);float st=floor(sv*6.)/6.;
  float e=fract(sv*6.);float edge=(1.-smoothstep(.0,.08,min(e,1.-e)))*step(.001,sv)*step(sv,.999);
  return vec2(max(st*.5,edge*.95),step(.8,st)*(1.-edge));
 }
```
The fallback warp is also present as the **implicit tail** of `motif()` (`hero:551-559`, identical code,
reachable when no `if(M==N)` matched). Domain-warped fBm (two warp stages, strength `2.6`), posterised into
**6 tone steps**, with the step edges drawn as bright lines (`edge`) — this is the classic "posterised
dithered tone ramp" motif.

### M==16 — moire (`hero:560-585`)
```glsl
if(M==16){ // moire — two drifting interference screens; rings beat against a rotated grid
  float dth=b8(gl_FragCoord.xy)+.5/64.;
  vec2 c=q-vec2(.5,.5);
  c.x*=asp;
  float r=length(c);
  float a1=atan(c.y,c.x);
  // screen 1: concentric rings, slowly breathing
  float rings=sin(r*(52.+lens*18.)-t*.55);
  // screen 2: rotated grid of lines, counter-drifting
  float ang=.62+t*.035;
  vec2 g=vec2(cos(ang)*c.x-sin(ang)*c.y, sin(ang)*c.x+cos(ang)*c.y);
  float grid=sin(g.x*(46.+lens*10.)+t*.30)*sin(g.y*(46.+lens*10.)-t*.22);
  // third beat: radial spokes, very slow
  float spokes=sin(a1*18.+r*9.-t*.16);
  float mo=rings*.52+grid*.30+spokes*.18;
  float v=smoothstep(-.18,.42,mo);
  // posterise into dithered tone steps like the rest of the family
  float st=floor(v*5.)/5.;
  float e=fract(v*5.);
  float edge=(1.-smoothstep(.0,.10,min(e,1.-e)))*step(.02,v)*step(v,.98);
  float ink=max(st*.55,edge*.92);
  float col=step(.72,st)*(1.-edge);
  // dithered falloff toward the edges keeps the band from reading as a flat plate
  float fall=1.-smoothstep(.55,1.25,r);
  ink*=mix(.55,1.,fall);
  col*=mix(.35,1.,fall);
  ink=max(ink,step(.5,dth)*.10*fall);
  return vec2(ink,col);
 }
```
Three superposed screens — breathing concentric rings, a counter-rotating grid, and slow radial spokes —
mixed with weights `.52/.30/.18`. Posterised into **5 tone steps**. The Bayer threshold `dth` is used as a
**stochastic dither in the falloff region** (`step(.5,dth)*.10*fall`) so the band edge dissolves into grain
instead of a flat plate.

### M==17 — rack (`hero:586-608`)
```glsl
if(M==17){ // rack — modular panels of uneven width, jacks, sliders, patch cables
  float ink=0.,col=0.;
  for(int i=0;i<3;i++){
   float fi=float(i);
   float y0=.10+fi*.28,y1=y0+.24;
   float inRow=step(y0,uv.y)*step(uv.y,y1);
   float hh=(uv.y-y0)/(y1-y0);
   float rail=max(hline(uv.y-y0,.0035),hline(uv.y-y1,.0035));
   float n=4.+floor(h1(vec2(fi,3.7))*4.);
   float x=uv.x*n+h1(vec2(fi,7.1))*n;
   float seam=gline(x,1.3);
   float fm=fract(x);
   vec2 kc=vec2((fm-.5)*1.35,(hh-.42)*1.9);
   float knob=1.-smoothstep(.085,.105,length(kc-vec2(0.,0.)));
   float knob2=1.-smoothstep(.085,.105,length(kc-vec2(.40,0.)));
   float sl=step(.29,fm)*step(fm,.345)*step(.30,hh)*step(hh,.72);
   float v=max(max(rail,seam*.85),max(knob,knob2)*.85);
   v=max(v,sl*.42);
   float c=max(knob,knob2)*step(.55,hh);
   ink=max(ink,inRow*v);col=max(col,inRow*c);
  }
  for(int j=0;j<3;j++){
   float fj=float(j);
   float xa=h1(vec2(fj,11.3))*.9,xb=xa+.10+h1(vec2(fj,13.7))*.22;
   float ya=.22+fj*.26,yb=ya+.16;
   float uu=clamp((uv.x-xa)/max(xb-xa,.05),0.,1.);
   float cy=mix(ya,yb,uu)+sin(uu*3.14159)*(.09+.05*h1(vec2(fj,17.1)));
   float cable=1.-smoothstep(.0022,.0045,abs(uv.y-cy));
   ink=max(ink,cable*.9);
  }
  return vec2(ink,col);
 }
```
Three **modular rack rows** (Eurorack-style): each row has a random module count `4…7`, seams between
modules, two knobs per module (circles) and a slider slot. Below, **3 patch cables** are drawn as sagging
curves (`mix` + `sin(πu)` sag), each connecting two random x positions.

### M==18 — shader (`hero:609-627`)
```glsl
if(M==18){ // shader — procedural field posterised, then a post pass: scanlines and vignette
  vec2 c=q-vec2(asp*.5,.5);float r=length(c),a=atan(c.y,c.x);
  float w=fbm3(vec2(a*1.9,r*2.4)+t*.05);
  float v=sin(r*(22.+lens*14.)-t*.75+w*7.)*.5+.5;
  v=pow(v,1.5);
  float st=floor(v*6.)/6.;float e=fract(v*6.);
  float edge=(1.-smoothstep(.0,.10,min(e,1.-e)))*step(.02,v)*step(v,.98);
  float ink=max(st*.48,edge*.92);
  // цвет — только на одном верхнем тоне и только там, где нет линии: акцент, не заливка
  // только самый верхний тон (st=.833) — как бейдж-акцент, а не заливка
  float col=step(.80,st)*(1.-edge)*(1.-smoothstep(.45,.95,r));
  float scan=.78+.22*(.5+.5*sin(uv.y*820.));
  float vig=1.-smoothstep(.35,1.15,r);
  ink*=scan*mix(.5,1.,vig);col*=mix(.4,1.,vig);
  return vec2(ink,col);
 }
```
Radial field (`sin(r*(22+lens*14) - t*.75 + fbm*7)`), gamma 1.5, posterised into 6 steps, then a **post
pass**: scanlines at `uv.y*820` (`.78…1.0` amplitude) and a vignette. Colour only on the top tone and only
away from the vignette edge ("акцент, не заливка").

### M==19 — storyboard (`hero:628-643`)
```glsl
if(M==19){ // storyboard — shot frames on a plan sheet, rough marks, one frame on cue
  vec2 g=vec2(3.,2.);vec2 cell=floor(uv*g);vec2 f=fract(uv*g);
  float bd=min(min(f.x,1.-f.x)*g.x,min(f.y,1.-f.y)*g.y);
  float border=1.-smoothstep(.0035,.009,bd);
  float sk=0.;
  for(int i=0;i<3;i++){
   float fi=float(i);
   float yy=.30+fi*.17+.045*sin(f.x*7.+fi*2.3+h1(cell)*6.2831+t*.25);
   sk=max(sk,hline(f.y-yy,.0035)*step(.10,f.x)*step(f.x,.90));
  }
  float hz=hline(f.y-.70,.0028)*step(.10,f.x)*step(f.x,.90);
  float blk=step(.14,f.x)*step(f.x,.34)*step(.58,f.y)*step(f.y,.66);
  float on=step(.55,h1(cell+floor(t*.12)*7.3));
  float ink=border*.95+max(sk,hz)*.8+blk*.5;
  return vec2(min(ink,1.),blk*on);
 }
```
A 3×2 plan sheet: each cell is a shot frame with a drawn border, three rough "sketch" strokes and a
horizon line, plus one solid block (a scene tag). One frame lights up per cue (`floor(t*.12)`).

### M==20 — channels (`hero:644-659`)
```glsl
if(M==20){ // channels — DMX faders on a console, levels stepping to the cue
  float n=28.;
  float x=uv.x*n;float ci=floor(x);float f=fract(x);
  float base=.18+.78*h1(vec2(ci,2.9));
  float cue=step(.55,fract(t*.35+h1(vec2(ci,5.3))));
  float h=base*(.55+.45*cue);
  float inBar=step(.16,f)*step(f,.84);
  float bar=step(uv.y,h)*inBar;
  float cap=hline(uv.y-h,.006)*inBar;
  float steps=gline(uv.y*26.,1.1)*bar;
  float bm=0.;
  for(int i=0;i<3;i++){
   float fi=float(i);
   float ang=.5+fi*.28;
   float dd=abs((uv.x-.5)*sin(ang)-(uv.y-.5)*cos(ang));
   bm=max(bm,1.-smoothstep(.0022,.005,dd));
  }
  float ink=max(max(bar*.55,cap),max(steps*.8,bm*.75));
  return vec2(ink,bar*step(.75,h));
 }
```
28 **DMX faders**. Each channel has a base level from a hash and steps to a cue (`step(.55, fract(t*.35+hash))`).
The fader body has stepped notches (`gline(uv.y*26.)`), a bright cap, and three diagonal fader strokes
(crossfaders) across the console.

### M==21 — atlas (`hero:660-677`)
```glsl
if(M==21){ // atlas — two nested contour systems, sparse and legible
  float ink=0.,col=0.;
  for(int i=0;i<2;i++){
   float fi=float(i);
   float sc=1.15+fi*1.9;
   vec2 p=q*sc+vec2(t*(.018-fi*.010),t*.006);
   float hh=fbm3(p)+.30*fbm3(p*2.4+fi*3.7);
   float lv=hh*(7.+fi*9.);
   float fl=fract(lv);float dd=min(fl,1.-fl)/fwidth2(lv);
   float idx=step(mod(floor(lv+.5),5.),.5);
   float w=.30+idx*.42;
   float line=1.-smoothstep(w,w+.55,dd);
   float band=step(.615,hh)*step(hh,.638);
   ink=max(ink,line*(.62-fi*.20)+band*(.20-fi*.07));
   col=max(col,band*step(fi,.5));
  }
  return vec2(min(ink,1.),col);
 }
```
Two nested contour systems at different scales (`1.15`, `3.05`) and different contour counts (`7`, `16`),
with index contours every 5th level. The outer system is drawn lighter (`*.62` vs `*.42`).
One narrow elevation band in the outer system is colour-eligible.

---

## 7. Porting checklist (Three.js / TouchDesigner)

To reimplement any motif:

1. Copy the helper block verbatim (`h1`, `vn`, `fbm3`, `fbm`, `b2/b4/b8`, `u5sg`, `fwidth2`, `vedge`, `gline`, `hline`).
2. Copy the target `if(M==N)` block verbatim, replacing `M` with a constant.
3. Keep the `vec2(ink, colmask)` return.
4. In the fragment `main()`, reproduce the composite:
   `th = b8(gl_FragCoord.xy) + 0.5/64;` → `if (ink > th) c = INK;` → `if (colmask > 0.5 && ink > th*0.6) c = K;`
5. In TouchDesigner: use a GLSL TOP with `u` uniforms, set the TOP resolution to
   `round(bandWidthPx / CELL) × round(bandHeightPx / CELL)` with `CELL = 2` (fine) or `3` (coarse),
   and let the viewer upscale with *Nearest* filtering — the equivalent of `image-rendering:pixelated`.
6. In Three.js: render to a `WebGLRenderTarget` at the reduced resolution, or use a plane with
   `magFilter = NearestFilter` and a canvas of reduced size scaled by CSS.
7. `fwidth`/`fwidth2` require `OES_standard_derivatives` in WebGL 1, or WebGL 2 (where it is core).
   In TouchDesigner, `fwidth` is available in GLSL TOPs.
8. The `gl_FragCoord.y` origin is **bottom-left** in GL but the shader flips it:
   `uv.y = 1. - uv.y;` — keep this, or every motif will be vertically mirrored.

---

## 8. What could not be extracted

- The exact `MOTIF` numeric id ↔ name mapping lives in `tools/hero_index_mock.html:203`
  (`const MOTIF={chladni:0,streams:1,...avperf:28};`) — recorded in `generative/algorithms.md`.
- WebGL context creation options are in `hero:770`:
  `gl.getContext('webgl',{antialias:false,preserveDrawingBuffer:true})` — `preserveDrawingBuffer:true`
  means the canvas can be screenshotted / exported (important for video production).
- Shader compile/link error handling only logs to console (`hero:772-774`); there is no fallback path
  if the fragment shader fails to compile — the canvas would stay blank. There is no WebGL2 path.
