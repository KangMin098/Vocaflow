// scripts/research/factory-qualification/sample-freeze.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const base='scripts/research/factory-qualification/local';
const dest='docs/research/factory-qualification/data/sample-registration.json';
if(fs.existsSync(dest))throw Error('registered sample cannot be overwritten');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const files=fs.readdirSync(base).filter(x=>/^sample-metadata-\d+\.json$/.test(x)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
const rows=files.flatMap(f=>JSON.parse(fs.readFileSync(`${base}/${f}`,'utf8')));
const expected=64742;if(rows.length!==expected)throw Error('metadata row count disagrees with SQL aggregate');
if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('duplicate ids during nontransactional metadata collection');
const seed='FQ1-20261014';
const counts={};for(const r of rows){r.grade??='missing';const k=r.type+':'+r.grade;counts[k]??={items:0,refs:new Set()};counts[k].items++;counts[k].refs.add(r.ref_id);}
const order=[['main','usable'],['main','unjudged'],['main','unjudged'],['main','missing'],['counter','usable'],['counter','blocked']];
const chosen=[],used=new Set(),missing=[];
for(const type of ['grammar_choice','vocab_choice'])for(let position=0;position<order.length;position++){
 const [split,grade]=order[position];const pool=rows.filter(r=>r.type===type&&r.grade===grade&&r.source_status!==null).sort((a,b)=>sha(`${seed}:${a.id}`).localeCompare(sha(`${seed}:${b.id}`)));
 const picked=pool.find(r=>![`ref:${r.ref_id}`,r.content_hash&&`hash:${r.content_hash}`,r.adapted_from_id&&`ref:${r.adapted_from_id}`].filter(Boolean).some(k=>used.has(k)));
 if(!picked){missing.push({type,position,split,grade,pool:pool.length});continue;}
 for(const k of [`ref:${picked.ref_id}`,picked.content_hash&&`hash:${picked.content_hash}`,picked.adapted_from_id&&`ref:${picked.adapted_from_id}`].filter(Boolean))used.add(k);
 chosen.push({...picked,split,position,rank_sha256:sha(`${seed}:${picked.id}`),generation_revision:null,generation_revision_note:'no dedicated DCP revision column; created_at is timestamp only'});
}
const out={version:'fq1-sample-registration-1',frozen_at:new Date().toISOString(),seed,sampling:'limited purposive strata; seeded SHA256 item ordering; sequential cross-type source/hash/adaptation deduplication; no population quality estimation',metadata_only_before_freeze:true,body_key_explanation_reads_before_freeze:0,expected_counts:{grammar_choice:15258,vocab_choice:49484},metadata_count:rows.length,metadata_chunks:files.map(file=>({file,sha256:sha(fs.readFileSync(`${base}/${file}`))})),strata:Object.entries(counts).map(([key,x])=>({key,items:x.items,sources:x.refs.size})),selection_order:order,quotas_per_type:{main:{usable:1,unjudged:2,missing:1},counter:{usable:1,blocked:1}},selected:chosen,shortages:missing,limitations:['nontransactional paged database observation; selected content recheck required','generation revision absent','content_hash is stored raw source hash; normalized paragraph duplication checked after body export without replacement','cached grade and license flags do not establish rights approval','AI model pretraining exposure and student exposure not established'],rules_sha256:sha(fs.readFileSync('scripts/research/factory-qualification/sample-freeze.mjs'))};
fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({count:chosen.length,main:chosen.filter(x=>x.split==='main').length,counter:chosen.filter(x=>x.split==='counter').length,sha256:sha(fs.readFileSync(dest)),shortages:missing}));
