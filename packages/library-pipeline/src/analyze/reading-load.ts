// packages/library-pipeline/src/analyze/reading-load.ts
//
// **한 번에 읽기 어려운 길이인가** — 검수자에게 표시하기 위한 판단.
//
// ── 왜 필요한가 (실측 2026-08-20) ────────────────────────────────────
// 파이프라인에 **본문 길이에 대한 판단이 아무 데도 없었다.** `minTitleLen`·
// `minDescriptionLen` 은 목록 항목이 부실한지 보는 것이고, 본문은 얼마든 길어도 통과한다.
// 그 결과 검수 대기에 연구논문 전문이 섞여 들어왔다:
//
//   plos          ready 4편 · 평균 **7,013어**  (시약명·실험 절차가 그대로)
//   wikivoyage    발행 2편 · 평균 11,290어 · 최대 **13,942어**
//   wikipedia     발행 2편 · 평균  9,121어
//
// 반면 뉴스형은 짧다 — voa 609어 · nasa 462어 · the_conversation 962어.
// 즉 길이는 소스 종류가 갈리는 자리이지 개별 글의 우연이 아니다.
//
// ── 임계값의 근거 ────────────────────────────────────────────────────
// 짐작한 숫자를 쓰지 않는다. **사람이 검수해 발행한 138편의 분포**를 기준으로 삼는다:
//
//   중앙값 855어 · p90 2,848어 · p95 5,890어 · 최대 13,942어
//
// p90 을 넘는 글은 우리가 실제로 받아들인 것 중 상위 10% 라는 뜻이므로 **예외**다.
// 예외는 조용히 통과시키지도, 조용히 버리지도 않고 **검수자에게 알린다.**
//
// ⚠️ 버리지 않는 이유: 긴 글이 나쁜 글은 아니다. 백과 항목은 길이가 본질이고,
//   상급 학습자에게는 유효하다. 판단은 사람이 한다 — 이 함수는 재료만 준다.
//   `lexical_noise > 0.08` 이 단어세트를 건너뛰되 글은 남기는 것과 같은 태도다.

/** 사람이 검수해 발행한 138편의 어수 p90 (2026-08-20 실측). */
export const ACCEPTED_WORDS_P90 = 2848

/** `analyze-article` 이 쓰는 읽기 속도. 여기와 어긋나면 표시 시간이 화면과 달라진다. */
export const ARTICLE_WPM = 200

export interface ReadingLoad {
  /** 실측 p90 을 넘는가 — "예외적으로 길다" 는 뜻이지 "나쁘다" 가 아니다. */
  overLong: boolean
  minutes: number
  /** 검수자에게 보일 한 줄. 예외가 아니면 null. */
  note: string | null
}

/**
 * 길이 부담을 판단한다.
 *
 * 순수 함수다 — DB 도 환경변수도 보지 않는다. 그래야 배치와 화면이 같은 답을 낸다.
 */
export function assessReadingLoad(wordCount: number | null | undefined): ReadingLoad {
  const words = typeof wordCount === 'number' && wordCount > 0 ? wordCount : 0
  const minutes = Math.max(1, Math.ceil(words / ARTICLE_WPM))
  if (words <= ACCEPTED_WORDS_P90) return { overLong: false, minutes, note: null }
  return {
    overLong: true,
    minutes,
    // 숫자만 적으면 검수자가 "그래서 어쩌라는 건가" 로 멈춘다 — 비교 대상을 같이 준다.
    note:
      `${words.toLocaleString()}어 · 약 ${minutes}분 — 발행분 p90(${ACCEPTED_WORDS_P90.toLocaleString()}어)을 넘는다. ` +
      `상급 학습자용으로는 유효하나 한 세션에 끝내기 어렵다.`,
  }
}
