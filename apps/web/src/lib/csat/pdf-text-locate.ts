// apps/web/src/lib/csat/pdf-text-locate.ts
//
// **인용문을 학습자의 PDF «그 자리» 에 칠하기 위한 좌표 계산.**
//
// ── 왜 필요한가 ───────────────────────────────────────────────────────
// `/csat/overlay` 는 학습자가 떨어뜨린 평가원 문제지를 브라우저에서 렌더하고 그 위에 상자를
// 얹는다. 그런데 지금 얹는 상자는 **문항 번호와 선지 기호뿐**이고, 정작 「정답 근거가 되는
// 문장」은 옆 패널에 **글자로 따로** 뜬다. 학습자는 그 문장을 종이에서 눈으로 찾아야 한다.
// 그건 이 기능이 없애려던 바로 그 일이다.
//
// 근거 문장의 좌표는 우리에게 없다(있을 수도 없다 — 문제지는 우리 것이 아니다). 대신
// **학습자의 브라우저에는 있다**: PDF.js `getTextContent()` 가 글자 조각마다 변환행렬을 준다.
// 그러므로 인용문(우리 저작물)을 보내면 **그 자리를 브라우저가 스스로 찾는다.**
// 서버로 가는 것은 여전히 SHA-256 64자뿐이고, 원본은 우리 쪽에 복제되지 않는다.
//
// ── 여기가 순수 함수인 이유 ───────────────────────────────────────────
// 좌표 계산을 클라이언트 컴포넌트 안에 두면 검사할 길이 없다(이 저장소는 컴포넌트를
// `renderToString` 으로만 본다). 그리고 이 계산이 틀리면 **엉뚱한 자리가 칠해지는데
// 화면은 멀쩡히 돈다** — 이 파일군이 되풀이해 겪은 실패 모드다.
//
// ⚠️ `server-only` 를 들이지 않는다 — 브라우저가 부른다.

import { findQuote, normalizeForMatch } from './quote-match'

/** PDF.js `getTextContent().items` 의 한 조각 중 우리가 쓰는 것만. */
export interface PdfTextItem {
  str: string
  /** [a, b, c, d, e, f] — `e`·`f` 가 조각의 왼아래 좌표(PDF 좌표계). */
  transform: number[]
  width: number
  height: number
  /** 이 조각 뒤에 줄바꿈이 있는가. PDF.js 가 준다. */
  hasEOL?: boolean
}

/** 칠할 상자 — PDF 좌표계(왼아래 원점 · 1/72 인치). 그리는 쪽이 배율을 정한다. */
export interface HighlightBox {
  x: number
  y: number
  w: number
  h: number
}

/** 이어 붙인 텍스트 + 글자마다의 출처 조각 번호. */
export interface JoinedText {
  text: string
  /** `text[i]` 가 온 조각 번호. 조각 사이에 끼운 공백은 **앞 조각**의 것으로 친다. */
  owner: number[]
  /** 조각 k 가 `text` 에서 차지하는 구간 [start, end). */
  spans: { start: number; end: number }[]
}

/**
 * 조각들을 한 문자열로 잇는다.
 *
 * PDF 는 한 문장을 여러 조각으로 쪼개 내놓고, **조각 사이에 공백이 있을 수도 없을 수도 있다.**
 * 그래서 조각이 공백으로 끝나지 않고 다음 조각이 공백으로 시작하지 않으면 한 칸을 끼운다.
 * 줄바꿈(`hasEOL`)도 한 칸으로 만든다 — `quote-match` 가 공백을 접으므로 이 정도면 충분하다.
 */
export function joinTextItems(items: PdfTextItem[]): JoinedText {
  let text = ''
  const owner: number[] = []
  const spans: { start: number; end: number }[] = []

  for (let k = 0; k < items.length; k += 1) {
    const s = items[k].str ?? ''
    const start = text.length
    text += s
    for (let i = 0; i < s.length; i += 1) owner.push(k)
    spans.push({ start, end: text.length })

    const next = items[k + 1]
    if (!next) continue
    const needsGap =
      items[k].hasEOL === true || (!/\s$/.test(s) && !/^\s/.test(next.str ?? '') && s.length > 0)
    if (needsGap) {
      text += ' '
      owner.push(k) // 끼운 공백은 앞 조각의 것 — 상자를 만들 때 이 칸은 무시된다
    }
  }

  return { text, owner, spans }
}

/** 조각 하나의 일부를 덮는 상자. `from`·`to` 는 조각 안의 글자 위치. */
function boxOf(item: PdfTextItem, from: number, to: number): HighlightBox | null {
  const len = (item.str ?? '').length
  if (len === 0 || to <= from) return null
  const x = item.transform[4]
  const y = item.transform[5]
  // 글자 폭이 고르다고 본다 — PDF.js 는 글자별 폭을 주지 않는다. 강조 상자로는 충분하고,
  // **틀려도 같은 줄 안에서만 틀린다**(엉뚱한 문장을 칠하지 않는다).
  const per = item.width / len
  const h = item.height || Math.abs(item.transform[3]) || 10
  return { x: x + per * from, y, w: per * (to - from), h }
}

/**
 * 인용문을 조각들 속에서 찾아 **덮는 상자들**을 만든다. 못 찾으면 빈 배열.
 *
 * **못 찾으면 빈 배열이지 «첫 줄» 이 아니다** — 틀린 자리를 자신 있게 칠하는 것이
 * 아무것도 안 칠하는 것보다 나쁘다(`quote-match` 와 같은 판단).
 *
 * 한 줄에 걸친 조각들은 각각 상자가 된다. 합치지 않는 이유는 PDF 가 줄을 바꿔도 같은
 * 조각 배열에 이어 담기 때문이다 — 합치면 줄 사이 빈 곳까지 칠해진다.
 */
export function locateQuote(items: PdfTextItem[], quote: string): HighlightBox[] {
  if (!items.length || !quote) return []
  const joined = joinTextItems(items)
  const hit = findQuote(joined.text, quote)
  if (!hit) return []

  const boxes: HighlightBox[] = []
  for (let k = 0; k < items.length; k += 1) {
    const span = joined.spans[k]
    const from = Math.max(hit.start, span.start)
    const to = Math.min(hit.end, span.end)
    if (from >= to) continue
    const b = boxOf(items[k], from - span.start, to - span.start)
    if (b) boxes.push(b)
  }
  return boxes
}

/**
 * 한 페이지에서 인용문 여럿의 자리를 한 번에 찾는다.
 *
 * **못 찾은 것을 빼지 않는다** — 입력 순서대로 빈 배열을 남긴다. 빼면 부르는 쪽이
 * n번째 인용과 n번째 결과를 잘못 짝짓는다(`findQuotes` 와 같은 이유).
 */
export function locateQuotes(items: PdfTextItem[], quotes: string[]): HighlightBox[][] {
  if (!items.length) return quotes.map(() => [])
  return quotes.map((q) => locateQuote(items, q))
}

/**
 * 인용문이 이 페이지에 있는가 — **페이지를 고르는 데** 쓴다.
 *
 * 문제지는 여러 쪽이고 학습자가 보는 쪽에 그 문항이 없을 수 있다. 상자를 만들기 전에
 * 값싸게 걸러낸다(정규화 비교 한 번).
 */
export function pageHasQuote(items: PdfTextItem[], quote: string): boolean {
  if (!items.length || !quote) return false
  const t = normalizeForMatch(joinTextItems(items).text).text
  return t.includes(normalizeForMatch(quote).text)
}
