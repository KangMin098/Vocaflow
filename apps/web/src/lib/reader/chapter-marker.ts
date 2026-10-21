// apps/web/src/lib/reader/chapter-marker.ts
//
// 장 본문 첫 문단에 남은 **장 표식 줄**을 표시 단계에서만 알아본다(2026-10-19 · docs/content-defects/2026-10-19-chapter-marker-in-body.md).
//
// 형식(SE 수집 → `packages/library-pipeline/src/segment/segment.ts`):
//   `CHAPTER <번호>. <제목>[<US><묶음>]<RS><원문 장 URL>`   (US = U+001F · RS = U+001E)
// 2026-10-19 DB 조회: 첫 줄에 RS 가 있는 장 10,694개 **전부** 이 형식이고, 전부 독립된 첫 문단이며,
// 끝의 URL 은 전부 `library_chapters_master.source_href` 와 같다. RS 없이 `CHAPTER …` 로 시작하는 정상 제목 줄 202개는
// 이 판정에 걸리지 않는다 — **RS 가 필수**다.
//
// 원본 본문 · DB 는 바꾸지 않는다. 문단 번호(이어읽기 `current_paragraph_idx`)를 지키려고 표식 문단은 목록에 남기고
// 문장만 비운다(호출부 `buildParagraphsFromContent`). 출처 URL 은 장 머리의 출처 링크로 보인다.

const US = String.fromCharCode(0x1f)
const RS = String.fromCharCode(0x1e)

export interface ChapterMarker {
  /** 표식의 장 번호 표기(「1」「IV」 등) */
  number: string
  /** 장 제목 */
  title: string
  /** 묶음(Part/Book 등) — US 뒤 필드, 없을 수 있다 */
  group?: string
  /** 원문 장 URL — 출처 링크 */
  sourceHref: string
}

// 한 줄 전체가 표식이어야 한다(앞뒤에 다른 글자 없음). URL 은 공백 없는 http(s).
const MARKER_RE = new RegExp(`^CHAPTER ([0-9IVXLC]+)\\.? (.+?)${RS}(https?:\\/\\/\\S+)$`)

/**
 * 덩어리(문장 · 문단)의 **첫 줄**이 장 표식이면 그 줄을 뗀 나머지와 표식을 돌려준다(표식이 아니면 그대로).
 * 문장 오프셋으로 자른 첫 문장이 표식 + 본문 첫 문장으로 한 덩어리일 수 있어서 쓴다(Echo).
 */
export function stripLeadingChapterMarker(text: string): { text: string; marker: ChapterMarker | null } {
  const trimmed = text.replace(/^\s+/, '')
  const nl = trimmed.indexOf('\n')
  const firstLine = nl >= 0 ? trimmed.slice(0, nl) : trimmed
  const marker = parseChapterMarker(firstLine)
  if (!marker) return { text, marker: null }
  return { text: nl >= 0 ? trimmed.slice(nl + 1).replace(/^\s+/, '') : '', marker }
}

/** 문단 텍스트가 장 표식 한 줄이면 그 내용을, 아니면 null. 정상 본문 첫 줄을 숨기지 않도록 형식이 정확할 때만. */
export function parseChapterMarker(paragraph: string): ChapterMarker | null {
  const text = paragraph.replace(/^\s+|\s+$/g, '')
  if (!text.includes(RS) || text.includes('\n')) return null
  const m = MARKER_RE.exec(text)
  if (!m) return null
  const [, number, titleAndGroup, sourceHref] = m
  if (!number || !titleAndGroup || !sourceHref) return null
  // 제목 · 묶음 안에 RS 가 또 있으면 형식이 아니다
  if (titleAndGroup.includes(RS)) return null
  const [title, group] = titleAndGroup.split(US)
  if (!title || !title.trim()) return null
  return { number, title: title.trim(), group: group?.trim() || undefined, sourceHref }
}
