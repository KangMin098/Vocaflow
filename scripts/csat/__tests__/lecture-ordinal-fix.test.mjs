// scripts/csat/__tests__/lecture-ordinal-fix.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { hereOrdinals, judgeCue, rewriteHere, ordinalWord, scan } from '../lecture-ordinal-fix.mjs'

const CLI = fileURLToPath(new URL('../lecture-ordinal-fix.mjs', import.meta.url))
const cue = (id, k, ...ko) => ({ id, role: 'evidence', target: { kind: 'anchor', id: `sentence:${k}` }, segments: ko.map((text) => ({ lang: 'ko-KR', text })) })

test('수사 표 — 1~49 왕복', () => {
  for (let n = 1; n <= 49; n += 1) {
    const w = ordinalWord(n)
    assert.ok(w, `수사 없음 ${n}`)
    assert.deepEqual(hereOrdinals(`여기 ${w} 번째 문장`).map((h) => h.n), [n])
  }
})

test('「여기」 없는 서수는 세지 않는다', () => {
  assert.deepEqual(hereOrdinals('스물여섯 번째 문장에는 다른 말이'), [])
})

test('낭독이 1 작으면 자동 후보 — target 은 그대로, 수사만 k+1', () => {
  const j = judgeCue('2014A#43', cue('c4', 14, '여기 열네 번째 문장을 보세요.'), 30)
  assert.equal(j.kind, 'auto')
  assert.equal(j.after[0].text, '여기 열다섯 번째 문장을 보세요.')
})

test('「첫 문장」 → 「두 번째 문장」(개수 「두 문장」으로 들리지 않게)', () => {
  assert.equal(rewriteHere('여기 첫 문장입니다.', 1, 2), '여기 두 번째 문장입니다.')
})

test('일치하면 대상 아님 · 분석 타깃은 대상 아님', () => {
  assert.equal(judgeCue('2015#25', cue('c4', 4, '여기 다섯 번째 문장'), 6), null)
  assert.equal(judgeCue('2015#25', { ...cue('c9', 0, '여기 첫 문장'), target: { kind: 'analysis', id: 'map' } }, 6), null)
})

test('분할 의심 · 차이 ≠ −1 · 서수 여럿 · 범위 밖은 수동', () => {
  assert.equal(judgeCue('2015#34', cue('c6', 4, '여기 여섯 번째 문장'), 8).reason, 'split-suspect')
  assert.equal(judgeCue('2020#43', cue('c6', 4, '여기 세 번째 문장'), 8).reason, 'diff -2')
  assert.equal(judgeCue('2020#43', cue('c6', 4, '여기 네 번째 문장, 여기 세 번째 문장'), 8).reason, 'multi-ordinal')
  assert.equal(judgeCue('2020#43', cue('c6', 9, '여기 아홉 번째 문장'), 9).reason, 'target-out-of-range')
})

test('낡은 분할 설명이 있으면 재검토 표시', () => {
  assert.equal(judgeCue('M2706#43', cue('c2', 7, '여기 일곱 번째 문장. 에이의 끝과 비의 첫머리가 한 칸에 붙어'), 20).reason, 'ordinal+stale-text-review')
})

test('scan 은 입력 객체를 바꾸지 않는다', () => {
  const data = { lectures: { 'X#43': { version: 1, cues: [cue('c1', 3, '여기 세 번째 문장')] } } }
  const before = JSON.stringify(data)
  const r = scan([{ file: 'X.json', data }], new Map([['X#43', 10]]))
  assert.equal(r.auto.length, 1)
  assert.equal(JSON.stringify(data), before)
})

test('CLI — --out 만 쓰고, 원본 폴더 안 --out 은 거부', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordfix-'))
  const data = path.join(dir, 'lecture-data')
  fs.mkdirSync(data)
  const src = JSON.stringify({ lectures: { 'X#43': { version: 1, cues: [cue('c1', 3, '여기 세 번째 문장')] } } })
  fs.writeFileSync(path.join(data, 'X.json'), src)
  const out = path.join(dir, 'out')
  const ok = spawnSync(process.execPath, [CLI, '--data', data, '--skeleton', path.join(dir, 'none'), '--out', out], { encoding: 'utf8' })
  assert.equal(ok.status, 0, ok.stderr)
  assert.equal(fs.readFileSync(path.join(data, 'X.json'), 'utf8'), src)
  // 문지도가 없으면 범위를 확인할 수 없어 수동으로 간다
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'ordinal-fix.manual.json'), 'utf8')).manual[0].reason, 'no-skeleton')
  const bad = spawnSync(process.execPath, [CLI, '--data', data, '--out', path.join(data, 'x')], { encoding: 'utf8' })
  assert.equal(bad.status, 2)
  const none = spawnSync(process.execPath, [CLI, '--data', data], { encoding: 'utf8' })
  assert.equal(none.status, 2)
})
