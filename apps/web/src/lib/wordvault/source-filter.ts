// apps/web/src/lib/wordvault/source-filter.ts
// WordVault 목록의 「출처」 필터 — 만드는 쪽(Reader 의 단어 링크)과 읽는 쪽(Browse)이 **같은 값**을 쓰게 한다.
//
// ⚠️ 2026-10-27 실측: Reader 는 단어장이 없는 챕터·개인 글에서 `?filter=<textId>`(접두어 없음)를 만들었고
//    Browse 는 `set:`·`text:`·`state:` 만 알아 그 값을 **전체 목록**으로 흘렸다 — 글 A 에서 「단어」 를 눌렀는데
//    B 의 단어까지 보이고 A 본문으로 돌아가는 링크(text: 전용)도 없었다.
//    이제 만드는 쪽은 `text:<id>` 를 쓰고, 읽는 쪽은 예전 링크(접두어 없는 uuid)를 `text:` 로 읽는다.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Reader 가 만드는 글 범위 필터 값 */
export function textSourceFilter(textId: string): string {
  return `text:${textId}`
}

/**
 * URL 의 filter 값을 정규화한다. 접두어 없는 uuid(예전 Reader 링크)는 그 글의 `text:` 범위로 읽는다 —
 * 전체 목록으로 바꿔 보여 주지 않는다. 그 밖의 값은 그대로(set:·text:·state:·all).
 */
export function normalizeSourceFilter(raw: unknown): string {
  if (typeof raw !== 'string') return 'all' // 반복 파라미터(배열) 등 — 출처를 추정하지 않는다
  const v = raw.trim()
  if (!v) return 'all'
  if (UUID.test(v)) return textSourceFilter(v)
  return v
}

/** 출처 필터(set·text)만 적용한다. 기억 상태(state:)·검색·난이도는 호출부가 따로 건다. */
export function applySourceFilter<W extends { setId?: string | null; textId?: string | null }>(
  list: readonly W[],
  filter: string,
): W[] {
  if (filter.startsWith('set:')) {
    const id = filter.slice(4)
    return list.filter((w) => w.setId === id)
  }
  if (filter.startsWith('text:')) {
    const id = filter.slice(5)
    return list.filter((w) => w.textId === id)
  }
  return [...list]
}

interface ReaderSourceCtx {
  textId?: string | null
  libraryBookId?: string | null
  chapterIdx?: number | null
  currentChapterWordSet?: { id: string } | null
}

/**
 * Reader 의 단어 출처 하나를 정한다 — 「단어」 목적지와 카드·게임 범위가 **같은 결정**을 쓴다.
 * - 도서 장: 발행 장 단어장(set) + 도서·장 문맥
 * - 기사(source_url=article:<id>, layout §4.7): 발행 기사 단어장(set) — 도서·장으로 꾸미지 않는다.
 *   기사 단어장 구독(subscribe_article_word_set)은 vocabularies.text_id 를 비워 두므로 text: 로 거르면 0 이 된다.
 * - 그 밖의 글: 그 글(text)
 */
export function readerSource(ctx: ReaderSourceCtx | null | undefined):
  | { kind: 'book-set'; setId: string; bookId: string; chapterIdx: number }
  | { kind: 'article-set'; setId: string }
  | { kind: 'text'; textId: string }
  | { kind: 'none' } {
  const set = ctx?.currentChapterWordSet
  if (set && ctx?.libraryBookId && ctx.chapterIdx != null) return { kind: 'book-set', setId: set.id, bookId: ctx.libraryBookId, chapterIdx: ctx.chapterIdx }
  if (set && !ctx?.libraryBookId) return { kind: 'article-set', setId: set.id }
  if (ctx?.textId) return { kind: 'text', textId: ctx.textId }
  return { kind: 'none' }
}

/** Reader(/text/[id]) 의 「단어」 목적지 */
export function readerWordsHref(ctx: ReaderSourceCtx | null | undefined): string {
  const src = readerSource(ctx)
  if (src.kind === 'book-set') {
    const qs = new URLSearchParams({ filter: `set:${src.setId}`, book: src.bookId, chapter: String(src.chapterIdx) })
    return `/wordvault/browse?${qs.toString()}`
  }
  if (src.kind === 'article-set') return `/wordvault/browse?filter=${encodeURIComponent(`set:${src.setId}`)}`
  if (src.kind === 'text') return `/wordvault/browse?filter=${encodeURIComponent(textSourceFilter(src.textId))}`
  return '/wordvault/browse'
}

/** 카드·게임 범위 쿼리(?set= · ?text=) — 「단어」 목적지와 같은 출처. 없으면 null(각 모듈 허브) */
export function readerScopeQuery(ctx: ReaderSourceCtx | null | undefined): string | null {
  const src = readerSource(ctx)
  if (src.kind === 'book-set' || src.kind === 'article-set') return `?set=${src.setId}`
  if (src.kind === 'text') return `?text=${encodeURIComponent(src.textId)}`
  return null
}
