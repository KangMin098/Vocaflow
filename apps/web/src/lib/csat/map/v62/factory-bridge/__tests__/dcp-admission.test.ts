// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/dcp-admission.test.ts
// 1C C1 · C2 — 실제 1B core(패킷 · 출력 검증 · evaluateSource) 위의 DCP 등록 계획. mock 없음.
import { describe, expect, it } from 'vitest'

import { isChoiceDcpType } from '@/lib/learner/dcp-types'

import { planAdmission, requestKeyFor, LEGACY_REVIEW_SCHEMA } from '../dcp-admission'
import { LocalProductionError } from '../local-production'
import { fileSha, outputOf, packetOf, reviewOf, snapshot } from './dcp-fixture'

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e instanceof LocalProductionError ? e.message : `other:${String(e)}`
  }
  return 'no_error'
}

async function base(synthetic = true) {
  const packet = await packetOf(synthetic)
  const output = outputOf(packet)
  return { packet, output, outputSha256: fileSha(output), review: reviewOf(packet, output), currentSource: snapshot() }
}

describe('C1 · 1B 검증 → DCP 행', () => {
  it('세 문항이 기존 선택지 DCP 모양(payload · answer_key)으로 바뀌고 계획은 등록 · 납품이 아니다', async () => {
    const plan = planAdmission({ ...(await base(false)), rights: { record_id: 'rights#test', basis: 'isolated' } })
    expect(plan.items).toHaveLength(3)
    for (const it of plan.items) {
      expect(isChoiceDcpType(it.row.type)).toBe(true)
      expect(it.row).toMatchObject({ kind: 'article', ref_id: plan.source.id, paragraph_idx: 0 })
      expect(it.row.payload.choices).toHaveLength(5)
      expect(it.row.payload.stem_ko.trim().length).toBeGreaterThan(0)
      expect(it.row.payload.passage).toContain('Show one painting')
      expect(it.row.answer_key.answer).toBeGreaterThanOrEqual(1)
      expect(it.row.answer_key.rationale_ko.length).toBeGreaterThan(20)
      expect(it.request_key).toBe(requestKeyFor(it.body_hash))
      expect(it.qualification_ready).toBe(true)
      expect(it.axes.F.state).toBe('pass')
      expect(it.axes.G.state).toBe('not_applicable')
    }
    expect(plan.items.map((i) => [i.row.type, i.row.answer_key.answer])).toEqual([['main_point', 2], ['title', 4], ['topic', 1]])
    expect(plan.claims).toEqual({ registered: false, qualified: false, released: false, delivered: false, human_review: false })
    expect(plan.real_admissible).toBe(false) // 정책 hash 가 합성 — 실등록 아님
    expect(plan.blockers).toContain('synthetic_policy_hash')
  })

  it('같은 입력 = 같은 요청 키(멱등) · 권리 근거가 없으면 F unknown 으로 자격 보류', async () => {
    const b = await base(false)
    const a1 = planAdmission(b)
    const a2 = planAdmission(b)
    expect(a1.items.map((i) => i.request_key)).toEqual(a2.items.map((i) => i.request_key))
    expect(a1.items.every((i) => !i.qualification_ready && i.held.includes('axis_F_unknown'))).toBe(true)
  })

  it('1B 기존 Codex 편집 검수 형식은 결속만 인정하고 축은 unknown(자격 보류)', async () => {
    const b = await base(false)
    const legacy = { schema: LEGACY_REVIEW_SCHEMA, reviewer: 'Codex', source_id: b.packet.body.source.id, reviewed_output_sha256: b.outputSha256, keys_checked: b.output.items.map((i) => ({ item_id: i.id })) }
    const plan = planAdmission({ ...b, review: legacy, rights: { record_id: 'r', basis: 'x' } })
    expect(plan.review.legacy).toBe(true)
    expect(plan.items.every((i) => i.held.includes('axis_B_unknown') && i.held.includes('review_conclusion_unknown'))).toBe(true)
    expect(code(() => planAdmission({ ...b, review: { ...legacy, reviewed_output_sha256: 'f'.repeat(64) } }))).toMatch(/review_target_mismatch/)
  })
})

describe('C2 · 거절', () => {
  it('현재 원문 본문 · metadata 변경 · 보관(archived) · 차단은 거절', async () => {
    const b = await base()
    expect(code(() => planAdmission({ ...b, currentSource: snapshot({ content: `${b.packet.body.source.content} Extra.` }) }))).toMatch(/source_changed: content_changed/)
    expect(code(() => planAdmission({ ...b, currentSource: snapshot({ license_class: 'cc_by' }) }))).toMatch(/source_changed|source_/)
    expect(code(() => planAdmission({ ...b, currentSource: snapshot({ status: 'archived' }) }))).toMatch(/^source_/)
    expect(code(() => planAdmission({ ...b, currentSource: snapshot({ display_only: true }) }))).toMatch(/^source_/)
  })

  it('낡은 출력 판본 · 검수 hash 불일치 · 다른 TASK/역할/주문 대상 검수는 거절', async () => {
    const b = await base()
    expect(code(() => planAdmission({ ...b, outputSha256: 'a'.repeat(64) }))).toMatch(/review_target_mismatch: output_sha256/)
    const stale = { ...b.output, items: b.output.items.map((i, k) => (k ? i : { ...i, stem: `${i.stem} ` })) }
    expect(code(() => planAdmission({ ...b, output: stale, outputSha256: fileSha(stale) }))).toMatch(/review_target_mismatch/)
    for (const t of [{ task: 'r.reference' }, { role: 'independent_check' }, { order_hash: '0'.repeat(64) }, { packet_hash: '1'.repeat(64) }])
      expect(code(() => planAdmission({ ...b, review: reviewOf(b.packet, b.output, { target: t }) }))).toMatch(/review_target_mismatch/)
  })

  it('근거 없는 pass · AI 의 권리(F) pass · 사람 아닌 검수 종류 위장은 거절', async () => {
    const b = await base()
    expect(code(() => planAdmission({ ...b, review: reviewOf(b.packet, b.output, { axes: { B: { state: 'pass', evidence: [] } } }) }))).toMatch(/pass_without_evidence/)
    expect(code(() => planAdmission({ ...b, review: reviewOf(b.packet, b.output, { axes: { F: { state: 'pass', evidence: ['권리 확인했다고 주장하는 AI'] } } }) }))).toMatch(/ai_cannot_grant_rights/)
    expect(code(() => planAdmission({ ...b, review: { ...reviewOf(b.packet, b.output), kind: 'human' } }))).toMatch(/review_schema/)
  })

  it('합성 수요는 실등록 불가로 표시되고 출력 검증 실패는 계획 자체를 거절', async () => {
    const b = await base(true)
    const plan = planAdmission(b)
    expect(plan.real_admissible).toBe(false)
    expect(plan.blockers).toContain('synthetic_demand_isolated_only')
    expect(plan.items[0]!.body.synthetic_demand).toBe(true)
    expect(code(() => planAdmission({ ...b, output: { ...b.output, role: 'transfer' } }))).toMatch(/output_invalid/)
  })
})
