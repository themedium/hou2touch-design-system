# Hou2Touch — Reusable Code

**Status:** MEASURED. Every block below is **quoted verbatim** from `tools/hero_index_mock.html`
(unless the heading says "reconstructed"). Line numbers refer to that file.

This is the copy-paste layer: the smallest set of verbatim code needed to rebuild the system elsewhere.

---

## 1. Vertex shader — `hero:207` (verbatim)

```glsl
attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}
```

## 2. Full-screen triangle — `hero:775-778` (verbatim)

```js
 const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 const lp=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,2,gl.FLOAT,false,0,0);
```

## 3. Shader helpers — `hero:211-232` (verbatim)

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

## 4. The motif dispatcher (skeleton with the shared preamble) — `hero:234-243` (verbatim)

```glsl
// returns x = ink density, y = colour mask
vec2 motif(vec2 uv,float asp,float t){
 vec2 q=vec2(uv.x*asp,uv.y);
 // pointer lens: local disturbance
 vec2 d=q-vec2(P.x*asp,P.y);float lens=PA*exp(-dot(d,d)*18.);
```
…followed by the 29 `if(M==N){…}` blocks (all quoted in `generative/shaders.md`), and closing with the
implicit fallback — `hero:551-559` (verbatim):

```glsl
 // warp — domain-warped fbm, posterised into dithered tone steps
 vec2 p=q*.95;vec2 a=vec2(fbm(p+t*.04),fbm(p+vec2(5.2,1.3)-t*.035));
 vec2 b=vec2(fbm(p+2.6*a+vec2(1.7,9.2)+t*.025),fbm(p+2.6*a+vec2(8.3,2.8)));
 float v=fbm(p+2.6*b+lens*1.5);
 float sv=smoothstep(.3,.8,v);float st=floor(sv*6.)/6.;
 float e=fract(sv*6.);float edge=(1.-smoothstep(.0,.08,min(e,1.-e)))*step(.001,sv)*step(sv,.999);
 return vec2(max(st*.5,edge*.95),step(.8,st)*(1.-edge));
}
```

## 5. `main()` — the composite — `hero:294-323` (verbatim)

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

---

## 6. Representative motifs (verbatim)

### 6.1 The simplest complete motif — `hero:363-373` (opart, id 10)

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

### 6.2 The most complex motif — `hero:412-431` (swarm13, id 15)

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

### 6.3 The "signature" motif — the node chain — `hero:449-470` (foundations, id 23)

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

---

## 7. JS engine — scene setup (`hero:686-700`, verbatim excerpts)

```js
function rgb(css){const e=document.createElement('i');e.style.color=css;document.body.appendChild(e);const v=getComputedStyle(e).color.match(/\d+/g).slice(0,3).map(x=>x/255);e.remove();return v}
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const scenes=[];
for(const s of document.querySelectorAll('.hero')){
 const cv=s.querySelector('canvas');const gl=cv.getContext('webgl',{antialias:false,preserveDrawingBuffer:true});
 if(!gl)continue;gl.getExtension('OES_standard_derivatives');
 const sh=(t,src)=>{const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(o));return o};
 const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);gl.useProgram(pr);
```
```js
 const U=n=>gl.getUniformLocation(pr,n);
 const k=rgb(getComputedStyle(s).getPropertyValue('--k'));
 const sc={s,cv,gl,u:{R:U('R'),T:U('T'),M:U('M'),K:U('K'),P:U('P'),PA:U('PA'),TX:U('TX'),HT:U('HT'),FN:U('FN'),BX:U('BX'),LC:U('LC'),RL:U('RL'),GR:U('GR')},gr:[.04,.08,.96],lc:[.7,.4],bx:[0,1,0,1],ht:0,m:MOTIF[s.dataset.m],k,p:[.7,.5],pa:0,pat:0,vis:true,fc:s.querySelector('.fc'),ret:s.querySelector('.lb.ret'),t0:performance.now()-Math.random()*4000};
```

## 8. Texture setup + the mask builder (`hero:786-806`, verbatim)

```js
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 for(const [k2,v2] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k2,v2);
 // knockout: the title's glyphs + halo are drawn into a mask at cell resolution; the field is cleared there
 const mk=document.createElement('canvas');
 const sc_mask=()=>{const br=cv.getBoundingClientRect(),box=s.querySelector('.ttl');
  mk.width=cv.width;mk.height=cv.height;const x=mk.getContext('2d');
  x.clearRect(0,0,mk.width,mk.height);x.save();x.scale(mk.width/br.width,mk.height/br.height);
  x.lineJoin='round';x.fillStyle=x.strokeStyle='#fff';
  const tw=document.createTreeWalker(box,NodeFilter.SHOW_TEXT),rg=document.createRange();let tn;let L=1e9,Tt=1e9,Rr=-1e9,B=-1e9;
  while((tn=tw.nextNode())){const el=tn.parentElement,cs=getComputedStyle(el),fs=parseFloat(cs.fontSize),txt=tn.textContent;
   x.font=`700 ${fs}px "H2T Bebas"`;x.letterSpacing=cs.letterSpacing;x.lineWidth=Math.max(2*CELL,fs*(FINE?.075:.05));
   const asc=x.measureText('H').fontBoundingBoxAscent;
   for(const mt of txt.matchAll(/\S+/g)){rg.setStart(tn,mt.index);rg.setEnd(tn,mt.index+mt[0].length);
    const r=rg.getClientRects()[0];if(!r)continue;const w=mt[0].toUpperCase();L=Math.min(L,r.left);Tt=Math.min(Tt,r.top);Rr=Math.max(Rr,r.right);B=Math.max(B,r.bottom);
    x.strokeText(w,r.left-br.left,r.top-br.top+asc);x.fillText(w,r.left-br.left,r.top-br.top+asc);}}
  {const tk=s.querySelectorAll('.band .tk i');if(tk.length>1){const a=tk[0].getBoundingClientRect(),b=tk[1].getBoundingClientRect(),z=tk[tk.length-1].getBoundingClientRect();sc.gr=[(a.left-br.left)/br.width,(b.left-a.left)/br.width,(z.right-br.left-1)/br.width];}}
  sc.bx=[(L-br.left)/br.width,(Tt-br.top)/br.height,(Rr-br.left)/br.width,(B-br.top)/br.height];
  x.restore();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mk);sc.ht=1;};
```

## 9. Resize + pointer + visibility (`hero:781-797`, verbatim)

```js
 const size=()=>{const r=cv.getBoundingClientRect();sc.W=r.width;sc.H=r.height;cv.width=Math.max(1,Math.round(r.width/CELL));cv.height=Math.max(1,Math.round(r.height/CELL));gl.viewport(0,0,cv.width,cv.height);if(sc.ht&&sc_mask)sc_mask()};
 size();new ResizeObserver(size).observe(cv);
 const band=s.querySelector('.band');
 band.addEventListener('pointermove',e=>{const r=band.getBoundingClientRect();sc.p=[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];sc.pat=1});
 band.addEventListener('pointerleave',()=>sc.pat=0);
 new IntersectionObserver(([e])=>{sc.vis=e.isIntersecting},{threshold:0}).observe(s);
```

## 10. The draw function (`hero:808-822`, verbatim)

```js
function draw(sc,now){
 const {gl,u}=sc;const t=(6.0+(now-sc.t0)/1000)*(FINE?.72:1);   /* 20.11.2026 (решение владельца): полоса анимируется ВСЕГДА — старт с удачной фазы 6.0 + реальное время; заморозка по системной настройке снята */
 sc.pa+=(sc.pat-sc.pa)*.08;
 gl.uniform2f(u.R,sc.cv.width,sc.cv.height);gl.uniform1f(u.T,t);gl.uniform1i(u.M,sc.m);gl.uniform3fv(u.K,sc.k);
 gl.uniform2f(u.P,sc.p[0],sc.p[1]);gl.uniform1f(u.PA,sc.pa);gl.uniform1i(u.TX,0);gl.uniform1f(u.HT,sc.ht);gl.uniform1f(u.FN,FINE?1:0); gl.uniform4fv(u.BX,sc.bx);
 if(FINE){const asp=sc.W/sc.H,RL=.17,bx=sc.bx;
  let lx=.7+.16*Math.sin(t*.13),ly=.5+.1*Math.sin(t*.17+1);
  const r=RL/asp;
  if(bx[2]<.72&&asp>1.4){lx=Math.max(lx,bx[2]+r+.03);ly=Math.min(Math.max(ly,RL+.11),1-RL-.1);}
  else{ly=Math.min(Math.max(ly,RL+.11),bx[1]-RL-.06);lx=Math.min(Math.max(lx,r+.04),1-r-.04);}
  if(sc.pa>.02){const mx=Math.min(Math.max(sc.p[0],r+.01),1-r-.01),my=Math.min(Math.max(sc.p[1],RL+.02),1-RL-.02);lx+=(mx-lx)*sc.pa;ly+=(my-ly)*sc.pa;} // pointer wins over the title-avoid rule
  if(ly-RL<0){ly=RL+.02}
  lx=Math.min(lx,1-r-.02);sc.lc=[lx,ly];
  gl.uniform2f(u.LC,lx,ly);gl.uniform1f(u.RL,RL);gl.uniform3fv(u.GR,sc.gr);
  if(sc.ret){sc.ret.style.left=(lx*sc.W+RL*sc.H*0.78+10)+'px';sc.ret.style.top=(ly*sc.H-RL*sc.H*0.78-18)+'px';
   sc.ret.textContent='×3.2 · '+lx.toFixed(3)+' / '+ly.toFixed(3);}}
 gl.drawArrays(gl.TRIANGLES,0,3);
 if(sc.fc)sc.fc.textContent='f '+String(Math.floor(t*60)).padStart(6,'0');
}
```

## 11. The loop + boot (`hero:824-826`, verbatim)

```js
function loop(now){for(const sc of scenes)if(sc.vis)draw(sc,now);requestAnimationFrame(loop)}   /* 20.11.2026: цикл полосы ВСЕГДА — заморозка по системной настройке снята (иначе рисуется ровно один кадр) */
document.fonts.ready.then(()=>{
 requestAnimationFrame(loop);
 requestAnimationFrame(()=>document.querySelectorAll('.hero').forEach(s=>s.classList.add('in')));
 setTimeout(()=>scenes.forEach(sc=>sc.mask()),reduce?0:1650); // halo lands with the letters
});
```

---

## 12. CSS — the hero system (verbatim, `hero:19-124`)

The complete hero CSS is reproduced in `identity/layout-grid.md` (grid) and `identity/color-system.md`
(tokens). The pieces that are **code, not layout**, are reproduced here:

```css
/* entrance */
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

```css
.btn{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 26px;border-radius:999px;font:500 12px/1 var(--mono);letter-spacing:.07em;text-transform:uppercase;border:1px solid var(--line2);color:var(--ink);text-decoration:none;white-space:nowrap;transition:background .3s var(--ease),color .3s var(--ease)}
.btn.rec{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.btn.rec i{width:7px;height:7px;background:var(--hou);border-radius:50%}
.btn:hover{background:var(--hou);border-color:var(--hou);color:#fff}
```

---

## 13. Reconstructed helpers (NOT verbatim — clearly marked)

These two are **reconstructed** from the documented contract, because the source lines were not captured
within the read budget. Use the semantics, not the code.

### 13.1 `bakeDither` — canvas image halftone
*Contract* (`school.px.html:3681`, verbatim comment):
> `/* дизер — как bakeDither главной (r1 · C-07): кадр cover под bw×bh клеток, уровни по перцентилям 2–98 (медиана → lev), 2 уровня: чернила / крем листа */`

*Signature* (`school.px.html:3682`, verbatim head):
```js
function bakeDither(img,bw,bh,cell,pos,lv,lev){const w=Math.max(1,Math.round(bw/cell)),h=Math.max(1,Math.round(bh/cell)),x=rdCtx(w,h);
```

*Reconstructed body* (semantics, not the original):
```
1. w = round(bw/cell); h = round(bh/cell)   # the canvas is sized in CELLS
2. draw img into a w×h canvas, 'cover' fit, focal point pos
3. read ImageData
4. compute the luminance of every cell
5. compute the level thresholds from the 2nd and 98th percentile of the luminance,
   mapping the median to `lev`
6. for every cell: compare its level index against the Bayer threshold at that cell
   → write INK or PAPER
7. return the ImageData
```

### 13.2 `ditherInto` — place the halftone into a target canvas
*Signature* (`school.px.html:2589`, verbatim head):
```js
function ditherInto(im,c,box,lv,o){o=o||{};let tries=0;
```
*Inner call* (`school.px.html:2593`, verbatim):
```js
    const D=bakeDither(im,cw,ch,1,o.pos||[.5,.5],lv||4,o.lev);if(!D)return;c.width=cw;c.height=ch;c.getContext("2d").putImageData(D,0,0);
```
*Contract comment* (`school.px.html:2583`, verbatim):
> `ditherInto: кадр img → дизер в canvas c; клетка = целое число пикселей экрана (≈ cs CSS px), холст по размеру клеток — «cover» по центру box;`

*Reconstructed body*:
```
1. resolve the box size and the cell size (cs CSS px, integer)
2. cw = round(box.w / cell); ch = round(box.h / cell)
3. wait for the image to load (the `tries` counter is a retry loop)
4. D = bakeDither(im, cw, ch, 1, pos, lv, lev)
5. c.width = cw; c.height = ch; putImageData(D, 0, 0)
```

---

## 14. CSS — the site shell's key components (verbatim, `src/template.html`)

```css
/* :83 */
.lbl::after{content:"";flex:1;min-width:16px;height:1px;background:var(--line)}
/* :117-126 */
.pn{position:relative;border:1px solid var(--line2);border-radius:6px;background:linear-gradient(180deg,var(--ink-300),var(--ink-250))}
.pn>.ph{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);font:500 12px/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--txt);white-space:nowrap;min-width:0}
.pn>.ph .fl b{width:16px;height:16px;border-radius:2px;box-shadow:inset 0 0 0 1px var(--line2);font:500 12px/16px var(--mono);text-align:center;color:var(--mute)}
.pn>.pf{display:flex;justify-content:space-between;gap:12px;padding:8px 14px;border-top:1px solid var(--line);font:500 12px/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mute);white-space:nowrap}
/* :137-138 */
.dat li{counter-increment:c;display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;min-height:48px;padding:11px 0;border-bottom:1px solid var(--line);font:400 17px/1.35 var(--sans);letter-spacing:-.01em}
.dat li::before{content:counter(c,decimal-leading-zero);font:500 12px var(--mono);color:var(--mute);border-right:1px solid var(--line);margin-right:14px;align-self:stretch;display:flex;align-items:center}
/* :215 */
.tlb{position:fixed;left:0;right:0;bottom:0;z-index:55;height:34px;display:flex;align-items:center;gap:18px;padding:0 var(--pad);background:rgba(11,11,12,.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:1px solid var(--line);transform:translateY(100%);transition:transform .8s var(--ease)}
/* :309-312 */
.marq{margin-top:var(--hgap);padding:14px 0;border-block:1px solid var(--line);white-space:nowrap;overflow:hidden;user-select:none}
.marq-t{display:inline-flex;will-change:transform}
.marq-t span{font:700 40px/1 var(--disp);text-transform:uppercase;padding-right:.3em}
.marq-t em{font-style:normal;color:var(--mute);padding-right:.3em;font:700 40px/1 var(--disp)}
```

---

## 15. Copy-paste checklist for a new implementation

| Step | Source | What to take |
|---|---|---|
| 1 | `hero:211-232` | the GLSL helpers |
| 2 | `hero:234-243` + one `if(M==N)` block | the motif |
| 3 | `hero:294-323` | `main()` |
| 4 | `hero:207`, `hero:775-778` | the triangle |
| 5 | `hero:786-806` | the mask builder |
| 6 | `hero:808-826` | the draw loop and boot |
| 7 | `hero:19-124` | the hero CSS |
| 8 | `identity/color-system.md` | the tokens |
| 9 | `motion/motion-principles.md` | the easing and durations |
