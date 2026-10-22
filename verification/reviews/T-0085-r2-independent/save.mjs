import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='.vite'?[]:e.isDirectory()?walk(path.posix.join(dir,e.name)):[path.posix.join(dir,e.name)])}
const receipt=JSON.parse(fs.readFileSync('verification/reviews/NEXT-VOCAB-PREPARATION/dispatch-receipt.json','utf8'))
const files=[...walk('verification/reviews/T-0085-r2-independent'),...walk('verification/reviews/NEXT-VOCAB-PREPARATION'),'planning/handoff/FINAL-VOCAB-PREPARATION-RETURN-rev1.json',receipt.goal_check.report]
execFileSync('git',['diff','--check','--',...files],{stdio:'inherit'})
execFileSync('git',['add','--intent-to-add','--',...files],{stdio:'inherit'})
execFileSync('git',['commit','--only',...files,'-m','review: accept trial display and continue learner preparation','-m','Verify T-0085 fixed counterexamples, actual styled browser and main48/48.\nPreserve current main trace guards and original failure evidence.\nRefresh goal check without claiming effect or release approval; dispatch one confirmed WordVault return gap.\n\nCo-Authored-By: Codex <noreply@openai.com>'],{stdio:'inherit'})
