// apps/web/src/lib/csat/quote-display.ts
// 학습자 로더와 읽기 전용 감사가 함께 쓰는 표시 상한. 서버 모듈을 가져오지 않는다.
/**
 * 근거 인용의 상한 — 낱말 수. 원문 전체 대신 근거 위치를 가리키는 짧은 발췌만 내보낸다.
 * 기존 40단어 상한을 유지하며, 지도는 별도로 구운 골격을 쓰므로 그 좌표를 바꾸지 않는다.
 */
export const QUOTE_WORD_CAP = 40

/** 표시 상한으로 자른 인용에는 말줄임을 붙여 온전한 문장처럼 보이지 않게 한다. */
export function capQuoteWords(quote: string | null, cap = QUOTE_WORD_CAP): string | null {
  const text = (quote ?? '').trim()
  if (!text) return null
  const words = text.split(/\s+/)
  if (words.length <= cap) return text
  return `${words.slice(0, cap).join(' ')} …`
}
