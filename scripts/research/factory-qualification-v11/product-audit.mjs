// scripts/research/factory-qualification-v11/product-audit.mjs
// Read-only product receipts; no DB writes, imports, publishing, or product tests.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PRODUCT = process.env.FQ11_PRODUCT_ROOT ?? 'D:/workspace/Vocaflow-map-v62';
const OUT = path.join(ROOT, 'docs/research/factory-qualification-v11/data/product-audit.json');
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
const git = (...args) => execFileSync('git', ['-C', PRODUCT, ...args], { encoding: 'utf8' }).trim();
const files = [
  'docs/csat-learner/v62/P-F4b_PERSIST_MODEL.md',
  'docs/csat-learner/v62/P-F4a_TEXTBOOK_PUBLISH_GATE.md',
  'docs/csat-learner/v62/P-F5_PRODUCTION_PILOT.md',
  'apps/web/src/lib/csat/map/v62/persist-contract.ts',
  'apps/web/src/lib/csat/map/v62/supply.ts',
  'apps/web/src/lib/csat/map/v62/demand.ts',
  'apps/web/src/lib/csat/map/v62/order-spec.ts',
  'apps/web/src/lib/csat/map/v62/production-pilot.ts',
  'apps/web/src/lib/csat/map/v62/study-items.ts',
  'apps/web/src/lib/csat/map/v62/qualification.ts',
  'apps/web/src/lib/csat/map/v62/__tests__/qualification.test.ts',
  'scripts/csat/map/v62/import-fq1.mjs',
  'apps/web/src/lib/csat/map/v4/as-is.ts',
  'apps/web/src/components/csat/diagnosis/map/TaskInspector.tsx',
  'apps/web/src/lib/csat/diagnosis/route-helpers.ts',
  'scripts/csat/map/v62/e2e-map-supply.mjs',
  'supabase/migrations/_pending_textbook_practice_publish_gate.sql',
];
const prs = [253,254,255].map((n) => JSON.parse(execFileSync('gh', ['pr','view',String(n),'--json','number,state,mergedAt,mergeCommit,url'], {cwd:PRODUCT,encoding:'utf8'})));
const receipt = {
  method:'read_only_git_files_github_and_separate_readonly_sql_receipts',
  observed_at:new Date().toISOString(), product_root:PRODUCT,
  product_head:git('rev-parse','HEAD'), origin_main:git('rev-parse','origin/main'), prs,
  files:files.map((p) => {
    const bytes=fs.readFileSync(path.join(PRODUCT,p));
    let mainSha=null;
    try { mainSha=sha(execFileSync('git',['-C',PRODUCT,'show',`origin/main:${p}`],{stdio:['ignore','pipe','ignore']})); } catch {}
    return {path:p,sha256:sha(bytes),bytes:bytes.length,main_sha256:mainSha,status:mainSha===null?'untracked_proposal':mainSha===sha(bytes)?'main_identical':'working_copy_differs'};
  }),
  sql_receipt:{
    observed_at:'2026-10-14', method:'Supabase execute_sql read_only; to_regclass then information_schema, pg_proc, pg_policies; aggregate only',
    tables:Object.fromEntries(['content_qualification','workspace_content_demand','factory_order','factory_order_event','workspace_content_delivery'].map(x=>[x,'absent'])),
    existing_learner_workspace:'present', proposed_functions_found:0, proposed_policies_found:0,
    content_qualification_rows:'not_countable_table_absent',
    knowledge_applications_csat_item_task:[{status:'active',rows:24,rows_with_named_release_fields:24},{status:'draft',rows:5,rows_with_named_release_fields:0}],
    limitations:['Named release fields do not independently establish authority, legal scope, or student efficacy.','No individual user IDs, raw payloads, keys, or approval identities exported.','No DB change or product E2E executed.'],
  },
  flag_sets:{supply:['producible','rights','content','teaching','assessment','learner','runnable'],proposed_approval_C:['producible','rights','content','teaching','gold','assessment','runnable']},
  implementation_gaps:['proposed_ledger_absent','approval_authority_and_scope_not_verified_by_pure_adapter','evidence_hashes_and_methods_dropped_by_snapshot_import','source_analysis_gold_revisions_not_independently_bound','supplyEligible_omits_learner_caller_boundary','delivery_transition_checks_only_qualificationId_presence','no_atomic_factory_delivery_RPC_or_RLS','shared_normalized_body_exposure_ledger_unchecked'],
  e2e_scenarios:[
    {id:'unqualified_factory_blocked',current:'pure proposal tests plus factory_candidate stock path; no delivery server E2E'},
    {id:'existing_R5_preserved',current:'existing R5 supply path and e2e-map-supply script; not rerun in this readonly research'},
    {id:'V2_guided_waits_review',current:'production pilot release hold, factory_candidate; no learner activity-unit renderer'},
    {id:'revision_change_revalidated',current:'pure bindResult proposal rejects content revision; no persisted invalidation server'},
    {id:'other_user_history_denied',current:'learnerContext session identity and existing APIs; no factory-delivery table/policy'},
    {id:'same_demand_duplicate_blocked',current:'canonical/signature pure contract and proposed unique; no atomic delivery persistence'},
  ],
};
if(process.argv.includes('--check')) {
  const old=JSON.parse(fs.readFileSync(OUT,'utf8'));
  const matches=old.files.every(x=>fs.existsSync(path.join(PRODUCT,x.path))&&sha(fs.readFileSync(path.join(PRODUCT,x.path)))===x.sha256);
  console.log(JSON.stringify({snapshot_files_unchanged:matches,current_head:receipt.product_head,recorded_head:old.product_head,live_product_may_change:true}));
  // This is an observation refresh, never an authority or qualification assertion.
} else { if(fs.existsSync(OUT)) throw new Error('Registered product receipt exists; preserve it and use a separate revision for a new audit.'); fs.mkdirSync(path.dirname(OUT),{recursive:true}); fs.writeFileSync(OUT,JSON.stringify(receipt,null,2)+'\n'); console.log(JSON.stringify({files:receipt.files.length,head:receipt.product_head,prs:prs.map(x=>[x.number,x.state]),db_writes:0})); }
