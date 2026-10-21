// verification/reviews/FINAL-MAIN-65c8ef6ae/check-main.mjs
// Use the existing checker with a per-invocation explicit main reference. No controller/config changes.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { goalCheckStep } from '../../../lib/orchestrator.mjs'
import { devConfig } from '../../../lib/devmode.mjs'
const repo='D:/workspace/Vocaflow-final-independent',dir='verification/reviews/FINAL-MAIN-65c8ef6ae'
const main=execFileSync('git',['-C',repo,'rev-parse','origin/main'],{encoding:'utf8'}).trim()
if(main!=='65c8ef6ae4534f8f1aa4d68d5188128fa5553782')throw Error('main moved; reassessment inputs must be rebound')
const inspected=JSON.parse(fs.readFileSync('verification/reviews/PR328-final-independent/ci-inspection.json','utf8'))
const merge=JSON.parse(fs.readFileSync('verification/reviews/PR328-final-independent/merge-receipt.json','utf8'))
if(!merge.identical_tree||merge.mergeCommit.oid!==main)throw Error('Missing exact merged-tree proof')
const result=goalCheckStep({by:'final-independent-accept',ciEnabled:true,deps:{productRepo:repo,devConfig:()=>({...devConfig(),mode:'GITHUB'}),readWorkflowJob:()=>({found:true,workflow:'ci.yml',job:'e2e',run_id:39555680677,head_sha:inspected.head,conclusion:'success',log_read:true,skipped_inner:false,test_passed:33,test_skipped:0,source_event:'pull_request',note:'Actual tested commit differs from merge commit; identical tree independently verified; deployment smoke remains unverified.'})}})
fs.writeFileSync(`${dir}/engine-${process.argv[2]||'final'}-receipt.json`,JSON.stringify({main,ref:'origin/main',report:result.report,distribution:result.distribution,changes:result.changes,config_globally_unchanged:true,ci_source:'Official PR328 inspected log/report, no new run; actual head retained.'},null,2)+'\n')
console.log(JSON.stringify({main,report:result.report,distribution:result.distribution,changes:result.changes}))
