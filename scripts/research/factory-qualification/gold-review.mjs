// scripts/research/factory-qualification/gold-review.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p).toString('utf8'));
const sha=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const privatePath='scripts/research/factory-qualification/local/gold-countercases-first.json';
const blindPath='scripts/research/factory-qualification/local/gold-blind-input.json';
const rulesPath='docs/research/factory-qualification/data/gold-rules.json';
const outputPath='docs/research/factory-qualification/data/gold-boundary-review.json';
const priorBase='scripts/research/csat-reading/local/v15/';
const history=['assessment-input.json','assessment-expected.json','assessment-review-first.json','rater-a-first.json','rater-b-first.json'].map(n=>({path:priorBase+n,sha256:sha(priorBase+n)}));
const packet=json(privatePath),blind=json(blindPath),rules=json(rulesPath);
if(packet.version!==rules.version||blind.version!==rules.version)throw Error('version mismatch');
if(packet.cases.length!==10||new Set(packet.cases.map(c=>c.id)).size!==10)throw Error('countercase IDs');
const counts={meets:0,partial:0,defect:0,defer:0},procedural={eligible:0,ineligible:0,defer:0};
for(const c of packet.cases){
 const contract=Object.keys(rules.task_facets[c.task]??{});
 if(contract.length!==4||Object.keys(c.expected).length!==4||contract.some(f=>!Object.hasOwn(c.expected,f)))throw Error('facet contract');
 for(const s of Object.values(c.expected)){if(!Object.hasOwn(counts,s))throw Error('state');counts[s]++;}
 if(!Object.hasOwn(procedural,c.eligibility))throw Error('procedure');procedural[c.eligibility]++;
 const b=blind.cases.find(x=>x.id===c.id);
 if(!b||b.response!==c.response||['expected','eligibility','reason'].some(k=>Object.hasOwn(b,k)))throw Error('blind expectation leakage');
}
const out={version:'FQ1-gold1-author-review',rules:{path:rulesPath,sha256:sha(rulesPath)},private_author_expected:{path:privatePath,sha256:sha(privatePath)},blind_input:{path:blindPath,sha256:sha(blindPath)},historical:{preserved:history,responses:16,facets:64,first_facet_agreement:'64/64',first_procedure_agreement:'16/16',first_independent_eligible:0,recounted_as_new:0},new_countercases:{responses:10,facets:40,task_counts:{V2:4,S5:6},response_ids:packet.cases.map(c=>c.id),author_expected_facet_counts:counts,author_expected_procedure_counts:procedural,independent_review:'pending; author expectations are not independently validated Gold'},boundary_coverage:['G1','G2','G3','G4','G5'],historical_ambiguity_ids:['z77','z03','z69','z31'],interpretation:{script:'Validates schema, blinded separation, versions and aggregates only. Semantic judgments were directly made by AI researcher from actual responses.',original_gold:'unchanged; new rules not applied retroactively to original 16/64',assessment_qualified:0,public_qualified:0,students:0,human_reviewers:0},unresolved:[{id:'U1',kind:'referent_judgment',response_ids:['g03','g04'],reason:'Analyst must judge unique antecedent; numeric resemblance alone is not binding evidence.'},{id:'U2',kind:'dependency_boundary',response_ids:['g06'],reason:'Explicit invalid grounds and retained correct unit specification require component-level attribution; no single whole-response score.'},{id:'U3',kind:'external_validity',response_ids:[],reason:'Human independent scoring and learner-response data absent.'}]};
const encoded=JSON.stringify(out,null,2)+'\n';
if(process.argv.includes('--check')){if(read(outputPath).toString('utf8')!==encoded)throw Error('aggregate differs');console.log('gold-boundary-review unchanged, inputs validated');}
else {const full=path.join(root,outputPath);if(fs.existsSync(full))throw Error('refuse overwrite; use --check or new revision');fs.writeFileSync(full,encoded);console.log(JSON.stringify({new_responses:10,new_facets:40,author_expected_facet_counts:counts,author_expected_procedure_counts:procedural,sha256:sha(outputPath)}));}
