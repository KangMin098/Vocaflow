// agents/scripts/__tests__/codex-route.test.mjs — 지정 Codex 대화 라우터(가짜 세션 저장소 · 가짜 codex 실행). 실제 Codex 호출 없음.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { compose, confirmLanded, deliver, findRollout, loadRegistry, resolve, verifyRollout } from '../codex-route.mjs'

const UUID = '01a14de8-2485-7a53-b530-d5612f35e57a'
const NAME = 'Codex-VOCAFLOW-FINAL-ACCEPT'
const REG = loadRegistry()

function fakeHome({ uuid = UUID, roleText = `세션: 기존 \`${NAME}\`` } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-route-'))
  const dir = path.join(home, '.codex', 'sessions', '2026', '10', '18')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `rollout-2026-10-18T16-27-01-${uuid}.jsonl`)
  fs.writeFileSync(file, `${JSON.stringify({ type: 'session_meta', payload: { id: uuid } })}\n${JSON.stringify({ payload: { role: 'user', content: roleText } })}\n`)
  return { home, file }
}
/** 가짜 codex: queue 를 받으면 세션 기록에 메시지를 붙이고 공식 출력 형식으로 답한다 */
const fakeRun = (file, { fail = false, wrongThread = false, noAppend = false } = {}) => (bin, argv) => {
  if (fail) { const e = new Error('spawn failed'); e.stderr = 'app-server not running'; throw e }
  const thread = argv[argv.indexOf('--thread') + 1]
  const msg = argv[argv.indexOf('--message') + 1]
  if (!noAppend) fs.appendFileSync(file, `${JSON.stringify({ payload: { role: 'user', content: msg } })}\n`)
  return `Queued message 01a15248-9233-7f21-bab5-c80dea96fabf for thread ${wrongThread ? '00000000-0000-0000-0000-000000000000' : thread}.\n`
}
const msg = () => compose({ task: 'FINAL-FI006', to: NAME, pr: 303, head: 'a976d399a', fi: ['FI-006'], criteria: ['같은 ref 동시 공급 1행'], body: '반례 ②③ 재실행 부탁' })

test('CR1 정본 결속 — ACCEPT 는 확인된 uuid · 근거, PLANNER 는 uuid 없음(대체 금지)', () => {
  assert.equal(resolve(REG, NAME).uuid, UUID)
  assert.throws(() => resolve(REG, 'Codex-VOCAFLOW-FINAL-PLANNER'), /uuid 가 확인되지 않았다/)
  assert.throws(() => resolve(REG, 'Codex-아무거나'), /등록되지 않은 세션 이름/)
  assert.throws(() => resolve(REG, 'Claude-VOCAFLOW-FINAL-OWNER'), /Codex 세션이 아니다/)
})

test('CR2 인계문 — 작업 ID 첫 줄 · PR · HEAD · FI · 수용 기준 · 결속 안내', () => {
  const m = msg()
  assert.match(m.split('\n')[0], /^\[VF-TASK FINAL-FI006\] Claude-VOCAFLOW-FINAL-OWNER → Codex-VOCAFLOW-FINAL-ACCEPT$/)
  assert.match(m, /PR: #303 · HEAD: a976d399a/)
  assert.match(m, /FI: FI-006/)
  assert.match(m, /- 같은 ref 동시 공급 1행/)
  assert.match(m, /첫 줄에 \[VF-TASK FINAL-FI006\]/)
  assert.throws(() => compose({ task: 'x', to: NAME, pr: 1, head: 'abcdef1' }), /작업 ID/)
  assert.throws(() => compose({ task: 'FINAL-X', to: NAME, pr: 1, head: 'zz' }), /HEAD/)
})

test('CR3 세션 기록 검증 — id 일치 · 역할 이름 포함', () => {
  const { home, file } = fakeHome()
  assert.equal(findRollout(UUID, home), file)
  assert.equal(verifyRollout(fs.readFileSync(file, 'utf8'), UUID, NAME).ok, true)
  assert.equal(verifyRollout(fs.readFileSync(file, 'utf8'), UUID, 'Codex-OTHER').ok, false)
  const other = fakeHome({ roleText: '다른 대화' })
  assert.equal(verifyRollout(fs.readFileSync(other.file, 'utf8'), UUID, NAME).ok, false)
})

test('CR4 전달 성공 — 큐 id · 세션 기록에 작업 ID 기록', () => {
  const { home, file } = fakeHome()
  const r = deliver({ registry: REG, to: NAME, message: msg(), run: fakeRun(file), home, bin: 'codex' })
  assert.equal(r.delivered, true)
  assert.equal(r.status, 'landed')
  assert.equal(r.queueId, '01a15248-9233-7f21-bab5-c80dea96fabf')
  assert.ok(fs.readFileSync(file, 'utf8').includes('[VF-TASK FINAL-FI006]'))
})

test('CR5 실패는 미전달 + 재개 조건 — 새 세션으로 대체하지 않는다', () => {
  const { home, file } = fakeHome()
  const cases = [
    deliver({ registry: REG, to: 'Codex-VOCAFLOW-FINAL-PLANNER', message: msg(), run: fakeRun(file), home }), // uuid 없음
    deliver({ registry: REG, to: NAME, message: msg(), run: fakeRun(file), home: fs.mkdtempSync(path.join(os.tmpdir(), 'vf-empty-')) }), // 기록 없음
    deliver({ registry: REG, to: NAME, message: msg(), run: fakeRun(file, { fail: true }), home }), // 런타임 실패
    deliver({ registry: REG, to: NAME, message: msg(), run: fakeRun(file, { wrongThread: true }), home }), // 다른 스레드 응답
    deliver({ registry: REG, to: NAME, message: '작업 ID 없는 글', run: fakeRun(file), home }),
  ]
  for (const r of cases) {
    assert.equal(r.delivered, false)
    assert.ok(r.reason && r.resume, JSON.stringify(r))
  }
})

test('CR6 큐 접수 · 처리 대기 — 대화가 진행 중이면 기록 반영 전(queued) · 나중에 confirm 으로 반영 확인', () => {
  const { home, file } = fakeHome()
  const r = deliver({ registry: REG, to: NAME, message: msg(), run: fakeRun(file, { noAppend: true }), home })
  assert.equal(r.delivered, true)
  assert.equal(r.status, 'queued')
  assert.equal(confirmLanded({ registry: REG, to: NAME, task: 'FINAL-FI006', home }).landed, false)
  fs.appendFileSync(file, `${JSON.stringify({ payload: { role: 'user', content: msg() } })}\n`) // 턴이 끝나 큐가 처리됨
  assert.equal(confirmLanded({ registry: REG, to: NAME, task: 'FINAL-FI006', home }).landed, true)
})
