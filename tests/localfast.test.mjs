// tests/localfast.test.mjs — LOCAL_FAST: 모드 · 기준 ref · 로컬 증거 → goal-check 규칙 · 정적 게이트 · 실행 수 판독 · 통합(가짜 git)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { baseRef, devConfig, readLocalEvidence } from '../lib/devmode.mjs'
import { ciAllowsPass } from '../lib/goalcheck.mjs'
import { countsOf, integrate, staticGates, writeLocalEvidence } from '../lib/localgate.mjs'

const HEAD = 'a'.repeat(40)
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-lf-'))

test('devConfig — 기본 LOCAL_FAST · 환경변수 우선 · 잘못된 모드 거부', () => {
  const f = path.join(tmp(), 'none.json')
  assert.equal(devConfig({ env: {}, file: f }).mode, 'LOCAL_FAST')
  assert.equal(baseRef(devConfig({ env: {}, file: f })), 'local/integration')
  assert.equal(baseRef(devConfig({ env: { VFC_DEV_MODE: 'GITHUB' }, file: f })), 'origin/main')
  assert.throws(() => devConfig({ env: { VFC_DEV_MODE: 'X' }, file: f }))
})

test('로컬 e2e 증거 → goal-check 의 CI 규칙(skip=0 · 실행>0 · 커밋 일치)을 그대로 통과/거부', () => {
  const dir = tmp()
  writeLocalEvidence('C1', { ok: true, ms: 1, counts: { passed: 12, failed: 0, skipped: 0 } }, HEAD, { dir, now: () => '2026-10-19T10:00:00.000Z' })
  const r = readLocalEvidence('C1', dir)
  assert.equal(ciAllowsPass(r, HEAD).ok, true)
  assert.equal(ciAllowsPass(r, 'b'.repeat(40)).ok, false, '다른 커밋의 증거는 통과가 아니다')
  writeLocalEvidence('C1', { ok: true, ms: 1, counts: { passed: 11, failed: 0, skipped: 1 } }, HEAD, { dir, now: () => '2026-10-19T11:00:00.000Z' })
  assert.equal(ciAllowsPass(readLocalEvidence('C1', dir), HEAD).ok, false, '가장 최근 증거가 건너뜀 1 → 거부')
  writeLocalEvidence('C1', { ok: true, ms: 1, counts: null }, HEAD, { dir, now: () => '2026-10-19T12:00:00.000Z' })
  assert.equal(ciAllowsPass(readLocalEvidence('C1', dir), HEAD).ok, false, '실행 수를 못 읽으면 UNKNOWN')
  assert.equal(readLocalEvidence('NONE', dir), undefined)
})

test('countsOf — vitest · playwright · node:test 출력', () => {
  assert.deepEqual(countsOf('Tests  2541 passed | 52 skipped (2593)'), { passed: 2541, failed: 0, skipped: 52 })
  assert.deepEqual(countsOf('  12 passed (2.4m)'), { passed: 12, failed: 0, skipped: 0 })
  assert.deepEqual(countsOf('ℹ pass 14\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0'), { passed: 14, failed: 0, skipped: 0 })
  assert.equal(countsOf('no summary'), null)
})

function fixture({ status = 'COMPLETED', verdict = 'APPROVE', files = 'M\tapps/web/src/a.ts', added = '+const x = 1', approval = null, allowed = ['apps/web/src/**'], verified = HEAD } = {}) {
  const dir = tmp()
  const review = `리뷰\n\`\`\`json\n{"verdict":"${verdict}","findings":[]}\n\`\`\`\n`
  fs.writeFileSync(path.join(dir, 'r.md'), review)
  const task = { task_id: 'T-1', status, verified_commit: verified, review_record: 'r.md', review_record_sha256: crypto.createHash('sha256').update(review).digest('hex'), impact: { parent_goal_id: 'VG-1' }, allowed_paths: allowed, approval }
  const git = (...a) => {
    if (a[0] === 'diff' && a[1] === '--name-status') return files
    if (a[0] === 'diff' && a[1] === '-U0') return `+++ b/x\n${added}`
    if (a[0] === 'show') return 'create table x();'
    throw new Error('unexpected ' + a.join(' '))
  }
  return { task, git, reviewRoot: dir }
}

test('staticGates — 정상 통과', () => {
  const f = fixture()
  assert.deepEqual(staticGates({ ...f, head: HEAD, base: 'local/integration' }).fail, [])
})

test('staticGates — 미완료 · REVIEW_UNKNOWN · 검증 뒤 커밋 · 범위 밖 · 비밀값 · .env · 승인 없는 마이그레이션 · 마이그레이션 삭제', () => {
  const run = (o) => { const f = fixture(o); return staticGates({ ...f, head: HEAD, base: 'b' }).fail.join(' | ') }
  assert.match(run({ status: 'REVIEW' }), /COMPLETED/)
  assert.match(run({ verdict: 'REVIEW_UNKNOWN' }), /APPROVE 만/)
  assert.match(run({ verdict: 'REWORK' }), /APPROVE 만/)
  assert.match(run({ verified: 'c'.repeat(40) }), /검증 뒤 커밋/)
  assert.match(run({ files: 'M\tagents/scripts/x.mjs' }), /허용 범위 밖/)
  assert.match(run({ added: '+const k = "sk-ant-abcdefghijklmnopqrstuvwxyz"' }), /비밀값/)
  assert.match(run({ files: 'A\tapps/web/src/.env.local', allowed: ['apps/web/**'] }), /\.env/)
  assert.match(run({ files: 'A\tsupabase/migrations/20261019_x.sql', allowed: ['supabase/**'] }), /DB 승인/)
  const sha = crypto.createHash('sha256').update('create table x();').digest('hex')
  assert.doesNotMatch(run({ files: 'A\tsupabase/migrations/20261019_x.sql', allowed: ['supabase/**'], approval: { sql_sha256: sha } }), /DB 승인/)
  assert.match(run({ files: 'D\tsupabase/migrations/20261019_x.sql', allowed: ['supabase/**'] }), /삭제/)
  assert.doesNotMatch(run({ files: 'A\tsupabase/migrations/_pending_x.sql', allowed: ['supabase/**'] }), /DB 승인/, '보류 SQL 파일은 적용 대상이 아니다')
})

test('integrate — 더러운 통합 worktree 는 손대지 않음 · 충돌은 되돌림 · 성공은 sha', () => {
  assert.equal(integrate({ integrationGit: (...a) => (a[0] === 'status' ? ' M x' : ''), head: HEAD, message: 'm' }).ok, false)
  const calls = []
  const conflict = (...a) => { calls.push(a[0]); if (a[0] === 'status') return ''; if (a[0] === 'merge' && a[1] !== '--abort') throw new Error('CONFLICT'); return '' }
  const r = integrate({ integrationGit: conflict, head: HEAD, message: 'm' })
  assert.equal(r.ok, false)
  assert.ok(calls.includes('merge'))
  assert.equal(integrate({ integrationGit: (...a) => (a[0] === 'rev-parse' ? 'f'.repeat(40) : ''), head: HEAD, message: 'm' }).sha, 'f'.repeat(40))
})

test('UI 게이트 — 테스트 파일만 바꾼 작업은 화면 작업이 아니다(T-0101 오탐) · 실제 컴포넌트는 그대로 UI', async () => {
  const { isUiPath } = await import('../lib/uigate.mjs')
  assert.equal(isUiPath('apps/web/src/components/csat/theater/__tests__/reasoning-note-authored.test.tsx'), false)
  assert.equal(isUiPath('apps/web/src/components/x/Y.spec.tsx'), false)
  assert.equal(isUiPath('apps/web/src/components/csat/theater/ReasoningNoteForm.tsx'), true)
  assert.equal(isUiPath('apps/web/src/components/**'), true)
})
