// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/fast-worksheet.test.ts
// 단계 3 FAST — 실제 1B 경로 패킷 · 출력(dcp-fixture)으로 편집 · 원천 경계 · 검수 결속 · 조판을 잰다.
import { describe, expect, it } from 'vitest'

import { FAST_BUNDLE_SCHEMA, evaluateFast, fastFiles, fastView, reviewRequest, type FastEdit } from '../fast-worksheet'
import { CONTENT, outputOf, packetOf, reviewOf, snapshot } from './dcp-fixture'

const EDIT: FastEdit = {
  order: ['cm-topic-01', 'cm-main-point-01', 'cm-title-01'],
  items: { 'cm-main-point-01': { stem: '다음 글의 중심 생각으로 가장 적절한 것은?' } },
  editor: { kind: 'ai', agent: 'codex', session: '01a15de1-34d4-7250-8dbe-2132827d1b7b', note: 'teacher selection' },
}
async function setup(edit: unknown = EDIT, s: unknown = snapshot()) {
  const packet = await packetOf(true, s)
  const base = outputOf(packet)
  const bundle = { schema: FAST_BUNDLE_SCHEMA, packet, base_output: base, source_snapshot: s, edit, review: null as unknown }
  return { packet, base, bundle }
}
/** 지금 바이트에 묶인 신규 검수 — evaluateFast 의 target 을 그대로 쓴다 */
const freshReview = (state: ReturnType<typeof evaluateFast>, o: Record<string, unknown> = {}) => {
  const r = reviewOf(state.packet, state.output) as Record<string, unknown>
  return { ...r, reviewer: { model: 'claude', session: 'fresh-session-1', role: 'independent_fast_content_reviewer' }, target: state.target, ...o }
}

describe('FAST 편집', () => {
  it('순서 · 발문 편집은 새 출력 바이트를 만들고 원본 · 편집자를 따로 남긴다', async () => {
    const { bundle, base } = await setup()
    const s = evaluateFast(bundle, snapshot())
    expect(s.output.items.map((i) => i.id)).toEqual(EDIT.order)
    expect(s.output.items[1]!.stem).toBe('다음 글의 중심 생각으로 가장 적절한 것은?')
    expect(s.output_sha256).not.toBe(s.base_output_sha256)
    expect(s.output.author).toEqual(base.author)
    expect(s.diff).toMatchObject({ reordered: true, fields: [{ item_id: 'cm-main-point-01', field: 'stem', before: '다음 글의 요지로 가장 적절한 것은?' }] })
    expect(s.review.status).toBe('review_required')
    // 같은 묶음 → 같은 바이트(재실행 안전)
    expect(evaluateFast(bundle, snapshot()).output_sha256).toBe(s.output_sha256)
  })

  it('수량 변경 · 일부 팩 · 모르는 문항 · 금지 필드(answer) · 편집자 위조를 거절한다', async () => {
    const { bundle } = await setup()
    const run = (edit: unknown) => () => evaluateFast({ ...bundle, edit }, snapshot())
    expect(run({ ...EDIT, order: EDIT.order.slice(0, 2) })).toThrow('quantity_change_requires_new_order')
    expect(run({ ...EDIT, order: ['cm-topic-01', 'cm-topic-01', 'cm-title-01'] })).toThrow('edit_order_not_full_pack')
    expect(run({ ...EDIT, items: { 'zz-x': { stem: '다음 글의 주제로 적절한 것은?' } } })).toThrow('edit_unknown_item')
    expect(run({ ...EDIT, items: { 'cm-topic-01': { answer: '3' } } })).toThrow('edit_forbidden_field')
    expect(run({ ...EDIT, editor: { ...EDIT.editor, kind: 'human' } })).toThrow('edit_editor_session')
    expect(() => evaluateFast({ ...bundle, quantity: 2 }, snapshot())).toThrow('bundle_shape')
  })

  it('편집 결과도 기존 validateOutput 을 다시 통과해야 한다(중복 선지 · 짧은 발문)', async () => {
    const { bundle } = await setup()
    const dup = { ...EDIT, items: { 'cm-topic-01': { choices: ['same text', 'same text', 'third one', 'fourth one', 'fifth one'] } } }
    expect(() => evaluateFast({ ...bundle, edit: dup }, snapshot())).toThrow(/edited_output_invalid.*duplicate_choice/)
    expect(() => evaluateFast({ ...bundle, edit: { ...EDIT, items: { 'cm-topic-01': { stem: '짧다' } } } }, snapshot())).toThrow(/stem/)
  })

  it('원본 출력의 없는 인용 · 변조된 패킷 키를 거절한다', async () => {
    const { bundle, base } = await setup()
    const forged = { ...base, items: base.items.map((it, i) => (i ? it : { ...it, evidence_quotes: ['this sentence is not in the source'] })) }
    expect(() => evaluateFast({ ...bundle, base_output: forged }, snapshot())).toThrow(/base_output_invalid.*not_in_source/)
    const packet = structuredClone(bundle.packet) as { body: { request: { quantity: number } } }
    packet.body.request.quantity = 2
    expect(() => evaluateFast({ ...bundle, packet }, snapshot())).toThrow('packet_hash_mismatch')
  })
})

describe('FAST 원천 경계', () => {
  it('has_items 만 달라지면 재사용하고 두 관측을 남긴다 — 본문 · 라이선스 · 게이트가 바뀌면 거절', async () => {
    const { bundle } = await setup(EDIT, snapshot({ has_items: false }))
    const s = evaluateFast(bundle, snapshot({ has_items: true }))
    expect(s.source.drift).toBe('has_items_only')
    expect(s.source.observations).toMatchObject({ original: { has_items: false }, current: { has_items: true } })
    expect(s.target.source_digest).toBe(s.source.original_digest) // 패킷 digest 를 위조하지 않는다
    expect(() => evaluateFast(bundle, snapshot({ has_items: true, content: `${CONTENT} Extra sentence.` }))).toThrow(/source_changed.*content_sha256/)
    expect(() => evaluateFast(bundle, snapshot({ license: 'CC-BY-4.0' }))).toThrow(/source_changed.*license/)
    expect(() => evaluateFast(bundle, snapshot({ status: 'archived' }))).toThrow(/source_/)
    expect(() => evaluateFast(bundle, null)).toThrow('source_current_missing')
  })

  it('묶음의 원본 snapshot 이 패킷 원천과 다르면 거절한다', async () => {
    const { bundle } = await setup()
    expect(() => evaluateFast({ ...bundle, source_snapshot: snapshot({ title: 'Other' }) }, snapshot())).toThrow('source_snapshot_not_packet_source')
  })
})

describe('FAST 검수', () => {
  it('종합 pass 여도 내용 B/C/D 중 실패·미상·해당 없음이면 학습지를 내보내지 않는다', async () => {
    const { bundle } = await setup()
    const s = evaluateFast(bundle, snapshot())
    const axes = (freshReview(s) as Record<string, unknown>).axes as Record<string, unknown>
    for (const axis of ['B', 'C', 'D']) for (const state of ['fail', 'unknown', 'not_applicable']) {
      const review = freshReview(s, { axes: { ...axes, [axis]: { state, evidence: ['실제 내용 검수 축이 통과하지 않은 반례'] } } })
      const judged = evaluateFast({ ...bundle, review }, snapshot())
      expect(judged.review).toMatchObject({ status: 'review_rejected', code: 'review_content_axis_not_pass', detail: [axis] })
      expect(fastFiles(judged, null).some(f => f.name === 'student.html' || f.name === 'teacher.html')).toBe(false)
    }
  })
  it('편집 전 바이트의 검수는 거절되고, 새 바이트의 신규 검수만 통과한다', async () => {
    const { bundle, packet, base } = await setup()
    const old = reviewOf(packet, base)
    expect(evaluateFast({ ...bundle, review: old }, snapshot()).review).toMatchObject({ status: 'review_rejected', code: 'review_target_mismatch' })
    const s = evaluateFast(bundle, snapshot())
    const ok = evaluateFast({ ...bundle, review: freshReview(s) }, snapshot())
    expect(ok.review).toMatchObject({ status: 'reviewed', held_axes: ['A', 'F'] })
  })

  it('변조 target · 일부 문항 · 권리 pass · 결론 fail 을 통과시키지 않는다', async () => {
    const { bundle } = await setup()
    const s = evaluateFast(bundle, snapshot())
    const judge = (r: unknown) => evaluateFast({ ...bundle, review: r }, snapshot()).review
    expect(judge(freshReview(s, { target: { ...s.target, output_sha256: 'f'.repeat(64) } }))).toMatchObject({ status: 'review_rejected', code: 'review_target_mismatch' })
    expect(judge(freshReview(s, { target: { ...s.target, items: s.target.items.slice(0, 2) } }))).toMatchObject({ code: 'review_items_incomplete' })
    expect(judge(freshReview(s, { axes: { F: { state: 'pass', evidence: ['rights granted by ai reviewer'] } } }))).toMatchObject({ code: 'review_ai_cannot_grant_rights' })
    expect(judge(freshReview(s, { conclusion: 'fail' }))).toMatchObject({ status: 'review_not_pass' })
    expect(judge({ schema: 'vocaflow-ai-editorial-review/1' })).toMatchObject({ code: 'review_schema_not_fast' })
  })

  it('검수 요청은 지금 target 을 담고, 검수 전 내보내기는 학습지를 만들지 않는다', async () => {
    const { bundle } = await setup()
    const s = evaluateFast(bundle, snapshot())
    expect(reviewRequest(s).target).toEqual(s.target)
    expect(fastFiles(s, null).map((f) => f.name)).toEqual(['edited-output.json', 'review-request.json'])
    expect(fastView(s).student_html).toBeNull()
  })
})

describe('FAST 조판', () => {
  it('문제지에는 정답 · 해설 · Gold 가 없고, 해설지에만 정답 · 해설이 있다 · manifest 는 출시를 주장하지 않는다', async () => {
    const { bundle } = await setup()
    const s0 = evaluateFast(bundle, snapshot())
    const s = evaluateFast({ ...bundle, review: freshReview(s0) }, snapshot())
    const files = Object.fromEntries(fastFiles(s, null).map((f) => [f.name, f.content]))
    const item = s.output.items[0]!
    expect(files['student.html']).not.toContain('정답')
    expect(files['student.html']).not.toContain(item.explanation.observation)
    expect(files['student.html']).not.toMatch(/gold|answer/i)
    expect(files['teacher.html']).toContain('정답 1번')
    expect(files['teacher.html']).toContain(item.explanation.interpretation)
    const m = JSON.parse(files['manifest.json']!)
    expect(m.claims).toMatchObject({ fq_qualified: false, released: false, registered: false, db_writes: 0 })
    expect(m.fq).toMatchObject({ status: 'held', held_axes: ['A', 'F'] })
    expect(m.edited_output_sha256).toBe(s.output_sha256)
    expect(m.review.session).toBe('fresh-session-1')
  })

  it('편집 문자열의 HTML 은 escape 되어 실행되지 않는다', async () => {
    const xss = { ...EDIT, items: { 'cm-topic-01': { stem: '<img src=x onerror=alert(1)> 윗글의 주제로 가장 적절한 것은?' } } }
    const { bundle } = await setup(xss)
    const s0 = evaluateFast(bundle, snapshot())
    const s = evaluateFast({ ...bundle, review: freshReview(s0) }, snapshot())
    for (const html of [fastView(s).student_html!, fastView(s).teacher_html!]) {
      expect(html).not.toContain('<img')
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
      expect(html).toContain("default-src 'none'")
    }
  })
})
