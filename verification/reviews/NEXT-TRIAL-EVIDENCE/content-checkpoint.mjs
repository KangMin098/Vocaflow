import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const repo='D:/workspace/Vocaflow-main-serving'
const rel='docs/final/review/FINAL_CONTENT_DECISION_MANIFEST_20261022.json'
const manifest=JSON.parse(fs.readFileSync(path.join(repo,rel),'utf8'))
const hash=b=>createHash('sha256').update(b).digest('hex')
const sets=manifest.sets.map(s=>({file:s.file,revision:s.set_revision,task:s.task,expected:s.file_sha256,actual:hash(fs.readFileSync(path.join(repo,s.file)))}))
if(sets.some(s=>s.expected!==s.actual))throw new Error('Content approval package hash drift: review update required; no approval inherited')
const result={observed_at:new Date().toISOString(),main:execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),package:rel,files_checked:sets.length,all_bytes_match:true,counts:manifest.counts,sets,
  db:{observed_at:'2026-10-22T08:41:41.568301Z',environment:'vocaflow-dev',method:'mcp supabase execute_sql SELECT aggregate counts only; no writes',authored_items:0,human_decisions:0,ai_decisions:0,qualifications:0,release_approvals:0,deliveries:0,bindings:0,factory_attempts:0},
  first_supply_package:'verification/reviews/T-0045-next-product-20261022/first-r5-review-package.json',
  first_supply_scope:'R5 current v3: teach1 + guided1 + independent2 + transfer2 + fresh-recheck2; optional delayed1. Scope/Gold/rights/public+assessment decisions remain separate and absent.',
  approval:'Schema installed does not constitute FINAL policy or per-revision Gold/rights/release approval. Actual installed human OR ai OR source_policy path previously independently inspected; no writes through any path.',
  no_actual_supply:true,educational_effect_validated:false}
fs.writeFileSync(new URL('./content-checkpoint.json',import.meta.url),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({main:result.main,files:sets.length,counts:result.counts,match:true,db:result.db},null,2))
