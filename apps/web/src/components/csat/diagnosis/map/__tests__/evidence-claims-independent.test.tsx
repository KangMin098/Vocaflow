// apps/web/src/components/csat/diagnosis/map/__tests__/evidence-claims-independent.test.tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { evidenceView } from '@/lib/csat/map/v62/evidence-claims'
import { EvidenceBlock } from '../EvidenceClaims'
import { repairGate } from '@/lib/csat/map/v4/plan'
import { evidenceKeysOfTask } from '@/lib/csat/map/v4/definition'

it('shared-passage notice preserves current per-item policy without claiming already-deduplicated observations', () => {
 const rows = [1,2].map(n => ({ attemptId: String(n), userId: 'u', itemRef: 'i'+n, taskKey: 'claim-support', phase: 'practice' as const, isCorrect: false, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, sessionId: 'fixture-session', contentHash: 'h', expectedContentHash: 'h', activity: 'theater', answeredAt: '2026-10-01T00:00:00Z' }))
 const e = evidenceView({ task: 'r.central_meaning', check: { taskKey: 'claim-support', status: 'verified', independentItems: 2, attemptedItems: 2, verifiedItems: ['i1','i2'], wrongItems: ['i1','i2'], unseen: [], examSeen: [], verifiedAt: '2026-10-01T00:00:00Z' }, firsts: rows, activity: rows.map(r => ({ ...r, contentHash: 'h', passageKey: 'shared', receivedAt: '2026-10-01T00:00:01Z' })), hashes: { 'claim-support|i1': 'h', 'claim-support|i2': 'h' }, transfer: { done: 0, planned: 2 } })
 expect(e.currentCheck.independentItems).toBe(2)
 expect(e.attempts.filter(a => a.claim === 'independent_check')).toHaveLength(2)
 const html = renderToStaticMarkup(<EvidenceBlock e={e} />)
 expect(html).toContain('현행 도구 독립 확인 집계에 2문항 포함')
 expect(html).toContain('첫 독립 관찰 중 맞힘 0 · 틀림 2')
 expect(html).toContain('별개 글의 독립 관찰로 해석하지 않아요')
 expect(html).not.toContain('서로 따로 센 확인이 아니에요')
})

it('shared helped attempts are not described as included independent observations', () => {
 const rows = [1,2].map(n => ({ attemptId: String(n), userId: 'u', itemRef: 'i'+n, taskKey: 'claim-support', phase: 'practice' as const, isCorrect: true, synthetic: true, helpLevel: 'viewed_first', afterViewedFirst: true, afterExplanation: false, sessionId: 'fixture-session', contentHash: 'h', expectedContentHash: 'h', activity: 'theater', answeredAt: '2026-10-01T00:00:00Z' }))
 const e = evidenceView({ task: 'r.central_meaning', check: null, firsts: rows, activity: rows.map(r => ({ ...r, contentHash: 'h', passageKey: 'shared', receivedAt: '2026-10-01T00:00:01Z' })), hashes: { 'claim-support|i1': 'h', 'claim-support|i2': 'h' }, transfer: { done: 0, planned: 2 } })
 expect(e.sharedPassageGroups).toHaveLength(1)
 expect(e.attempts.filter(a => a.claim === 'independent_check')).toHaveLength(0)
 expect(renderToStaticMarkup(<EvidenceBlock e={e} />)).toContain('현행 도구 독립 확인 집계에 0문항 포함')
})

it('a stale current instrument does not erase an independently observed historical first outcome', () => {
 const first = { attemptId: '1', userId: 'u', itemRef: 'i1', taskKey: 'claim-support', phase: 'practice' as const, isCorrect: false, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, sessionId: 'fixture-session', contentHash: 'old', expectedContentHash: 'new', activity: 'theater', answeredAt: '2026-10-01T00:00:00Z' }
 const e = evidenceView({ task: 'r.central_meaning', check: null, firsts: [first], activity: [{ ...first, contentHash: 'old', receivedAt: '2026-10-01T00:00:01Z' }], hashes: { 'claim-support|i1': 'new' }, transfer: { done: 0, planned: 2 } })
 expect(e.attempts[0]!.claim).toBe('performed_only')
 const html = renderToStaticMarkup(<EvidenceBlock e={e} />)
 expect(html).toContain('현재 주석까지 확인된 독립 확인 0개 · 전체 기간') // T-0076 — 상세 기록 범위(이번 판정 수와 별개)
 expect(html).toContain('기록에서 확인된 독립 첫 관찰 1개')
 expect(html).toContain('첫 독립 관찰 중 맞힘 0 · 틀림 1')
})

// T-0076 — Codex NEXT-AUTHORED-EVIDENCE probe(최신 main 기준 4 fail · 2 pass) 이식 + 원인별 대조
const task = 'r.central_meaning' as const, key = 'authored-central-meaning', v = '2026-10-01T00:00:00Z', after = '2026-10-02T00:00:00Z', before = '2026-09-30T00:00:00Z'
const check = { taskKey: key, status: 'verified', independentItems: 2, attemptedItems: 2, verifiedItems: ['authored:probe-ind-1', 'authored:probe-ind-2'], wrongItems: ['authored:probe-ind-1', 'authored:probe-ind-2'], unseen: [], examSeen: [], verifiedAt: v }
const row = (o: Record<string, unknown> = {}) => ({ attemptId: '3', sessionId: 's3', itemRef: 'authored:probe-guide', taskKey: key, phase: 'practice', activity: 'practice', isCorrect: true, answeredAt: after, receivedAt: after, helpLevel: 'viewed_first', synthetic: false, repairRole: 'guided_practice', contentHash: 'h', ...o })
const view = (a: unknown[], o: Record<string, unknown> = {}) => evidenceView({ task, check: check as never, firsts: [], activity: a, hashes: {}, transfer: { done: 0, planned: 2 }, ...o } as never)
const asis = { id: task, basis: 'direct_check', status: 'verified_need', check } as never
const first = { attemptId: '1', sessionId: 's1', userId: 'fixture', taskKey: key, itemRef: 'authored:probe-ind-1', phase: 'practice', activity: 'theater', isCorrect: false, answeredAt: v, helpLevel: 'independent', synthetic: false, afterViewedFirst: false, afterExplanation: false, contentHash: 'h', expectedContentHash: 'h' }
const same = (a: unknown[]) => { const g = repairGate(asis, a as never); return { plan: g.succeeded ? 'succeeded' : g.tried ? 'tried' : 'none', view: view(a).instructionPath.repair } }
describe('T-0076 근거 설명 = 기존 PLAN · 서버 사실의 투영', () => {
  it('결속된 안내 연습 정답 = PLAN 과 같이 succeeded', () => { const a = [row()]; expect(evidenceKeysOfTask(task)).toContain(key); expect(repairGate(asis, a as never).succeeded).toBe(true); expect(view(a).instructionPath.repair).toBe('succeeded') })
  it('결속된 안내 연습 오답 = tried(성공 아님)', () => { const a = [row({ isCorrect: false })]; expect(repairGate(asis, a as never).succeeded).toBe(false); expect(view(a).instructionPath.repair).toBe('tried') })
  it('안내 연습 오답 → 정답 = tried → succeeded', () => { expect(view([row({ isCorrect: false })]).instructionPath.repair).toBe('tried'); expect(view([row({ isCorrect: false, attemptId: '4' }), row({ answeredAt: '2026-10-03T00:00:00Z', receivedAt: '2026-10-03T00:00:00Z' })]).instructionPath.repair).toBe('succeeded') })
  it('결속 없음 · 서버 수신 없음 · 이전 회차 · 다른 TASK 키 · 창작 평가 재풀이 = 성공 아님(PLAN 과 일치)', () => {
    for (const [label, a] of [
      ['결속 없음', [row({ repairRole: undefined })]],
      ['서버 수신 없음', [row({ receivedAt: null })]],
      ['이전 회차', [row({ answeredAt: before, receivedAt: before })]],
      ['다른 TASK 키', [row({ taskKey: 'authored-evidence-location' })]],
      ['창작 평가 재풀이', [row({ itemRef: 'authored:probe-ind-1', activity: 'theater', repairRole: undefined, helpLevel: 'independent' })]],
    ] as const) { const s = same(a as unknown as unknown[]); expect(s.view, label).not.toBe('succeeded'); expect(s.view, label).toBe(s.plan) }
  })
  it('창작 수행 기록을 근거 상세에서 통째로 빠뜨리지 않는다', () => { const a = row({ ...first, receivedAt: v, repairRole: undefined, passageKey: 'synthetic-p1' }); expect(view([a], { firsts: [first] }).attempts.map((x) => x.attemptId)).toContain('1') })
  it('이번 판정 2문항을 상세 0개로 바꾸지 않는다 · 상세는 다른 범위로 따로 · hashes 없는 창작 기록 = 주석 확인 불가', () => {
    const f2 = { ...first, attemptId: '2', sessionId: 's2', itemRef: 'authored:probe-ind-2' }
    const e = view([first, f2].map((f) => row({ ...f, receivedAt: v, repairRole: undefined })), { firsts: [first, f2] })
    const html = renderToStaticMarkup(<EvidenceBlock e={e} />)
    expect(e.currentCheck.independentItems).toBe(2)
    expect(html).toContain('이번 판정의 독립 확인 2문항')
    expect(html).not.toContain('현행 도구 독립 확인 문항 0개')
    expect(html).toContain('data-current-items="2"')
    expect(e.attempts.every((x) => x.fields.instrument === 'UNKNOWN')).toBe(true)
  })
  it('원장 못 읽음 = 미확인(0 · 성공 아님)', () => { const e = view([], { activity: undefined }); expect(e.ledger).toBe('unknown'); expect(e.instructionPath.repair).toBe('unknown'); expect(renderToStaticMarkup(<EvidenceBlock e={e} />)).toContain('다 읽지 못해 확인 보류') })
  it('기출 막힌 문항 재시도 정답 = succeeded 유지', () => { const c = { ...check, taskKey: 'claim-support', verifiedItems: ['M2609#20'], wrongItems: ['M2609#20'] }; expect(view([row({ itemRef: 'M2609#20', taskKey: 'claim-support', activity: 'theater', repairRole: undefined })], { check: c }).instructionPath.repair).toBe('succeeded') })
  it('창작 결속 없음/불일치 첫 시도 = 결속 확인 불가로 설명(도움을 봤다고 추정하지 않음)', () => {
    const f = { ...first, helpLevel: 'viewed_first', afterViewedFirst: true, authoredBinding: 'missing' }
    const e = view([row({ ...first, receivedAt: v, repairRole: undefined })], { firsts: [f] })
    expect(e.attempts[0]!.fields.independence).toBe('INELIGIBLE')
    expect(e.attempts[0]!.reasons.join(' ')).toContain('연결을 확인할 수 없음')
    expect(e.attempts[0]!.reasons.join(' ')).not.toContain('도움 · 해설 뒤')
  })
})

// T0076-P1-1 — Codex unknown-count 반례 이식: 원장을 못 읽으면 이번 판정 수도 「확인 보류」(측정된 0 이 아님) · 읽힌 빈 원장의 0 은 정상
describe('T0076-P1-1 확인 보류 ≠ 0', () => {
  const run = (firsts: unknown, activity: unknown) => evidenceView({ task: 'r.central_meaning', check: null, firsts, activity, hashes: undefined, transfer: { done: 0, planned: null } } as never)
  const checkText = (e: ReturnType<typeof run>) => renderToStaticMarkup(<EvidenceBlock e={e} />).match(/data-testid="ev-check"[^>]*>([\s\S]*?)<\/dd>/)![1].replace(/<[^>]*>/g, '')
  it('첫 시도 · 수행 원장 못 읽음 + 판정 없음 → 0문항이라 하지 않음', () => { const e = run(undefined, undefined); expect(e.ledger).toBe('unknown'); expect(checkText(e)).not.toMatch(/이번 판정의 독립 확인 0문항/); expect(checkText(e)).toMatch(/확인 보류/) })
  it('수행 원장만 못 읽음 → 0문항 완전 집계로 그리지 않음 · data-current-items 없음', () => { const e = run([], undefined); expect(checkText(e)).not.toMatch(/이번 판정의 독립 확인 0문항/); expect(renderToStaticMarkup(<EvidenceBlock e={e} />)).not.toContain('data-current-items') })
  it('읽힌 빈 원장 = 정당한 0', () => { const e = run([], []); expect(e.ledger).toBe('complete'); expect(checkText(e)).toContain('이번 판정의 독립 확인 0문항') })
})
