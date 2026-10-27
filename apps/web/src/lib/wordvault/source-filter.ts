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

/** Reader(/text/[id]) 의 「단어」 목적지 — 발행 챕터 단어장이면 set:, 아니면 그 글의 text:, 맥락 없으면 전체. */
export function readerWordsHref(ctx: {
  textId?: string | null
  libraryBookId?: string | null
  chapterIdx?: number | null
  currentChapterWordSet?: { id: string } | null
} | null | undefined): string {
  if (ctx?.currentChapterWordSet && ctx.libraryBookId && ctx.chapterIdx != null) {
    const qs = new URLSearchParams({
      filter: `set:${ctx.currentChapterWordSet.id}`,
      book: ctx.libraryBookId,
      chapter: String(ctx.chapterIdx),
    })
    return `/wordvault/browse?${qs.toString()}`
  }
  if (ctx?.textId) return `/wordvault/browse?filter=${encodeURIComponent(textSourceFilter(ctx.textId))}`
  return '/wordvault/browse'
}
