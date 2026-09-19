// packages/library-pipeline/src/analyze/readiness.test.ts
//
// 2026-08-19 — 이 파일은 한 번 **틀린 것을 지키고 있었다.**
//   원래 테스트는 "키가 없으면 막고, 사전 적중 95%→72% 를 사유에 적는다" 를 못 박았다.
//   그 95→72 는 정확 일치 값이었고(학습자 경로는 `resolve_dict_headword` 로 굴절을 푼다,
//   실측 95.6%), 게다가 키를 넣어도 사전은 안 채워졌다 —
//   `enrich_shared_dictionary` 가 제약이 금지하는 `source='lcp_llm'` 을 하드코딩해
//   103일 동안 한 행도 못 넣었기 때문이다.
//
//   즉 회귀 테스트가 **틀린 숫자를 고정**하고 있었다. 숫자를 사유에 적게 한 것 자체는
//   옳았지만, 그 숫자가 무엇을 잰 것인지는 아무도 검사하지 않았다.
//   그래서 이제 **"막지 않는다"** 를 못 박는다 — 근거 없는 차단이 진짜 구멍을 가렸다.

import { describe, expect, it } from 'vitest'

import { DEGRADED_CEFR_CONFIDENCE, checkAnalysisReadiness } from './readiness'

describe('checkAnalysisReadiness', () => {
  it('키가 있으면 통과하고 저하 항목이 없다', () => {
    const r = checkAnalysisReadiness({ ANTHROPIC_API_KEY: 'sk-test' })
    expect(r.ready).toBe(true)
    expect(r.reason).toBeNull()
    expect(r.degraded).toEqual([])
  })

  it('키가 없어도 **막지 않는다** — 사전은 키와 무관하다', () => {
    // 이것이 이번 정정의 핵심이다. 막으면 PD 큐 26편이 이유 없이 서 있게 된다.
    const r = checkAnalysisReadiness({})
    expect(r.ready).toBe(true)
    expect(r.reason).toBeNull()
  })

  it('키가 없으면 빠지는 것이 무엇인지 정확히 한 가지만 말한다', () => {
    const d = checkAnalysisReadiness({}).degraded
    expect(d).toHaveLength(1)
    expect(d[0]).toContain('CEFR')
    // 사전이 영향받지 않는다는 것을 명시해야 한다 — 이 문장이 없으면
    // 다음 사람이 또 키를 사전 문제의 해법으로 오해한다.
    expect(d[0]).toContain('사전은 영향받지 않는다')
    expect(d[0]).toContain('drain-article-lemmas')
  })

  it('빈 문자열도 없는 것으로 본다 — 키가 있는 척하는 값이 더 위험하다', () => {
    expect(checkAnalysisReadiness({ ANTHROPIC_API_KEY: '' }).degraded).toHaveLength(1)
  })

  it('실측 수치는 0~1 범위이고 키 있는 쪽이 더 높지만 차이는 작다', () => {
    const { withKey, withoutKey } = DEGRADED_CEFR_CONFIDENCE
    expect(withKey).toBeGreaterThan(withoutKey)
    // 차이가 0.05 를 넘으면 "작다" 는 판단이 무너지고 다시 막을 근거가 생긴다.
    expect(withKey - withoutKey).toBeLessThan(0.05)
    for (const v of [withKey, withoutKey]) {
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('환경변수를 주입받는다 — 테스트가 실제 환경을 건드리지 않는다', () => {
    expect(checkAnalysisReadiness({ ANTHROPIC_API_KEY: 'x' }).degraded).toEqual([])
    expect(checkAnalysisReadiness({ OTHER: 'x' }).degraded).toHaveLength(1)
  })
})
