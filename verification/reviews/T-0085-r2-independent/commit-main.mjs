import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const cwd='D:/workspace/Vocaflow-main-serving',dir='D:/workspace/Vocaflow-AI-Control/verification/reviews/T-0085-r2-independent'
const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim()
const base='9c539ad009e27bc8e0444187f34a4d0f0824249f',source='f14d7beb5d87d3952b4eccde0c58b5c34390917d'
if(git('rev-parse','HEAD')!==base||git('branch','--show-current')!=='main'||git('diff','--name-only'))throw new Error('Main changed during checks')
const files=git('diff','--cached','--name-only').split('\n')
const expected=git('diff','--name-only','e21ff733c',source).split('\n')
if(JSON.stringify([...files].sort())!==JSON.stringify([...expected].sort()))throw new Error('Staged scope differs from accepted task')
git('diff','--check','--cached')
const tests=JSON.parse(fs.readFileSync(dir+'/combined-results.json','utf8'))
if(tests.numPassedTests!==48||tests.numFailedTests||tests.numPendingTests)throw new Error('Combined scope not passing')
const tree=git('write-tree')
fs.writeFileSync(dir+'/merge-message.txt','merge: integrate current trial evidence display\n\nPreserve latest main trace guards, links and help changes.\nBind accepted T-0085 source with combined48/48, type/lint0.\nDB/participant/content approval and actual effect unchanged.\n\nCo-Authored-By: Codex <noreply@openai.com>\n')
execFileSync('git',['commit','-F',dir+'/merge-message.txt'],{cwd,stdio:'inherit'})
const commit=git('rev-parse','HEAD')
if(git('rev-parse','HEAD^{tree}')!==tree)throw new Error('Committed tree differs from tested tree')
execFileSync('node',['agents/scripts/lock.mjs','release','codex','--pid','19700'],{cwd,stdio:'inherit'})
const report={task:'T-0085',source,base,merge_commit:commit,tested_tree:tree,committed_tree:git('rev-parse','HEAD^{tree}'),files,conflicts:[],tests:{files:5,passed:48,failed:0,skipped:0},tsc_exit:0,eslint_exit:0,diff_check_exit:0,main_clean:git('status','--porcelain','--untracked-files=no')==='',lock_released:'codex19700',db_writes:0,remote_push:false,remote_ci:false,authenticated_DB_or_effect_VERIFIED:false}
fs.writeFileSync(dir+'/local-main-integration.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
