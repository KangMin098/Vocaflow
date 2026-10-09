// tests/fakes/fake-codex.mjs — 테스트용 가짜 Codex CLI (`exec ... -` 형태로 불린다)
//
// 시나리오 FAKE_CODEX:
//   approve      바로 APPROVE
//   p1_once      첫 리뷰는 in-scope P1, 이후 APPROVE (상태 파일 FAKE_STATE_DIR 로 횟수 기억)
//   always_p1    언제나 in-scope P1
//   fp           P1 → 구현자가 contested(false_positive)로 답하면 APPROVE
//   out_p1       P1 이지만 scope "out"(별도 티켓) → 차단 아님
//   garbage      vfc-review 블록 없음

import fs from 'node:fs'
import path from 'node:path'

const prompt = fs.readFileSync(0, 'utf8')
const sc = process.env.FAKE_CODEX || 'approve'
const dir = process.env.FAKE_STATE_DIR || '.'
const counter = path.join(dir, 'codex-count')
const n = (fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0) + 1
fs.writeFileSync(counter, String(n))
const p1 = { id: 'F1', severity: 'P1', scope: 'in', file: 'src/x.ts', line: 1, claim: '가짜 결함', scenario: 's', fix: 'f' }
let review
if (sc === 'garbage') {
  console.log('리뷰를 했지만 블록이 없다')
  process.exit(0)
} else if (sc === 'p1_once') review = n === 1 ? { verdict: 'REQUEST_CHANGES', findings: [p1] } : { verdict: 'APPROVE', findings: [] }
else if (sc === 'always_p1') review = { verdict: 'REQUEST_CHANGES', findings: [p1] }
else if (sc === 'fp') review = /contested/.test(prompt) ? { verdict: 'APPROVE', findings: [], notes: '오탐 주장 수용' } : { verdict: 'REQUEST_CHANGES', findings: [p1] }
else if (sc === 'out_p1') review = { verdict: 'APPROVE', findings: [{ ...p1, scope: 'out' }] }
// design_once: 첫 리뷰는 설계 자체의 문제(kind design) — 설계 재질의로 가야 한다. 이후 APPROVE
else if (sc === 'design_once') review = n === 1 ? { verdict: 'REQUEST_CHANGES', findings: [{ ...p1, kind: 'design', claim: '승인 설계의 수용 기준이 정본 계약과 충돌한다', question: '어느 계약을 따를지 정해 달라' }] } : { verdict: 'APPROVE', findings: [] }
else review = { verdict: 'APPROVE', findings: [] }
console.log(`검토 완료\n\`\`\`json vfc-review\n${JSON.stringify({ ...review, ran_tests: false, notes: review.notes ?? 'fake' })}\n\`\`\``)
