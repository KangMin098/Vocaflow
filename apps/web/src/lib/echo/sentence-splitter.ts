// apps/web/src/lib/echo/sentence-splitter.ts
//
// 본문 text → sentence list. lib/dictation/text-splitter.ts 와 유사하지만
// EchoMatch 전용 — 약어 (Mr. Dr.) 처리 + 빈 문장 필터.

const ABBREVS = new Set([
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'St', 'Jr', 'Sr', 'vs', 'etc', 'e.g', 'i.e',
])

export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return []
  // 단순 sentence boundary — period/question/exclaim + whitespace + uppercase
  // 약어 보호: Mr.\sX → 분리 X
  const placeholder = ''
  let safe = text
  for (const abbr of ABBREVS) {
    safe = safe.replaceAll(`${abbr}.`, `${abbr}${placeholder}`)
  }
  // 분리
  const parts = safe
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/g)
    .map((s) => s.replaceAll(placeholder, '.').trim())
    .filter((s) => s.length >= 4)
  return parts
}
