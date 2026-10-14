// scripts/research/csat-reading/v13-finalize.mjs
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const base='docs/research/csat-reading/',dir=base+'data/v13/',read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=x=>createHash('sha256').update(x).digest('hex');
const agreement=read(dir+'agreement.json'),logic=read(dir+'logic-review.json'),window=read(dir+'window-review.json'),tasks=read(dir+'task-summary.json'),principles=read(dir+'principle-current-ledger.json'),handoff=read(dir+'handoff.json');
function requireIt(value,label){if(!value)throw Error(label);}
const run=read(dir+'pilot-execution.json');for(const [p,h] of Object.entries(run.first_hashes))requireIt(sha(fs.readFileSync(p))===h,'First outcome changed '+p);
for(const [p,h] of Object.entries(read(dir+'registration.json').previous_artifact_hashes))requireIt(sha(fs.readFileSync(p))===h,'Old artifact changed '+p);
requireIt(logic.denominators.paths_reviewed===58&&logic.path_audit.length===58,'Path coverage');requireIt(logic.relation_audit.length===77,'Relation coverage');
requireIt(logic.choice_pair_audit.length===55&&logic.denominators.strict_comparable_pairs===48,'Candidate target audit');requireIt(logic.findings.filter(x=>x.kind==='defect').length===9&&logic.findings.filter(x=>x.kind==='unresolved').length===10,'Findings denominators');
requireIt(window.packet_count===6&&window.positive_claim_count===8,'Window denominator');
const windowCounts=window.reviews.flatMap(x=>x.positive_claims).reduce((s,x)=>(s[x.verdict]=(s[x.verdict]??0)+1,s),{});
requireIt(Object.values(windowCounts).reduce((s,x)=>s+x,0)===8,'Window claim coverage');
requireIt(tasks.latest_unique===74&&tasks.unreviewed_combinations===23506,'Task counts');requireIt(principles.summary.both_original_and_key_checked_pairs===1&&principles.summary.partial_defer_key_pairs===1,'Principle counts');
const docs=['V13-REPORT.md','PROTOCOL-v1.3.md','V13-SOURCE.md','V13-VALIDATION.md','V13-TASKS.md','V13-RELATIONS.md','V13-PRINCIPLES.md','V13-CROSS-TYPE.md','V13-TEACHING.md','V13-COVERAGE.md','V13-HANDOFF.md','V13-THEORY.md'];
const linkErrors=[];for(const name of docs){const p=base+name,text=fs.readFileSync(p,'utf8');for(const m of text.matchAll(/\]\(([^)]+)\)/gu)){const target=m[1];if(target.startsWith('http')||target.startsWith('#'))continue;const resolved=path.resolve(path.dirname(p),target.split('#')[0]);if(!fs.existsSync(resolved))linkErrors.push({p,target});}}
requireIt(!linkErrors.length,'Broken research links '+JSON.stringify(linkErrors));
// Exact full passages must stay private. Short anchors and own paraphrases remain allowed.
const corpus=read('scripts/research/csat-reading/local/v13/pilot-input.json');const publicFiles=[...docs.map(x=>base+x),...fs.readdirSync(dir).filter(x=>x.endsWith('.json')&&!['artifacts.json','final-gate.json','final-integrity.json'].includes(x)).map(x=>dir+x)];const leaks=[];
for(const p of publicFiles){const text=fs.readFileSync(p,'utf8').replace(/\s+/gu,' ');for(const it of corpus.items){const plain=it.passage.replace(/\s+/gu,' ');if(plain.length>200&&text.includes(plain))leaks.push({p,id:it.id});}}
requireIt(!leaks.length,'Full source redistribution '+JSON.stringify(leaks));
const gate={version:'1.3',status:{RESEARCH_COMPLETED:true,VALIDITY_SUPPORTED:{scope:'Limited R1 source-bound best-fit/numeric explanations and narrowed development cases; not measurement validation',population_generalization:false},VALIDITY_BLOCKED:{confirmatory_expansion:true,same_target_equivalence:true,restricted_method_sufficiency:true,necessary_relations:true,learner_diagnosis_or_effects:true},PRODUCT_HANDOFF_READY:{research_review_packet:true,public_content:false,direct_learner_diagnosis:false,automatic_level_or_prescription:false}},numeric_first_gate:agreement.numeric_gate,logic_findings:logic.findings_counts,strict_target_comparable:48,total_target_pairs:55,strict_subset_gate_replaces_registered_gate:false,window:{packets:6,source_items:3,claims:8,verdicts:windowCounts},principles:principles.summary,student_n:0,human_experts:0,DB_UI_public_v3_changed:false,main_merged:false,teaching_effects:'not_tested'};
const integrity={version:'1.3',pass:true,first_outcomes_unchanged:true,old_artifacts_unchanged:true,research_docs:docs.length,source_n:11,logical_paths:58,relations:77,choice_pairs:55,task_union:74,link_errors:linkErrors,full_passage_leaks:leaks,regression_tests:38,agent_config_checks:15,product_build:'not_run_research_only',handoff_student_promotion:false};
if(process.argv.includes('--check')){
 const a=read(dir+'artifacts.json');for(const [p,h] of Object.entries(a.files))requireIt(sha(fs.readFileSync(p))===h.sha256,'Sealed v1.3 artifact mismatch '+p);
 requireIt(JSON.stringify(read(dir+'final-gate.json'))===JSON.stringify(gate),'Gate drift');requireIt(JSON.stringify(read(dir+'final-integrity.json'))===JSON.stringify(integrity),'Integrity drift');
 console.log(JSON.stringify({pass:true,sealed_files:Object.keys(a.files).length,first_hashes_preserved:true,full_passage_leaks:0,broken_links:0,scientific_confirmation:'blocked',research_handoff:'limited_ready'}));
}else{
 for(const [name,x] of [['final-gate.json',gate],['final-integrity.json',integrity]])fs.writeFileSync(dir+name,JSON.stringify(x,null,2)+'\n');
 const files=[...docs.map(x=>base+x),base+'README.md',base+'PLAN.md','docs/CHANGELOG.md',...fs.readdirSync(dir).filter(x=>x.endsWith('.json')&&x!=='artifacts.json').map(x=>dir+x),...fs.readdirSync('scripts/research/csat-reading').filter(x=>x.startsWith('v13-')||x==='v13.test.mjs').map(x=>'scripts/research/csat-reading/'+x)].sort();
 const index={version:'1.3',date:'2026-10-14',task:'T-0027',branch:'research/csat-reading-20261012',preregistration_commit:'ca6e5a1cb',source_freeze_commit:'811e45a1b',first_outcomes_commit:'c602b299c',files:Object.fromEntries(files.map(p=>{const bytes=fs.readFileSync(p);return[p,{sha256:sha(bytes),bytes:bytes.length}]})),index_self_excluded:true,private_sources_required_for_semantic_reproduction:true};
 fs.writeFileSync(dir+'artifacts.json',JSON.stringify(index,null,2)+'\n');console.log(JSON.stringify({sealed_files:files.length,gate:'VALIDITY_BLOCKED',handoff:'research_review_only',windows:windowCounts}));
}
