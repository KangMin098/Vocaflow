// verification/reviews/FINAL-MAIN-0649f8c0b/classify.mjs
// Human-readable independent interpretation, not replacement canon or a new completion gate.
import fs from 'node:fs'
import crypto from 'node:crypto'
const dir='verification/reviews/FINAL-MAIN-0649f8c0b',wt='D:/workspace/Vocaflow-final-product'
const doc=JSON.parse(fs.readFileSync('goals/GOAL_ACCEPTANCE_CRITERIA.json','utf8'))
const engine=JSON.parse(fs.readFileSync(JSON.parse(fs.readFileSync(dir+'/engine-final-receipt.json','utf8')).report,'utf8'))
const classify={
 'VG-L0':['EVIDENCE_MISSING','Actual multi-cohort learning improvement/long-term operational reliability not established; isolated synthetic journeys are not effectiveness evidence.','T0045 integrated report'],
 'VG-L1-A':['EVIDENCE_MISSING','Independent/transfer code paths verified in isolation; actual retention/reassessment outcomes require learner evidence and an approved study.','T0050/T0052/T0068; evidence-claims.ts'],
 'VG-L1-B':['PARTIAL_IMPLEMENTED','Representative CSAT/WordVault routes complete; every platform target group/accessibility journey not independently covered.','T0061/T0062/T0069/T0070/T0071'],
 'VG-L1-C':['BLOCKED_EXTERNAL','Authored publication qualification cannot be established in actual dev DB before installation and recorded human rights/Gold decisions.','Dev SELECT2026-10-21T03:33:19Z; APPROVAL_PACKAGE'],
 'VG-L1-D':['PARTIAL_IMPLEMENTED','Technical verification and effects limits explicitly separate; actual deployment/effectiveness remain unverified.','PR326 receipts; T0045'],
 'VG-L2-A1':['DEFECT','Goal-only version change leaves old-goal PLAN saved/executable; T0072 is the newly reproduced missing connection.','goal-version-results.json:3fail2pass'],
 'VG-L2-A2':['PARTIAL_IMPLEMENTED','R0 reading instructional/guided/independent cycles and V1 learning return implemented; deferred instruments are not fabricated.','T0050/T0052/T0056/T0068/T0069'],
 'VG-L2-A3':['PARTIAL_IMPLEMENTED','Unseen different-passage transfer/recheck exercised with synthetic learners; actual comparable delayed learner evaluation missing.','T0068 pass/fail cycles; evidence-claims.ts'],
 'VG-L2-B1':['PARTIAL_IMPLEMENTED','Different general-reading/CSAT routes and WordVault roundtrip exist; full platform route/state coverage is not established by FINAL tests.','ROUTES; T0069'],
 'VG-L2-B2':['DEFECT','Today/return/history representative paths are implemented, but current-goal/old-PLAN presentation remains inconsistent in reproduced branch.','T0061/T0062/T0070/T0071; T0072 baseline'],
 'VG-L2-C1':['BLOCKED_EXTERNAL','Source/revision/delivery qualification contracts exist; actual authored deployment/decisions absent.','17-set hash check; dev metadata SELECT'],
 'VG-L2-C2':['PARTIAL_IMPLEMENTED','TASK demand/order/supply outcomes implemented; actual approved authored supply/use feedback is blocked, broader corpus sampling not re-audited.','T0067; demand.ts; AuthoredSupplyCard'],
 'VG-L2-D1':['DEFECT','G2/request/CAS IDs verified, but aggregate QA/internal account contamination still exists in current dashboard metrics.','dashboard-stats.ts:205,460-461; T0006 partial'],
 'VG-L2-D2':['PARTIAL_IMPLEMENTED','Required CI and isolated tests genuinely run; actual deployment smoke for this main has no supplied proof.','PR326 CI39530426670; merge identical-tree proof'],
 'VG-L2-D3':['EVIDENCE_MISSING','Actual external-user usability and learning-effect studies not established by synthetic browser success.','T0045 evidence-level separation'],
 'VG-L3-A1-01':['DEFECT','Top action=start, summary planGate=null/direct link, editor data-state=saved under old PLAN goal10/current goal11.','goal-version.test.ts/results; T0072'],
 'VG-L3-A1-02':['PARTIAL_IMPLEMENTED','Diagnosis eligibility/help/synthetic/timing guards exist and R0 regression evidence reused; all bad-data sources not independently re-audited.','as-is.ts; isEligible; T0062'],
 'VG-L3-A2-01':['PARTIAL_IMPLEMENTED','R0 reading and nondeferred16 TASK cycles verified; V1 is learning-only and held/listening instruments cannot be treated as measured.','T0068/T0069; codebook'],
 'VG-L3-A2-02':['IMPLEMENTED_IN_TESTED_SCOPE','Representative R0 path completes without lecture/game; instructional practice and independent evidence are distinguished.','T0050/T0052/PR326 isolated journeys'],
 'VG-L3-A3-01':['IMPLEMENTED_IN_TESTED_SCOPE','Fresh independent/transfer items use distinct passages/content IDs; duplicate exposure/cross-role protections tested.','T0068; authored-flow PGlite; PR326 regression'],
 'VG-L3-A3-02':['PARTIAL_IMPLEMENTED','Current-policy/eligibility/uncertainty kept with attempts; approved delayed retention instrument is absent (NOT_ESTABLISHED), not invented.','evidence-claims.ts:delayedRetention; T0062'],
 'VG-L3-B1-01':['PARTIAL_IMPLEMENTED','General reading/word review and exam map are distinct entry paths; R0 vocabulary contextual return is verified.','T0069; route source'],
 'VG-L3-B1-02':['EVIDENCE_MISSING','Full optional classroom/game/lecture regression across shared learner state lies beyond this FINAL synthetic scope; no claim of missing implementation.','Existing platform routes; UNMAPPED full criteria coverage'],
 'VG-L3-B2-01':['PARTIAL_IMPLEMENTED','CSAT records/history plus WordVault roundtrip preserve raw scales; one global cross-module history criterion is not fully evidenced by that.','T0062/T0069; independent reports'],
 'VG-L3-B2-02':['DEFECT','Next action/return/notes implemented, but goal revision with unchanged stage/count still presents old saved PLAN as current.','T0061/T0070/T0071; new T0072 baseline'],
 'VG-L3-C1-01':['PARTIAL_IMPLEMENTED','Source/set/revision/hash provenance and existing ledger binding verified in isolated code; actual authored release absent.','APPROVAL_PACKAGE;17hashes;FI001/FI006'],
 'VG-L3-C1-02':['IMPLEMENTED_IN_TESTED_SCOPE','Unapproved/revoked/stale revision/wrong role blocked in isolated SQL/API; real supply0 is not a successful eligible delivery.','Previous qualification/RLS/PostgreSQL evidence; T0067'],
 'VG-L3-C2-01':['PARTIAL_IMPLEMENTED','Goal/TASK demand roles/shortage and supply outcomes exist; no actual approved authored use measurements yet.','demand.ts; T0056/T0067'],
 'VG-L3-C2-02':['EVIDENCE_MISSING','Article/phrase/comic retention/discard decisions are a separate platform audit scope; do not assign duplicate cleanup work to final-product.','T0045 scope; other corpus owners'],
 'VG-L3-D1-01':['PARTIAL_IMPLEMENTED','Core R0 request/attempt/session/delivery/goal/plan IDs and replay controls verified; every platform event contract not claimed complete.','FI006/FI015/FI016; PR326'],
 'VG-L3-D1-02':['DEFECT','Current dashboard totals still count all user_profiles and today daily_activity without QA/internal eligibility filtering.','dashboard-stats.ts:205,460-461; T0006 audit retained'],
 'VG-L3-D2-01':['PARTIAL_EVIDENCE','Historical execution0 cause resolved by31 actual tests; deployment smoke missing. Engine external-input state also reflects an old open CI decision, not a request for new CI secrets.','PR326 CI39530426670; original PR158 failure history'],
 'VG-L3-D2-02':['PARTIAL_EVIDENCE','Independent auth/RLS/CAS/security boundaries and representative PC keyboard checks reused; no new blanket platform privacy/accessibility PASS.','Prior FI security private verification; PR326'],
 'VG-L3-D3-01':['EVIDENCE_MISSING','No verified actual external learner usability cohort supplied; synthetic browser accounts do not satisfy it.','T0045 ACTUAL_LEARNER_EVIDENCE remains unverified'],
 'VG-L3-D3-02':['EVIDENCE_MISSING','Actual preregistered baseline/followup/delayed/transfer study results not supplied; effects cannot be inferred.','evidence-claims.ts NOT_EVALUATED; T0045']
}
const rows=doc.criteria.filter(g=>g.level!==4).map(g=>{
 if(!classify[g.id])throw Error('Unmapped canonical goal '+g.id)
 const [classification,reason,evidence]=classify[g.id],r=engine.results.find(x=>x.goal_id===g.id)
 return {goal_id:g.id,criterion_id:g.acceptance[0].criterion_id,condition:g.acceptance[0].condition,engine_status:r.status,classification,reason,evidence,scope:'FINAL R0 code/isolated evidence where stated; not full platform or actual learner completion'}
})
if(rows.length!==35)throw Error('Expected35 instantiated criteria')
const distribution={};for(const x of rows)distribution[x.classification]=(distribution[x.classification]||0)+1
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const pkg=fs.readFileSync(wt+'/docs/final/APPROVAL_PACKAGE.md','utf8')
const sets=fs.readdirSync(wt+'/apps/web/src/lib/knowledge/authored').filter(x=>x.endsWith('.json')).map(n=>{const p=wt+'/apps/web/src/lib/knowledge/authored/'+n,b=JSON.parse(fs.readFileSync(p,'utf8')),h=sha(p);return {file:n,items:b.items.length,sha256:h,package_match:pkg.includes(h)}})
const sql=wt+'/supabase/migrations/_pending_authored_supply.sql'
const deploy=wt+'/supabase/deploy/authored-supply/20261020090000_authored_supply.sql'
const external={observed_at:'2026-10-21T03:33:19.217921Z',method:'read-only Supabase SELECT to_regclass',authored_item:null,content_human_decision:null,content_human_decision_revocation:null,workspace_content_delivery:'present',workspace_delivery_attempt:'present',actual_authored_installation:'NOT_INSTALLED',human_gold_and_rights:'No recorded DB qualification evidence; AI review is not human approval',sets,items:sets.reduce((n,x)=>n+x.items,0),pending_sql_sha256:fs.existsSync(sql)?sha(sql):null,deploy_copy_sha256:fs.existsSync(deploy)?sha(deploy):null,db_writes:0}
fs.writeFileSync(dir+'/criteria-main.json',JSON.stringify({main:engine.head.main_sha,formal_engine_report:JSON.parse(fs.readFileSync(dir+'/engine-final-receipt.json','utf8')).report,instantiated_criteria:35,templates_excluded:5,distribution,warning:'Independent classifications explain existing goal states; they are not new canonical statuses, blanket goal PASS or an A-H1:1 mapping.',rows},null,2)+'\n')
fs.writeFileSync(dir+'/external-state.json',JSON.stringify(external,null,2)+'\n')
console.log(JSON.stringify({criteria:rows.length,distribution,sets:sets.length,hash_matches:sets.filter(x=>x.package_match).length,items:external.items,sql_sha:external.pending_sql_sha256,deploy_sha:external.deploy_copy_sha256}))
