// scripts/research/factory-qualification/sample-export.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const base='scripts/research/factory-qualification/local';
const regPath='docs/research/factory-qualification/data/sample-registration.json';
const reg=JSON.parse(fs.readFileSync(regPath,'utf8'));
for(const split of ['main','counter'])if(fs.existsSync(`${base}/dcp-${split}-input.json`))throw Error('first input exists; refuse overwrite');
const envPath=process.argv[2]??'D:/workspace/Vocaflow/apps/web/.env.local';
const env={...process.env};for(const line of fs.readFileSync(envPath,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m&&!env[m[1]])env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const url=env.NEXT_PUBLIC_SUPABASE_URL,key=env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('credential unavailable; never print credential values');
async function query(table,filter){const r=await fetch(`${url}/rest/v1/${table}?${filter}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw Error(`read failed ${table} ${r.status}`);return r.json();}
const records=[];const sourceCache=new Map();
async function source(id){if(!sourceCache.has(id)){const rows=await query('library_articles',`id=eq.${id}&select=*`);sourceCache.set(id,rows[0]??null);}return sourceCache.get(id);}
for(const selected of reg.selected){
 const items=await query('csat_dcp_items',`id=eq.${selected.id}&select=*`);if(items.length!==1)throw Error('selected item missing');
 const item=items[0];if(item.type!==selected.type||item.ref_id!==selected.ref_id||Date.parse(item.created_at)!==Date.parse(selected.created_at))throw Error('selected metadata changed');
 const src=await source(item.ref_id);const ancestry=[];const seen=new Set([item.ref_id]);let parent=src?.adapted_from_id;
 while(parent&&!seen.has(parent)&&ancestry.length<20){seen.add(parent);const row=await source(parent);ancestry.push({id:parent,source:row});parent=row?.adapted_from_id;}
 const eligibility=await query('csat_source_eligibility',`article_id=eq.${item.ref_id}&select=*`);
 records.push({id:item.id,split:selected.split,type:item.type,task:item.type==='vocab_choice'?'v.contextual_sense':'s.form_scope',workspace:item.type==='vocab_choice'?'ws.vocab-context':'ws.grammar-scope',selected_metadata:selected,item,source:src,ancestry,eligibility:eligibility[0]??null,source_metadata_changed:Date.parse(src?.updated_at)!==Date.parse(selected.source_updated_at),item_sha256:sha(JSON.stringify(item)),source_sha256:src?sha(JSON.stringify(src)):null,source_revision:src?{updated_at:src.updated_at,content_hash:src.content_hash}:null,generation_revision:null});
}
const summaries=[];
for(const split of ['main','counter']){const selected=records.filter(x=>x.split===split);const out={version:'fq1-dcp-first-input-1',read_at:new Date().toISOString(),registration_sha256:sha(fs.readFileSync(regPath)),split,items:selected,private:true,not_release_approval:true};const file=`${base}/dcp-${split}-input.json`;fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');summaries.push({split,n:selected.length,file,sha256:sha(fs.readFileSync(file))});}
const normalize=s=>s?.toLowerCase().replace(/\s+/g,' ').trim()??'';
const bodies=records.map(x=>{const p=x.item.payload;const text=p.passage_text??p.passage??p.text??null;return{id:x.id,source_ref:x.item.ref_id,original_hash:x.source?.content_hash??null,normalized_source_hash:x.source?.content?sha(normalize(x.source.content)):null,normalized_generated_passage_hash:typeof text==='string'?sha(normalize(text)):null,payload_fields:Object.keys(p),answer_fields:Object.keys(x.item.answer_key??{}),source_present:!!x.source,source_content_present:!!x.source?.content,ancestry_n:x.ancestry.length,source_metadata_changed:x.source_metadata_changed};});
const duplicates=[];for(const field of ['normalized_source_hash','normalized_generated_passage_hash']){const groups=new Map();for(const r of bodies)if(r[field]){const g=groups.get(r[field])??[];g.push(r.id);groups.set(r[field],g);}for(const [hash,ids]of groups)if(ids.length>1)duplicates.push({field,hash,ids,disposition:'hold; no replacement'});}
const manifest={version:'fq1-export-first-1',read_at:new Date().toISOString(),registration_sha256:sha(fs.readFileSync(regPath)),packets:summaries,structural_metadata:bodies,duplicates,answer_values_public:false,db_writes:0};
fs.writeFileSync('docs/research/factory-qualification/data/sample-export.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({packets:summaries,duplicates,metadata_changed:bodies.filter(x=>x.source_metadata_changed).length}));
