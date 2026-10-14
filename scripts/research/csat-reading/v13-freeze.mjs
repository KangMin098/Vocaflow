// scripts/research/csat-reading/v13-freeze.mjs
import fs from 'node:fs';import {sha,read} from './v13-analysis.mjs';
const base='docs/research/csat-reading/data/v13/',local='scripts/research/csat-reading/local/v13/';
const exists=p=>fs.existsSync(p);
if(exists(base+'pilot-registration.json'))throw Error('Source already frozen; never overwrite');
const input=read(local+'pilot-input.json');
if(input.items.length!==11||input.items.some(x=>x.id==='2022#26'))throw Error('Admission denominator');
for(const it of input.items){if(it.answer!==undefined||it.solved_answer!==undefined)throw Error('Unblinded source');if(it.choices.length!==5||!it.units.length||!it.source_binding)throw Error('Incomplete structure '+it.id);for(const u of it.units)if(it.passage.slice(u.start,u.end)!==u.text)throw Error('Unit mismatch '+it.id+':'+u.id);}
const paths=['docs/research/csat-reading/PROTOCOL-v1.3.md',base+'registration.json',base+'pilot-selection.json',base+'eligibility-addendum.json',base+'pilot-source.json',local+'pilot-input.json',local+'pilot-key.json',local+'rater-instructions.md','scripts/research/csat-reading/v13-analysis.mjs','scripts/research/csat-reading/v13-source-units.mjs'];
const hashes=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(p))]));
fs.writeFileSync(base+'pilot-registration.json',JSON.stringify({version:'1.3',preregistration_commit:'ca6e5a1cb',eligibility_commit:'54266da1a',planned_n:12,source_eligible_n:11,source_groups:new Set(input.items.map(x=>x.passage_group)).size,first_classification:'not_started',hashes,limitations:['AI contexts only, not human experts','Project source-role exposure distinct from fresh rater input','Original PDF download lineage/rights not established']},null,2)+'\n');
console.log(JSON.stringify({frozen:11,input_sha256:hashes[local+'pilot-input.json'],key_not_public:true}));
