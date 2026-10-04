// scripts/csat/__tests__/source-origin-build.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

test('builder distinguishes stored attempts from unsearched passages and deduplicates identical logs', () => {
  const root=path.resolve('scripts/csat/source-origin-work')
  fs.mkdirSync(root,{recursive:true})
  const dir=fs.mkdtempSync(path.join(root,'builder-regression-'))
  const file=n=>path.join(dir,n)
  const row=(hash,id)=>({passage_sha256:hash.repeat(64),representative_item_id:id,item_ids:[id],exam:{kind:'suneung'},word_count:20})
  const pending=[row('a','fixture#21'),row('b','fixture#22')]
  const attempt={passage_sha256:'a'.repeat(64),query:'a usable phrase',raw_search:'no source found',attempt_id:'fixed'}
  try {
    fs.writeFileSync(file('pending.jsonl'),pending.map(JSON.stringify).join('\n')+'\n')
    fs.writeFileSync(file('curated.json'),JSON.stringify({audited_at:'2026-10-04',scope:{unique_passages:2,in_scope_items:2},entries:{}}))
    fs.writeFileSync(file('search.jsonl'),[attempt,attempt,{...attempt,passage_sha256:'b'.repeat(64),raw_search:''}].map(JSON.stringify).join('\n')+'\n')
    const args=['scripts/csat/source-origin-build.mjs','--pending',file('pending.jsonl'),'--curated',file('curated.json'),'--search-log',file('search.jsonl'),'--results',file('results.jsonl'),'--report',file('report.md')]
    const run=spawnSync(process.execPath,args,{encoding:'utf8'})
    assert.equal(run.status,0,run.stderr)
    const rows=fs.readFileSync(file('results.jsonl'),'utf8').trim().split('\n').map(JSON.parse)
    assert.equal(rows[0].search_checked,true);assert.equal(rows[0].search_attempt_count,1)
    assert.equal(rows[1].search_checked,false);assert.equal(rows[1].search_attempt_count,0)
    assert.match(rows[1].note,/미조사/)
    assert.match(fs.readFileSync(file('report.md'),'utf8'),/1개 지문, 1건/)
    assert.ok(!fs.readFileSync(file('report.md'),'utf8').includes('51개'))
  } finally {
    const resolved=path.resolve(dir)
    assert.ok(resolved.startsWith(root+path.sep))
    fs.rmSync(resolved,{recursive:true,force:true})
  }
})
