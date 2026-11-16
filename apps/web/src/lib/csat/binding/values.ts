// apps/web/src/lib/csat/binding/values.ts
// 도표·안내문·실용문의 수치·단위·조건 읽기 전용 어댑터.
//
// 도표 문항의 막대 값은 그림에만 있다. 원문 글자(passage)에 없는 값을 분석이 단정하면 그 값은
// 「원문 근거 없음(imageOnly)」으로 표시하고 근거로 내보내지 않는다 — 현재 도표 이미지가 입력 해시에 묶인
// 검수 자산(csat_review_visual_heads)이 있어도, 값 자체를 판독한 구조화 자료가 없으면 마찬가지다.
import type { BindingBasis, ConditionAnchor, ConditionCue, ValueAnchor, ValueUnit } from './types'

const WORD_NUM: Record<string, number> = {
  half: 0.5, twice: 2, double: 2, triple: 3, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`
const WORDS = Object.keys(WORD_NUM).join('|')

type Raw = { value: number; unit: ValueUnit; raw: string; start: number; end: number }

const toNum = (s: string) => Number(s.replace(/,/g, ''))

/** 글 속 수치 — 단위까지 읽는다. 순서가 중요하다(더 긴 꼴을 먼저) */
export function readValues(text: string): Raw[] {
  const out: Raw[] = []
  const taken: [number, number][] = []
  const push = (m: RegExpMatchArray, value: number, unit: ValueUnit) => {
    const start = m.index ?? 0
    const end = start + m[0].length
    if (taken.some(([a, b]) => start < b && end > a)) return
    taken.push([start, end])
    out.push({ value, unit, raw: m[0], start, end })
  }
  const rules: [RegExp, (m: RegExpMatchArray) => [number, ValueUnit]][] = [
    [new RegExp(String.raw`(${NUM}|${WORDS})\s*percentage points?`, 'gi'), (m) => [WORD_NUM[m[1].toLowerCase()] ?? toNum(m[1]), 'percentage_point']],
    [new RegExp(String.raw`(${NUM}|${WORDS})[-\s]?(?:%|percent\b)`, 'gi'), (m) => [WORD_NUM[m[1].toLowerCase()] ?? toNum(m[1]), 'percent']],
    [new RegExp(String.raw`\b(twice|double|triple|half)\b`, 'gi'), (m) => [WORD_NUM[m[1].toLowerCase()], 'times']],
    [new RegExp(String.raw`(${NUM}|${WORDS})\s*times\b`, 'gi'), (m) => [WORD_NUM[m[1].toLowerCase()] ?? toNum(m[1]), 'times']],
    [new RegExp(String.raw`[$€£₩]\s?(${NUM})`, 'g'), (m) => [toNum(m[1]), 'currency']],
    [new RegExp(String.raw`(${NUM})\s?(?:dollars?|won|원|달러)`, 'gi'), (m) => [toNum(m[1]), 'currency']],
    [/\b(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.)?/gi, (m) => [Number(m[1]) + (m[3]?.toLowerCase() === 'p.m.' && Number(m[1]) < 12 ? 12 : 0) + Number(m[2]) / 60, 'time']],
    [/\b(\d{1,2})\s*(a\.m\.|p\.m\.)/gi, (m) => [Number(m[1]) + (m[2].toLowerCase() === 'p.m.' && Number(m[1]) < 12 ? 12 : 0), 'time']],
    [/\b(?:aged?|ages)\s+(\d{1,2})(?:\s*(?:-|–|to)\s*\d{1,2})?|\b(\d{1,2})\s*(?:years? old|세)/gi, (m) => [Number(m[1] ?? m[2]), 'age']],
    [/\b(1[89]\d{2}|20\d{2})\b/g, (m) => [Number(m[1]), 'year']],
    [new RegExp(String.raw`\b(${NUM})(?:st|nd|rd|th)\b`, 'gi'), (m) => [toNum(m[1]), 'ordinal']],
    [new RegExp(String.raw`\b(${NUM})\b`, 'g'), (m) => [toNum(m[1]), 'count']],
  ]
  for (const [re, conv] of rules) for (const m of text.matchAll(re)) {
    const [value, unit] = conv(m)
    if (Number.isFinite(value)) push(m, value, unit)
  }
  return out.sort((a, b) => a.start - b.start)
}

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9

/**
 * 분석 글이 단정한 수치가 원문 글자에 있는가. 원문에 같은 값·단위가 없으면 imageOnly —
 * 그림에서 읽었다는 주장일 뿐 이 계층에서 확인할 수 없다(precision unavailable).
 */
export function valueAnchors(claimText: string, passage: string, basis: BindingBasis): ValueAnchor[] {
  const inSource = readValues(passage)
  return readValues(claimText)
    .filter((v) => v.unit !== 'ordinal' && !(v.unit === 'count' && v.value <= 5 && Number.isInteger(v.value))) // ①–⑤·[5] 같은 번호 참조 제외
    .map((v) => {
      const hit = inSource.find((s) => same(s.value, v.value) && (s.unit === v.unit || s.unit === 'count' || v.unit === 'count'))
      return hit
        ? { kind: 'value', basis, precision: 'exact', value: v.value, unit: hit.unit, raw: hit.raw, span: { start: hit.start, end: hit.end }, imageOnly: false }
        : { kind: 'value', basis, precision: 'unavailable', value: v.value, unit: v.unit, raw: v.raw, imageOnly: true }
    })
}

const CUES: [ConditionCue, RegExp][] = [
  ['only', /\bonly\b|\bexclusively\b|\blimited to\b/gi],
  ['except', /\bexcept\b|\bexcluding\b|\bother than\b|\bunless\b/gi],
  ['must', /\bmust\b|\brequired\b|\bmandatory\b|\bshould\b|\bneed to\b/gi],
  ['not', /\bnot (?:allowed|permitted|available|included|accepted|refundable)\b|\bno (?:\w+ )?(?:allowed|refunds?|pets|food)\b|\bprohibited\b/gi],
  ['deadline', /\b(?:by|before|until|no later than|deadline)\b[^.]{0,30}\b(?:\d{1,2}(?:st|nd|rd|th)?|January|February|March|April|May|June|July|August|September|October|November|December)\b/gi],
  ['weekday', /\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)days?\b|\bweekdays?\b|\bweekends?\b/gi],
  ['time_range', /\b\d{1,2}(?::\d{2})?\s*(?:a\.m\.|p\.m\.)?\s*[-–－~]\s*\d{1,2}(?::\d{2})?\s*(?:a\.m\.|p\.m\.)?/gi],
  ['age', /\b(?:under|over|aged?|ages)\s+\d{1,2}\b|\b\d{1,2}\s*(?:and|or)\s*(?:under|over|older|younger)\b/gi],
  ['fee', /[$€£₩]\s?\d[\d,.]*|\bfree\b|\bfee\b|\bdiscount\b|\brefund\b/gi],
  ['limit', /\b(?:up to|maximum|minimum|at least|at most|no more than|first \d+)\b/gi],
]

/** 안내문·실용문의 조건·한정 표현 위치 — 선지 판단이 걸리는 자리 후보. 정답 근거라고 단정하지 않는다 */
export function conditionAnchors(passage: string, basis: BindingBasis): ConditionAnchor[] {
  const out: ConditionAnchor[] = []
  for (const [cue, re] of CUES) for (const m of passage.matchAll(re)) {
    const start = m.index ?? 0
    out.push({ kind: 'condition', basis, precision: 'exact', cue, start, end: start + m[0].length, quote: m[0] })
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end)
}

/** 한국어 선지(안내문 일치)의 수치·조건 — 지문 영어 수치와 맞춰 볼 키 */
export function choiceKeys(choice: string): { values: Raw[]; cues: ConditionCue[] } {
  const cues: ConditionCue[] = []
  if (/만|뿐|한해|한정/.test(choice)) cues.push('only')
  if (/제외|빼고/.test(choice)) cues.push('except')
  if (/해야|필수|반드시/.test(choice)) cues.push('must')
  if (/없다|않는다|불가|금지/.test(choice)) cues.push('not')
  if (/월요일|화요일|수요일|목요일|금요일|토요일|일요일|주말|평일/.test(choice)) cues.push('weekday')
  if (/세 미만|세 이상|세 이하|세 초과|어린이|성인/.test(choice)) cues.push('age')
  if (/무료|요금|비용|할인|환불|\$/.test(choice)) cues.push('fee')
  if (/까지|마감/.test(choice)) cues.push('deadline')
  if (/최대|최소|이상|이하|선착순/.test(choice)) cues.push('limit')
  return { values: readValues(choice.replace(/(\d+)세/g, '$1 years old').replace(/(\d+)시/g, '$1:00')), cues }
}
