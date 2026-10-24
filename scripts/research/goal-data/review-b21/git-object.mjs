// scripts/research/goal-data/review-b21/git-object.mjs
// Read-only Git object decoder; never invokes Git or changes repository state.
import fs from 'node:fs'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
const dir='D:/workspace/Vocaflow/.git/objects', locations=new Map(), packs=new Map(), cache=new Map()
for(const f of fs.readdirSync(dir+'/pack').filter(f=>f.endsWith('.idx'))){
 const b=fs.readFileSync(dir+'/pack/'+f);if(b.readUInt32BE(0)!==0xff744f63||b.readUInt32BE(4)!==2)throw Error('unsupported index')
 const n=b.readUInt32BE(8+255*4), start=8+1024, off=start+n*24
 for(let i=0;i<n;i++){let o=b.readUInt32BE(off+i*4);if(o>=0x80000000)o=Number(b.readBigUInt64BE(off+n*4+(o&0x7fffffff)*8));locations.set(b.subarray(start+i*20,start+(i+1)*20).toString('hex'),[f.replace('.idx','.pack'),o])}
}
const full=prefix=>{const loose=[];if(fs.existsSync(dir+'/'+prefix.slice(0,2)))for(const f of fs.readdirSync(dir+'/'+prefix.slice(0,2)))if((prefix.slice(0,2)+f).startsWith(prefix))loose.push(prefix.slice(0,2)+f);const a=[...new Set([...loose,...locations.keys()].filter(h=>h.startsWith(prefix)))];if(a.length!==1)throw Error('ambiguous/missing '+prefix);return a[0]}
function delta(base,d){let p=0;const v=()=>{let x=0,s=0,b;do{b=d[p++];x+=(b&127)*2**s;s+=7}while(b&128);return x};if(v()!==base.length)throw Error('delta base');const n=v(),parts=[];while(p<d.length){const c=d[p++];if(c&128){let o=0,l=0;for(let i=0;i<4;i++)if(c&(1<<i))o+=d[p++]*2**(i*8);for(let i=0;i<3;i++)if(c&(1<<(i+4)))l+=d[p++]*2**(i*8);parts.push(base.subarray(o,o+(l||65536)))}else if(c)parts.push(d.subarray(p,p+=c));else throw Error('delta opcode')}const b=Buffer.concat(parts);if(b.length!==n)throw Error('delta size');return b}
function packed(file,offset){if(!packs.has(file))packs.set(file,fs.readFileSync(dir+'/pack/'+file));const b=packs.get(file);let p=offset,c=b[p++],type=(c>>4)&7;while(c&128)c=b[p++];let base;if(type===6){c=b[p++];let distance=c&127;while(c&128){c=b[p++];distance=(distance+1)*128+(c&127)}base=packed(file,offset-distance)}if(type===7){base=object(b.subarray(p,p+20).toString('hex'));p+=20}const data=zlib.inflateSync(b.subarray(p));return base?{type:base.type,data:delta(base.data,data)}:{type:({1:'commit',2:'tree',3:'blob',4:'tag'})[type],data}}
export function object(prefix){const h=prefix.length===40?prefix:full(prefix);if(cache.has(h))return cache.get(h);let r;const f=dir+'/'+h.slice(0,2)+'/'+h.slice(2);if(fs.existsSync(f)){const b=zlib.inflateSync(fs.readFileSync(f)),i=b.indexOf(0);r={type:b.subarray(0,i).toString().split(' ')[0],data:b.subarray(i+1)}}else{const a=locations.get(h);if(!a)throw Error('missing object '+h);r=packed(...a)}const actual=crypto.createHash('sha1').update(r.type+' '+r.data.length+'\0').update(r.data).digest('hex');if(actual!==h)throw Error('object integrity '+h);cache.set(h,r);return r}
export const revision=full('3cf2b8cbb')
const tree=object(revision).data.toString().match(/^tree (\w+)/)[1]
export function at(path){let id=tree;for(const name of path.split('/')){const b=object(id).data;let p=0,found;while(p<b.length){const s=b.indexOf(32,p),z=b.indexOf(0,s);if(b.subarray(s+1,z).toString()===name)found=b.subarray(z+1,z+21).toString('hex');p=z+21}if(!found)throw Error('missing pinned path '+path);id=found}return object(id).data.toString('utf8')}
export function list(path=''){let id=tree;for(const name of path.split('/').filter(Boolean)){const rows=entries(id),row=rows.find(r=>r.name===name);if(!row)throw Error('missing tree '+path);id=row.id}return entries(id).map(r=>r.name)}
function entries(id){const b=object(id).data,a=[];let p=0;while(p<b.length){const s=b.indexOf(32,p),z=b.indexOf(0,s);a.push({name:b.subarray(s+1,z).toString(),id:b.subarray(z+1,z+21).toString('hex')});p=z+21}return a}
