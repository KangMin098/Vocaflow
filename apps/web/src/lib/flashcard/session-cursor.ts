// apps/web/src/lib/flashcard/session-cursor.ts
//
// **새로고침해도 하던 자리에서 이어진다.**
//
// ── 무엇이 결함이었나 (실측 2026-09-05) ────────────────────────────────
// `/flashcard/play?limit=30` 에서 12장을 평가하고 새로고침(또는 뒤로 갔다 다시 들어오면)
// 화면은 **1 / 30 부터 다시** 시작했다. 진행 위치가 `useState(0)` 뿐이었기 때문이다.
// 이미 평가한 12장이 그대로 다시 나오고, 학습자는 같은 단어를 한 세션에 두 번 평가하게 된다.
// (이중 **적재**는 서버의 멱등 가드가 이미 막는다 — `lib/srs/flush-actions.ts`.
//  여기서 막는 것은 이중 **노동**이다.)
//
// ── 왜 이렇게 작나 ─────────────────────────────────────────────────────
// 세션 전체(평가 결과·통계)를 저장하지 않는다. 평가 결과는 `lib/srs/session-storage.ts` 의
// 큐가 이미 갖고 있고, 통계는 재개 뒤 남은 카드로 다시 쌓이면 된다. 저장할 것은
// **"어느 큐의 몇 번째였나"** 하나다. 큐가 달라졌으면(다른 limit · 다른 스코프 · 새 단어)
// 커서는 무효다 — 그래서 큐의 단어 id 열을 키로 삼는다.
//
// ⚠️ `localStorage` 다. `sessionStorage` 면 탭을 닫았다 열 때 사라지고, 그 경우가 바로
//    "하던 자리로 돌아오고 싶은" 경우다. 오래된 커서는 스스로 지운다(아래 TTL).

const KEY = 'vocaflow-flashcard-cursor'
/** 이보다 오래된 커서는 잇지 않는다 — 어제의 12번째 카드로 돌아가면 오히려 낯설다. */
const TTL_MS = 6 * 60 * 60 * 1000

export interface FlashcardCursor {
  /** 큐의 단어 id 를 순서대로 이은 지문 — 같은 큐인지의 근거 */
  queueKey: string
  /** 다음에 볼 카드 인덱스 (0-based) */
  idx: number
  /** 저장 시각(ms) */
  at: number
}

/** 큐의 정체 — 순서까지 같아야 같은 큐다(정렬이 바뀌면 12번째가 다른 단어다). */
export function queueKeyOf(wordIds: readonly string[]): string {
  return wordIds.join('|')
}

function read(): FlashcardCursor | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Partial<FlashcardCursor> | null
    if (
      !c ||
      typeof c.queueKey !== 'string' ||
      typeof c.idx !== 'number' ||
      !Number.isInteger(c.idx) ||
      c.idx < 0 ||
      typeof c.at !== 'number'
    ) {
      return null
    }
    return c as FlashcardCursor
  } catch {
    return null
  }
}

/**
 * 이 큐에서 이어 볼 인덱스. 없거나 다른 큐거나 오래됐거나 끝을 넘겼으면 `0`.
 *
 * 끝을 넘긴 커서(`idx >= length`)는 "지난번에 다 했다" 는 뜻이라 처음부터가 맞다 —
 * 그대로 두면 빈 화면(완료 상태)으로 열린다.
 */
export function resumeIndexFor(wordIds: readonly string[]): number {
  const c = read()
  if (!c) return 0
  if (c.queueKey !== queueKeyOf(wordIds)) return 0
  if (Date.now() - c.at > TTL_MS) {
    clearCursor()
    return 0
  }
  if (c.idx >= wordIds.length) {
    clearCursor()
    return 0
  }
  return c.idx
}

export function saveCursor(wordIds: readonly string[], idx: number): void {
  if (typeof window === 'undefined') return
  try {
    const c: FlashcardCursor = { queueKey: queueKeyOf(wordIds), idx, at: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* 저장이 막힌 브라우저 — 이어보기만 못 할 뿐 학습은 그대로 간다 */
  }
}

export function clearCursor(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 없으면 그만이다 */
  }
}
