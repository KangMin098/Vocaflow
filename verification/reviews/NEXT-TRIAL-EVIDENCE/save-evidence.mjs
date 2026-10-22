import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='.vite'?[]:e.isDirectory()?files(path.posix.join(dir,e.name)):[path.posix.join(dir,e.name)])}
const receipt=JSON.parse(fs.readFileSync('verification/reviews/NEXT-TRIAL-EVIDENCE/dispatch-receipt.json','utf8'))
const own=[...files('verification/reviews/T-0084-r2-independent'),...files('verification/reviews/NEXT-TRIAL-EVIDENCE'),'planning/handoff/FINAL-TRIAL-EVIDENCE-DISPLAY-rev1.json',receipt.goal_check.report]
for(const p of own)if(!fs.statSync(p).isFile())throw new Error(p)
execFileSync('git',['diff','--check','--',...own],{stdio:'inherit'})
// --only includes precisely this review's artifacts; shared inbox and foreign files stay untouched.
execFileSync('git',['add','--intent-to-add','--',...own],{stdio:'inherit'})
execFileSync('git',['commit','--only',...own,'-m','review: accept metric cohort and dispatch trial evidence fix','-m','Record T-0084 independent acceptance and exact tested local main merge.\nPreserve initial failures and correct the package script review claim.\nRecheck canonical main and hand off one scoped trial display defect.\n\nCo-Authored-By: Codex <noreply@openai.com>'],{stdio:'inherit'})
console.log(execFileSync('git',['show','--stat','--oneline','HEAD'],{encoding:'utf8'}))
