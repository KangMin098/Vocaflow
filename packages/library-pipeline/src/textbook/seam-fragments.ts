// packages/library-pipeline/src/textbook/seam-fragments.ts
//
// 이음매 해설이 인용하는 문장 조각 — 해설을 쓰는 쪽(explain-seam)과 해설 번호를 화면 자리에 대 보는 쪽
// (insert-coordinates)이 **같은 함수**를 써야 대조가 성립한다. 의존이 없어 학습 화면(client)에서도 가볍게 읽힌다.

/** ①~⑤ — 수능 답지 번호. */
export const CIRCLED = ['①', '②', '③', '④', '⑤'] as const

/** 문장 끝 조각 — 이음매의 왼쪽. 너무 길면 뒤에서 자른다. */
export function tail(sentence: string, limit = 60): string {
  const s = sentence.replace(/\s+/g, ' ').trim()
  if (s.length <= limit) return s
  const cut = s.slice(s.length - limit)
  const sp = cut.indexOf(' ')
  return `…${sp > 0 ? cut.slice(sp + 1) : cut}`
}

/** 문장 앞 조각 — 이음매의 오른쪽. */
export function head(sentence: string, limit = 60): string {
  const s = sentence.replace(/\s+/g, ' ').trim()
  if (s.length <= limit) return s
  const cut = s.slice(0, limit)
  const sp = cut.lastIndexOf(' ')
  return `${sp > 0 ? cut.slice(0, sp) : cut}…`
}
