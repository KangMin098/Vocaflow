// apps/web/src/lib/csat/__tests__/hakpyeong-review.test.ts
import { describe, expect, it } from 'vitest'
import { batchTokens, PRECHECK_VERSION_CURRENT, reviewBlock, reviewCounts, type HakReviewItem, type ReviewBatch } from '../hakpyeong-review'
import { parseOperationsState, viewsFor } from '../evidence-operations'

const base = (over: Partial<HakReviewItem> = {}): HakReviewItem => ({
  itemId: 'H2603G3#30', typeId: 'R-VOCAB', analysisId: 'a1', version: 2, status: 'in_review', analystRun: 'fix-x-000001',
  unitsBased: true, validPersonas: [], verdicts: [],
  precheck: { errors: [], warnings: [], checkedAt: '2026-10-01T00:00:00Z', precheckVersion: 1, commit: 'abc', current: true },
  ...over,
})
const pass = (persona: 'setter' | 'analyst' | 'tutor', counted = true) =>
  ({ persona, verdict: 'pass' as const, kind: 'blind' as const, findings: [], reviewedAt: '2026-10-01T00:00:00Z', counted })

describe('reviewBlock — 막힌 이유 우선순위', () => {
  it('발행 + 유효 3 → 발행됨', () => {
    expect(reviewBlock(base({ status: 'published', validPersonas: ['setter', 'analyst', 'tutor'] })).state).toBe('published')
  })
  it('도표는 다른 조건보다 먼저 — 발행 보류이고 완료로 세지 않는다', () => {
    const b = reviewBlock(base({ typeId: 'R-CHART', precheck: null }))
    expect(b.state).toBe('chart')
    expect(reviewCounts([base({ typeId: 'R-CHART' })]).published).toBe(0)
  })
  it('analyst_run 없음 → 분석 없음', () => {
    expect(reviewBlock(base({ analystRun: null })).state).toBe('noAnalysis')
  })
  it('현재 이미지 정본이 있어도 유효 독립 승인이 없으면 검수 대기다', () => {
    expect(reviewBlock(base({typeId:'R-CHART',visualAssetId:'current-image',visualAnalysisReady:true})).state).toBe('waiting')
    expect(reviewBlock(base({typeId:'R-CHART',visualAssetId:'current-image',visualAnalysisReady:true,validPersonas:['setter','analyst','tutor']})).reason).toContain('발행 대기')
    expect(reviewCounts([base({typeId:'R-CHART',visualAssetId:'current-image'})]).published).toBe(0)
  })
  it('옛 도표 분석은 이미지와 승인3개가 있어도 재작성 먼저 표시한다',()=>{
    expect(reviewBlock(base({typeId:'R-CHART',visualAssetId:'current-image',validPersonas:['setter','analyst','tutor']})).state).toBe('fixFirst')
  })
  it('현재 해시와 맞는 사전 검사 실패 → 교정 먼저(반려·검수 대기보다 먼저)', () => {
    const b = reviewBlock(base({ precheck: { ...base().precheck!, errors: ['인용이 걸친 단위 [u6] 가 …'] }, verdicts: [{ ...pass('setter'), verdict: 'revise' }] }))
    expect(b.state).toBe('fixFirst')
    expect(b.reason).toContain('[u6]')
  })
  it('오래된 사전 검사 실패는 믿지 않는다 → 사전 검사 다시', () => {
    expect(reviewBlock(base({ precheck: { ...base().precheck!, errors: ['x'], current: false } })).state).toBe('precheckStale')
    expect(reviewBlock(base({ precheck: null })).state).toBe('precheckStale')
  })
  it('현재 분석에 반려 판정 → 반려 · 교정 대기', () => {
    const b = reviewBlock(base({ verdicts: [pass('setter'), { ...pass('tutor'), verdict: 'revise', findings: ['[u14] 가 근거'] }] }))
    expect(b.state).toBe('rejected')
    expect(b.reason).toContain('tutor')
  })
  it('반려 뒤 재검수 통과 → 옛 반려는 막지 않는다(페르소나별 최근 판정만)', () => {
    const old = { ...pass('tutor'), verdict: 'revise' as const, reviewedAt: '2026-09-30T00:00:00Z', findings: ['옛 소견'] }
    const b = reviewBlock(base({ validPersonas: ['setter', 'analyst', 'tutor'], verdicts: [old, pass('setter'), pass('analyst'), pass('tutor')] }))
    expect(b.state).toBe('waiting')
    expect(b.reason).toContain('3/3')
  })
  it('최근 판정이 반려면 여전히 반려', () => {
    const later = { ...pass('tutor'), verdict: 'revise' as const, reviewedAt: '2026-10-02T00:00:00Z', findings: ['새 소견'] }
    expect(reviewBlock(base({ validPersonas: ['setter', 'analyst'], verdicts: [pass('setter'), pass('analyst'), pass('tutor', false), later] })).state).toBe('rejected')
  })
  it('검수 뒤 문항이 바뀐 반려는 막지 않고 새 블라인드 검수로 보낸다', () => {
    const b = reviewBlock(base({ validPersonas: ['setter', 'analyst'], verdicts: [pass('setter'), pass('analyst'), { ...pass('tutor', false), verdict: 'revise' as const, stale: 'input' as const }] }))
    expect(b.state).toBe('waiting')
    expect(b.reason).toContain('블라인드 풀이도 무효')
    expect(b.next).toContain('export --items')
  })
  it('분석만 바뀐 반려는 블라인드 풀이를 살려 재검수로 보낸다', () => {
    const b = reviewBlock(base({ validPersonas: ['setter', 'analyst'], verdicts: [pass('setter'), pass('analyst'), { ...pass('tutor', false), verdict: 'revise' as const, stale: 'analysis' as const }] }))
    expect(b.state).toBe('waiting')
    expect(b.next).toContain('rereview')
  })
  it('유효 승인은 게이트 함수 값 — pass 3개여도 유효 1이면 1/3', () => {
    const b = reviewBlock(base({ validPersonas: ['setter'], verdicts: [pass('setter'), pass('analyst', false), pass('tutor', false)] }))
    expect(b.state).toBe('waiting')
    expect(b.reason).toContain('1/3')
    expect(b.next).toContain('export --items H2603G3#30')
  })
  it('유효 3/3 인데 아직 in_review → 발행 명령', () => {
    expect(reviewBlock(base({ validPersonas: ['setter', 'analyst', 'tutor'] })).next).toContain('publish --items')
  })
})

describe('사전 검사기 버전', () => {
  it('화면의 현재 버전 = CLI 검사기 버전(다르면 모든 기록이 낡거나, 낡은 기록이 현재로 보인다)', async () => {
    // 저장소 스크립트(.mjs)를 직접 읽는다 — 두 숫자가 어긋나면 이 회귀가 떨어진다
    const lib = await import('../../../../../../scripts/csat/lib-evidence-units.mjs')
    expect(PRECHECK_VERSION_CURRENT).toBe(lib.PRECHECK_VERSION)
  })
})

describe('배치 토큰 — 모르면 미기록(null), 0 이 아니다', () => {
  const b = (tokens: ReviewBatch['tokens']): ReviewBatch => ({ batch: 'x', runDate: '2026-10-01', kind: 'blind', chunkSize: 8, items: 8, agents: 3, tokens, published: null, refused: null, reRejected: null, note: null })
  it('합계', () => expect(batchTokens(b({ setter: 1, analyst: 2, tutor: [3, 4] }))).toBe(10))
  it('tokens 없음 → null', () => expect(batchTokens(b(null))).toBeNull())
  it('하나라도 null → null', () => expect(batchTokens(b({ setter: 1, analyst: null }))).toBeNull())
})

describe('「검수 진행」 탭은 학평 전용', () => {
  it('평가원 범위에는 없다 · URL 로 와도 운영 현황', () => {
    expect(viewsFor({ set: 'kice' })).not.toContain('review')
    expect(parseOperationsState({ view: 'review' }).view).toBe('overview')
  })
  it('학평 범위에는 있다', () => {
    expect(viewsFor({ set: 'hakpyeong', grade: 3 })).toContain('review')
    expect(parseOperationsState({ view: 'review', set: 'hakpyeong', grade: '3' }).view).toBe('review')
  })
})
