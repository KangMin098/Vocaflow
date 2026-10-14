// scripts/research/csat-reading/v15-content-source-revision.mjs
// Fill provenance/required-scope fields in a new ledger; preserve first output.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=p=>({path:p,sha256:sha(fs.readFileSync(p))});
const pub='docs/research/csat-reading/data/v15/',local='scripts/research/csat-reading/local/v15/';
const first=read(pub+'content-candidates.json'),overlay=read(local+'content-packages.json');
const candidates=first.candidates.map(c=>{const item=(read(c.source.path).items||read(c.source.path)).find(x=>x.id===c.item_id);const ledger=read(c.source.admission_ledger.path).items.find(x=>x.id===c.item_id);const p=ledger.provenance;
 const pdf=c.source.pdf||{filename:p.pdf_filename,sha256:p.pdf_sha256,pages:p.pages,paper_form:p.paper_form,official_download_chain:'unresolved'};
 const a=[...overlay.reused_priority_activities,...overlay.new_activities].find(a=>a.activity_id===c.candidate_id);
 const ranges=a.source.ranges||[{field:'passage',start:0,end:item.passage.length,status:'conservative_sufficient_scope; minimality_not_established'}];
 return{...c,exam:{...c.exam,form:c.exam.form||pdf.paper_form},source:{...c.source,pdf},provided_information:{...c.provided_information,required_evidence_ranges:ranges,original_presentation_access:item.presentation?.kind==='dual_axis_bar_line_chart'?'actual preserved original chart render plus marked derived cells; visual performance not inferred':'source paper presentation retained in private input',minimum_sufficiency:'not_established; declared full provided body is not a proven minimal paid read'},review_revision:'provenance_and_scope_explicit_only; original Gold unchanged'};
});
const result={version:'1.5-candidate-ledger-revision1',first_ledger:ref(pub+'content-candidates.json'),private_detail:ref(local+'content-packages.json'),candidates,counts:{unique_candidate_activities:8,unique_item_ids:8,source_verified_inherited:8,new_visual_audits:0,public_qualified:0,direct_assessment_qualified:0},limits:['research local access confirmed, publication rights unresolved','source status is inherited AI/PDF admission, not newly performed visual certification','v3 fields are actual existing AI interpretations, not official intent or Gold']};
const path=pub+'content-candidates-revision1.json',bytes=JSON.stringify(result,null,2)+'\n';if(process.argv.includes('--check')){if(fs.readFileSync(path,'utf8')!==bytes)throw Error('Revision mismatch');}else{if(fs.existsSync(path))throw Error('Refusing overwrite');fs.writeFileSync(path,bytes,'utf8');}
console.log(JSON.stringify({check:process.argv.includes('--check'),ledger:ref(path)}));
