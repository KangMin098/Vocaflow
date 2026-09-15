// apps/web/src/lib/learner/session-queue-query.ts
//
// 모듈 허브 세션 큐 **조회부** (server-only). 계산은 session-queue.ts(순수 · 클라이언트 공용).
//
// **왜 fetchStudyVocabularies 를 재사용하는가** — 이 파일의 핵심이다.
//   play 라우트(`/flashcard/play` · `/spellforge/play`)가 세션 단어를 뽑을 때 쓰는 쿼리와
//   같은 것을 쓴다. 허브가 별도 쿼리로 "오늘 17장" 을 계산하면 시작을 눌렀을 때 나오는
//   것과 어긋날 수 있고, 그러면 mock 을 지우고 **새 거짓말**을 만든 셈이 된다.
//   같은 함수를 부르면 그 드리프트가 원리적으로 불가능하다.
//   (spellforge/hub-words 도 같은 fetchStudyVocabularies 를 쓴다 — 두 허브 모두 정합.)
//
//   그 쿼리의 성질(중요): due 로 **필터하지 않는다**. next_review_at 임박순 정렬 +
//   STUDY_SESSION_CAP(50) 상한이다. 즉 "오늘 due 인 것" 이 아니라 "가장 급한 50개" 다.
//   허브 문구도 "오늘 N장" 이 아니라 "이번 세션 N장" 이어야 한다.
//
// 기억 4상태는 getMemoryState() 단일 출처로 R(t) 동적 계산 — memory_state 컬럼 저장 금지 규칙.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { getMemoryState } from '@/lib/srs/state'
import { fetchStudyVocabularies, STUDY_SESSION_CAP } from '@/lib/wordvault/study-queries'

import { emptySessionQueue, type QueuedWord, type SessionQueue } from './session-queue'

export async function fetchSessionQueue(
  client: SupabaseClient<Database>,
  userId: string | null,
): Promise<SessionQueue> {
  if (!userId) return emptySessionQueue()

  // 세션 rows 는 play 라우트와 동일 출처. 전체 개수는 head count 로 따로 센다
  // (세션 쿼리가 50에서 잘리므로 그 rows 로는 "내 단어 전체" 를 알 수 없다).
  const [rows, total] = await Promise.all([
    fetchStudyVocabularies(client, userId),
    client
      .from('vocabularies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then((r) => (r.error ? null : r.count)),
  ])

  const now = new Date()
  const words: QueuedWord[] = rows.map((r) => ({
    word: r.word,
    state: getMemoryState(
      {
        difficulty: 0,
        stability: r.stability ?? 0,
        lastReviewAt: r.last_review_at ? new Date(r.last_review_at) : null,
      } as Parameters<typeof getMemoryState>[0],
      now,
    ),
    overdue: !!r.next_review_at && new Date(r.next_review_at).getTime() <= now.getTime(),
  }))

  // count 가 실패하면 세션 개수로 대체한다 — "225개 중 50개" 를 못 말할 뿐,
  // 없는 숫자를 지어내지는 않는다. (rows 조회 실패는 fetchStudyVocabularies 가 throw 한다 —
  // 빈 큐로 삼키면 "단어 0개" 로 위장되어 이 화면이 다시 조용히 거짓말한다.)
  const vocabTotal = total ?? words.length

  return {
    words,
    vocabTotal,
    capped: words.length >= STUDY_SESSION_CAP && vocabTotal > words.length,
  }
}
