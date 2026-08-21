// apps/web/src/lib/textbook/my-shelf-query.ts
//
// **내가 고른 교재** 조회·저장. 판정·표시는 `shelf.ts`(순수)가 소유한다.
//
// ⚠️ `react.cache` 를 쓰지 않는다 — 호출부가 한 곳이고, 감싸면 렌더 테스트가 죽는다
//    (CONVENTIONS §vitest — 범인은 server-only 가 아니라 react.cache 다).
//
// ── 저장소가 아직 없을 수 있다 ──────────────────────────────────────
// 이 기능은 마이그레이션 `20260821140000_user_textbook_selections` 에 의존한다.
// 적용 전에는 테이블이 없어 조회가 **오류**를 돌려준다. 그 오류를 빈 배열로 뭉개면
// 화면이 "고른 교재가 없어요"(사실은 저장소가 없음)라고 **거짓말**한다 —
// 이 저장소의 지배적 결함 유형이다. 그래서 상태를 구별해 화면까지 올려 보낸다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

export interface MySelection {
  /** 고른 권들의 step 번호 */
  steps: number[]
  /**
   * 로그인 상태인가.
   *
   * ⚠️ `available` 과 다른 축이다. 비로그인은 **정상적으로** 0권이므로 `available: true` 인데,
   *    화면이 그 둘을 구별하지 못하면 비로그인 방문자에게 **눌러도 안 되는 담기 버튼**을 판다.
   *    서가는 공개 표면이라(apps/web/CLAUDE.md) 이 경우가 드물지 않다 —
   *    거기가 이 제품에서 CAC 0 경로가 성립하는 유일한 순간이다.
   */
  signedIn: boolean
  /**
   * 저장소를 실제로 읽었는가.
   *
   * false = 마이그레이션 미적용 등으로 **못 읽음**. "고른 것이 없다" 와 다르다.
   */
  available: boolean
}

export async function fetchMyTextbooks(): Promise<MySelection> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  // 비로그인은 "고른 것이 없다" 가 맞다 — 다만 **담을 수 없는 이유가 다르다**.
  if (!user) return { steps: [], available: true, signedIn: false }

  const lc = client as unknown as SupabaseClient
  const { data, error } = await lc
    .from('user_textbook_selections')
    .select('step')
    .eq('user_id', user.id)
    .order('step', { ascending: true })

  // 테이블 부재·권한 오류를 빈 목록으로 뭉개지 않는다.
  if (error) return { steps: [], available: false, signedIn: true }

  return {
    steps: (data ?? []).map((r) => Number((r as { step: number }).step)),
    available: true,
    signedIn: true,
  }
}
