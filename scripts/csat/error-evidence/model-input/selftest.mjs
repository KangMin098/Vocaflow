// scripts/csat/error-evidence/model-input/selftest.mjs
//
// PII 가드 자가검사 — 규칙 양성/음성 픽스처 + 합성 packet(실제 학생 데이터 없음)으로 치환 · 차단 · redaction · 해시 결정성을 확인한다.
// 운영 래퍼(model-packets.mjs selftest)와 node:test 가 같이 쓴다. 운영 래퍼에 합성 packet 을 두지 않는 이유:
// 래퍼의 정적 가드(model-input-enforcement.test.ts)가 「원본 packet 은 deidentifyPacket 에만 넘긴다」를 식별자 수로 검사한다.

import { deidentifyPacket, detectPii, residualIdentifiers } from './deidentify.mjs'
import { NEGATIVE, POSITIVE } from './pii-fixtures.mjs'

/** 합성 packet — 실제 학생 데이터 없이 치환 · 잔여 검사 · 해시 결정성을 확인한다 */
export function syntheticPacket(text = '두 번째 문장에서 흐름을 놓쳤어요') {
  return {
    round_id: 1, taxonomy_version: 'v0.1', choice_trap_map: 'v0.1:' + '0'.repeat(64), quality_rule_version: 'rq-1', evidence_profile: 'all',
    input_hash: 'f'.repeat(64),
    canonical_input: {
      format: 'ci-1', quality_rule: 'rq-1', item_id: '11111111-2222-4333-8444-555555555555', stem: '다음 글의 요지로 가장 적절한 것은?', passage: 'One. Two.',
      choices: ['a', 'b', 'c', 'd', 'e'], answer: 2, chosen_option: 3, option_traps: [],
      process_evidence: [
        ['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'reason', { text, session: '99999999-8888-4777-8666-555555555555' }],
        ['bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', 'interpretation', { state: 'answered', text: '「유의미한」으로 읽었어요' }],
      ],
    },
  }
}
const SYN_CTX = { sessionId: '99999999-8888-4777-8666-555555555555', itemNo: 21, participantKey: 'P001', examOrdinal: 1 }

/** 규칙 픽스처 + 합성 packet 검사. 실패 목록(규칙 이름 · 픽스처 번호만) */
export function selftest() {
  const fails = []
  let passed = 0
  POSITIVE.forEach(([rule, text], i) => { if (detectPii(text).includes(rule)) passed++; else fails.push(`positive[${i}]:${rule}`) })
  NEGATIVE.forEach((text, i) => { if (detectPii(text).length === 0) passed++; else fails.push(`negative[${i}]`) })
  const ok = deidentifyPacket(syntheticPacket(), SYN_CTX)
  if (ok.status === 'ok' && residualIdentifiers(ok.packet).length === 0) passed++; else fails.push('synthetic:clean')
  if (deidentifyPacket(syntheticPacket(), SYN_CTX).sha256After === ok.sha256After) passed++; else fails.push('synthetic:deterministic')
  const bad = deidentifyPacket(syntheticPacket('제 번호 010-1234-5678'), SYN_CTX)
  if (bad.status === 'blocked' && bad.packet === null) passed++; else fails.push('synthetic:block')
  const red = deidentifyPacket(syntheticPacket('제 번호 010-1234-5678'), { ...SYN_CTX, redactions: [{ find: '010-1234-5678', replace: '[연락처]' }] })
  if (red.status === 'ok') passed++; else fails.push('synthetic:redaction')
  return { passed, failed: fails.length, fails }
}
