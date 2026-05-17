// packages/library-pipeline/src/segment/regex-segmenter.ts
// 1차 분할: 정규식 기반 chapter 감지

const CHAPTER_PATTERNS: RegExp[] = [
  /^\s*(?:CHAPTER|Chapter|CH\.|Ch\.)\s+([IVXLC\d]+)\.?[ \t]*(.*)$/m,
  /^\s*(?:PART|Part)\s+([IVXLC\d]+)\.?[ \t]*(.*)$/m,
  /^\s*(?:BOOK|Book)\s+([IVXLC\d]+)\.?[ \t]*(.*)$/m,
  // ALLCAPS title 패턴 (1661 Sherlock Holmes 같이 'I. A SCANDAL IN BOHEMIA' 형식)
  /^([IVXLC]+)\.\s+([A-Z][A-Z\s'’\-]{4,})$/m,
]

export interface RegexBoundary {
  charOffset: number
  match: string
  title?: string
}

/**
 * 본문에서 chapter 시작 지점 모두 찾기.
 * 첫 boundary 이전 영역은 front-matter (목차/서문) 로 간주.
 */
export function findChapterBoundaries(body: string): RegexBoundary[] {
  const boundaries: RegexBoundary[] = []

  for (const pattern of CHAPTER_PATTERNS) {
    const re = new RegExp(pattern.source, 'gm')
    let m: RegExpExecArray | null
    while ((m = re.exec(body)) !== null) {
      boundaries.push({
        charOffset: m.index,
        match: m[0],
        ...(m[2]?.trim() && { title: m[2].trim() }),
      })
    }
    if (boundaries.length > 0) break //   가장 잘 맞는 패턴 1개만 사용
  }

  // charOffset 정렬 + 중복 제거 (200자 이내 인접 boundary 는 dedup)
  boundaries.sort((a, b) => a.charOffset - b.charOffset)
  return boundaries.filter(
    (b, i) => i === 0 || b.charOffset - boundaries[i - 1]!.charOffset > 200,
  )
}
