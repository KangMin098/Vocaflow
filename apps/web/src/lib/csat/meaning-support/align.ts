// apps/web/src/lib/csat/meaning-support/align.ts
//
// **v3.1 원문 대조 — 학습자 기기의 문제지 추출본 ↔ 빌드가 만든 대조 자료(글자 지문 · 오프셋).** (PR #238 보강 3)
//
// 서버는 원문을 보내지 않는다. 기기에서 연 문제지(ItemPaper)의 지문을 받아
//   - 문장마다 글자 지문이 맞는지 본다 → 같은 문장 수 · 같은 길이라도 글자가 다르면 'mismatch'(강조 금지 · 대응 불가 설명)
//   - 앵커가 가리키는 구절의 **실제 위치(원문 문자열 범위)** 를 찾는다 → 문제지 위 표시 · 영어 구절 보이기(기기 원문에서만)
// 규칙은 scripts/csat/lib-meaning-support.mjs 의 lettersOnly · textHash 와 같다(동치 회귀 __tests__/align.test.ts).

export interface MsAlignment {
  v: number
  sentences: { n: number; chars: number; len: number; h: string }[]
  spans: Record<string, { n: number; s: number; e: number; h: string }>
}

/** 지문 상태 — ItemPaper 가 알려 준다 */
export type PaperStatus = 'loading' | 'missing' | 'unreadable' | 'ready'

export type TextAlign =
  | { state: 'pending' } // 문제지를 여는 중
  | { state: 'no_source'; why: 'missing' | 'unreadable' } // 원문 없음 — 문장 길이로만 대응
  | { state: 'mismatch'; sentence: number | null; why: 'sentence' | 'span' } // 원문이 다르다 — 강조 금지
  | { state: 'ok'; spans: Record<string, { start: number; end: number }>; sentences: Record<number, { start: number; end: number }> }

/** NFKC → 소문자 → [a-z0-9] 만. map[i] = 원문 문자열에서의 위치(UTF-16) */
export function lettersWithMap(t: string): { s: string; map: number[] } {
  let s = ''
  const map: number[] = []
  // 원문 위치를 지키려고 글자 단위로 정규화한다(NFKC 가 한 글자를 여러 글자로 펴도 같은 위치를 가리킨다)
  for (let i = 0; i < t.length; ) {
    const cp = t.codePointAt(i)!
    const w = cp > 0xffff ? 2 : 1
    for (const ch of String.fromCodePoint(cp).normalize('NFKC').toLowerCase()) {
      if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) { s += ch; map.push(i) }
    }
    i += w
  }
  return { s, map }
}
export const lettersOnly = (t: string) => lettersWithMap(t).s

/** cyrb53 14 hex — 동일성 지문(보안 용도 아님) */
export function textHash(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

/** 문장 사이 글자 건너뛰기 한도 — 추출본의 단락 표지 (A) · [B] 같은 것만. 넘으면 다른 원문으로 본다 */
const MAX_SKIP = 8
/**
 * 건너뛴 글자가 **단락 표지뿐인가** — 괄호로 싼 1~2글자((A) · [B] · (1))와 기호 · 공백만 허용한다.
 * 문장 앞에 낱말이 끼어든 원문(예: "No rules …")은 표지가 아니므로 대조가 실패한다(Codex P2 · 2026-10-13).
 */
const LABEL_GAP = /^[^A-Za-z0-9]*(?:[([]\s*[A-Za-z0-9]{1,2}\s*[)\]][^A-Za-z0-9]*)*$/
const gapIsLabel = (raw: string) => LABEL_GAP.test(raw)

/** 기기 지문과 대조. 문장 하나 · 구절 하나라도 지문이 다르면 mismatch(부분 강조도 하지 않는다) */
export function alignPassage(a: MsAlignment | null | undefined, status: PaperStatus, passage: string | null): TextAlign {
  if (status === 'loading') return { state: 'pending' }
  if (status !== 'ready' || !passage) return { state: 'no_source', why: status === 'unreadable' ? 'unreadable' : 'missing' }
  if (!a) return { state: 'mismatch', sentence: null, why: 'sentence' }
  const { s: L, map } = lettersWithMap(passage)
  const starts: Record<number, number> = {}
  const sentences: Record<number, { start: number; end: number }> = {}
  let cur = 0
  // 원문 위치 — 앞 문장 끝 다음 글자부터(처음은 0)
  const rawAfter = (li: number) => (li === 0 ? 0 : map[li - 1] + 1)
  for (const sen of a.sentences) {
    let at = -1
    for (let k = 0; k <= MAX_SKIP && cur + k + sen.len <= L.length; k++) {
      if (textHash(L.slice(cur + k, cur + k + sen.len)) !== sen.h) continue
      // 건너뛴 글자가 있으면 그 원문 구간이 단락 표지뿐이어야 한다
      if (k > 0 && !gapIsLabel(passage.slice(rawAfter(cur), map[cur + k]))) continue
      at = cur + k
      break
    }
    if (at < 0) return { state: 'mismatch', sentence: sen.n, why: 'sentence' }
    starts[sen.n] = at
    sentences[sen.n] = { start: map[at], end: map[at + sen.len - 1] + 1 }
    cur = at + sen.len
  }
  // 끝 — 마지막 문장 뒤에 낱말이 더 붙은 원문도 다른 원문이다(표지 · 기호만 허용)
  if (cur < L.length && !gapIsLabel(passage.slice(rawAfter(cur)))) {
    return { state: 'mismatch', sentence: a.sentences[a.sentences.length - 1]?.n ?? null, why: 'sentence' }
  }
  const spans: Record<string, { start: number; end: number }> = {}
  for (const [id, sp] of Object.entries(a.spans)) {
    const base = starts[sp.n]
    if (base == null || textHash(L.slice(base + sp.s, base + sp.e)) !== sp.h) return { state: 'mismatch', sentence: sp.n, why: 'span' }
    spans[id] = { start: map[base + sp.s], end: map[base + sp.e - 1] + 1 }
  }
  return { state: 'ok', spans, sentences }
}

/** 서버 측 분할 검사 — 지도 골격(문장 수 · 문장 길이)이 작성 때 원문과 같은가. 다르면 지도 강조 · 문장 선택을 끈다 */
export function splitMatches(a: MsAlignment | null | undefined, skeletonChars: readonly number[] | null): boolean {
  if (!a || !skeletonChars) return false
  if (a.sentences.length !== skeletonChars.length) return false
  return a.sentences.every((s, i) => s.chars === skeletonChars[i])
}
