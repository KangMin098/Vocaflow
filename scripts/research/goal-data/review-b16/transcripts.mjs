// scripts/research/goal-data/review-b16/transcripts.mjs
import fs from 'node:fs'
import crypto from 'node:crypto'
const dir='scripts/research/goal-data/review-b16/'
const captured=JSON.parse(fs.readFileSync(dir+'transcripts.local.json'))
const rows=captured.map(c=>({label:c.label,path:c.path,unchanged:fs.readFileSync(c.path,'utf8')===c.raw,sha256:crypto.createHash('sha256').update(c.raw).digest('hex')}))
fs.writeFileSync(dir+'transcript-check.local.json',JSON.stringify(rows,null,2)+'\n')
if(rows.length!==4||rows.some(r=>!r.unchanged))throw Error('Captured transcript changed or missing')
console.log(JSON.stringify({transcripts:rows.length,unchanged:true}))
