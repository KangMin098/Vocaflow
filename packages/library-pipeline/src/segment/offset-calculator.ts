// packages/library-pipeline/src/segment/offset-calculator.ts
// chapter 본문에서 paragraph + sentence offset 사전 계산

const ABBREVIATIONS: ReadonlySet<string> = new Set([
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr',
  'St', 'Mt', 'Ave', 'Rd',
  'Inc', 'Co', 'Ltd', 'Corp',
  'eg', 'ie', 'etc', 'vs', 'cf',
  'pm', 'am',
])

/**
 * paragraph 시작 char offset 계산.
 * 빈 줄 1+ 이후를 paragraph 경계로 간주.
 */
export function computeParagraphOffsets(content: string): number[] {
  const offsets: number[] = [0]
  const re = /\n\s*\n+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    offsets.push(m.index + m[0].length)
  }
  return offsets
}

/**
 * sentence 시작 char offset 계산.
 * winkNLP 미포함 — 간단한 정규식. 정확도 부족 시 winkNLP 도입.
 * 약어 처리 (Mr./Dr./e.g./i.e./etc./vs./p.m./a.m.) 포함.
 */
export function computeSentenceOffsets(content: string): number[] {
  const offsets: number[] = [0]
  const re = /([.!?])\s+(?=[A-Z"'])/g
  let m: RegExpExecArray | null

  while ((m = re.exec(content)) !== null) {
    // 직전 단어가 약어인지 확인
    const before = content.slice(Math.max(0, m.index - 10), m.index)
    const lastWord =
      before.split(/\s+/).pop()?.replace(/[^a-zA-Z]/g, '') ?? ''
    if (ABBREVIATIONS.has(lastWord)) continue

    offsets.push(m.index + m[0].length)
  }

  return offsets
}

/**
 * chapter 본문 단어 수 (winkNLP 무관 빠른 카운트)
 */
export function countWords(content: string): number {
  const matches = content.match(/\b[a-zA-Z][a-zA-Z'-]*\b/g)
  return matches?.length ?? 0
}
