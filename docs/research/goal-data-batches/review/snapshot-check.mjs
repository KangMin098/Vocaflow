// docs/research/goal-data-batches/review/snapshot-check.mjs
import fs from 'node:fs'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
const dir='docs/research/goal-data-batches/review'
const blob=(sha,p)=>execFileSync('git',['show',`${sha}:${p}`],{maxBuffer:30e6})
const hash=b=>crypto.createHash('sha256').update(b).digest('hex')
const matrix=JSON.parse(blob('1b8f089e5','docs/research/goal-data-batches/D4-assessment/task-assessment-matrix.json'))
const checked=Object.entries(matrix.input_sha256).map(([p,expected])=>({path:p,expected,working_bytes_match:hash(fs.readFileSync(p))===expected,git_input_matches_review:hash(blob(matrix.input_head,p))===hash(blob('80fa44540',p))}))
const result={d4_input_head:matrix.input_head,files:checked,all_git_inputs_identical:checked.every(c=>c.git_input_matches_review),all_working_bytes_match:checked.every(c=>c.working_bytes_match),note:'파일 바이트 해시가 다르면 줄바꿈까지 같은 것으로 주장하지 않는다. git input blob 동일성은 별도 검사했다.'}
fs.writeFileSync(`${dir}/snapshot-checks.json`,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({files:checked.length,all_git_inputs_identical:result.all_git_inputs_identical,all_working_bytes_match:result.all_working_bytes_match,mismatches:checked.filter(c=>!c.git_input_matches_review||!c.working_bytes_match)}))
