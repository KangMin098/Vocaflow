// apps/web/src/lib/learner/hub-lift-query.ts
//
// `/hub` 기억 곡선의 서버 조회부. 계산은 `memory-lift.ts`(순수).
//
// **세션 큐와 같은 조회를 쓴다**(`fetchStudyVocabularies` — `/flashcard/play` 일반 진입이 부르는 그 함수).
// 허브가 보여 준 앞 N개와 「이 N개부터」 가 여는 세션의 앞 N개가 같아야 약속이 지켜진다
// (`/flashcard/play?limit=N` 은 같은 순서를 앞에서 자른다 — 그 파일의 limit 주석).
//
// 기준선도 이 낱말들만으로 센다(`memory-lift.ts` 범위 주석) — 추가 쿼리는 이 하나뿐이다.
//
// ⚠️ 오류를 빈 상태로 삼키지 않는다 — 감사(2026-09-18)가 회고 화면에서 잡은 결함이 그것이다.
//    "모아 둔 단어가 없어요" 와 "불러오지 못했어요" 는 다음 한 걸음이 다르다.

import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { rowToCard } from '@/lib/srs/supabase-adapter'
import { fetchStudyVocabularies } from '@/lib/wordvault/study-queries'

import { buildMemoryLift, type MemoryLift } from './memory-lift'

/** 곡선 아래 조판하는 낱말 수의 상한 — 390 에서 세 줄, 1280 에서 두 줄 안쪽 */
export const HUB_LIFT_WORDS = 24

export type HubLiftResult =
  | { kind: 'ok'; lift: MemoryLift }
  | { kind: 'empty' }
  | { kind: 'error' }

export async function fetchHubLift(now: Date = new Date()): Promise<HubLiftResult | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  let rows: Awaited<ReturnType<typeof fetchStudyVocabularies>>
  try {
    rows = await fetchStudyVocabularies(supabase as Parameters<typeof fetchStudyVocabularies>[0], user.id, null, now)
  } catch {
    return { kind: 'error' }
  }
  if (rows.length === 0) return { kind: 'empty' }

  const cards = rows.slice(0, HUB_LIFT_WORDS).map((r) => ({
    ...rowToCard(r as unknown as Parameters<typeof rowToCard>[0]),
    word: r.word,
  }))

  return { kind: 'ok', lift: buildMemoryLift(cards, now) }
}
