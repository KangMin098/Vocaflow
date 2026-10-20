// tests/remote.test.mjs — 로컬 개발 상태 ↔ 원격 공식 통합 상태 분리(CI 대기가 로컬 진행을 막지 않는다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { localStatus, setRemote, statusBoard, loadRemote } from '../lib/remote.mjs'

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-remote-')), 'R.json')
const H1 = 'b060561a757ce6a698fd3592471ddb4dcf15a454'
const H2 = 'c7c8a06dc251de33de4237c15f381378993db23a'

test('로컬 상태는 작업 큐 + 로컬 통합 기록에서만 — 원격 상태는 입력이 아니다', () => {
  assert.equal(localStatus({ task_id: 'T', status: 'REVIEW' }, null), 'LOCAL_REVIEW')
  assert.equal(localStatus({ task_id: 'T', status: 'COMPLETED', verified_commit: H1 }, null), 'LOCAL_ACCEPTED')
  assert.equal(localStatus({ task_id: 'T', status: 'COMPLETED', verified_commit: H1 }, { head: H1 }), 'LOCAL_INTEGRATED')
  assert.equal(localStatus({ task_id: 'T', status: 'COMPLETED', verified_commit: H1 }, { head: H2 }), 'LOCAL_ACCEPTED', '다른 커밋의 통합은 이 작업의 통합이 아니다')
  assert.equal(localStatus({ task_id: 'T', status: 'WAITING_CHATGPT' }, null), 'DESIGNING')
})

test('원격 상태 — PR · HEAD 결속 · 다른 HEAD 의 CI 결과 승계 거부 · 잘못된 값 거부', () => {
  const f = tmp()
  setRemote('T-0050', { pr: 303, head: H1, status: 'CI_PENDING', by: 'final-product' }, { f })
  assert.throws(() => setRemote('T-0050', { pr: 303, head: H2, status: 'REMOTE_REVIEW', by: 'x' }, { f }), /CI_PENDING 부터/)
  setRemote('T-0050', { pr: 303, head: H2, status: 'CI_PENDING', by: 'x' }, { f })
  assert.throws(() => setRemote('T-0050', { pr: 303, head: H2, status: 'GREEN', by: 'x' }, { f }))
  assert.throws(() => setRemote('T-0050', { pr: null, head: H2, status: 'CI_PENDING', by: 'x' }, { f }), /PR/)
  assert.throws(() => setRemote('T-0050', { pr: 303, head: H2, status: 'CI_PENDING' }, { f }), /by/)
  const e = loadRemote(f).entries['T-0050']
  assert.equal(e.history.length, 2)
  assert.equal(e.head, H2)
})

test('board — CI_PENDING 이어도 로컬 상태는 그대로 진행(차단 없음)', () => {
  const f = tmp()
  setRemote('T-0050', { pr: 303, head: H1, status: 'CI_PENDING', by: 'final-product' }, { f })
  const rows = statusBoard([{ task_id: 'T-0050', owner_id: 'final-product', status: 'REVIEW' }, { task_id: 'T-0051', owner_id: 'final-product', status: 'READY' }], loadRemote(f), () => null)
  assert.deepEqual(rows.map((r) => [r.task_id, r.local, r.remote]), [['T-0050', 'LOCAL_REVIEW', 'CI_PENDING'], ['T-0051', 'READY', 'NOT_SUBMITTED']])
})

test('실행 규칙 — LOCAL_FAST 의 일반 개발은 push · gh 거부 · 백업 · 공식 통합만 허용 · GITHUB 모드는 예전대로', async () => {
  const { assertRemoteAllowed } = await import('../lib/devmode.mjs')
  const LF = { mode: 'LOCAL_FAST' }, GH = { mode: 'GITHUB' }
  assert.throws(() => assertRemoteAllowed('dev', 'git push', LF), (e) => e.code === 'LOCAL_FAST_NO_REMOTE')
  assert.throws(() => assertRemoteAllowed('dev', 'gh run list', LF), /LOCAL_FAST/)
  assert.doesNotThrow(() => assertRemoteAllowed('backup', 'git push backup', LF))
  assert.doesNotThrow(() => assertRemoteAllowed('official', 'gh pr view', LF))
  assert.doesNotThrow(() => assertRemoteAllowed('dev', 'git push', GH))
  assert.throws(() => assertRemoteAllowed('other', 'x', LF), /모른다/)
})

test('실행 규칙 — ci.mjs 기본 runner 는 LOCAL_FAST 에서 gh 를 실행하지 않는다(ghAvailable=false · 판독 시도 0)', async () => {
  const prev = { mode: process.env.VFC_DEV_MODE, kind: process.env.VFC_REMOTE_KIND }
  process.env.VFC_DEV_MODE = 'LOCAL_FAST'; delete process.env.VFC_REMOTE_KIND
  try {
    const { ghAvailable } = await import('../lib/ci.mjs')
    assert.equal(ghAvailable(), false, 'gh 를 부르기 전에 거부되어 판독 불가로 본다')
  } finally {
    if (prev.mode === undefined) delete process.env.VFC_DEV_MODE; else process.env.VFC_DEV_MODE = prev.mode
    if (prev.kind !== undefined) process.env.VFC_REMOTE_KIND = prev.kind
  }
})
