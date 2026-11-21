// Rebuild the studio's original mesh artwork with node scripts/render-art.mjs.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
const out = new URL("../public/art/", import.meta.url);
await mkdir(out, { recursive: true });
const tau = 2 * Math.PI;
const unit = v => {const n=Math.hypot(...v);return v.map(x=>x/n)};
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const diff = (a,b)=>a.map((x,i)=>x-b[i]);
const dot = (a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const rot = ([x,y,z],a,b,c) => {
  let h=y*Math.cos(a)-z*Math.sin(a), k=y*Math.sin(a)+z*Math.cos(a);
  let l=x*Math.cos(b)+k*Math.sin(b), m=-x*Math.sin(b)+k*Math.cos(b);
  return [l*Math.cos(c)-h*Math.sin(c),l*Math.sin(c)+h*Math.cos(c),m];
};
const variants=[
  {id:"ember",base:[244,81,14], bg:[21,19,17],angles:[.44,-.31,.43],scale:.167},
  {id:"chrome",base:[160,153,215],bg:[154,143,194],angles:[.9,.15,-.55],scale:.164},
  {id:"terrain",base:[177,212,97],bg:[55,72,37],angles:[.88,-.2,-.12],scale:.178},
  {id:"tide",base:[86,162,237],bg:[29,63,99],angles:[.23,.97,.63],scale:.188}
];
for (const [v,c] of variants.entries()){
  const W=1000,H=570, pixels=Buffer.alloc(W*H*3), depth=new Float32Array(W*H).fill(-Infinity);
  let seed=123456;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    seed=(Math.imul(1664525,seed)+1013904223)>>>0;
    const light=1.16-.42*Math.hypot((x-W*.4)/W,(y-H*.32)/H), grain=(seed/4294967296-.5)*3;
    for(let i=0;i<3;i++) pixels[(y*W+x)*3+i]=Math.max(0,c.bg[i]*light+grain);
  }
  function point(u,a){
    if(v===2){
      const x=(u/tau-.5)*7, y=(a/tau-.5)*5;
      return rot([x,y,.76*Math.sin(x*1.4+y*.75)+.32*Math.cos(y*2.5-x)+.045*Math.cos(u*88)],...c.angles)
    }
    const curve=t=>[(1.58+.62*Math.cos(3*t))*Math.cos(2*t),(1.58+.62*Math.cos(3*t))*Math.sin(2*t),.86*Math.sin(3*t)];
    const p=curve(u), t=unit(diff(curve(u+.001),curve(u-.001))), n=unit(cross(t,[0,0,1])), b=cross(t,n);
    const r=(v===1?.45:.57)+.022*Math.cos(u*(v===3?72:128));
    return rot(p.map((q,i)=>q+r*(n[i]*Math.cos(a)+b[i]*Math.sin(a))),...c.angles)
  }
  const rows=736,cols=v===2?95:58, vertices=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
    const u=i*tau/rows,a=j*tau/cols,p=point(u,a);
    const normal=unit(cross(diff(point(u+.0004,a),point(u-.0004,a)),diff(point(u,a+.0004),point(u,a-.0004))));
    if(normal[2]<0) normal.forEach((_,k)=>normal[k]*=-1);
    const diffuse=Math.max(0,dot(normal,[-.4,.66,.63])), spec=Math.pow(Math.max(0,dot(normal,unit([-.41,.57,.9]))),v===1?9:22);
    const glint=Math.pow(Math.max(0,dot(normal,unit([.8,-.2,.55]))),12);
    const colors=c.base.map(k=>Math.min(255,k*(.23+.83*diffuse)+spec*108+glint*57));
    vertices.push([W*.5+p[0]*W*c.scale,H*.5-p[1]*W*c.scale,p[2],...colors]);
  }
  function triangle(a,b,c){
    const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    if(Math.abs(den)<.00001)return;
    for(let y=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])));y<=Math.min(H-1,Math.max(a[1],b[1],c[1]));y++)
    for(let x=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0])));x<=Math.min(W-1,Math.max(a[0],b[0],c[0]));x++){
      const s=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den;
      const t=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den, w=1-s-t;
      if(s<0||t<0||w<0)continue;
      const index=y*W+x,z=s*a[2]+t*b[2]+w*c[2];
      if(z<=depth[index])continue; depth[index]=z;
      for(let k=0;k<3;k++)pixels[index*3+k]=s*a[k+3]+t*b[k+3]+w*c[k+3];
    }
  }
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
    const k=i*(cols+1)+j, l=k+cols+1;
    triangle(vertices[k],vertices[l],vertices[k+1]);triangle(vertices[l],vertices[l+1],vertices[k+1]);
  }
  await sharp(pixels,{raw:{width:W,height:H,channels:3}}).webp({quality:90}).toFile(new URL(c.id+".webp",out).pathname.replace(/^\/(\w:)/,"$1"));
}
