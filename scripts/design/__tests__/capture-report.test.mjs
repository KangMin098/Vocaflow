// scripts/design/__tests__/capture-report.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {saveCaptureReport} from '../lib/capture-report.mjs'

function directory(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocaflow-capture-report-'))
  t.after(() => {for (const file of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, file));fs.rmdirSync(dir)})
  return dir
}

test('failed, incomplete, loading and interaction-failed reruns retain the last complete report', t => {
  const dir = directory(t), good = {renders:[{route:'/hub',landed:'/hub',ok:true}],checks:[{ok:true}]}
  assert.equal(saveCaptureReport(dir,good,1),true)
  for (const report of [
    {renders:[{ok:false,error:'connection refused'}]},
    {renders:[]},
    {renders:[{ok:true,loadingLike:true}]},
    {renders:[{ok:true}],checks:[{ok:false}]},
  ]) {
    assert.equal(saveCaptureReport(dir,report,1),false)
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'_last-success.json'),'utf8')),good)
  }
  assert.equal(fs.readdirSync(dir).filter(file=>file.startsWith('_run-')).length,5)
})

test('an empty capture or partial expected matrix cannot establish a successful baseline', t => {
  const dir=directory(t)
  assert.equal(saveCaptureReport(dir,[],0),false)
  assert.equal(saveCaptureReport(dir,[{ok:true}],4),false)
  assert.equal(fs.existsSync(path.join(dir,'_last-success.json')),false)
})
