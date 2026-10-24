// apps/web/src/lib/csat/binding/extraction.ts
// PDF → 글자 추출 결함 검출 — 원문 정정은 하지 않는다(정정은 콘텐츠 담당). 같은 결함을 자동으로 찾아
// 근거 결속이 그 자리를 「확정 원문」으로 쓰지 않게 막는 것이 목적이다.
//
// 구분하는 것: 선지에 섞인 쪽번호 · 선지에 붙은 각주 · 다음 표지까지 이어 붙은 선지 · 정의 없는 각주 표지 ·
// 각주가 빠지고 남은 조각 · 표지 누락/중복/역순. (문자 이동처럼 원본 PDF 없이는 판정할 수 없는 것은 여기서 다루지 않는다 —
// pdf.ts 의 해시 대조 범위 밖이면 「확인 불가」로 남긴다.)
import { CIRCLED, findMarkers, MARKER_TYPES, UNDERLINE_TYPES } from './markers'
import type { ExtractionDefect } from './types'

/** 각주 정의 「* term: 뜻」 「** term: 뜻」 — 뜻은 한글로 시작한다 */
const GLOSS = /(\*{1,3})\s*([A-Za-z][A-Za-z\- ’']{0,40}?)\s*[:：]\s*([가-힣][^*]*?)(?=\s*\*|\s+\d{1,2}\s*$|$)/g
/** 본문 속 각주 표지 — 낱말 바로 뒤의 * (곱셈·빈칸 기호와 구분하려고 앞 글자가 영문·닫는 괄호여야 한다) */
const MARK = /([A-Za-z)’'])(\*{1,3})(?=[\s,.;:)]|$)/g
/** 선지 끝의 쪽번호 — 각주 뒤나 문장부호 뒤의 1–2자리 숫자 */
const PAGE_TAIL = /(?:[.!?’'”"」)]|[가-힣])\s+(\d{1,2})\s*$/

export type ItemText = { typeId: string | null; passage: string; choices: string[] }

export function glossesOf(text: string): { mark: string; term: string; gloss: string; at: number }[] {
  return [...text.matchAll(GLOSS)].map((m) => ({ mark: m[1], term: m[2].trim(), gloss: m[3].trim(), at: m.index ?? 0 }))
}

/**
 * 각주 정의 용어가 표지 낱말의 것인가 — 굴절(constraints* ↔ constraint)과 구 용어(body clock ↔ clock*)를 허용한다.
 * 맞는지 모르면 false — 그 표지는 정의 없음(unavailable)으로 남는다.
 */
export function glossMatches(term: string, word: string): boolean {
  const w = word.toLowerCase().replace(/[’']s$/, '')
  if (w.length < 2) return false
  // 접두어 추정은 하지 않는다(Hours ↔ hourglass 를 짝으로 만든다 — T-0154 G2). 규칙 굴절만 허용한다
  const forms = (s: string) => {
    const out = new Set([s, `${s}s`, `${s}es`, `${s}ed`, `${s}d`, `${s}ing`, `${s}ly`])
    if (s.endsWith('y')) for (const x of ['ies', 'ied']) out.add(s.slice(0, -1) + x)
    if (s.endsWith('e')) out.add(`${s.slice(0, -1)}ing`)
    return out
  }
  return term.toLowerCase().split(/[\s-]+/).some((t) => t.length >= 2 && (forms(t).has(w) || forms(w).has(t)))
}

/** 별표가 든 공백 단위 토큰이 주소·메일인가 — 안내문은 실제 주소를 「www.wabu*.com」 처럼 가린다(각주 표지가 아니다) */
function inAddress(passage: string, at: number): boolean {
  const s = passage.lastIndexOf(' ', at) + 1
  const e = passage.indexOf(' ', at)
  const token = passage.slice(s, e < 0 ? passage.length : e)
  return /www\.|@|https?:|\.(?:com|org|net|kr|edu|gov)\b/i.test(token)
}

export function marksOf(passage: string): { mark: string; at: number; word: string }[] {
  return [...passage.matchAll(MARK)].filter((m) => !inAddress(passage, (m.index ?? 0) + m[1].length)).map((m) => {
    const at = (m.index ?? 0) + m[1].length
    const word = passage.slice(0, at).match(/([A-Za-z’'\-]+)\)?$/)?.[1] ?? ''
    return { mark: m[2], at, word }
  })
}

export function detectDefects(item: ItemText): ExtractionDefect[] {
  const out: ExtractionDefect[] = []
  const { passage, choices, typeId } = item
  if (choices.length !== 5) out.push({ code: 'choice_count', count: choices.length })

  choices.forEach((c, i) => {
    const choice = i + 1
    const page = c.match(PAGE_TAIL)
    // 숫자 선지(도표 값·연도)는 쪽번호가 아니다 — 앞에 각주나 문장이 붙은 경우만 센다
    if (page && c.length > 8 && !/^\s*[\d,.$%]+\s*$/.test(c)) out.push({ code: 'choice_page_number', choice, raw: page[1] })
    if (glossesOf(c).length) out.push({ code: 'choice_footnote_merged', choice, raw: c.slice(c.indexOf('*')).trim() })
    // 삽입 유형: 「( ① )」 표지 괄호가 선지 앞뒤에 남은 조각 — 「) War should … (」
    if (/^\s*[)）]/.test(c) || /[(（]\s*$/.test(c)) out.push({ code: 'choice_paren_residue', choice })
  })

  if (typeId && MARKER_TYPES.has(typeId)) {
    const hits = findMarkers(passage, typeId)
    for (let n = 1; n <= 5; n += 1) {
      const count = hits.filter((h) => h.choice === n).length
      if (count === 0) out.push({ code: 'marker_missing', choice: n })
      else if (count > 1) out.push({ code: 'marker_duplicate', choice: n, count })
    }
    const order = hits.map((h) => h.choice)
    if (order.some((v, i) => i > 0 && v < order[i - 1])) out.push({ code: 'marker_order', order })
    if (UNDERLINE_TYPES.has(typeId)) {
      // 밑줄 선지는 낱말·짧은 구다. 다음 표지까지 이어진 조각(40자 초과)은 추출 결함 — 밑줄 범위로 쓰지 않는다
      choices.forEach((c, i) => {
        const body = c.replace(/\s*\*.*$/, '')
        if (body.length > 40) out.push({ code: 'choice_overrun', choice: i + 1, chars: body.length })
      })
    }
  }

  // 각주 표지는 있는데 그 낱말의 정의가 지문·선지 어디에도 없다 — 별표 수가 같고 용어가 표지 낱말과 맞는 정의만 짝으로 센다
  const allGlosses = [passage, ...choices].flatMap(glossesOf)
  const inlineGloss = new Set(glossesOf(passage).map((g) => g.at))
  const marks = marksOf(passage).filter((m) => ![...inlineGloss].some((g) => m.at >= g && m.at <= g + 3))
  for (const m of marks) {
    if (!allGlosses.some((g) => g.mark === m.mark && glossMatches(g.term, m.word))) {
      out.push({ code: 'footnote_mark_without_gloss', mark: m.mark, at: m.at, context: passage.slice(Math.max(0, m.at - 20), m.at + 12).trim() })
    }
  }

  // 각주·줄이 빠지고 남은 조각 — 「p.m. month. Fees」 처럼 문장 끝 뒤에 소문자 낱말 1–3개 + 마침표만 남은 것.
  // 점 찍힌 약어(a.m. p.m. U.S. e.g.) 뒤는 문장이 이어지는 경우가 흔하다(「1:00 p.m. every day.」「U.S. born filmmaker.」)
  // — 그 뒤에서는 낱말 하나짜리만 조각으로 본다
  for (const m of passage.matchAll(/([.!?])\s+((?:[a-z]+\s){0,2}[a-z]{3,}\.)(?=\s+[A-Z(]|\s*$)/g)) {
    const at = m.index ?? 0
    const afterAbbrev = /(?:^|\s)(?:[A-Za-z]\.)+[A-Za-z]$/.test(passage.slice(Math.max(0, at - 8), at))
    if (afterAbbrev && /\s/.test(m[2])) continue
    out.push({ code: 'orphan_fragment', at: at + m[0].length - m[2].length, text: m[2] })
  }
  return out
}

/** 결함 코드 중 「원문 근거가 사라졌다」를 뜻하는 것 — 차단 이유 footnote_missing 으로 올린다 */
export function hasMissingFootnote(defects: ExtractionDefect[]): boolean {
  return defects.some((d) => d.code === 'footnote_mark_without_gloss')
}

export { CIRCLED }
