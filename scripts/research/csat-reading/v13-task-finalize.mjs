// scripts/research/csat-reading/v13-task-finalize.mjs
// Reproduce bounded counts and guard candidate/relevance/learner-evidence separation.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const base='docs/research/csat-reading/',dir=base+'data/v13/',selection=read(dir+'task-selection.json'),review=read(dir+'task-review.json'),education=read(dir+'task-education.json'),relations=read(dir+'task-relations.json'),old=read(base+'data/v12/item-task-reviewed.json').rows
assert.equal(sha(dir+'task-selection.json'),review.selection_sha256)
assert.equal(sha(base+'data/v12/item-task-reviewed.json'),review.old_46_sha256)
for(const s of selection.source_hashes)assert.equal(sha(s.path),s.sha256)
const count=rows=>rows.reduce((s,r)=>(s[r.relevance]=(s[r.relevance]??0)+1,s),{})
const latest=new Map(old.map(r=>[`${r.item_id}/${r.task_id}`,r]));for(const r of review.rows){latest.set(`${r.item_id}/${r.task_id}`,r);assert.equal(r.learner_use,false);assert.notEqual(r.candidate_relevance,undefined);const d=read(r.source_ref),item=(d.items??d).find(x=>x.id===r.item_id);for(const a of r.anchors){const text=a.field==='passage'?item.passage:item.choices[Number(a.field.match(/\[(\d+)\]/)[1])];assert.equal(text.slice(a.start,a.end),a.quote)}}
assert.equal(latest.size,74);assert.equal(review.rows.filter(r=>r.previously_reviewed).length,2)
assert.equal(education.packages.length,4);assert.equal(education.method_comparisons,40);assert.equal(education.material_role_contracts,24);assert.equal(education.retained_profile_count,30)
for(const p of education.packages){assert.equal(Object.keys(p.contracts).length,14);assert.equal(p.methods.length,10);assert.equal(p.materials.length,6);assert.equal(p.promotion_gate.R3_scoring_and_independence,false);for(const m of p.methods){assert.equal(m.effectiveness_status,'not_tested');assert(m.learner_action&&m.independent_check&&m.counterexample.item_id)}}
assert.equal(relations.relations.length,34);assert.equal(relations.pairs.length,7);assert.equal(relations.approval_status_changes,0)
const sample=review.rows.filter(r=>r.sampling_roles.includes('probability_audit')),positive=sample.filter(r=>r.candidate_relevance!=='unknown'),unknown=sample.filter(r=>r.candidate_relevance==='unknown')
assert.equal(sample.length,24)
const summary={version:'1.3',historical:{reviewed:46,direct:18,indirect:28},new_revision_rows:30,new_unique:28,prior_revisions:2,latest_unique:74,latest_status_counts:count([...latest.values()]),unreviewed_combinations:23580-latest.size,automatic_candidates_unchanged:6310,probability_audit:{restricted_denominator:181,sample:24,positive_candidate_n:positive.length,positive_reviewed_states:count(positive),candidate_unknown_n:unknown.length,unknown_reviewed_states:count(unknown),population_precision_reported:false,population_omission_rate_reported:false,confidence_intervals_reported:false},item_pdf_provenance:'Local source admission inherited from old source-audit/restoration/pilot source files; this analyst directly read admitted full research inputs, did not repeat image/key audit. Exact file/row/stem/choice hashes and anchor ranges bind this revision.',source_audit_hashes:['data/main-20261014/source-audit.json','data/v12/restoration-a.json','data/v12/restoration-b.json','data/v12/pilot-source.json'].map(p=>({path:base+p,sha256:sha(base+p)})),validation:{candidate_to_learner_promotion:false,old46_hash_preserved:true,source_hashes:true,source_anchors:true,contracts14_each:true,methods10_each:true,materials6_each:true,relations34_status_preserved:true,pairs7:true},results_scope:'Single AI semantic development review; no human independent validity or student effects.'}
if(process.argv.includes('--check')){const saved=read(dir+'task-summary.json');assert.deepEqual(saved,summary);console.log(JSON.stringify({pass:true,summary},null,2));process.exit(0)}
const target=dir+'task-summary.json';if(fs.existsSync(target))throw Error('Summary exists; use --check')
fs.writeFileSync(target,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2))
