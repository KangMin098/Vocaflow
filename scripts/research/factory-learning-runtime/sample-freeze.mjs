// scripts/research/factory-learning-runtime/sample-freeze.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const base='scripts/research/factory-learning-runtime/local';
const output='docs/research/factory-learning-runtime/data/sample-registration.json';
if(fs.existsSync(output))throw Error('Frozen registration exists: refuse overwrite');
const metadataFile=`${base}/sample-metadata.json`;
const receipt=JSON.parse(fs.readFileSync(metadataFile,'utf8'));
const priorPath='docs/research/factory-qualification/data/sample-registration.json';
const prior=JSON.parse(fs.readFileSync(priorPath,'utf8'));
const excludedIds=new Set(prior.selected.map(x=>x.id));
const excludedRefs=new Set(prior.selected.map(x=>x.ref_id));
const selected=[],shortages=[],usedRefs=new Set(),usedHashes=new Set();
const types=['vocab_choice','unit_vocab','blank_word','grammar_choice','grammar_fix','unit_grammar','word_order'];
for(const type of types)for(const stratum of ['normal_metadata','problematic_metadata']){
 const pool=receipt.rows.filter(x=>x.type===type&&x.stratum===stratum).sort((a,b)=>hash(`FQR1-20261015:${a.id}`).localeCompare(hash(`FQR1-20261015:${b.id}`)));
 const row=pool.find(x=>!excludedIds.has(x.id)&&!excludedRefs.has(x.ref_id)&&!usedRefs.has(x.ref_id)&&!usedHashes.has(x.content_hash)&&!excludedRefs.has(x.adapted_from_id));
 if(!row){shortages.push({type,stratum,reason:'No eligible distinct source within seeded top 40 metadata candidates',candidate_count:pool.length});continue;}
 usedRefs.add(row.ref_id);if(row.content_hash)usedHashes.add(row.content_hash);
 selected.push({...row,sample_id:`FQR1-${String(selected.length+1).padStart(2,'0')}`,rank_sha256:hash(`FQR1-20261015:${row.id}`),generation_revision:null});
}
const strata=receipt.rows.filter(x=>x.seeded_rank===1).map(x=>({type:x.type,stratum:x.stratum,eligible_rows:x.stratum_population}));
const out={version:'FQR1-sample-registration-1',frozen_at:new Date().toISOString(),seed:'FQR1-20261015',metadata_only_before_freeze:true,body_key_explanation_values_reads_before_freeze:0,metadata_receipt:{file:metadataFile,sha256:hash(fs.readFileSync(metadataFile)),query:receipt.query,read_at:receipt.read_at,candidate_count:receipt.rows.length},code_sha256:hash(fs.readFileSync(import.meta.filename)),prior_registration:{file:priorPath,sha256:hash(fs.readFileSync(priorPath)),excluded_item_ids:[...excludedIds],excluded_source_ids:[...excludedRefs]},strata,selected,shortages,limitations:['Purposeful 2 per type; normal/problematic are metadata strata not content verdicts','SQL seeded top 40 per stratum; sequential source deduplication within bounded candidates','Nontransactional database snapshot; current metadata rechecked after export','Generation revision absent; created_at is not a revision','Source/cache status is not rights approval; normalized duplicate checked after export without substitution'],public_qualified:0,assessment_qualified:0};
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({selected:selected.length,distinct_sources:usedRefs.size,shortages,sha256:hash(fs.readFileSync(output))}));
