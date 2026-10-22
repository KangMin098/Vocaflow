import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
const dir='verification/reviews/T-0086-r1-independent'
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.name==='.vite'?[]:e.isDirectory()?walk(path.posix.join(d,e.name)):[path.posix.join(d,e.name)])
const receipt=JSON.parse(fs.readFileSync(dir+'/next-receipt.json','utf8'))
const files=[...walk(dir),'planning/handoff/FINAL-FIRST-R5-REVIEW-PACKET-rev1.json',receipt.goal_check.report]
execFileSync('git',['diff','--check','--',...files],{stdio:'inherit'})
execFileSync('git',['add','--intent-to-add','--',...files],{stdio:'inherit'})
execFileSync('git',['commit','--only',...files,'-m','review: accept vocabulary preparation context and queue first set review','-m','Record independent source30/30 and styled browser10/10.\nIntegrate exact accepted source into latest main with combined30/30 and type/lint0.\nPreserve source audit changes and queue missing current R5 review packet; no content approval or DB writes.\n\nCo-Authored-By: Codex <noreply@openai.com>'],{stdio:'inherit'})
