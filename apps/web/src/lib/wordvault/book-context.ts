// apps/web/src/lib/wordvault/book-context.ts
// WordVault 목록 머리의 「도서 › N장」 안내와 본문 복귀가 **실제로 보이는 단어의 출처**와 같은지 정한다.
//
// ⚠️ 2026-10-27: browse 페이지는 `book`·`chapter` 파라미터만으로 안내를 만들고 `filter=set:<id>` 가 그 도서·장의
//    세트인지 보지 않았다 — set B 의 단어를 보이면서 도서 A 1장과 그 본문으로 안내할 수 있었다. `chapter=1junk` 는
//    parseInt 로 1 이 됐다. 확인할 수 없으면 안내를 만들지 않는다(다른 장을 그 장인 것처럼 말하지 않는다).

const INT = /^(0|[1-9][0-9]*)$/

export interface ChapterSet {
  id: string
  chapterIdx: number
}

/** 장 번호 — 원문 전체가 0 이상 안전 정수일 때만. 없으면 undefined, 형식이 틀리면 null. */
export function parseChapterParam(raw: string | null | undefined): number | null | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  if (!INT.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : null
}

/**
 * 안내할 현재 장 번호, 또는 null(안내 없음).
 * - filter 가 `set:<id>` 이면 그 세트가 이 도서의 장 세트여야 하고, chapter 가 주어졌으면 그 세트의 장과 같아야 한다.
 * - filter 가 세트가 아니면(도서만 진입) chapter 가 주어졌으면 그 번호, 없으면 첫 장(기존 동작). 형식이 틀리면 null.
 */
export function resolveBookChapter(
  filter: string | null | undefined,
  chapterParam: string | null | undefined,
  chapters: readonly ChapterSet[],
): number | null {
  const ch = parseChapterParam(chapterParam)
  if (ch === null) return null
  const f = filter ?? ''
  if (f.startsWith('set:')) {
    const set = chapters.find((c) => c.id === f.slice(4))
    if (!set) return null
    if (ch !== undefined && ch !== set.chapterIdx) return null
    return set.chapterIdx
  }
  if (ch !== undefined) return ch
  return chapters[0]?.chapterIdx ?? 0
}
