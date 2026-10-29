// apps/web/src/lib/csat/binding/markers.ts
// 지문 속 ①–⑤ 표지 — 어법·어휘·지칭·삽입·무관문장·도표처럼 선지가 지문 안에 박힌 유형의 결속 기반.
//
// 평문에는 밑줄의 끝이 없다. 그래서 어법·어휘의 근거 범위는 「표지 위치 + 뒤 첫 낱말」(precision marker)까지만
// 확정한다. 추출본 선지가 다음 표지까지 이어 붙은 긴 조각이어도(choice_overrun) 그 조각을 밑줄 범위로 쓰지 않는다.
import type { BindingBasis, MarkerAnchor } from './types'

export const CIRCLED = ['①', '②', '③', '④', '⑤'] as const
export const LETTERED = ['(a)', '(b)', '(c)', '(d)', '(e)'] as const

/** 선지가 지문 속 표지로 존재하는 유형 */
export const MARKER_TYPES = new Set(['R-GRAMMAR', 'R-VOCAB', 'X-VOCAB', 'R-REFER', 'X-REFER', 'R-INSERT', 'R-IRRELEVANT', 'R-CHART'])
/** 밑줄 친 낱말·구가 근거인 유형 — 표지 뒤 첫 낱말이 판단 대상이다 */
export const UNDERLINE_TYPES = new Set(['R-GRAMMAR', 'R-VOCAB', 'X-VOCAB', 'R-REFER', 'X-REFER'])
/** 장문 세트(41–45)는 ①–⑤ 가 아니라 (a)–(e) 로 표지한다 */
export const LETTERED_TYPES = new Set(['X-VOCAB', 'X-REFER'])

export type MarkerHit = { choice: number; at: number; len: number }

/** 지문의 표지 위치. 같은 번호가 두 번 나오면 모두 돌려준다(중복은 검사기가 결함으로 센다) */
export function findMarkers(passage: string, typeId?: string | null): MarkerHit[] {
  const hits: MarkerHit[] = []
  if (typeId && LETTERED_TYPES.has(typeId)) {
    for (const m of passage.matchAll(/\(([a-e])\)/g)) hits.push({ choice: m[1].charCodeAt(0) - 96, at: m.index ?? 0, len: 3 })
    return hits
  }
  for (let i = 0; i < passage.length; i += 1) {
    const k = CIRCLED.indexOf(passage[i] as (typeof CIRCLED)[number])
    if (k >= 0) hits.push({ choice: k + 1, at: i, len: 1 })
  }
  return hits
}

/** 표지 글자 — 무효화 검사가 오프셋의 글자를 대조할 때 쓴다 */
export function markerText(choice: number, typeId?: string | null): string {
  return typeId && LETTERED_TYPES.has(typeId) ? LETTERED[choice - 1] : CIRCLED[choice - 1]
}

/** 표지 뒤 첫 낱말들 — 밑줄 시작. 삽입 유형의 「( ① )」처럼 뒤가 괄호면 빈 문자열 */
export function headAfter(passage: string, at: number, words = 2, len = 1): string {
  const rest = passage.slice(at + len).replace(/^\s+/, '')
  if (/^[)）]/.test(rest)) return ''
  const m = rest.match(new RegExp(`^(?:[^\\s①②③④⑤]+\\s*){1,${words}}`))
  return (m?.[0] ?? '').trim().replace(/[,.;:]+$/, '')
}

/**
 * 표지 앵커 — 각 번호가 정확히 한 번 나올 때만 만든다. 없거나 겹치면 그 번호는 빠지고
 * 검사기(extraction)가 marker_missing · marker_duplicate 로 보고한다.
 */
export function markerAnchors(passage: string, basis: BindingBasis, typeId?: string | null): MarkerAnchor[] {
  const hits = findMarkers(passage, typeId)
  const out: MarkerAnchor[] = []
  for (let n = 1; n <= 5; n += 1) {
    const mine = hits.filter((h) => h.choice === n)
    if (mine.length !== 1) continue
    out.push({ kind: 'marker', basis, precision: 'marker', choice: n, at: mine[0].at, head: headAfter(passage, mine[0].at, 2, mine[0].len), mark: markerText(n, typeId) })
  }
  return out
}

/** 표지 앵커가 걸친 근거 단위 번호 — 단위 오프셋이 있을 때만 */
export function unitOfOffset(units: { n: number; start?: number; end?: number }[], at: number): number | null {
  const u = units.find((x) => typeof x.start === 'number' && typeof x.end === 'number' && at >= x.start && at < x.end)
  return u ? u.n : null
}
