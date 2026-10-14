// scripts/research/factory-qualification/audit-product.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve('D:/workspace/Vocaflow-map-v62');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const files=['apps/web/src/lib/csat/map/v62/demand.ts','apps/web/src/lib/csat/map/v62/supply.ts','apps/web/src/lib/csat/map/v62/order-spec.ts','apps/web/src/lib/csat/map/v62/persist-contract.ts','apps/web/src/lib/csat/order-model.ts','apps/web/src/lib/csat/order-view.ts','docs/csat-learner/v62/P-F0_FACTORY_AUDIT.md','docs/csat-learner/v62/P-F1-F3_DEMAND_SUPPLY.md','docs/csat-learner/v62/P-F4b_PERSIST_MODEL.md','apps/web/src/lib/csat/map/v62/production-pilot.ts','docs/csat-learner/v62/P-F5_PRODUCTION_PILOT.md','scripts/csat/map/v62/import-research-v15.mjs'];
const out={version:'fq1-product-audit-1',observed_at:new Date().toISOString(),readonly_worktree:root,head:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:execFileSync('git',['-C',root,'branch','--show-current'],{encoding:'utf8'}).trim(),files:files.map(file=>({file,exists:fs.existsSync(path.join(root,file)),sha256:fs.existsSync(path.join(root,file))?sha(fs.readFileSync(path.join(root,file))):null,tracked:execFileSync('git',['-C',root,'ls-files','--',file],{encoding:'utf8'}).trim().length>0})),mapping:{vocab_choice:['R-VOCAB','X-VOCAB'],grammar_choice:['R-GRAMMAR']},contracts:{WorkspaceDemand:'implemented pure demand.ts; explicit roles/tasks/version/requires; no production',SupplyResult:'implemented supply.ts; Qualification boolean|null; factory_candidate excludes independent assessment',FactoryOrder:'pure state machine implemented persist-contract.ts; persistent DB design is not evidence of applied schema',ContentArtifact:'design reuses artifact_kind/ref/revision existing asset references; no dedicated table required',WorkspaceDelivery:'persistent design in P-F4b; runtime implementation not proven by design',production_pilot:'untracked evolving read-only file snapshot; not qualified release or learner evidence'},qualification_fields:['producible','rights','content','teaching','assessment','learner','runnable'],research_boundary:{db_writes:0,production_runs:0,release_approvals:0,learner_observations:0}};
fs.mkdirSync('docs/research/factory-qualification/data',{recursive:true});
const dest='docs/research/factory-qualification/data/product-audit.json';
if(fs.existsSync(dest))throw Error('preserve initial audit; use new revision');
fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({head:out.head,files:out.files.length,hash:sha(fs.readFileSync(dest))}));
