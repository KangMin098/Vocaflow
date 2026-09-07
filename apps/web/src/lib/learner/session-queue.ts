// apps/web/src/lib/learner/session-queue.ts
//
// 모듈 허브의 세션 큐 — **순수 계산부**. 조회는 session-queue-query.ts(server-only).
//
// ⚠️ 이 파일에 `server-only` 를 넣거나 서버 전용 모듈을 import 하면 안 된다.
//    허브 표시부(FlashcardHubClient · SpellForgeHubClient)가 'use client' 이면서
//    bucketsOf 를 쓰기 때문이다. 실제로 처음엔 조회와 계산을 한 파일에 뒀다가
//    "You're importing a component that needs server-only" 로 **모듈 그래프 전체가 깨져
//    앱의 모든 라우트가 500** 이 됐다 — tsc·eslint 는 둘 다 통과했고 런타임만 잡았다.
//
// 왜 계산을 순수 함수로 떼는가(설계 이유):
//   허브에는 세션 길이 선택(10·20·30·전체)이 있다. 서버가 50개로 버킷을 굳혀 보내면
//   10장을 고른 학습자에게 50장의 분포를 보여주게 된다 — mock 을 지우고 만든 새 거짓말이다.
//   정렬된 단어 배열을 넘기고 클라이언트가 고른 길이만큼 잘라 **같은 함수**로 세면,
//   화면의 분포는 항상 그 세션에 담길 카드와 같다. (배열은 50개 이하 · 1KB 미만)

import type { QueueBucket } from '@/components/hub/TodayQueue'

export type QueueKind = QueueBucket['kind']

/** 세션에 담길 단어 하나 — 배열 순서가 play 라우트가 제시할 순서다(급한 것 먼저). */
export interface QueuedWord {
  word: string
  state: QueueKind
  /** 복습 시점이 이미 지났나 — "급함" 의 근거 */
  overdue: boolean
}

export interface SessionQueue {
  /** play 라우트가 담는 순서 그대로. 최대 STUDY_SESSION_CAP 개 */
  words: QueuedWord[]
  /** 내 단어 전체 (세션 상한 밖까지) — "225개 중 50개" 를 말할 수 있게 */
  vocabTotal: number
  /** 세션이 상한에 걸렸나 — 걸렸으면 "이번에 다 담지 못했다" 를 말해야 한다 */
  capped: boolean
}

/** 미리보기에 올릴 단어 수 — TodayQueue 가 3개까지 렌더한다. */
const PREVIEW_MAX = 3

/** 버킷 표시 순서 — TodayQueue 카드 순서(급한 것부터)와 같게 둔다. */
const KIND_ORDER: readonly QueueKind[] = ['risk', 'shaky', 'new', 'stable']

export function emptySessionQueue(): SessionQueue {
  return { words: [], vocabTotal: 0, capped: false }
}

/**
 * 정렬된 세션 단어 → TodayQueue 버킷.
 * `limit` 을 주면 앞에서 그만큼만 센다 — 학습자가 고른 세션 길이와 화면 분포를 일치시킨다.
 * 개수 0인 버킷도 남긴다(TodayQueue 가 4칸을 항상 그리고 0을 흐리게 표시한다).
 */
export function bucketsOf(words: QueuedWord[], limit?: number): QueueBucket[] {
  const slice = typeof limit === 'number' ? words.slice(0, Math.max(0, limit)) : words
  const counts: Record<QueueKind, number> = { risk: 0, shaky: 0, new: 0, stable: 0 }
  const previews: Record<QueueKind, string[]> = { risk: [], shaky: [], new: [], stable: [] }
  for (const w of slice) {
    counts[w.state] += 1
    // 앞에서부터 채운다 — 학습자가 실제로 먼저 만날 단어가 미리보기에 오게.
    if (previews[w.state].length < PREVIEW_MAX && w.word) previews[w.state].push(w.word)
  }
  return KIND_ORDER.map((kind) => ({
    kind,
    count: counts[kind],
    ...(previews[kind].length > 0 ? { preview: previews[kind] } : {}),
  }))
}

/** 세션에 담길 것 중 복습 시점이 지난 개수 — bucketsOf 와 같은 slice 규칙. */
export function overdueOf(words: QueuedWord[], limit?: number): number {
  const slice = typeof limit === 'number' ? words.slice(0, Math.max(0, limit)) : words
  return slice.filter((w) => w.overdue).length
}
