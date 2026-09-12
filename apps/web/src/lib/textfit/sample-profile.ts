// apps/web/src/lib/textfit/sample-profile.ts
//
// `/fit` 도착 화면의 **작동하는 증명** — 예시 지문을 서버가 미리 분석해 둔다.
//
// ── 혁신 판정 3문 (vocaflow-design §A) ──────────────────────────────
//   N1 자산 의존: `shared_dictionary` 해석(`textfit_resolve_levels_public`) + 커버리지 계산 —
//      이 두 자산 없이는 성립하지 않는다.
//   N2 즉시 증명: 도착 즉시 학년축 8칸·적정 레벨·어려운 단어·학습지 인쇄까지 **도구 전체가 작동한
//      상태**로 보인다. 클릭 0 · 입력 0.
//   N3 학습과학: 이 화면은 학습 화면이 아니라 획득 관문이다. 여기서 게이트는 §C-6 「교사의 3분」 —
//      교사가 3분 안에 학급에 던질 수 있는가. 빈 입력칸은 그 3분을 "무엇을 붙여넣지?" 로 쓰게 한다.
//
// ── 왜 필요했나 (2026-09-05 실측) ────────────────────────────────────
//   랜딩은 이미 증명을 먼저 보인다(`hero-demo.ts`). 그런데 그 랜딩의 1차 CTA 가 보내는 이 화면은
//   **빈 textarea** 로 시작했다 — 증명에서 빈 폼으로 떨어지는 셈이다(§C-4: 빈 상태는 실측 데이터로
//   남의 결과를 보여줄 유일한 기회인데, 그 자리를 비워 두는 것은 발명의 포기다). 「예시 지문」
//   버튼이 있었지만 그건 클릭 1 이고, I2 는 0 을 요구한다.
//
// ── 왜 `unstable_cache` 인가 ────────────────────────────────────────
//   `/fit` 은 `searchParams`(`?r=`) 를 읽으므로 동적 렌더다. 그대로 두면 **요청마다** 분석이 돈다
//   (실측 1.97초). 지문이 상수라 결과도 하루 한 번이면 충분하다 — 랜딩의 `revalidate = 86400`
//   과 같은 주기다. `react.cache` 는 요청 한 번 안에서만 살아서 여기엔 맞지 않는다.
//
// 실패하면 `null` — 화면은 이전처럼 빈 입력칸으로 뜬다. 증명만 빠지고 도구는 그대로다.
// 0% 짜리 빈 결과를 만들어 넣지 않는다(그건 "아무도 못 읽는 글" 이라는 거짓이다).

import 'server-only'

import { unstable_cache } from 'next/cache'

import { tokenizeText } from '@/lib/text-extract/tokenize'

import { analyzeCounts } from './analyze'
import type { LevelProfile } from './profile'
import { FIT_SAMPLE } from './sample'

/** 캐시 유효 기간(초) — 랜딩 ISR 과 같은 하루. 사전 레벨은 그보다 천천히 바뀐다. */
const SAMPLE_REVALIDATE_SECONDS = 86_400

/**
 * 예시 지문을 실제로 분석한다 — **캐시 없는 순수 계산.** 테스트와 캐시 래퍼가 이걸 부른다.
 */
export async function computeSampleProfile(): Promise<LevelProfile | null> {
  try {
    const tokenization = tokenizeText(FIT_SAMPLE)
    if (tokenization.uniqueFinal === 0) return null
    const { profile } = await analyzeCounts(tokenization.counts, tokenization.totalWords)
    // 학습 대상 단어가 하나도 안 잡혔으면 결과가 아니라 결함이다 — 화면에 내지 않는다.
    if (profile.uniqueContentWords === 0) return null
    return profile
  } catch (err) {
    console.error('[fit-sample] 예시 지문 분석 실패:', err)
    return null
  }
}

/**
 * 예시 지문 분석 결과 — 프로세스 간 캐시(하루). `/fit` 서버 컴포넌트가 부른다.
 *
 * ⚠️ 실패(`null`)도 캐시된다. 하루 동안 증명이 빠진 채 뜰 수 있다는 뜻인데, 그 반대(요청마다
 *    재시도)는 장애 중에 `/api/fit` 과 같은 DB 를 계속 두드린다. 증명은 있으면 좋은 것이고
 *    도구는 있어야 하는 것이다 — 도구 쪽을 지킨다.
 */
export const getSampleProfile = unstable_cache(computeSampleProfile, ['fit-sample-profile'], {
  revalidate: SAMPLE_REVALIDATE_SECONDS,
})
