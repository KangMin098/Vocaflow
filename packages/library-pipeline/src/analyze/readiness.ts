// packages/library-pipeline/src/analyze/readiness.ts
//
// **분석을 돌려도 되는 상태인가** — 조용한 저하를 막는 한 곳.
//
// ── 왜 필요한가 (실측 2026-08-19) ─────────────────────────────────────
// `analyzeArticle` 은 `ANTHROPIC_API_KEY` 가 없으면 **경고만 찍고 계속 돈다.** 사전에 없는
// 낱말을 채우는 lookup-enrich 와 CEFR 의 LLM 시그널이 건너뛰어진다. 로그는 흘러가고 아무도
// 못 본다.
//
// 그날 키 없이 처리한 두 파이프라인을 기존과 견주니:
//
//   | | 어휘 | 사전 적중 |
//   |---|---|---|
//   | ACP 기존(키 있음) | 48,071 | **95.2%** |
//   | ACP 오늘(키 없음) | 1,338 | **72.0%** |
//   | 재저작 오늘(키 없음) | 331 | **75.2%** |
//
// 학습자가 단어를 눌렀을 때 뜻이 안 나오는 비율이 **5% → 25~28%** 로 뛴다.
//
// ⚠️ **겉으로는 정상으로 보인다는 것이 이 결함의 핵심이다.** CEFR 신뢰도(0.732→0.725)와
//   어휘 밀도(23.7%→26.3%)는 거의 안 변한다. 흔히 보는 지표만으로는 못 알아챈다.
//
// 그래서 판단을 **한 곳에** 둔다. 스크립트마다 각자 검사하면 한쪽만 고쳐지고, 이 저장소는
// 그 사본 문제를 이미 여러 번 겪었다.

/** 키 없이 돌렸을 때의 실측 사전 적중률(2026-08-19 · ACP 6편 + 재저작 6편). */
export const DEGRADED_DICTIONARY_HIT = { withKey: 0.952, withoutKey: 0.72 } as const

export interface AnalysisReadiness {
  ready: boolean
  /** 사람이 읽는 사유. `ready` 면 null. */
  reason: string | null
}

/**
 * 분석을 돌려도 되는가.
 *
 * `env` 를 주입받는다 — 테스트에서 실제 환경변수를 건드리지 않기 위해서다.
 */
export function checkAnalysisReadiness(
  env: Record<string, string | undefined> = process.env,
): AnalysisReadiness {
  if (!env.ANTHROPIC_API_KEY) {
    const a = Math.round(100 * DEGRADED_DICTIONARY_HIT.withKey)
    const b = Math.round(100 * DEGRADED_DICTIONARY_HIT.withoutKey)
    return {
      ready: false,
      reason:
        `ANTHROPIC_API_KEY 가 없다. 이 키가 없으면 사전에 없는 낱말을 채우지 못한다 — ` +
        `실측 사전 적중률 ${a}% → ${b}%, 즉 학습자가 단어를 눌렀을 때 뜻이 안 나오는 비율이 ` +
        `${100 - a}% 에서 ${100 - b}% 로 뛴다. CEFR 신뢰도·어휘 밀도는 거의 안 변해서 ` +
        `겉으로는 정상으로 보인다.`,
    }
  }
  return { ready: true, reason: null }
}
