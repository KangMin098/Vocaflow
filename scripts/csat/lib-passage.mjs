// scripts/csat/lib-passage.mjs
//
// **문항 번호 → 영어 지문 · 선택지 5개.** 여러 검사 스크립트가 공유한다.
//
// ⚠️ columns/*.txt 는 홀수형·짝수형이 이어 붙어 있어 같은 지문이 두 번 나온다.
//    두 판은 지문이 같고 **선택지 순서만 다르다**. 그래서 지문은 첫 판만 쓰고,
//    선택지는 판마다 따로 돌려준다(정답 번호가 판마다 다르므로).

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_COL = path.resolve('scripts/csat/data/columns2')
let COL = process.env.CSAT_COLUMNS ? path.resolve(process.env.CSAT_COLUMNS) : DEFAULT_COL
const cache = new Map()

export function useColumns(dir) { COL = path.resolve(dir); cache.clear() }

/** 정답표가 실제로 쓴 형(홀수/짝수) — 여기에 선택지 번호를 맞춰야 한다 */
let FORMS = null
function formUsed(exam) {
  if (!FORMS) {
    const a = JSON.parse(fs.readFileSync(path.resolve('scripts/csat/data/answers.json'), 'utf8'))
    FORMS = Object.fromEntries((a.report ?? []).map((r) => [r.exam, r.form_used]))
  }
  return FORMS[exam] ?? '홀수'
}

/**
 * 그 회차의 줄들. PDF 에 홀수형·짝수형이 이어 붙은 회차(2023·2024·2026)는
 * **정답표가 쓴 형만** 돌려준다 — 두 판은 지문이 같고 선택지 순서만 다르므로,
 * 아무 판이나 쓰면 정답 번호가 어긋난다.
 */
function lines(exam) {
  if (!cache.has(exam)) {
    const p = path.join(COL, `${exam}.txt`)
    if (!fs.existsSync(p)) { cache.set(exam, null); return null }
    let ls = fs.readFileSync(p, 'utf8').replace(/\r/g, '').split('\n')
    const marks = []
    ls.forEach((l, i) => { const m = l.match(/(홀수형|짝수형)/); if (m) marks.push({ i, form: m[1][0] + '수' }) })
    const seen = [...new Set(marks.map((m) => m.form))]
    if (seen.length > 1) {
      const want = formUsed(exam)
      const starts = []
      for (const m of marks) if (!starts.length || starts[starts.length - 1].form !== m.form) starts.push(m)
      const k = starts.findIndex((s) => s.form === want)
      if (k >= 0) {
        const from = starts[k].i
        const to = k + 1 < starts.length ? starts[k + 1].i : ls.length
        ls = ls.slice(from, to)
      }
    }
    cache.set(exam, ls)
  }
  return cache.get(exam)
}

const CIRC = '①②③④⑤'

/** 한 문항의 원문 블록들을 전부 돌려준다 (홀수형·짝수형 → 보통 1~2개) */
export function itemBlocks(exam, no) {
  const ls = lines(exam)
  if (!ls) return []
  const starts = []
  const re = new RegExp(`^\\s*${no}\\s*[.．]`)
  const reNext = new RegExp(`^\\s*${no + 1}\\s*[.．]`)
  ls.forEach((l, i) => { if (re.test(l)) starts.push(i) })
  // 다음 문항 번호에서 끊는다. **세트 머리글 `[41~42]` 에서도 끊어야 한다** —
  // 40번은 바로 뒤가 장문 세트라, 머리글을 무시하면 41번 줄까지 넘어가
  // 장문 지문을 40번 것으로 착각한다(실제로 겪었다).
  const reSet = /^\s*\[\s*\d{2}\s*[~～–—-]\s*\d{2}\s*\]/
  const out = []
  for (const i of starts) {
    let j = ls.findIndex((l, k) => k > i && (reNext.test(l) || reSet.test(l)))
    if (j < 0) j = Math.min(i + 60, ls.length)
    out.push(ls.slice(i, j))
  }
  return out
}

/**
 * 장문 세트(41~42 · 43~45)는 지문이 문항 번호 밑에 없고 `[41~42]` 머리글 밑에 한 번만 있다.
 * 그래서 세트 문항은 그 머리글 블록에서 지문을 가져와야 한다.
 * 세트에 속하지 않는 번호면 null.
 */
export function setBlockFor(exam, no) {
  const ls = lines(exam)
  if (!ls) return null
  // `[41～42]` `[43~45]` — 물결표가 회차마다 다르다(～ · ~ · –)
  const heads = []
  ls.forEach((l, i) => {
    const m = l.match(/^\s*\[\s*(\d{2})\s*[~～–—-]\s*(\d{2})\s*\]/)
    // ⚠️ `[31~34]` `[36~37]` 같은 머리글도 있지만 그것은 **발문을 묶은 것**이지
    //    지문을 공유하는 것이 아니다. 지문을 공유하는 세트는 장문(41~45)뿐이다.
    //    이 구분을 놓치면 빈칸 55문항의 지문이 통째로 발문으로 바뀐다(실제로 겪었다).
    if (m && +m[1] >= 41) heads.push({ i, from: +m[1], to: +m[2] })
  })
  const h = heads.find((x) => no >= x.from && no <= x.to)
  if (!h) return null
  // 세트 지문은 머리글 다음부터 첫 문항 번호 직전까지
  const end = ls.findIndex((l, k) => k > h.i && new RegExp(`^\\s*${h.from}\\s*[.．]`).test(l))
  return ls.slice(h.i + 1, end < 0 ? Math.min(h.i + 80, ls.length) : end)
}

/** 블록에서 영어 지문만 — 발문(한글)·선택지(①~⑤ 이후)를 걷어낸다 */
export function passageOf(block) {
  const body = []
  for (const raw of block) {
    const l = raw.trim()
    if (!l) continue
    if ([...CIRC].some((c) => l.startsWith(c))) break          // 선택지 시작
    if (/^\s*\d+\s*[.．]/.test(l)) continue                     // 발문 줄
    if (/^\[\d+[~–-]\d+\]/.test(l)) continue                    // 세트 안내
    body.push(l)
  }
  return body
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/([a-z])- ([a-z])/g, '$1$2')                       // 줄바꿈 하이픈 복원
    .trim()
}

/** 블록에서 선택지 5개 — ①~⑤ 로 잘라 낸다 */
export function choicesOf(block) {
  const text = block.join('\n')
  const i = text.search(/[①②③④⑤]/)
  if (i < 0) return null
  const tail = text.slice(i).replace(/\n/g, ' ').replace(/\s+/g, ' ')
  const out = []
  for (let k = 0; k < 5; k += 1) {
    const a = tail.indexOf(CIRC[k])
    if (a < 0) return null
    const b = k === 4 ? tail.length : tail.indexOf(CIRC[k + 1])
    out.push(tail.slice(a + 1, b < 0 ? tail.length : b).trim())
  }
  return out
}

// 마침표로 끝나지만 문장이 끝난 것이 아닌 것들. 이걸 안 막으면
// "Dear Mr. Brown, ..." 이 두 문장이 되어 **위치 기반 검정이 통째로 어긋난다**(P6.18 에서 겪었다).
const ABBR = ['mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'jr', 'sr', 'vs', 'etc', 'e.g', 'i.e', 'no', 'fig', 'approx', 'inc', 'ltd', 'co', 'univ', 'dept', 'p.m', 'a.m']
const ABBR_RE = new RegExp(`\\b(?:${ABBR.join('|')})\\.$`, 'i')

/** 영어 문장 분할 — 약어·인용부호를 견딘다 */
export function sentences(p) {
  if (!p) return []
  const raw = p
    .replace(/([.!?]["”’)]?)\s+(?=[“"(A-Z])/g, '$1')
    .split('')
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
  // 약어에서 잘린 조각을 도로 붙인다
  const out = []
  for (const s of raw) {
    if (out.length && ABBR_RE.test(out[out.length - 1])) out[out.length - 1] += ' ' + s
    else out.push(s)
  }
  return out
}

export const EXAMS = ['2014B', '2014A', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']

/** 유형 id → 그 유형의 문항들 (classified.json 기준) */
export function itemsOfType(typeId) {
  const c = JSON.parse(fs.readFileSync(path.resolve('scripts/csat/data/classified.json'), 'utf8'))
  return c.rows.filter((r) => r.type === typeId)
}

let ANS = null
export function answerOf(exam, no) {
  if (!ANS) {
    ANS = new Map()
    const load = (f) => {
      const p = path.resolve('scripts/csat/data', f)
      if (!fs.existsSync(p)) return
      for (const a of JSON.parse(fs.readFileSync(p, 'utf8')).answers) ANS.set(`${a.exam}#${a.no}`, a)
    }
    load('answers.json')
    load('mock-answers.json')   // 모의평가 — 규칙 도출에 안 쓴 홀드아웃
  }
  return ANS.get(`${exam}#${no}`) ?? null
}

/** 모의평가 회차 id (columns2/M*.txt · mock-answers.json) */
export const MOCK_EXAMS = ['M2606', 'M2609', 'M2706']

/** 모의평가의 유형 배정 — mock-questions.json */
export function mockRows() {
  const p = path.resolve('scripts/csat/data/mock-questions.json')
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).rows : []
}
