// agents/scripts/__tests__/policy.test.mjs — PR 자동화 정책 v1.1(2026-10-11) 적용 검사 회귀: check.mjs D11 · 정책 낡음 판정
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { policyChecks } from '../check.mjs'
import { policyNotice } from '../handoff-inject.mjs'
import { readText, rel } from '../lib.mjs'

const real = (p) => readText(rel(p))
const files = (over) => (p) => (p in over ? over[p] : real(p))

test('PC1 지금 저장소 — D11 전부 통과', () => {
  const rows = policyChecks()
  assert.ok(rows.length >= 5)
  assert.deepEqual(rows.filter((r) => !r.ok).map((r) => r.name), [])
})

test('PC2 AGENTS.md 정책 줄 버전이 정본과 다르면 실패(한쪽 세션이 옛 규칙으로 돈다)', () => {
  const agents = real('AGENTS.md').replace(/PR_AUTOMATION_POLICY v1\.1/, 'PR_AUTOMATION_POLICY v1.0')
  const bad = policyChecks(files({ 'AGENTS.md': agents })).find((r) => r.name.startsWith('AGENTS.md 정책 줄'))
  assert.equal(bad.ok, false)
})

test('PC3 옛 승인 규칙(main 머지 사용자 확인 · 파일 ≥30)이 되살아나면 실패', () => {
  const agents = real('AGENTS.md') + '\n- main 머지는 사용자 확인.\n'
  assert.equal(policyChecks(files({ 'AGENTS.md': agents })).find((r) => r.name.startsWith('옛 승인 규칙')).ok, false)
})

test('PC4 정책 파일 없음 · 깨진 JSON · 이력 없음 → 실패', () => {
  assert.equal(policyChecks(files({ 'agents/policies/pr-automation.json': null }))[0].ok, false)
  assert.equal(policyChecks(files({ 'agents/policies/pr-automation.json': '{' }))[0].ok, false)
  assert.equal(policyChecks(files({ 'agents/DECISIONS.md': '' })).find((r) => r.name.startsWith('정책 이력')).ok, false)
})

test('PN1 정책 낡음 판정 — 같은 버전 · 둘 다 없음은 조용 · 다르거나 없으면 경고', () => {
  const v = (x) => JSON.stringify({ version: x })
  assert.equal(policyNotice(v('1.1'), v('1.1')), '')
  assert.equal(policyNotice(null, null), '')
  assert.match(policyNotice(v('1.0'), v('1.1')), /\[정책 낡음\].*v1\.0 ≠ origin\/main v1\.1/)
  assert.match(policyNotice(null, v('1.1')), /\[정책 낡음\].*정책이 없다/)
  assert.match(policyNotice('{', v('1.1')), /\[정책 오류\]/)
  assert.equal(policyNotice(v('1.1'), null), '', 'origin/main 에 아직 없으면(첫 도입) 경고 안 함')
})

test('PN2 세션 시작 주입(injection)이 정책 낡음 판정을 부른다 — 연결이 빠지면 구버전 워크트리가 조용히 옛 규칙으로 돈다', async () => {
  const fs = await import('node:fs')
  const src = fs.readFileSync(new URL('../handoff-inject.mjs', import.meta.url), 'utf8')
  const body = src.slice(src.indexOf('export function injection'))
  assert.match(body, /policyNotice\(readText\(rel\('agents', 'policies', 'pr-automation\.json'\)\), readMainPolicy\(\)\)/)
  assert.match(body, /if \(notice\) out\.push\(notice\)/)
})
