// 어댑터 단위 검사 — node --test adapter.test.mjs <repo> (main 의 실제 강의 · sidecar-final 로)
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

import { resolveAnswerBoundary, truncateLecture } from './adapter.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = process.env.REPO ?? 'D:/workspace/Vocaflow'
const sha256 = async (s) => 'sha256:' + crypto.createHash('sha256').update(s).digest('hex')
const exam = (e) => JSON.parse(execFileSync('git', ['-C', repo, 'show', `main:apps/web/src/lib/csat/lecture-data/${e}.json`], { encoding: 'utf8', maxBuffer: 1 << 26 }))
const side = (e) => JSON.parse(fs.readFileSync(path.join(here, '..', 'cue-audit', 'sidecar-final', `${e}.disclosure.json`), 'utf8'))
const pair = (id) => { const e = id.split('#')[0]; return [exam(e).lectures[id], side(e).lectures.find((l) => l.lecture_id === id)] }

test('2026#22 — 규칙 경계(c5, index 4) 앞에서 정지, VERIFIED', async () => {
  const [l, s] = pair('2026#22')
  const r = await resolveAnswerBoundary(l, s, sha256)
  assert.equal(r.status, 'VERIFIED')
  assert.equal(r.stopBefore, 4)
})

test('2026#27 — 대본이 규칙(index 5)보다 먼저 답을 말함(합의 ANSWER index 4) → 4 에서 정지', async () => {
  const [l, s] = pair('2026#27')
  const r = await resolveAnswerBoundary(l, s, sha256)
  assert.equal(r.status, 'VERIFIED')
  assert.equal(r.stopBefore, 4)
})

test('정답 판정이 갈린 cue 가 경계 앞에 있으면 UNVERIFIED(3자 판정 전)', async () => {
  const [l, s] = pair('2016#27')
  const r = await resolveAnswerBoundary(l, s, sha256)
  if (s.cues.some((c) => c.review?.final_source === 'third')) return // 3자 판정 반영 뒤에는 이 검사가 아니라 아래 결속 검사가 지킨다
  assert.equal(r.status, 'UNVERIFIED')
  assert.equal(r.stopBefore, null)
})

test('결속 — cue 원문이 한 글자라도 바뀌면 UNVERIFIED', async () => {
  const [l, s] = pair('2026#22')
  const changed = structuredClone(l)
  changed.cues[1].segments[0].text += ' '
  const r = await resolveAnswerBoundary(changed, s, sha256)
  assert.equal(r.status, 'UNVERIFIED')
  assert.match(r.reasons[0], /해시 불일치/)
})

test('결속 — version 이 다르면 UNVERIFIED', async () => {
  const [l, s] = pair('2026#22')
  const r = await resolveAnswerBoundary({ ...l, version: (l.version ?? 0) + 1 }, s, sha256)
  assert.equal(r.status, 'UNVERIFIED')
})

test('sidecar 없음 → UNVERIFIED', async () => {
  const [l] = pair('2026#22')
  assert.equal((await resolveAnswerBoundary(l, null, sha256)).status, 'UNVERIFIED')
})

test('truncateLecture — 경계 뒤 cue 를 담지 않는다', () => {
  const [l] = pair('2026#22')
  const t = truncateLecture(l, 4)
  assert.equal(t.cues.length, 4)
  assert.ok(!JSON.stringify(t).includes('정답은'))
})
