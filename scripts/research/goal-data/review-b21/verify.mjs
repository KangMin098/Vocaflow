// scripts/research/goal-data/review-b21/verify.mjs
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {at,revision} from './git-object.mjs'
const dir='scripts/research/goal-data/review-b21/',doc='docs/research/goal-data-batches/review-b21/',v=JSON.parse(fs.readFileSync(doc+'verdict.json','utf8')),p=JSON.parse(fs.readFileSync(dir+'provenance.local.json','utf8')),s=JSON.parse(fs.readFileSync(dir+'supplement.local.json','utf8')),d=JSON.parse(fs.readFileSync(dir+'deep.local.json','utf8')),checks=[]
const check=(name,ok)=>{checks.push({name,ok});if(!ok)throw Error(name)}
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.mjs'))){const r=spawnSync(process.execPath,['--check',dir+f],{encoding:'utf8'});check('syntax '+f,r.status===0)}
check('actual prompts4',p.results.length===4&&p.results.every(r=>r.prompt_equal))
check('direct output edits0',p.results.every(r=>r.direct_edits.length===0))
check('A02 report absent',p.results.find(r=>r.label==='A-02').handback.length===0)
check('acceptance ids and statuses',v.acceptance.map(c=>c.id).join(',')==='0,1,2,3,4,5'&&v.acceptance.every(c=>['confirmed','refuted','unclear'].includes(c.status)))
check('pinned revision',v.input.revision===revision)
check('counts',s.checks.length===198&&d.checks.length===105&&v.verification.additional_rebuild_checks===d.checks.length-94&&s.changes.length===16)
check('all execution assertions',s.checks.concat(d.checks).every(c=>c.pass))
check('unclear preserved',v.acceptance[3].status==='unclear'&&v.acceptance[4].subclaims.independent_full_thirteen_reproduction==='unclear'&&v.unrun.length===3)
check('no P0 P1',v.new_P0===0&&v.new_P1===0&&v.findings.length===0)
for(const c of v.acceptance)for(const ref of c.evidence){const m=/^(.*):(\d+)$/.exec(ref);check('reference format '+ref,!!m);const q=m[1],n=Number(m[2]);let text;if(q.startsWith('D:/workspace/Vocaflow-goal-data/')&&!q.includes('/local/'))text=at(q.slice('D:/workspace/Vocaflow-goal-data/'.length));else text=fs.readFileSync(q,'utf8');check('reference line '+ref,n>0&&n<=text.split('\n').length)}
const md=fs.readFileSync(doc+'review.md','utf8');check('relative row review link',fs.existsSync(path.resolve(doc,'../../../../scripts/research/goal-data/review-b21/row-review.md')))
check('report present',md.includes('223/240')&&md.includes('13쌍 전수 재현')&&md.includes('32/32'))
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.ok),dossier_items:JSON.parse(fs.readFileSync(dir+'dossier.local.json','utf8')).length,verdict:v.result}))
