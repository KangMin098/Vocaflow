// apps/web/src/lib/csat/browse-search.ts
//
// **서가 · 기출 찾기가 함께 쓰는 검색어 해석 — 순수.** (기출 찾기 FND1)
//
// 옛 `filterBrowse` 는 검색어 전체를 문자열 하나로 보고 「유형 이름 포함 OR 회차 이름 포함 OR 번호 같음」 으로 걸렀다.
// 그래서 `2026 34` · `2026#34` · `2026학년도 34번` · `빈칸 2026` 처럼 학습자가 실제로 치는 조합은 0건이었다.
// 이제 검색어를 **토큰으로 나눠 모든 토큰이 맞아야(AND)** 남긴다:
//   · `2026#34` · `M2606-31` 처럼 문항 id 모양이면 그 문항 하나(회차 id + 번호 정확히)
//   · 1~2자리 숫자 = 문항 번호 **정확히**(34 가 134 · 341 을 뜻하지 않는다)
//   · 4자리 학년도(2001~2099) = 그 학년도 회차 또는 회차 이름에 그 숫자가 있는 회차
//   · 회차 id 모양(`2014A` · `M2606` · `H2503G1`) = 그 회차 · 이름 일부(`a형`)도 받는다
//   · 나머지 글자 = 유형 이름 · 유형 id · 회차 이름 중 하나에 포함
// 꼬리말 `학년도` · `년` · `번` · `회` 는 떼고 읽는다. 검색어 길이는 주소 계약과 같이 40자에서 자른다(browse-url).
// 원문 · 발문 · 해설 본문은 검색하지 않는다 — 이 모듈이 받는 것은 회차 · 번호 · 유형 메타데이터뿐이다.

/** 주소 · 입력의 검색어 상한(browse-url `q` 와 같다) */
export const QUERY_MAX = 40

export type QueryToken =
  | { kind: 'item'; examId: string; no: number }
  | { kind: 'no'; no: number }
  | { kind: 'year'; year: number }
  | { kind: 'exam'; examId: string }
  | { kind: 'text'; text: string }

export interface ParsedQuery {
  /** 자른 뒤 다듬은 원문(빈 문자열이면 거르지 않는다) */
  text: string
  tokens: QueryToken[]
}

const EXAM_ID = /^(?:\d{4}[ab]?|m\d{4}|h\d{4}g[123])$/
const ITEM_ID = /^(\d{4}[ab]?|m\d{4}|h\d{4}g[123])\s*[#-]\s*(\d{1,2})$/

export function parseQuery(raw: string): ParsedQuery {
  const text = raw.slice(0, QUERY_MAX).trim().toLowerCase()
  if (!text) return { text: '', tokens: [] }
  const whole = text.match(ITEM_ID)
  if (whole) return { text, tokens: [{ kind: 'item', examId: whole[1], no: Number(whole[2]) }] }
  const tokens: QueryToken[] = []
  for (const piece of text.split(/[\s,·/|]+/)) {
    if (!piece) continue
    const id = piece.match(ITEM_ID)
    if (id) {
      tokens.push({ kind: 'item', examId: id[1], no: Number(id[2]) })
      continue
    }
    // `2026#34` 가 다른 토큰과 붙은 경우가 아니면 `#` 은 구분자다
    for (const part of piece.split('#')) {
      const t = part.replace(/(학년도|년|번|회)$/, '')
      if (!t) continue
      if (/^\d{1,2}$/.test(t)) tokens.push({ kind: 'no', no: Number(t) })
      else if (/^\d{4}$/.test(t) && Number(t) > 2000 && Number(t) < 2100) tokens.push({ kind: 'year', year: Number(t) })
      else if (EXAM_ID.test(t)) tokens.push({ kind: 'exam', examId: t })
      else tokens.push({ kind: 'text', text: t })
    }
  }
  return { text, tokens }
}

/** 한 문항이 검색어에 맞는가 — 모든 토큰이 맞아야 한다(AND) */
export function matchesQuery(
  parsed: ParsedQuery,
  item: { exam_id: string; no: number; type_id: string },
  exam: { id: string; label: string; year: number },
  typeName: string,
): boolean {
  if (parsed.tokens.length === 0) return true
  const examId = exam.id.toLowerCase()
  const label = exam.label.toLowerCase()
  const name = typeName.toLowerCase()
  const typeId = item.type_id.toLowerCase()
  return parsed.tokens.every((t) => {
    switch (t.kind) {
      case 'item':
        return examId === t.examId && item.no === t.no
      case 'no':
        return item.no === t.no
      case 'year':
        return exam.year === t.year || label.includes(String(t.year))
      case 'exam':
        return examId === t.examId
      case 'text':
        return name.includes(t.text) || typeId.includes(t.text) || label.includes(t.text) || examId === t.text
    }
  })
}
