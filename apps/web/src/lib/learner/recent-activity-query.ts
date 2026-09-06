// apps/web/src/lib/learner/recent-activity-query.ts
//
// `/dashboard` 최근 활동 줄이 그리는 것을 **서버에서 한 벌로** 읽는다.
//
// ── 왜 생겼나 (실측 2026-09-06, dev 서버 프로덕션 동형 측정) ──────────────
// `/dashboard` 의 라우트는 이미 서버 컴포넌트인데도 브라우저가 **데이터 요청 10건**을 냈다.
// 열 건 전부가 마지막 줄 한 컴포넌트(`RecentActivity`)의 몫이었다 — 그것이 `useHubData()`
// 를 부르고, 그 훅은 /hub 한 화면분(프로필·통계·오늘 카운트·정확도 분자/분모·복습 예정·
// 이어보기 텍스트·학습기록 50·점수 50)을 통째로 조회한다. 이 화면이 **실제로 쓰는 것은
// 그중 마지막 두 개뿐**이고, 나머지 여덟은 그려지지도 않는 값이었다.
//
// 규칙 셋 (`lib/dictation/hub-query.ts` · `lib/wordvault/hub-query.ts` 와 같은 결):
//   ① 사용자 확인은 여기서 한 번. 페이지의 다른 서버 조회와 마찬가지로 `cache()` 안에 둔다.
//   ② 화면이 쓰는 것만 읽는다 — 두 테이블, 각 50행.
//   ③ 상대 시간 문자열도 **여기서** 만든다. 클라이언트에서 `Date.now()` 로 만들면 서버 HTML
//      과 어긋나 하이드레이션이 깨진다(서버가 그린 "3분 전"과 클라이언트의 "4분 전").
//
// ⚠️ **여기 조회를 다시 붙이면 그 낭비가 되살아난다.** 최근 활동 줄은 스스로 조회하지 않는다 —
//    `RecentActivity` 는 props 로 받은 것만 그린다. 훅(`useHubData`)을 다시 부르는 순간
//    이 화면의 브라우저 요청은 0 → 10 으로 돌아간다.
//
// ⚠️ **실패를 빈 목록으로 둔갑시키지 않는다.** 빈 목록은 "아직 학습 활동이 없어요" 라는
//    **정직한 사실**의 표현이라, 조회 실패까지 같은 모양으로 내리면 학습자는 자기 기록이
//    사라졌다고 읽는다(CONVENTIONS 「조용한 실패」). 그래서 `failed` 를 함께 내려
//    화면이 「못 불러왔어요 + 다시 시도」를 그릴 수 있게 한다.

import 'server-only'

import { cache } from 'react'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { formatRelativeTime } from '@/lib/utils/relative-time'

import type { Enums } from '@vocaflow/types'

export type ActivityModuleId = Enums<'module_id'>

/** 칩 한 개분. 화면은 이 객체만 보고 그린다 — 여기 없는 값은 그리지 않는다. */
export interface RecentActivityItem {
  /** 출처를 접두사로 구분한다(`lr:` 학습기록 · `sc:` 점수) — 두 테이블의 id 가 겹칠 수 있다 */
  id: string
  module: ActivityModuleId
  textTitle: string
  /** 게임 점수. 학습 기록에는 없다(null) */
  score: number | null
  /** 학습 기록의 정오. 게임 점수에는 없다(null) */
  isCorrect: boolean | null
  /** 서버가 만든 한국어 상대 시간 — 클라이언트가 다시 계산하지 않는다 */
  relativeTime: string
  /** 정렬 근거. 화면은 안 쓰지만 테스트가 순서를 확인한다 */
  createdAt: string
}

export interface RecentActivityData {
  items: RecentActivityItem[]
  /** 조회 자체가 실패했는가 — "아직 없어요" 와 "못 읽었다" 를 화면이 구별해야 한다 */
  failed: boolean
}

/** 칩으로 그리는 최대 개수. 그 위는 「전체」 링크의 몫이다. */
const CHIP_LIMIT = 5
/**
 * 테이블별로 읽는 행 수 = `CHIP_LIMIT`.
 *
 * 이전 구현은 각 50행을 읽어 합친 뒤 5건만 남겼다 — 90행이 매번 버려졌다. 두 목록이 각자
 * 시간 내림차순이므로 **합집합의 상위 5건은 반드시 각 목록의 상위 5건 안에 있다**
 * (6번째보다 뒤인 항목이 상위 5위에 들려면 같은 목록에서 자기보다 앞선 5건을 모두
 * 제쳐야 하는데 그럴 수 없다). 결과가 같으므로 읽는 양만 줄인다.
 */
const SCAN_LIMIT = CHIP_LIMIT

type RecordRow = {
  id: string
  module: ActivityModuleId
  attempted_at: string | null
  is_correct: boolean
  vocabularies: { texts: { title: string } | null } | null
}

type ScoreRow = {
  id: string
  module: ActivityModuleId
  created_at: string | null
  score: number
  texts: { title: string } | null
}

export const EMPTY_RECENT_ACTIVITY: RecentActivityData = { items: [], failed: false }

/** 실패 상태 — 화면이 「못 불러왔어요 + 다시 시도」를 그린다. */
export function failedRecentActivity(): RecentActivityData {
  return { items: [], failed: true }
}

/**
 * 최근 학습 활동 5건 — 학습 기록과 게임 점수를 시간순으로 합친다.
 *
 * `cache()` 인 이유: 같은 요청 안에서 페이지와 (앞으로 생길) 다른 서버 조각이 함께 불러도
 * 쿼리는 한 번이어야 한다. `fetchManageOverview` · `fetchMemoryHorizon` 과 같은 규칙이다.
 */
export const fetchRecentActivity = cache(async (): Promise<RecentActivityData> => {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  // 비로그인은 실패가 아니다 — 페이지가 이미 "로그인하면 볼 수 있어요" 로 갈라진다.
  if (!user) return EMPTY_RECENT_ACTIVITY

  const lc = client as unknown as SupabaseClient

  const [records, scores] = await Promise.all([
    lc
      .from('learning_records')
      .select('id, module, attempted_at, is_correct, vocabularies(texts(title))')
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: false })
      .limit(SCAN_LIMIT),
    lc
      .from('scores')
      .select('id, module, created_at, score, texts(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(SCAN_LIMIT),
  ])

  // 한쪽만 실패해도 실패로 본다 — 반쪽 목록을 "최근 활동" 이라 부르면 그것도 거짓이다.
  if (records.error || scores.error) {
    // eslint-disable-next-line no-console
    console.error('[recent-activity] read failed:', records.error ?? scores.error)
    return failedRecentActivity()
  }

  const merged: RecentActivityItem[] = []

  for (const r of (records.data ?? []) as unknown as RecordRow[]) {
    if (!r.attempted_at) continue
    merged.push({
      id: `lr:${r.id}`,
      module: r.module,
      textTitle: r.vocabularies?.texts?.title ?? '단어장',
      score: null,
      isCorrect: r.is_correct,
      relativeTime: formatRelativeTime(r.attempted_at),
      createdAt: r.attempted_at,
    })
  }
  for (const s of (scores.data ?? []) as unknown as ScoreRow[]) {
    if (!s.created_at) continue
    merged.push({
      id: `sc:${s.id}`,
      module: s.module,
      textTitle: s.texts?.title ?? '게임 세션',
      score: s.score,
      isCorrect: null,
      relativeTime: formatRelativeTime(s.created_at),
      createdAt: s.created_at,
    })
  }

  merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))

  return { items: merged.slice(0, CHIP_LIMIT), failed: false }
})
