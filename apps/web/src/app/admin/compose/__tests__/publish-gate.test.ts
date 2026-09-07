// apps/web/src/app/admin/compose/__tests__/publish-gate.test.ts
//
// ⑦ 발행 판정 회귀 — **모르는 것을 통과로 세지 않는다.**
//
// 실제로 그랬다: 콘텐츠 품질 게이트를 앞의 20건만 조회하면서 21번째부터는 조회조차 하지 않은
// 것을 "critical FAIL 이 없다" 로 셌다. 화면은 발행 버튼을 켜고 서버는 트리거로 거부했다.
// null(모름)과 0(없음)을 뭉갠 이 저장소의 단골 실패 모드라, 판정 함수 층에서 잠근다.

import { describe, expect, it } from 'vitest'

import {
  CONTENT_GATE_SCAN_CHUNK,
  CONTENT_GATE_SCAN_MAX,
  evaluatePublishGate,
  planContentGateScan,
  type ArticleContentGateRow,
  type ArticleGateRow,
} from '../publish-gate'

const PASSING_GATES: ArticleGateRow[] = [
  {
    article_id: 'a1',
    invariant: 'I12 출처 독립성',
    severity: 'critical',
    verdict: 'PASS',
    content_hash: 'h1',
  },
  {
    article_id: 'a1',
    invariant: 'I14 구조 독립성',
    severity: 'critical',
    verdict: 'PASS',
    content_hash: 'h1',
  },
]

function verdictFor(opts: {
  gates?: ArticleGateRow[]
  contentGates?: ArticleContentGateRow[]
  checked?: string[]
  contentHash?: string | null
}) {
  return evaluatePublishGate({
    articleId: 'a1',
    contentHash: opts.contentHash === undefined ? 'h1' : opts.contentHash,
    gates: opts.gates ?? PASSING_GATES,
    contentGates: opts.contentGates ?? [],
    contentGateCheckedIds: new Set(opts.checked ?? ['a1']),
  })
}

describe('발행 게이트 판정', () => {
  it('재저작 게이트 통과 + 콘텐츠 게이트 확인 완료면 발행 가능', () => {
    const v = verdictFor({})
    expect(v.blocked).toBe(false)
    expect(v.reasons).toEqual([])
    expect(v.contentGateChecked).toBe(true)
  })

  it('콘텐츠 게이트를 조회하지 못한 글은 발행 가능으로 표시되지 않는다', () => {
    // 이 한 줄이 이 파일의 존재 이유다 — 조회 범위 밖이라는 이유로 통과가 되면 안 된다.
    const v = verdictFor({ checked: [] })
    expect(v.blocked).toBe(true)
    expect(v.reasons).toContain('content_gate_unchecked')
    expect(v.contentGateChecked).toBe(false)
  })

  it('미확인은 "FAIL 0건" 과 구별된다 — FAIL 목록을 비워 통과처럼 보이게 하지 않는다', () => {
    const checkedNoFail = verdictFor({ checked: ['a1'] })
    const unchecked = verdictFor({ checked: [] })
    expect(checkedNoFail.contentFailed).toEqual([])
    expect(unchecked.contentFailed).toEqual([])
    // 둘 다 FAIL 은 0건이지만 발행 가능 여부는 정반대여야 한다.
    expect(checkedNoFail.blocked).toBe(false)
    expect(unchecked.blocked).toBe(true)
  })

  it('다른 글의 판정을 내 글의 판정으로 세지 않는다', () => {
    const v = evaluatePublishGate({
      articleId: 'a1',
      contentHash: 'h1',
      gates: [{ ...PASSING_GATES[0]!, article_id: 'other' }],
      contentGates: [],
      contentGateCheckedIds: new Set(['a1']),
    })
    expect(v.gates).toEqual([])
    expect(v.reasons).toContain('no_gates')
    expect(v.blocked).toBe(true)
  })

  it('콘텐츠 게이트 critical FAIL 은 재저작 게이트가 전부 통과여도 막는다', () => {
    const v = verdictFor({
      contentGates: [
        { article_id: 'a1', invariant: '추출 비어있음(0단어)', severity: 'critical', verdict: 'FAIL' },
      ],
    })
    expect(v.blocked).toBe(true)
    expect(v.reasons).toContain('content_gate_failed')
    expect(v.contentFailed).toHaveLength(1)
  })

  it('판정이 없는 글 · 본문이 바뀐 글 · critical FAIL 은 각각의 사유로 막는다', () => {
    expect(verdictFor({ gates: [] }).reasons).toContain('no_gates')
    expect(verdictFor({ contentHash: 'h2' }).reasons).toContain('stale')
    expect(
      verdictFor({
        gates: [{ ...PASSING_GATES[0]!, verdict: 'FAIL' }],
      }).reasons,
    ).toContain('gate_failed')
  })

  it('WARN 과 critical 아닌 FAIL 은 발행을 막지 않는다', () => {
    const v = verdictFor({
      gates: [
        { ...PASSING_GATES[0]!, verdict: 'WARN' },
        { ...PASSING_GATES[1]!, severity: 'warning', verdict: 'FAIL' },
      ],
    })
    expect(v.blocked).toBe(false)
  })
})

describe('콘텐츠 게이트 조회 계획', () => {
  const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `a${i}`)

  it('상한 안에서는 전량을 조회 대상으로 잡는다 (20건에서 잘리지 않는다)', () => {
    const plan = planContentGateScan(ids(45))
    expect(plan.scanned).toHaveLength(45)
    expect(plan.skipped).toEqual([])
    expect(plan.chunks.flat()).toEqual(ids(45))
    expect(plan.chunks[0]).toHaveLength(CONTENT_GATE_SCAN_CHUNK)
  })

  it('상한을 넘기면 조용히 자르지 않고 남은 것을 skipped 로 말한다', () => {
    const plan = planContentGateScan(ids(CONTENT_GATE_SCAN_MAX + 7))
    expect(plan.scanned).toHaveLength(CONTENT_GATE_SCAN_MAX)
    expect(plan.skipped).toHaveLength(7)
    // skipped 는 화면에서 '미확인' 이 되어 발행을 막는다 — 통과로 새어 나가지 않는다.
    for (const id of plan.skipped) {
      expect(
        evaluatePublishGate({
          articleId: id,
          contentHash: 'h',
          gates: [],
          contentGates: [],
          contentGateCheckedIds: new Set(plan.scanned),
        }).reasons,
      ).toContain('content_gate_unchecked')
    }
  })

  it('빈 목록은 조회하지 않는다', () => {
    const plan = planContentGateScan([])
    expect(plan.chunks).toEqual([])
    expect(plan.scanned).toEqual([])
  })
})
