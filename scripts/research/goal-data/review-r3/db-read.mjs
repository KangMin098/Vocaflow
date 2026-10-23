// scripts/research/goal-data/review-r3/db-read.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url?.includes('jajenrevcbmrpaliomxv')||!key)throw Error('dev configuration unavailable');
const dir='docs/research/goal-data-batches/review-r3/';
const query='select=id,stem,passage,choices,answer,answers&type_id=eq.R-INSERT&order=id';
const res=await fetch(`${url}/rest/v1/csat_items?${query}`,{method:'GET',headers:{apikey:key,Authorization:`Bearer ${key}`,Range:'0-999'}});
if(!res.ok)throw Error(`GET HTTP ${res.status}`);
const rows=await res.json();
function split(p){const pre=String(p??'').split('( ①')[0].trim();const s=pre.split(/(?<=[.!?”"])\s+(?=[A-Z“"])/);return {confidence:s.length<2?'uncertain':'first_sentence',given_sentence:s.length<2?null:s[0],prefix:pre};}
const classified=rows.map(r=>({...r,...split(r.passage)}));
// 等間隔抽出。標本を先に固定し、内容による選別をしない。
const pick=(a,n)=>Array.from({length:n},(_,i)=>a[Math.floor(i*a.length/n)]);
const samples=[...pick(classified.filter(r=>r.confidence==='first_sentence'),20),...pick(classified.filter(r=>r.confidence==='uncertain'),10)];
fs.writeFileSync(dir+'insert-packet.local.json',JSON.stringify(samples,null,2));
const out={observed_at:new Date().toISOString(),method:'GET',table:'csat_items',query,status:res.status,total:rows.length,first_sentence:classified.filter(r=>r.confidence==='first_sentence').length,uncertain:classified.filter(r=>r.confidence==='uncertain').length,samples:samples.map(r=>({id:r.id,confidence:r.confidence,sha256:crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex')}))};
fs.writeFileSync(dir+'db-checks.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
