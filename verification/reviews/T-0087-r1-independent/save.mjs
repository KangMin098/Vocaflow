import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const dir='verification/reviews/T-0087-r1-independent',final=JSON.parse(fs.readFileSync(dir+'/final-status.json','utf8'))
const files=[...fs.readdirSync(dir).map(f=>dir+'/'+f),final.goal_check.report]
execFileSync('git',['diff','--check','--',...files],{stdio:'inherit'})
execFileSync('git',['add','--intent-to-add','--',...files],{stdio:'inherit'})
fs.writeFileSync(dir+'/controller-message.txt','review: accept the first R5 human review packet\n\nVerify eight current-main v3 items, sixteen body and Gold bindings, and all displayed fields.\nComplete T-0087 and integrate two docs into local main; keep content decisions pending.\nRecord exact proof scope, EOF-only cleanup, and current Goal Check.\n\nCo-Authored-By: Codex <noreply@openai.com>\n')
execFileSync('git',['add','--intent-to-add','--',dir+'/controller-message.txt'],{stdio:'inherit'})
execFileSync('git',['commit','--only',...files,dir+'/controller-message.txt','-F',dir+'/controller-message.txt'],{stdio:'inherit'})
