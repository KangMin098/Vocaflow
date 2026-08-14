// apps/web/src/lib/content/content-ref.ts
//
// 콘텐츠 참조(content_ref) — "무엇으로 학습했나"의 단일 표현.
//
// 왜 이 타입이 필요한가 (docs/VOCAB_FRAMEWORK_PROPOSAL.md §06):
//   학습 결과를 남기는 자리(`scores`)의 콘텐츠 참조가 `text_id` 하나뿐이었다. 그것은
//   `texts` FK 라 사용자가 enroll 한 텍스트만 가리킬 수 있어서, 큐레이션 도서 챕터·공용
//   단어장·짧은 글·만화로 학습한 세션은 **남길 자리가 없어 전부 NULL 로 적재**됐다.
//   실측 49행 전부 NULL — "어떤 도서를 학습했나"를 어떤 쿼리로도 답할 수 없었다.
//
//   콘텐츠 유형이 늘 때마다 7곳을 손대야 했던 것도 같은 원인이다(article 이 book 을 복사하다
//   밴드·상한을 빠뜨린 사고가 실제로 있었다). 유형을 하나 늘릴 때 구현하는 것이
//   **어댑터 1개**가 되도록 표현을 여기로 모은다.
//
// 이 파일은 순수하다 — DB·React 를 모르고, 적재는 lib/scores/record-score.ts 가 한다.

/** 학습 자료의 종류. DB `scores.content_type` CHECK 와 1:1. */
export type ContentKind = 'book' | 'text' | 'set' | 'article' | 'comic' | 'mine'

export interface ContentRef {
  type: ContentKind
  /** 콘텐츠 uuid. `mine`(내 복습 단어 큐)은 가리킬 자료가 없어 undefined. */
  id?: string
  /** 도서 챕터 번호 — `book` 에서만 의미를 갖는다. */
  chapter?: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** DB CHECK 와 같은 규칙 — 적재 전에 여기서 걸러 제약 위반으로 세션이 죽지 않게 한다. */
export function isValidContentRef(ref: ContentRef | null | undefined): ref is ContentRef {
  if (!ref) return false
  if (ref.type === 'mine') return ref.id === undefined
  return typeof ref.id === 'string' && UUID_RE.test(ref.id)
}

/** `scores` INSERT 용 컬럼 3개. 참조가 없거나 형태가 어긋나면 전부 null(적재는 계속된다). */
export function toScoreColumns(ref: ContentRef | null | undefined): {
  content_type: string | null
  content_id: string | null
  content_chapter: number | null
} {
  if (!isValidContentRef(ref)) {
    return { content_type: null, content_id: null, content_chapter: null }
  }
  return {
    content_type: ref.type,
    content_id: ref.id ?? null,
    // 챕터는 book 에서만 의미가 있다 — 다른 유형에 실려 오면 버린다(잘못된 필터의 원인이 된다).
    content_chapter: ref.type === 'book' && typeof ref.chapter === 'number' ? ref.chapter : null,
  }
}

// ── 어댑터 ────────────────────────────────────────────────────────
//
// 각 진입 경로가 이미 갖고 있는 값에서 ContentRef 를 만든다.
// 새 콘텐츠 유형이 생기면 여기에 어댑터 하나를 더하는 것으로 끝나야 한다.

/**
 * 게임 스코프(`?set=` / `?text=` / `?chapter=`) → ContentRef.
 * 아무 스코프도 없으면 사용자의 복습 큐로 논다 → `mine`.
 * (lib/game/use-word-scope.ts 의 3단 스코프와 같은 어휘)
 */
export function contentRefFromScope(scope: {
  set?: string
  text?: string
  /** 큐레이션 도서 — enroll 없이 챕터 단어장으로 연다 */
  book?: string
  chapter?: number | null
}): ContentRef {
  // 우선순위는 좁은 것부터 — set 은 이미 한 챕터로 좁혀진 자료다.
  if (scope.set) return { type: 'set', id: scope.set }
  if (scope.text) return { type: 'text', id: scope.text }
  if (scope.book) {
    return {
      type: 'book',
      id: scope.book,
      ...(typeof scope.chapter === 'number' ? { chapter: scope.chapter } : {}),
    }
  }
  return { type: 'mine' }
}

/**
 * texts 행 → ContentRef.
 * `library_book_id` 가 있으면 그 행은 도서 챕터다 — **텍스트가 아니라 도서로 기록해야**
 * "이 도서로 얼마나 학습했나" 가 챕터를 가로질러 합쳐진다.
 */
export function contentRefFromText(row: {
  id: string
  library_book_id?: string | null
  chapter_idx?: number | null
}): ContentRef {
  if (row.library_book_id) {
    return {
      type: 'book',
      id: row.library_book_id,
      ...(typeof row.chapter_idx === 'number' ? { chapter: row.chapter_idx } : {}),
    }
  }
  return { type: 'text', id: row.id }
}

/** 도서 + 챕터 (큐레이션 경로 — enroll 없이 바로 학습하는 ScriptQuiz 챕터 퀴즈 등). */
export function contentRefFromBook(bookId: string, chapter?: number | null): ContentRef {
  return { type: 'book', id: bookId, ...(typeof chapter === 'number' ? { chapter } : {}) }
}

/** 화면 표시용 짧은 라벨 — 리포트·감사 화면이 같은 말을 쓰도록. */
export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  book: '도서',
  text: '스크립트',
  set: '단어장',
  article: '짧은 글',
  comic: '만화',
  mine: '내 단어',
}
