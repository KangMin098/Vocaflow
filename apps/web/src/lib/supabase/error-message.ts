// apps/web/src/lib/supabase/error-message.ts
//
// **DB 오류 문자열을 학습자에게 그대로 보여주지 않는다.**
//
// ── 왜 (실측 2026-08-30) ─────────────────────────────────────────────
// 쓰기 페이로드가 어느 선을 넘으면 응답이 **JSON 이 아니라 HTML 오류 페이지**로 온다.
// 그러면 `error.message` 는 이렇게 시작한다:
//
//     <!DOCTYPE html>
//     <!--[if lt IE 7]> <html class="no-js ie6 old …
//
// 실측: 19.7MB 는 통과, **48.1MB 는 43초 뒤 HTML** (프록시 계층이 끊는다).
// 그런데 `VocabSetGrid` 는 그 문자열을 토스트에 **그대로** 그린다 —
// 학습자가 단어장을 담다가 HTML 소스를 보게 된다.
//
// 크기만의 문제가 아니다. Postgres 오류 원문(`duplicate key value violates unique
// constraint "vocabularies_user_id_word_key"`)도 학습자가 읽을 문장이 아니다.
//
// **규칙**: 원문은 로그로, 화면에는 사람의 문장. 다만 **빈 문자열로 삼키지 않는다** —
// "실패했다" 는 사실은 반드시 남는다(이 저장소의 조용한 실패 금지).

/** 화면에 그대로 내보내도 되는 길이의 상한. 이보다 길면 사람이 읽을 문장이 아니다. */
const MAX_SHOWN = 160

/**
 * DB 오류 문자열 → 학습자에게 보여줄 한 줄.
 *
 * 원문이 사람이 읽을 만하면 그대로 쓴다(짧고 구체적인 것이 더 도움이 된다).
 * HTML·과도하게 긴 문자열·빈 값이면 대체 문장을 준다.
 */
export function humanDbError(raw: string | null | undefined, fallback = '잠시 후 다시 시도해 주세요'): string {
  const s = (raw ?? '').trim()
  if (!s) return fallback
  // HTML 응답 — 프록시가 끊었거나 게이트웨이 오류다.
  if (/^\s*<(!doctype|html|head|body)\b/i.test(s) || /<\/html>/i.test(s)) {
    return '요청이 너무 커서 처리하지 못했어요 — 조금 나눠서 다시 시도해 주세요'
  }
  if (s.length > MAX_SHOWN) return fallback
  return s
}

/** 화면에 낼 문장과 로그에 남길 원문을 함께 돌려준다. */
export function dbErrorForUi(
  raw: string | null | undefined,
  fallback?: string,
): { shown: string; raw: string } {
  return { shown: humanDbError(raw, fallback), raw: (raw ?? '').slice(0, 500) }
}
