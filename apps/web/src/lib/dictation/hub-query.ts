// apps/web/src/lib/dictation/hub-query.ts
//
// `/dictate` 허브가 그리는 **모든 것을 서버에서 한 벌로** 읽는다.
//
// ── 왜 생겼나 (실측 2026-09-06, 프로덕션 빌드) ────────────────────────
// 라우트 파일부터 `'use client'` 라 서버가 그리는 것이 **하나도 없었고**(첫 HTML 은
// 스켈레톤), 하이드레이션이 끝난 뒤 `DictationHubClient` 가 페처 5종을 한꺼번에 불러
// **브라우저에서 데이터 요청 15건**을 냈다 — 학습자 화면 중 가장 많았다. 내역은
// `auth.getUser()` 2회(허브 1 + `fetchResumableSessionId` 안 1) · `texts` 2회 ·
// `library_books` · `user_word_set_subscriptions` · `shared_word_sets` ·
// RPC 2종 · `dictation_sessions` 2회 · 오늘의 5문장 조립 4~5회.
//
// 규칙 셋 (`lib/wordvault/hub-query.ts` 와 같은 결):
//   ① 사용자 확인은 **호출부에서 한 번**. 이 함수는 이미 확인된 `userId` 를 받는다.
//   ② 조회 로직을 복제하지 않는다 — 기존 페처 6종은 이미 `SupabaseClient` 를 인자로
//      받으므로 서버 클라이언트를 그대로 넘긴다. 여기서 하는 일은 **묶어서 한 번에
//      보내고 실패를 판정하는 것**뿐이다.
//   ③ 섹션은 조회하지 않는다. props 로 받은 것만 그린다(그래야 서버 HTML 에 수치가 남는다).
//
// ⚠️ **실패를 빈 상태로 둔갑시키지 않는다.** 페처들은 개별적으로 실패를 삼켜
//    빈 배열/EMPTY_OVERVIEW 를 돌려주는데, 그것만 보면 화면이 "아직 없어요" 를 말한다.
//    그래서 여기서 `failed` 를 함께 내려 화면이 「못 불러왔어요 + 다시 시도」를
//    그릴 수 있게 한다(CONVENTIONS 「조용한 실패」).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { buildDailyDictation, type DailyDictation } from './daily'
import { fetchDictationCatalog, type DictationCatalog } from './catalog'
// ⚠️ `./persist` 가 아니라 `./reads` 에서 가져온다 — `persist.ts` 는 `'use client'` 라
//    서버가 꺼내면 함수가 아니라 클라이언트 참조가 온다(그 자리에서 첫 렌더가 죽는다).
import {
  fetchDictationOverview,
  fetchDictationWeakness,
  fetchRecentDictationSessions,
  fetchResumableSessionId,
  type DictationOverview,
  type RecentSessionRow,
  type WeaknessRow,
} from './reads'

/** 허브 한 화면분. 이 객체 하나가 곧 `DictationHubClient` 의 props 다. */
export interface DictationHubData {
  overview: DictationOverview
  catalog: DictationCatalog
  weakness: WeaknessRow[]
  recent: RecentSessionRow[]
  /** 오늘의 5문장. **재료가 없으면 null** — 실패와는 다르다(`failed` 로 구별한다). */
  daily: DailyDictation | null
  /** DB 가 아는 미완주 세션. 이 기기 localStorage 값이 있으면 그쪽이 우선한다. */
  resumeSessionId: string | null
  /** 조회 자체가 실패했는가 — "아직 없어요" 와 "못 셌다" 를 화면이 구별해야 한다. */
  failed: boolean
}

export const EMPTY_DICTATION_CATALOG: DictationCatalog = { books: [], scripts: [], sets: [] }

const EMPTY_HUB: Omit<DictationHubData, 'failed'> = {
  overview: {
    streak: 0,
    span: 0,
    weeklyAccuracy: null,
    totalSentences: 0,
    totalSessions: 0,
    bestAccuracy: null,
  },
  catalog: EMPTY_DICTATION_CATALOG,
  weakness: [],
  recent: [],
  daily: null,
  resumeSessionId: null,
}

/** 실패 상태 — 화면이 「못 불러왔어요 + 다시 시도」를 그린다. */
export function failedDictationHubData(): DictationHubData {
  return { ...EMPTY_HUB, failed: true }
}

/**
 * 허브 한 화면을 그리는 데 필요한 전부. **호출은 한 번.**
 *
 * 여섯 갈래는 서로를 기다릴 이유가 없으므로 한꺼번에 보낸다. 하나라도 던지면
 * 화면 전체를 실패로 본다 — 받아쓰기 허브는 "오늘의 5문장"이 본체라, 그것이 빠진 채
 * 나머지만 그리면 학습자는 "오늘 할 게 없다" 로 읽는다.
 */
export async function loadDictationHubData(
  supabase: SupabaseClient,
  userId: string,
): Promise<DictationHubData> {
  try {
    const [overview, catalog, weakness, recent, daily, resumeSessionId] = await Promise.all([
      fetchDictationOverview(supabase),
      fetchDictationCatalog(supabase, userId),
      fetchDictationWeakness(supabase, 14),
      fetchRecentDictationSessions(supabase, 5),
      buildDailyDictation(supabase, userId),
      fetchResumableSessionId(supabase),
    ])
    return { overview, catalog, weakness, recent, daily, resumeSessionId, failed: false }
  } catch (e) {
    // 로그는 남긴다 — 화면은 "왜" 를 말할 수 없고(사용자에게 스택은 소음이다),
    // 서버 로그마저 없으면 재현 불가능한 신고가 된다.
    console.error('[Dictation] 허브 로드 실패:', e)
    return failedDictationHubData()
  }
}
