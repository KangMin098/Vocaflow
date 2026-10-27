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
export function parseChapterParam(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  if (typeof raw !== 'string') return null // ?chapter=1&chapter=2 → 배열: 하나를 고르지 않는다
  if (!INT.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : null
}

/**
 * 안내할 현재 장 번호, 또는 null(안내 없음).
 * 안내는 **보이는 단어가 이 도서의 그 장 세트일 때만** 만든다: filter 가 `set:<id>` 이고 그 세트가 이 도서의 장 세트이며,
 * chapter 가 주어졌으면 그 세트의 장과 같아야 한다. 세트가 아닌 필터(text:·state:·all·없음)는 목록이 그 장의 단어가
 * 아니므로 안내하지 않는다 — 현재 링크를 만드는 곳(Reader·허브·장 이동)은 모두 set: 를 싣는다(2026-10-27 grep).
 */
export function resolveBookChapter(
  filter: unknown,
  chapterParam: unknown,
  chapters: readonly ChapterSet[],
): number | null {
  const ch = parseChapterParam(chapterParam)
  if (ch === null) return null
  if (typeof filter !== 'string' || !filter.startsWith('set:')) return null // 반복 파라미터(배열)도 안내 없음
  const f = filter
  const set = chapters.find((c) => c.id === f.slice(4))
  if (!set) return null
  if (ch !== undefined && ch !== set.chapterIdx) return null
  return set.chapterIdx
}
