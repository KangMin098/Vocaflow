// packages/library-pipeline/src/analyze/readiness.ts
//
// **분석을 돌려도 되는 상태인가** — 조용한 저하를 막는 한 곳.
//
// ── 2026-08-19 정정: 앞선 판단이 틀렸다 ──────────────────────────────
// 이 파일은 원래 "ANTHROPIC_API_KEY 가 없으면 사전 적중이 95%→72% 로 떨어진다" 며
// 배치를 **막았다**. 두 군데가 틀렸다.
//
// ① 72% 는 **정확 일치** 값이었다 — 학습자가 겪는 값이 아니다.
//    추출기는 본문에 표제어가 없으면 표면형을 남긴다(`keepLemmaOnlyIfInText`, v06.35
//    유령 어휘 차단). 짧은 기사에서는 단수형이 본문에 안 나오는 일이 흔해
//    countries·years·hours 가 통째로 "미등재" 로 보인다. 그러나 학습자 경로
//    (`select_article_vocab` → `resolve_dict_headword`)는 그걸 푼다.
//    실측(43편·5,386낱말): 정확 일치 64.2% · **해소기 통과 후 95.6%**.
//
// ② 키를 넣어도 사전은 안 채워졌다. 보강 결과를 되돌려 넣는
//    `enrich_shared_dictionary` 는 본문에 `source='lcp_llm'` 을 하드코딩하는데
//    (마이그레이션 20260508120200), 그 **나흘 전**에 생긴 제약
//    `shared_dictionary_source_check`(20260504160708)이 그 값을 금지한다.
//    호출부는 오류를 `console.warn` 으로 삼켰다(`lookup-enrich.ts`).
//    → 103일 동안 한 행도 안 들어갔다. `source='lcp_llm'` 행 0개가 그 증거다.
//
// 즉 **키는 사전 구멍의 원인이 아니었고, 키를 넣어도 안 막혔다.**
// 사전은 Claude Code 드레인이 채운다(`scripts/dict/drain-article-lemmas.mjs`).
// 첫 드레인 실측: 진짜 빠진 낱말 239 → 197 등재 → **적중 99.2%**.
//
// ⚠️ 그래서 이 함수는 **더 이상 막지 않는다.** 키가 없을 때 실제로 빠지는 것은
//   CEFR 의 LLM 시그널 하나뿐이고, 그 영향은 실측상 신뢰도 0.732 → 0.725 다.
//   근거 없이 막는 게이트는 "안전" 이 아니라 **가짜 안전**이다 — 진짜 구멍(사전)을
//   가린 채 배치만 세웠다.

/**
 * 키 없이 돌렸을 때의 CEFR 신뢰도 (2026-08-19 실측 · ACP 6편 + 재저작 6편).
 * 사전 적중이 아니다 — 사전은 키와 무관하다(위 ② 참조).
 */
export const DEGRADED_CEFR_CONFIDENCE = { withKey: 0.732, withoutKey: 0.725 } as const

export interface AnalysisReadiness {
  /** 배치를 돌려도 되는가. 사전은 드레인 소관이므로 키 유무로 막지 않는다. */
  ready: boolean
  /** `ready` 가 false 일 때만 채워지는 차단 사유. */
  reason: string | null
  /** 키 없이 돌 때 실제로 빠지는 것. 비어 있으면 온전한 분석이다. */
  degraded: string[]
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
    const a = DEGRADED_CEFR_CONFIDENCE.withKey
    const b = DEGRADED_CEFR_CONFIDENCE.withoutKey
    return {
      ready: true,
      reason: null,
      degraded: [
        `CEFR 의 LLM 시그널이 빠진다 (신뢰도 실측 ${a} → ${b}). 어휘 사전은 영향받지 않는다 — ` +
          `사전은 Claude Code 드레인이 채운다(scripts/dict/drain-article-lemmas.mjs).`,
      ],
    }
  }
  return { ready: true, reason: null, degraded: [] }
}
