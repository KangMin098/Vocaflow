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
  const reSet = /^\s*\[\s*\d{2}\s*[~～∼〜–—-]\s*\d{2}\s*\]/
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
    const m = l.match(/^\s*\[\s*(\d{2})\s*[~～∼〜–—-]\s*(\d{2})\s*\]/)
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

/**
 * 선택지 블록이 시작하는 줄 번호. 없으면 -1.
 *
 * ⚠️ **아무 ①~⑤ 로나 끊으면 안 된다.** 어법·어휘·무관·순서·삽입은 기호 선지라
 *    **선택지 블록이 따로 없고 ①~⑤ 가 본문 안에 찍힌다.** 줄머리에 온 마커에서 끊으면
 *    지문이 거기서 잘린다(M2609#30 은 ④⑤ 를 통째로 잃었고, 어법 마커 검출도 4/5 로 떨어졌다).
 *
 * 진짜 선택지 블록은 **① 로 시작하는 줄이 있고 그 뒤로 ②③④⑤ 가 차례로 나오는** 꼬리다.
 */
function choiceStart(block) {
  for (let i = 0; i < block.length; i += 1) {
    if (!block[i].trim().startsWith(CIRC[0])) continue
    const tail = block.slice(i).join('\n')
    let at = -1, ok = true
    for (const c of CIRC) { const j = tail.indexOf(c); if (j <= at) { ok = false; break } at = j }
    if (ok) return i
  }
  return -1
}

/** 한글 비율 — 공백을 뺀 글자 중 한글이 차지하는 몫 */
function koRatio(s) {
  const chars = s.replace(/\s/g, '')
  if (!chars.length) return 0
  return (chars.match(/[가-힣]/g) ?? []).length / chars.length
}

/**
 * 블록에서 **영어 지문만.**
 *
 * ⚠️ 2026-09-02 이전 구현은 두 가지를 조용히 틀리고 있었다. 둘 다 실측으로 잡았다:
 *
 *   ① **번호 줄을 통째로 버렸다.** 그런데 지문이 번호와 같은 줄에서 시작하는 회차가 많다
 *      (`31. Ever since the early Enlightenment, preservation and`). 사정권 830문항 중
 *      **143문항(17%)** 의 지문 첫 줄이 사라져 있었다. 대의파악처럼 첫 문장이 주제문인
 *      유형에서는 정답 근거 자체가 없어진다.
 *   ② **발문 꼬리를 지문에 넣었다.** 번호 줄만 건너뛰고 그다음 줄부터 다 넣었으므로
 *      여러 줄 발문의 2행("적절한 것은? [3점]")이 지문 머리에 붙었다. **806개 중 473개(59%)**
 *      가 오염돼 있었다.
 *
 * 그래서 줄을 버리고 남기는 기준을 **한글 비율**로 바꾼다. 발문·각주·[3점] 표기는 한글이
 * 우세하고, 지문은 라틴 문자가 우세하다. 번호는 떼고 뒤에 남은 것으로 판정한다.
 */
// 발문은 **덩어리로 끝난다** — 이 표지 뒤부터가 지문이다. 줄 단위로 한글 비율만 보면
// 고유명사가 섞인 발문(`Harmony Youth Orchestra Auditions에 관한 다음 안내문의`)이 빠져나간다.
const STEM_END = /(?:것은\s*\??|것을\s*고르시오\s*\.?|고르시오\s*\.?|하시오\s*\.?|답하시오\s*\.?)/g

export function passageOf(block) {
  const cut = choiceStart(block)
  const head = cut >= 0 ? cut : block.length

  // 발문 종료 지점 — 앞쪽 8줄 안에서 **마지막** 종결 표지. 없으면 -1(줄 단위 규칙으로 간다).
  let stemEnd = -1
  let stemTail = ''
  for (let i = 0; i < Math.min(head, 8); i += 1) {
    const raw = block[i]
    if (!/[가-힣]/.test(raw)) continue
    const hits = [...raw.matchAll(STEM_END)]
    if (!hits.length) continue
    const last = hits[hits.length - 1]
    stemEnd = i
    stemTail = raw.slice(last.index + last[0].length)
  }

  const body = []
  if (stemEnd >= 0) {
    const t = stemTail.replace(/\[\s*[23]\s*점\s*\]/g, '').trim()
    if (t && /[A-Za-z]/.test(t)) body.push(t)
  }

  for (let i = stemEnd + 1; i < block.length; i += 1) {
    if (i >= head) break // 선택지 블록 시작
    let l = block[i].trim()
    if (!l) continue
    // 번호·세트 머리는 **떼고** 뒤를 본다 — 버리지 않는다
    l = l.replace(/^\s*\d{1,2}\s*[.．]\s*/, '')
    l = l.replace(/^\[\s*\d{1,2}\s*[~～∼〜–—-]\s*\d{1,2}\s*\]\s*/, '')
    if (!l) continue
    // 각주 — `* monist: 일원론의` · `* be entitled to: (~할) 권한이 있다` · `** entail: 내포하다`.
    // 낱말에 공백이 있어 `\S+` 로는 안 잡힌다(실측: 2014A#33 의 `be entitled to`).
    if (/^\*+\s/.test(l) || /^\*+[^:：]{1,40}[:：]/.test(l)) continue
    if (koRatio(l) >= 0.3) continue // 발문·안내·배점 표기
    // 발문 꼬리가 문장 앞에 붙어 있으면 거기까지 떼어 낸다 (`적절한 것은? [3점] As we all know,`).
    // 고유명사가 섞인 발문(`Harmony Youth Orchestra Auditions에 관한 다음 안내문의`)은
    // 한글 비율이 낮아 위 필터를 빠져나온다 — 조사·어미로 끝나는 한글 꼬리를 여기서 턴다.
    l = l.replace(/^.*?[가-힣][^A-Za-z]*?(?:것은\??|하시오\.?|고르시오\.?)\s*/, '')
    l = l.replace(/^.*[가-힣](?:의|을|를|은|는|에|와|과|로|으로)\s+(?=[A-Z])/, '')
    l = l.replace(/\[\s*[23]\s*점\s*\]/g, '')
    if (!l.trim()) continue
    // **빈칸을 잃어버리지 않는다.** 평가원 PDF 의 빈칸은 밑줄이 아니라 **공백 폭**으로 온다
    // (`a(n)        state`). 뒤에서 공백을 접으면 빈칸이 그냥 한 칸이 되어,
    // 빈칸추론 117문항의 **빈칸 위치가 통째로 사라진다** — 이 유형은 정답 근거가 위치다.
    body.push(l.trim().replace(/ {4,}/g, ' ______ '))
  }
  return body
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/([a-z])- ([a-z])/g, '$1$2') // 줄바꿈 하이픈 복원
    .trim()
}

/** 블록에서 선택지 5개 — ①~⑤ 로 잘라 낸다 */
// 다음 문항의 머리. ⑤ 는 뒤를 닫아 주는 마커가 없어서 **블록 끝까지 삼킨다** —
// 실제로 2022 #34 의 ⑤ 가 1,029자였고 그 안에 35번 문두가 통째로 들어 있었다.
// ⑤ 만 부풀면 다른 넷의 길이 순위가 밀려 **정답이 짧아 보이는 착시**가 생긴다.
const NEXT_ITEM = /\s\d{1,2}\.\s*(?:다음|밑줄|위 |윗 |주어진|글의|아래|어법|빈칸|(?:\(A\)))/

/** 선지 꼬리에 붙은 지면 장식을 턴다 — 쉼표 행렬 · 형별 표기 · 낱개 기호 */
function trimChoice(s) {
  let t = s
  const nx = t.search(NEXT_ITEM)
  if (nx > 0) t = t.slice(0, nx)
  // 지면 상투구 — 형별 표기 · 듣기 종료 안내 · 시험지 말미 확인 사항
  t = t.replace(/[,\s·]*(?:짝수형|홀수형)[\s\S]*$/, '')
  t = t.replace(/\s*이제\s*듣기[\s\S]*$/, '')
  t = t.replace(/\s*\*?\s*확인\s*사항[\s\S]*$/, '')
  t = t.replace(/\s*문제지의\s*지시[\s\S]*$/, '')
  t = t.replace(/(?:\s*,\s*){2,}[\s\S]*$/, '')
  // 지면 하단 고지가 마지막 선지에 붙는다 — 실측: M2706#32 의 ⑤ 끝에 통째로 들어왔다
  t = t.replace(/\s*\d*\s*이\s*문제지에\s*관한\s*저작권[\s\S]*$/, '')
  t = t.replace(/\s+\d{1,2}\s*$/, '') // 쪽번호 잔재
  t = t.replace(/\s+[가-힣]{1,3}\s*$/, '') // 옆 단에서 넘어온 한글 토막
  // 지면 표시 낱글자 — 실측: M2306#32 · 2022#32 · M2209#32 의 ⑤ 끝에 `K` 가 붙어 왔다.
  // 선지는 구·절이라 홀로 선 대문자 한 글자로 끝나는 일이 없다.
  t = t.replace(/\s+[A-Z]\s*$/, '')
  return t.replace(/[\s,]+$/, '').trim()
}

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
    out.push(trimChoice(tail.slice(a + 1, b < 0 ? tail.length : b)))
  }
  // 그래도 ⑤ 만 유별나게 길면 잘라내지 못한 것이 남아 있다는 뜻이다. 버린다.
  const head = out.slice(0, 4).map((c) => c.length).sort((x, y) => x - y)
  const med = (head[1] + head[2]) / 2
  if (med > 0 && out[4].length > Math.max(60, med * 3)) return null
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

/**
 * **수능 14회차 + 모의평가 3회차를 한 목록으로.**
 * 검사 스크립트는 이걸 쓴다 — 모평은 규칙 도출에 안 쓴 회차이므로 표본을 넓히면서
 * 동시에 홀드아웃 성격을 갖는다. 정답표가 없는 M2509 는 뺀다.
 */
export function allRows() {
  const c = JSON.parse(fs.readFileSync(path.resolve('scripts/csat/data/classified.json'), 'utf8')).rows
    .map((r) => ({ ...r, src: '수능' }))
  const m = mockRows()
    .filter((r) => MOCK_EXAMS.includes(r.exam) && r.type)
    .map((r) => ({ ...r, src: '모평' }))
  return [...c, ...m]
}
