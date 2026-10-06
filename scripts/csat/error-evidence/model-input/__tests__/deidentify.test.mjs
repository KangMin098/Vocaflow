// scripts/csat/error-evidence/model-input/__tests__/deidentify.test.mjs
//   node --test scripts/csat/error-evidence/model-input/__tests__/deidentify.test.mjs
// 모델 입력 비식별화(PILOT_PROTOCOL §9) — 치환 결과 식별자 0 · 규칙 양성/음성 · redaction 뒤 통과 · 추적 경로 쓰기 거부 · 해시 결정성.
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { assertPrivatePath, attemptKey, auditLine, deidentifyPacket, detectPii, rehydrate, residualIdentifiers, rulesHash } from '../deidentify.mjs'
import { syntheticPacket, selftest } from '../model-packets.mjs'
import { NEGATIVE, POSITIVE } from '../pii-fixtures.mjs'
import { PII_RULES } from '../pii-rules.mjs'

const CTX = { sessionId: '99999999-8888-4777-8666-555555555555', itemNo: 21, participantKey: 'P001', examOrdinal: 1 }
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE = /01[016789]-?[0-9]{3,4}-?[0-9]{4}/
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')

test('attempt key 꼴 — P001-E1-#21', () => {
  assert.equal(attemptKey('P001', 1, 21), 'P001-E1-#21')
  assert.throws(() => attemptKey('kim', 1, 21))
  assert.throws(() => attemptKey('P001', 0, 21))
})

test('치환 결과에 UUID · 이메일 · 전화 꼴이 0 — 세션 · 증거 · 문항 id 는 별칭으로', () => {
  const r = deidentifyPacket(syntheticPacket(), CTX)
  assert.equal(r.status, 'ok')
  const s = JSON.stringify(r.packet)
  assert.ok(!UUID.test(s) && !EMAIL.test(s) && !PHONE.test(s), s)
  assert.equal(r.packet.attempt, 'P001-E1-#21')
  assert.equal(r.packet.canonical_input.process_evidence[0][0], 'P001-E1-#21/e1')
  assert.equal(r.packet.canonical_input.process_evidence[0][2].session, 'P001-E1-#21')
  assert.equal(r.packet.canonical_input.item_id, 'P001-E1-#21/item')
  assert.ok(!('input_hash' in r.packet), 'DB 원입력 해시는 모델 packet 에 넣지 않는다')
  assert.deepEqual(residualIdentifiers(r.packet), [])
})

test('알 수 없는 UUID 가 남으면 차단(residual)', () => {
  const p = syntheticPacket()
  p.canonical_input.process_evidence[1][2].ref = '12345678-1234-4234-8234-123456789abc'
  const r = deidentifyPacket(p, CTX)
  assert.equal(r.status, 'blocked')
  assert.ok(r.rules.includes('residual:uuid'))
  assert.equal(r.packet, null)
})

for (const [rule, text] of POSITIVE) {
  test(`양성 — ${rule}`, () => assert.ok(detectPii(text).includes(rule), `${rule} 를 못 잡음`))
}
test('음성 — 풀이 서술은 어떤 규칙에도 안 걸린다', () => {
  for (const t of NEGATIVE) assert.deepEqual(detectPii(t), [], t)
})
test('모든 규칙에 양성 픽스처가 하나 이상', () => {
  const covered = new Set(POSITIVE.map(([r]) => r))
  for (const r of PII_RULES) assert.ok(covered.has(r.name), r.name)
})

test('자유서술 탐지 → packet 차단 · 규칙 이름만(원문 없음)', () => {
  const r = deidentifyPacket(syntheticPacket('김민수 선생님이 010-1234-5678 로 연락하래요'), CTX)
  assert.equal(r.status, 'blocked')
  assert.equal(r.packet, null)
  assert.ok(r.rules.includes('name_ko_honorific') && r.rules.includes('phone_kr_mobile'))
  const line = auditLine('ec-pilot-run-20261020-1', r, '2026-10-20T00:00:00Z')
  assert.ok(!line.includes('김민수') && !line.includes('010-1234'), '감사 로그에 원문이 없어야 한다')
})

test('redaction 뒤 통과 · 맞는 곳 없는 redaction 은 실패', () => {
  const p = syntheticPacket('김민수 선생님이 설명해 주셨어요')
  const r = deidentifyPacket(p, { ...CTX, redactions: [{ find: '김민수 선생님', replace: '[교사]' }] })
  assert.equal(r.status, 'ok')
  assert.ok(!JSON.stringify(r.packet).includes('김민수'))
  assert.throws(() => deidentifyPacket(p, { ...CTX, redactions: [{ find: '없는 글', replace: 'x' }] }), /낡은 redaction/)
})

test('전/후 해시 결정적 — 키 순서가 달라도 같다', () => {
  const a = deidentifyPacket(syntheticPacket(), CTX)
  const p = syntheticPacket()
  const shuffled = Object.fromEntries(Object.entries(p).reverse())
  const b = deidentifyPacket(shuffled, CTX)
  assert.equal(a.sha256Before, b.sha256Before)
  assert.equal(a.sha256After, b.sha256After)
  assert.notEqual(a.sha256Before, a.sha256After)
  assert.equal(rulesHash(), rulesHash())
})

test('rehydrate — 별칭을 실제 증거 id 로', () => {
  const r = deidentifyPacket(syntheticPacket(), CTX)
  const out = rehydrate({ claims: [{ code: 'V.x', evidence: ['P001-E1-#21/e2'] }] }, r.aliases)
  assert.equal(out.claims[0].evidence[0], 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff')
})

test('저장소 추적 경로 · 무시되지 않는 경로에는 쓰지 않는다', () => {
  assert.throws(() => assertPrivatePath(path.join(ROOT, 'docs/csat-learner/codebook/PILOT_PROTOCOL.md')), /추적 경로/)
  assert.throws(() => assertPrivatePath(path.join(ROOT, 'docs/csat-learner/pilot-runs/raw.json')), /무시되지 않는/)
  assert.throws(() => assertPrivatePath('relative/x.json'), /절대경로/)
  assert.ok(assertPrivatePath(path.join(ROOT, '.pilot-private/run/aliases.json')))
  assert.ok(assertPrivatePath(path.join(os.tmpdir(), 'ec-pilot-private-test', 'x.json')))
})

test('가짜 git — 추적 · 무시 판정 주입', () => {
  const git = (tracked, ignored) => ({ toplevel: () => '/repo', tracked: () => tracked, ignored: () => ignored })
  assert.throws(() => assertPrivatePath('/repo/a.json', git(true, true)), /추적/)
  assert.throws(() => assertPrivatePath('/repo/a.json', git(false, false)), /무시되지 않는/)
  assert.ok(assertPrivatePath('/repo/a.json', git(false, true)))
})

test('운영 자가검사 전부 통과', () => {
  const r = selftest()
  assert.equal(r.failed, 0, r.fails.join(','))
  assert.ok(r.passed >= POSITIVE.length + NEGATIVE.length + 4)
})
