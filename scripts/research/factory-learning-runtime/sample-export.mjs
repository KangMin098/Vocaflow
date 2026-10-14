// scripts/research/factory-learning-runtime/sample-export.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const base='scripts/research/factory-learning-runtime/local';
const regPath='docs/research/factory-learning-runtime/data/sample-registration.json';
const output=`${base}/sample-content-first.json`;
if(fs.existsSync(output))throw Error('First content packet exists; refuse overwrite');
const reg=JSON.parse(fs.readFileSync(regPath,'utf8'));
const env={...process.env};for(const line of fs.readFileSync(process.argv[2]??'D:/workspace/Vocaflow/apps/web/.env.local','utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m&&!env[m[1]])env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const url=env.NEXT_PUBLIC_SUPABASE_URL,key=env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Read credential unavailable; no secret values printed');
async function query(table,filter){const r=await fetch(`${url}/rest/v1/${table}?${filter}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw Error(`Read-only query failed ${table} ${r.status}`);return r.json();}
const items=[];
for(const selected of reg.selected){
 const rows=await query('csat_dcp_items',`id=eq.${selected.id}&select=*`);if(rows.length!==1)throw Error('Selected item missing');const item=rows[0];
 if(item.type!==selected.type||item.ref_id!==selected.ref_id||item.kind!==selected.kind||Date.parse(item.created_at)!==Date.parse(selected.created_at))throw Error('Frozen selected identity drift');
 const sourceRows=await query('library_articles',`id=eq.${item.ref_id}&select=*`);const source=sourceRows[0]??null;
 const cacheRows=await query('csat_source_eligibility',`article_id=eq.${item.ref_id}&select=*`);const eligibility=cacheRows[0]??null;
 items.push({sample_id:selected.sample_id,selected_metadata:selected,item,source,eligibility,item_sha256:hash(JSON.stringify(item)),source_sha256:source?hash(JSON.stringify(source)):null,source_metadata_changed:Date.parse(source?.updated_at)!==Date.parse(selected.source_updated_at),generation_revision:null});
}
const packet={version:'FQR1-content-first-1',read_at:new Date().toISOString(),registration_sha256:hash(fs.readFileSync(regPath)),items,private:true,db_writes:0};
fs.writeFileSync(output,JSON.stringify(packet,null,2)+'\n');
const normalized=x=>typeof x==='string'?x.toLowerCase().replace(/\s+/g,' ').trim():null;
const metadata=items.map(x=>({sample_id:x.sample_id,id:x.item.id,type:x.item.type,kind:x.item.kind,ref_id:x.item.ref_id,item_sha256:x.item_sha256,source_sha256:x.source_sha256,payload_fields:Object.keys(x.item.payload??{}),answer_fields:Object.keys(x.item.answer_key??{}),source_present:!!x.source,source_content_present:typeof x.source?.content==='string'&&x.source.content.length>0,source_metadata_changed:x.source_metadata_changed,normalized_source_hash:normalized(x.source?.content)?hash(normalized(x.source.content)):null,normalized_generated_hash:normalized(Array.isArray(x.item.payload?.sentences)?x.item.payload.sentences.join(' '):x.item.payload?.context)?hash(normalized(Array.isArray(x.item.payload?.sentences)?x.item.payload.sentences.join(' '):x.item.payload?.context)):null}));
const duplicates=[];for(const field of ['normalized_source_hash','normalized_generated_hash']){const groups=new Map();for(const row of metadata)if(row[field])groups.set(row[field],[...(groups.get(row[field])??[]),row.sample_id]);for(const[sha256,ids]of groups)if(ids.length>1)duplicates.push({field,sha256,ids,disposition:'Preserved; no post-content replacement'});}
const manifest={version:'FQR1-export-1',read_at:packet.read_at,registration_sha256:packet.registration_sha256,packet:{file:output,sha256:hash(fs.readFileSync(output)),n:items.length},metadata,duplicates,source_present:metadata.filter(x=>x.source_present).length,source_content_present:metadata.filter(x=>x.source_content_present).length,source_metadata_changed:metadata.filter(x=>x.source_metadata_changed).length,db_writes:0,public_answer_values:false};
fs.writeFileSync('docs/research/factory-learning-runtime/data/sample-export.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({packet:manifest.packet,duplicates,source_present:manifest.source_present,source_metadata_changed:manifest.source_metadata_changed}));
