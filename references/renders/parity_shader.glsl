precision highp float;varying vec2 v;uniform sampler2D T;uniform vec2 R,I,M;uniform float t,h,A,C,P,K,B;
  vec3 hs(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(vec3(p.x*p.y*p.z,p.x+p.y*p.z,p.x*p.y+p.z));}
  float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
    return mix(mix(mix(hs(i).x,hs(i+vec3(1,0,0)).x,f.x),mix(hs(i+vec3(0,1,0)).x,hs(i+vec3(1,1,0)).x,f.x),f.y),
               mix(mix(hs(i+vec3(0,0,1)).x,hs(i+vec3(1,0,1)).x,f.x),mix(hs(i+vec3(0,1,1)).x,hs(i+vec3(1,1,1)).x,f.x),f.y),f.z);}
  float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}
  float b4(vec2 a){return b2(.5*a)*.25+b2(a);}
  float b8(vec2 a){return b4(.5*a)*.25+b2(a);}
  float pk(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);}
  float gate(vec2 c,float y){return step(.62*pk(c)+.38*(1.-y),K*1.0001);} /* halftone: клетка появляется, когда порог < K; при K = 1 — все */
  float vn(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(pk(vec2(i,3.1)),pk(vec2(i+1.,3.1)),f);} /* r2 · C2-01: шум по x of того же хеша pk() — без fbm и без времени */
  float mk(vec2 p){float y=R.y-p.y;if(y>B+72.)return 1.;y+=16.*(.5*vn(p.x/61.)+.3*vn(p.x/19.)+.2*vn(p.x/7.)-.5);return smoothstep(B,B+28.+28.*vn(p.x/83.+5.),y);}
  /* маска облака над строкой фактов (B = низ .hm + 12 px от верха): край ±8 px неподвижной волной, полоса 28…56 px; точки в полосе мельчают (√m) и выпадают по порогу pk() — край печати, а не линейка */
  vec2 cov(vec2 uv){float ar=R.x/R.y,ir=I.x/I.y;vec2 s=ar>ir?vec2(1.,ir/ar):vec2(ar/ir,1.);vec2 c=(uv-.5)*s+vec2(P,.48)+(vec2(.5)-vec2(P,.48))*s;c.y=1.-c.y;return c;}
  void main(){
    vec2 fc=gl_FragCoord.xy;
    vec2 d=(fc-M*R)/R.y;float inl=step(length(d),.15*h);
    float cell=mix(C,max(2.,floor(C*.5)),inl);
    vec2 q=(floor(fc/cell)+.5)*cell,up=q/R;
    float tt=t*.08;vec2 fl=vec2(n(vec3(up*vec2(R.x/R.y,1.)*2.2,tt)),n(vec3(up*vec2(R.x/R.y,1.)*2.2+7.3,tt)))-.5;
    vec3 PAP=vec3(.914,.906,.878),INK=vec3(.043,.043,.047),ORG=vec3(.898,.314,.118);
    float hc=cell*1.25;mat2 rt=mat2(.7071,.7071,-.7071,.7071),ri=mat2(.7071,-.7071,.7071,.7071);
    vec2 rp=rt*fc,hq=(floor(rp/hc)+.5)*hc,cen=ri*hq;
    vec3 ch=texture2D(T,cov(cen/R)+fl*(.012+A*.03)).rgb;float lh=1.-dot(ch,vec3(.299,.587,.114));
    float ink=pow(clamp((lh-.1)/.62,0.,1.),1.35);float m=mk(cen),rad=hc*.5*sqrt(clamp(ink+A*.12,0.,1.))*sqrt(m)*step(pk(hq+.5)*.9+.05,m);
    float dm=smoothstep(rad+.7,rad-.7,length(rp-hq))*gate(hq,cen.y/R.y);
    vec3 dc=mix(INK,vec3(.16,.2,.27),.35);
    float cb=max(2.,floor(R.y/300.));vec2 qb=(floor(fc/cb)+.5)*cb;
    vec3 cs=texture2D(T,cov(qb/R)+fl*.012).rgb;
    float lb=clamp(((1.-dot(cs,vec3(.299,.587,.114)))-.05)*3.2+A*.18,0.,1.)*2.;
    float bs=floor(lb),lev=bs+step(b8(fc/cb),lb-bs);
    vec3 bg=lev<.5?PAP:(lev<1.5?mix(PAP,mix(PAP,ORG,.9),gate(floor(fc/cb),qb.y/R.y)*step(b8(fc/cb),smoothstep(.96,1.,mk(qb)))):PAP); /* оранжевая сетка Байера — полосой по полуtoneам края облака (не ослаблять); у кромки маски гаснет раньше чернил (m < .96 — только чернила) */
    gl_FragColor=vec4(mix(bg,dc,dm),1.);
  }