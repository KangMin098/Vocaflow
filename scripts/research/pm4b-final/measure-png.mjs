// scripts/research/pm4b-final/measure-png.mjs
// Read-only PNG pixel audit; mirrors ref-measure white-component criteria without a browser.
import fs from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const file = process.argv[2];
const b = fs.readFileSync(file);
const w = b.readUInt32BE(16), h = b.readUInt32BE(20), depth=b[24], type=b[25];
if(depth!==8 || ![2,6].includes(type) || b[28]!==0) throw new Error('Only non-interlaced 8-bit RGB/RGBA PNG supported');
const channels=type===6?4:3, chunks=[];
for(let p=8;p<b.length;){const n=b.readUInt32BE(p), t=b.toString('ascii',p+4,p+8);if(t==='IDAT')chunks.push(b.subarray(p+8,p+8+n));p+=12+n;}
const packed=inflateSync(Buffer.concat(chunks)), stride=w*channels, raw=Buffer.alloc(h*stride);
const paeth=(a,c,d)=>{const p=a+c-d, x=Math.abs(p-a), y=Math.abs(p-c), z=Math.abs(p-d);return x<=y&&x<=z?a:y<=z?c:d;};
for(let y=0;y<h;y++){const f=packed[y*(stride+1)];for(let x=0;x<stride;x++){const i=y*stride+x, a=x>=channels?raw[i-channels]:0,c=y?raw[i-stride]:0,d=y&&x>=channels?raw[i-stride-channels]:0;const q=f===0?0:f===1?a:f===2?c:f===3?Math.floor((a+c)/2):f===4?paeth(a,c,d):NaN;if(!Number.isFinite(q))throw new Error('PNG filter');raw[i]=(packed[y*(stride+1)+1+x]+q)&255;}}
const white=new Uint8Array(w*h),seen=new Uint8Array(w*h),stack=new Int32Array(w*h),rects=[];
for(let i=0;i<w*h;i++)white[i]=Number(raw[i*channels]>=254&&raw[i*channels+1]>=254&&raw[i*channels+2]>=254);
for(let s=0;s<w*h;s++){if(!white[s]||seen[s])continue;let sp=0,minX=w,minY=h,maxX=0,maxY=0,area=0;stack[sp++]=s;seen[s]=1;
 while(sp){const p=stack[--sp],x=p%w,y=Math.floor(p/w);area++;minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&white[q]&&!seen[q]){seen[q]=1;stack[sp++]=q;}}
 const rw=maxX-minX+1,rh=maxY-minY+1;if(rw>=120&&rw<=420&&rh>=30&&rh<=110&&area/(rw*rh)>.55)rects.push({x:minX,y:minY,w:rw,h:rh});}
rects.sort((a,b)=>a.x-b.x||a.y-b.y);
const median=a=>a.length?[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]:null;
const cols=[];for(const r of rects){let c=cols.find(c=>Math.abs(c.x-r.x)<=6);if(!c){c={x:r.x,items:[]};cols.push(c);}c.items.push(r);}
const pitches=cols.slice(1).map((c,i)=>c.x-cols[i].x), rows=cols.flatMap(c=>{const ys=c.items.map(r=>r.y).sort((a,b)=>a-b);return ys.slice(1).map((y,i)=>y-ys[i]);});
console.log(JSON.stringify({file,sha256:createHash('sha256').update(b).digest('hex'),image:{w,h},node:{w:median(rects.map(r=>r.w)),h:median(rects.map(r=>r.h))},columns:cols.map(c=>c.x),rawColumnPitch:median(pitches),rowPitch:median(rows),rects},null,2));
