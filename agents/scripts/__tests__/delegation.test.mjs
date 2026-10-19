// agents/scripts/__tests__/delegation.test.mjs — AUTONOMOUS_DELEGATED 판정기(순수). 실행 · DB 접근 없음.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'

import { classifySql, evaluateDelegatedApply, policyActive, protectedChanges } from '../delegation.mjs'

const sha256 = (t) => createHash('sha256').update(t).digest('hex')
const POLICY = JSON.parse(fs.readFileSync(new URL('../../policies/delegation.json', import.meta.url), 'utf8'))
const adopted = { ...POLICY, status: 'adopted', adoption: { by: 'human', adoptedAt: '2026-10-19T00:00:00Z', ticketHash: 'a'.repeat(64), scopeSha: 'b'.repeat(64) }, db: { ...POLICY.db, enabled: true } }

test('DL1 정본은 제안 상태 · 채택 기록 없음 · DB 위임 꺼짐 — 지금은 어떤 위임도 활성 아님', () => {
  assert.equal(POLICY.status, 'proposed')
  assert.equal(POLICY.adoption, null)
  assert.equal(POLICY.db.enabled, false)
  assert.equal(policyActive(POLICY).active, false)
})

test('DL2 status 만 adopted 로 바꿔도 사람 승인 티켓 기록이 없으면 비활성(에이전트 자기 채택 차단)', () => {
  assert.equal(policyActive({ ...POLICY, status: 'adopted' }).active, false)
  assert.equal(policyActive({ ...POLICY, status: 'adopted', adoption: { by: 'codex', adoptedAt: 'x', ticketHash: 'a'.repeat(64), scopeSha: 'b'.repeat(64) } }).active, false)
  assert.equal(policyActive(adopted).active, true)
})

test('DL3 SQL 등급 — 추가만 additive · 권한/RLS security · 삭제/덮어쓰기 destructive · 동적/파일 unsafe', () => {
  assert.equal(classifySql('create table public.t (id bigint primary key);\ncreate index t_i on public.t (id);\n-- drop table x (주석은 무시)').class, 'additive')
  assert.equal(classifySql("comment on table public.t is 'delete from x';").class, 'additive')
  assert.equal(classifySql('grant select on public.t to authenticated;').class, 'security')
  assert.equal(classifySql('alter table public.t enable row level security;').class, 'security')
  assert.equal(classifySql('create function public.f() returns int language sql security definer as $$ select 1 $$;').class, 'security')
  assert.equal(classifySql('drop table public.t;').class, 'destructive')
  assert.equal(classifySql('update public.t set x = 1;').class, 'destructive')
  assert.equal(classifySql('alter table public.t drop column x;').class, 'destructive')
  assert.equal(classifySql('do $$ begin perform 1; end $$;').class, 'unsafe')
  assert.equal(classifySql("copy t from program 'x';").class, 'unsafe')
})

test('DL4 위임 적용 — 모든 조건이 맞을 때만 ok', () => {
  const sql = 'create table public.t (id bigint primary key);'
  const base = { policy: adopted, target: 'jajenrevcbmrpaliomxv', file: 'supabase/migrations/20261019000000_t.sql', sql, sha: sha256(sql),
    codexAcceptance: { reviewer: 'codex', verdict: 'ACCEPT', sha: sha256(sql) }, checkpoint: { before: true }, applied: {} }
  assert.deepEqual(evaluateDelegatedApply(base, sha256).reasons, [])
  const bad = (o) => evaluateDelegatedApply({ ...base, ...o }, sha256).ok
  assert.equal(bad({ policy: POLICY }), false) // 채택 전
  assert.equal(bad({ target: 'prod-project' }), false)
  assert.equal(bad({ file: 'supabase/migrations/_pending_t.sql' }), false)
  assert.equal(bad({ sha: 'c'.repeat(64) }), false) // 본문 ≠ 승인 SHA
  assert.equal(bad({ codexAcceptance: { reviewer: 'codex', verdict: 'ACCEPT', sha: 'd'.repeat(64) } }), false) // 다른 SHA 의 수용
  assert.equal(bad({ codexAcceptance: { reviewer: 'claude', verdict: 'ACCEPT', sha: sha256(sql) } }), false) // 작성자 자기 수용
  assert.equal(bad({ checkpoint: { before: false } }), false)
  assert.equal(bad({ applied: { '20261019000000': 'x' } }), false) // 재적용 금지
  const grant = 'grant select on public.t to anon;'
  assert.equal(evaluateDelegatedApply({ ...base, sql: grant, sha: sha256(grant), codexAcceptance: { reviewer: 'codex', verdict: 'ACCEPT', sha: sha256(grant) } }, sha256).ok, false) // 권한 변경은 위임 불가
})

test('DL5 정책 · 실행기 · 가드 · CI 정의를 바꾸는 PR 은 보호 경로로 잡힌다(정본 목록 · 기본 목록 같음)', () => {
  const files = ['apps/web/x.ts', 'agents/policies/delegation.json', 'agents/scripts/safe-merge.mjs', '.github/workflows/ci.yml', 'agents/scripts/lock.mjs']
  assert.deepEqual(protectedChanges(files, POLICY), ['agents/policies/delegation.json', 'agents/scripts/safe-merge.mjs', '.github/workflows/ci.yml'])
  assert.deepEqual(protectedChanges(files, null), protectedChanges(files, POLICY))
})
