// apps/web/src/lib/csat/f08-proto/leak.ts
//
// 공개 전 묶음이 정답을 흘리는지 검사한다. 정답 번호를 말하는 문구와 정답 선지의 연속 세 낱말을 찾는다.
// 2026-34 분석 v5 의 m1 노트가 「(예: understood as a restraint on their freedom)」로 정답 선지를 그대로
// 담고 있었다 — 데이터가 그렇게 생겼으니 화면 조립이 아니라 이 검사가 막는다.

const NUMBER_WORDS = ['일', '이', '삼', '사', '오']

export function answerLeaks(text: string, answer: number, answerChoice: string): string[] {
  const found: string[] = []
  const lower = text.toLowerCase()
  const words = answerChoice.toLowerCase().split(/\s+/).filter(Boolean)
  for (let i = 0; i + 3 <= words.length; i++) {
    const gram = words.slice(i, i + 3).join(' ')
    if (lower.includes(gram)) found.push(`정답 선지 구절 「${gram}」`)
  }
  const spoken = NUMBER_WORDS[answer - 1]
  const patterns = [new RegExp(`정답[^.]{0,6}(${answer}|${spoken})\\s*번`), new RegExp(`(${answer}|${spoken})\\s*번[이은]?\\s*(정답|맞)`)]
  for (const p of patterns) if (p.test(text)) found.push(`정답 번호 문구 ${p.source}`)
  return found
}
