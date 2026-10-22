import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const cwd='D:/workspace/Vocaflow-main-serving',dir='D:/workspace/Vocaflow-AI-Control/verification/reviews/T-0086-r1-independent'
const git=(...a)=>execFileSync('git',a,{cwd,encoding:'utf8'}).trim(),{base,source}=JSON.parse(fs.readFileSync(dir+'/merge-base.json','utf8'))
if(git('rev-parse','HEAD')!==base||git('branch','--show-current')!=='main'||git('diff','--name-only'))throw new Error('Main changed during checks')
const files=git('diff','--cached','--name-only').split('\n'),expected=git('diff','--name-only','f14d7beb5',source).split('\n')
if(JSON.stringify([...files].sort())!==JSON.stringify([...expected].sort()))throw new Error('Unexpected staged scope')
git('diff','--check','--cached')
const r=JSON.parse(fs.readFileSync(dir+'/combined-results.json','utf8'))
if(r.numPassedTests!==30||r.numFailedTests||r.numPendingTests)throw new Error('Combined checks incomplete')
const tree=git('write-tree')
fs.writeFileSync(dir+'/merge-message.txt','merge: preserve map context during vocabulary preparation\n\nIntegrate accepted T-0086 without overwriting latest WordVault changes.\nKeep factory return support and current map evidence boundaries.\nCombined30/30skip0, type/lint0, DB writes0.\n\nCo-Authored-By: Codex <noreply@openai.com>\n')
execFileSync('git',['commit','-F',dir+'/merge-message.txt'],{cwd,stdio:'inherit'})
if(git('rev-parse','HEAD^{tree}')!==tree)throw new Error('Committed tree changed after verification')
execFileSync('node',['agents/scripts/lock.mjs','release','codex','--pid','19700'],{cwd,stdio:'inherit'})
const out={task:'T-0086',source,base,merge_commit:git('rev-parse','HEAD'),tested_tree:tree,committed_tree:git('rev-parse','HEAD^{tree}'),files,conflicts:[],tests:{files:5,passed:30,failed:0,skipped:0},source_chromium:'10/10 source globals/Tailwind; navigation shim, not authenticated Next',tsc_exit:0,eslint_exit:0,diff_check_exit:0,main_clean:git('status','--porcelain','--untracked-files=no')==='',lock_released:'codex19700',db_writes:0,remote_push:false,remote_ci:false,actual_effect_verified:false}
fs.writeFileSync(dir+'/local-main-integration.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2))
