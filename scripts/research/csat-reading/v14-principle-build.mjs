// scripts/research/csat-reading/v14-principle-build.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
// Detailed first construction is preserved privately. Public reruns only verify
// committed metadata against the privacy manifest; they never emit answer values.
const base='docs/research/csat-reading/data/v14/';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=JSON.parse(fs.readFileSync(base+'principle-redaction.json','utf8'));
for(const r of manifest.private_first_receipts){if(hash(r.private_path)!==r.first_sha256)throw Error('Private first record drift');}
if(hash(base+'principle-cross-review.json')!==manifest.redacted_public_sha256)throw Error('Public redaction drift');
const full=JSON.parse(fs.readFileSync(manifest.private_first_receipts[0].private_path,'utf8'));
for(const c of full.cases)for(const s of c.source_refs){
 const sources=JSON.parse(fs.readFileSync(s.input_path,'utf8')).items;
 if(!sources.some(i=>i.id===s.id))throw Error('Missing private source');
 if(!Number.isInteger(s.official_answer_observed))throw Error('Missing private key observation');
}
console.log(JSON.stringify({private_source_key_observations_verified:true,public_answers_emitted:false,cross_pairs:full.cases.length}));
