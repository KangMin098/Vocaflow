// tests/review-rebind.test.mjs
//
// 완료 작업의 리뷰 재결속(rebindReview)과 independent 작업의 로컬 통합 정렬 근거(staticGates).
// 실측(2026-10-24 T-0143): 완료 뒤 리뷰 파일에 절이 덧붙여 해시가 깨졌고, 판정이 JSON 이 아니라 게이트가 읽지 못했다 ·
// independent 는 등록 시 parent_goal_id 가 null 인데 게이트가 그것을 요구했다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-rebind-'))
process.env.VFC_ROOT = root
fs.mkdirSync(path.join(root, 'verification/reviews'), { recursive: true })
const T = await import('../lib/tasks.mjs')
const { staticGates } = await import('../lib/localgate.mjs')

const COMMIT = '955d6766ab9ef57e82b30bfd30a28c6ef3d8b7dd'
const write = (name, text) => { fs.writeFileSync(path.join(root, 'verification/reviews', name), text); return `verification/reviews/${name}` }
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex')

function state(over = {}) {
  const old = 'old review ACCEPT_WITH_NOTES'
  const task = { task_id: 'T-9', status: 'COMPLETED', owner_id: 'author', reviewed_by: 'reviewer', verified_commit: COMMIT, review_record: write('old.md', old), review_record_sha256: sha(old), history: [], ...over }
  return { state: { ownership: { owners: { author: {}, reviewer: {} } }, taskQueue: { tasks: [task] } }, task }
}

test('rebindReview — 다른 owner 의 통과 판정 JSON 으로 다시 결속하고 옛 기록을 남긴다', () => {
  const { state: s, task } = state()
  const text = `최종\n\`\`\`json\n{"verdict":"APPROVE","commit":"${COMMIT}"}\n\`\`\`\n`
  const p = write('final.md', text)
  const oldSha = task.review_record_sha256
  T.rebindReview(s, 'T-9', { caller: 'reviewer', review_path: p })
  assert.equal(task.status, 'COMPLETED')
  assert.equal(task.review_record, p)
  assert.equal(task.review_record_sha256, sha(text))
  assert.equal(task.review_history.at(-1).review_record_sha256, oldSha)
  assert.match(task.history.at(-1).note, /review rebind/)
})

test('rebindReview — 자기 리뷰 · 미완료 · 통과 아닌 판정 · 검증 커밋 미기재는 거부', () => {
  const ok = `\`\`\`json\n{"verdict":"APPROVE","commit":"${COMMIT}"}\n\`\`\``
  const run = (over, caller, text) => { const { state: s } = state(over); return () => T.rebindReview(s, 'T-9', { caller, review_path: write(`x-${Math.random()}.md`, text) }) }
  assert.throws(run({}, 'author', ok), /SELF_REVIEW|자기/)
  assert.throws(run({ status: 'REVIEW' }, 'reviewer', ok), /COMPLETED 만/)
  assert.throws(run({}, 'reviewer', `{"verdict":"REQUEST_CHANGES","commit":"${COMMIT}"}`), /통과\(APPROVE\|PASS\)만/)
  assert.throws(run({}, 'reviewer', '{"verdict":"APPROVE"}'), /검증 커밋/)
  assert.throws(run({}, 'nobody', ok), /등록된 owner/)
})

function gate(impact) {
  const text = '{"verdict":"APPROVE"}'
  fs.writeFileSync(path.join(root, 'g.md'), text)
  const task = { task_id: 'T-8', status: 'COMPLETED', verified_commit: COMMIT, review_record: 'g.md', review_record_sha256: sha(text), impact, allowed_paths: ['scripts/**'] }
  const git = (...a) => (a[1] === '--name-status' ? 'M\tscripts/a.mjs' : '+++ b/x\n+const y = 1')
  return staticGates({ task, head: COMMIT, base: 'local/integration', git, reviewRoot: root }).fail
}

test('staticGates — independent 는 user_request_ref 가 정렬 근거다(정본 목표 없이도)', () => {
  assert.deepEqual(gate({ kind: 'independent', parent_goal_id: null, user_request_ref: '2026-10-24 user: 요청' }), [])
  assert.ok(gate({ kind: 'independent', parent_goal_id: null, user_request_ref: '  ' }).some((f) => f.startsWith('align:')))
  assert.ok(gate({ kind: 'platform', parent_goal_id: null, user_request_ref: '2026-10-24 user: 요청' }).some((f) => f.startsWith('align:')))
})
