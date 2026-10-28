// apps/web/src/lib/learner/article-practice-availability.ts
//
// T-0215 — 기사 서가 목록의 「연습 있음」: 연습이 설치된 기사 id · 문항 수를 **목록 요청당 한 번** 읽는다.
// - 출처: DB 함수 article_practice_availability()(DL-0230 · 로그인 사용자만 · article_practice_items 와 같은 검수 허용 목록 · 문항 본문 · 정답 없음).
// - 카드별 조회 · 기사 id 하드코딩 없음. 쓰기 없음.
// - 로그아웃이면 부르지 않는다(signed_out). 조회 실패는 「없음」 이 아니다(failed — 화면은 표시를 생략한다).
//   판정 규칙은 기사 화면의 classifyPracticeLookup(reader-article-practice.ts)과 같다: error · 배열 아님 → 실패, 빈 배열 → 없음.

import type { SupabaseClient } from '@supabase/supabase-js'

export type ArticlePracticeAvailability =
  | { state: 'signed_out' }
  | { state: 'failed' }
  | { state: 'ok'; counts: Record<string, number> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** RPC 응답 → 상태. 행 모양이 하나라도 틀리면 실패(부분만 믿지 않는다). */
export function classifyPracticeAvailability(res: { data: unknown; error: unknown }): ArticlePracticeAvailability {
  if (res.error || !Array.isArray(res.data)) return { state: 'failed' }
  const counts: Record<string, number> = {}
  for (const row of res.data as unknown[]) {
    const r = row as { article_id?: unknown; item_count?: unknown } | null
    if (!r || typeof r.article_id !== 'string' || !UUID_RE.test(r.article_id)) return { state: 'failed' }
    if (typeof r.item_count !== 'number' || !Number.isInteger(r.item_count) || r.item_count < 1) return { state: 'failed' }
    counts[r.article_id.toLowerCase()] = r.item_count
  }
  return { state: 'ok', counts }
}

/** 서가 목록 loader — 로그인 확인 1회 · RPC 1회. 예외도 실패로 접는다(목록 자체는 막지 않는다). */
export async function loadArticlePracticeAvailability(client: SupabaseClient): Promise<ArticlePracticeAvailability> {
  try {
    const { data } = await client.auth.getUser()
    if (!data.user) return { state: 'signed_out' }
    const res = await client.rpc('article_practice_availability')
    return classifyPracticeAvailability({ data: res.data, error: res.error })
  } catch {
    return { state: 'failed' }
  }
}

/** 카드 한 장에 붙일 문항 수 — ok 이고 그 기사가 있을 때만. 그 밖(로그아웃 · 실패 · 없음)은 null(표시 생략). */
export function practiceCountFor(av: ArticlePracticeAvailability | null | undefined, articleId: string): number | null {
  if (!av || av.state !== 'ok') return null
  return av.counts[articleId.toLowerCase()] ?? null
}
