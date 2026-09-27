// scripts/csat/lib-mock-parse.mjs
//
// **시험지 텍스트 → 발문·정답표·유형** 파서. 평가원 모평(`ingest-mock.mjs`)과 교육청 학평
// (`ingest-hakpyeong.mjs`)이 같은 조판 관습(번호. 발문 · [n~m] 세트 머리글 · ①~⑤ · [3점])을
// 쓰므로 한 벌만 둔다. 2026-09-28 ingest-mock 에서 그대로 옮겼다(동작 불변 — 모평 산출 대조).
// 입력 텍스트는 단이 이미 풀린 것이어야 한다(pdftotext+lib-columns 든 pdfjs 좌표든).

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')

// ── 정답표 ────────────────────────────────────────────────────────────
export const CIRC = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }
export function parseKey(raw) {
  const flat = raw.replace(/\n/g, ' ')
  const out = new Map()
  // `1②  2` · `10 ①  2` · `25 ④, ⑤ 2` (복수정답)
  const re = /(?<!\d)(\d{1,2})\s*([①②③④⑤](?:\s*,\s*[①②③④⑤])*)\s+([23])(?!\d)/g
  let m
  while ((m = re.exec(flat))) {
    const no = +m[1]
    if (no < 1 || no > 45) continue
    const answers = [...m[2].matchAll(/[①②③④⑤]/g)].map((x) => CIRC[x[0]])
    if (!out.has(no)) out.set(no, { no, answer: answers[0], answers, points: +m[3], multi: answers.length > 1 })
  }
  return [...out.values()].sort((a, b) => a.no - b.no)
}

// ── 유형 배정 — 본 코퍼스의 정규식표를 그대로 쓴다 ───────────────────
const TYPES = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).types
  .map((t) => ({ ...t, re: new RegExp(t.match.replace(/^\/|\/$/g, '')) }))

export const RE_SET = /^\s*\[\s*(\d{1,2})\s*[~～∼〜–—-]\s*(\d{1,2})\s*\]\s*(.*)$/

/**
 * 발문을 모은다. 세 가지를 처리해야 한다:
 *  ① **여러 줄로 이어지는 발문** — 빈 줄을 건너뛰고 한글 줄을 계속 붙인다.
 *  ② **세트 머리글** `[31~34] 다음 빈칸에 …` — 31~34 는 자기 발문이 없고 머리글이 발문이다.
 *  ③ **줄 가운데에서 시작하는 발문** — 단 나누기가 실패한 페이지의 잔해. ②까지로 못 찾은
 *     번호에 한해서만 줍는다(1차에 쓰면 지문 속 숫자를 발문으로 삼킨다).
 */
export function stemsOf(text) {
  const ls = text.split('\n')

  const collect = (from) => {
    let s = ''
    for (let j = from, blanks = 0; j < ls.length && j < from + 6; j += 1) {
      const l = ls[j].trim()
      if (!l) { if (++blanks > 2) break; continue }
      if (/^[①②③④⑤]/.test(l)) break
      if (/^\s*\d{1,2}\s*[.．]/.test(ls[j])) break
      if (RE_SET.test(ls[j])) break
      if (!/[가-힣]/.test(l)) break // 영어 지문이 시작되면 발문 끝
      s += ' ' + l
    }
    return s
  }

  // ② 세트 머리글을 먼저 모은다
  const setStems = new Map()
  ls.forEach((l, i) => {
    const m = l.match(RE_SET)
    if (!m) return
    const from = +m[1]
    const to = +m[2]
    if (from < 1 || to > 45 || to < from) return
    const stem = (m[3] + collect(i + 1)).trim()
    if (!/[가-힣]/.test(stem)) return
    for (let n = from; n <= to; n += 1) if (!setStems.has(n)) setStems.set(n, stem)
  })

  // ②-b 세트 머리글도 줄 가운데에서 시작할 수 있다 — 단 나누기가 실패한 페이지에서
  //     `① affect our …        [36~37] 주어진 글 다음에 …` 처럼 앞 단 꼬리에 붙는다.
  //     이걸 놓치면 순서·삽입 세트의 첫 문항(36번)이 회차마다 통째로 빠진다(M2109·M2506 실측).
  ls.forEach((l, i) => {
    const m = l.match(/\s{2,}\[\s*(\d{1,2})\s*[~～∼〜–—-]\s*(\d{1,2})\s*\]\s*(.*)$/)
    if (!m) return
    const from = +m[1]
    const to = +m[2]
    if (from < 1 || to > 45 || to < from) return
    const stem = (m[3] + collect(i + 1)).trim()
    if (!/[가-힣]/.test(stem)) return
    for (let n = from; n <= to; n += 1) if (!setStems.has(n)) setStems.set(n, stem)
  })

  const out = new Map()
  for (let i = 0; i < ls.length; i += 1) {
    const m = ls[i].match(/^\s*(\d{1,2})\s*[.．]\s*(.*)$/)
    if (!m) continue
    const no = +m[1]
    if (no < 1 || no > 45 || out.has(no)) continue
    let stem = (m[2] + collect(i + 1)).trim()
    // **옆 단에서 넘어온 다음 문항의 발문을 잘라낸다.** 단이 안 갈린 페이지에서는
    // `Because the environment plays a significant role in      35. 다음 글에서 전체 흐름과…`
    // 처럼 이 문항의 지문 조각 뒤에 **다른 번호의 발문**이 붙는다. 그대로 두면 유형이
    // 그 발문으로 배정된다(실측 M2506#33 이 빈칸추론인데 R-IRRELEVANT 로 실렸다).
    stem = stem.replace(/\s{2,}\d{1,2}\s*[.．]\s*(?=[^\s])[\s\S]*$/, '').trim()
    // 자기 발문에 한글이 없으면(= 지문이 바로 시작) 세트 머리글이 발문이다
    if (!/[가-힣]/.test(stem) && setStems.has(no)) stem = setStems.get(no)
    out.set(no, { no, stem, high_score: /\[\s*3\s*점\s*\]/.test(stem) })
  }
  // 문항 번호 줄이 아예 없는 세트 문항도 살린다
  for (const [no, stem] of setStems) if (!out.has(no)) out.set(no, { no, stem, high_score: false })

  // ③ 줄 가운데 발문 — 못 찾은 번호에 한해
  for (let no = 1; no <= 45; no += 1) {
    if (out.has(no)) continue
    const re = new RegExp(String.raw`\s{2,}(` + no + String.raw`\s*[.．]\s*)(\S.*)$`)
    for (let i = 0; i < ls.length; i += 1) {
      const m = ls[i].match(re)
      if (!m || !/[가-힣]/.test(m[2])) continue
      const col = ls[i].length - m[2].length
      let stem = m[2]
      // 같은 단(= 같은 시작 열)에서 이어지는 한글 줄을 붙인다
      for (let j = i + 1, blanks = 0; j < ls.length && j < i + 5; j += 1) {
        const cont = ls[j].length > col - 4 ? ls[j].slice(Math.max(0, col - 4)).trim() : ''
        if (!cont) { if (++blanks > 1) break; continue }
        if (/^[①②③④⑤]/.test(cont) || /^\d{1,2}\s*[.．]/.test(cont)) break
        if (!/[가-힣]/.test(cont)) break
        stem += ' ' + cont
      }
      stem = stem.trim()
      out.set(no, { no, stem, high_score: /\[\s*3\s*점\s*\]/.test(stem), rescued: true })
      break
    }
  }

  return [...out.values()].sort((a, b) => a.no - b.no)
}

export function classify(stem) {
  const norm = stem.replace(/\s+/g, '')
  return TYPES.filter((t) => t.re.test(norm))
}

/**
 * 문제지에서 **3점 문항 번호 집합**을 읽는다.
 *
 * 배점 자리는 회차마다 다르고, 그 자리는 그 회차 정답표에만 맞는다. 그래서 문제지가 누구
 * 것인지 가릴 때 이보다 나은 지문(指紋)이 없다 — 파일명이 아니라 내용끼리 대조하는 것이다.
 */
export function threePointSet(text) {
  const ls = text.split('\n')
  const marks = []
  ls.forEach((l, i) => {
    const m = l.match(/^\s*(\d{1,2})\s*[.．]/)
    if (m && +m[1] >= 1 && +m[1] <= 45) marks.push({ i, no: +m[1] })
  })
  const out = new Set()
  for (let k = 0; k < marks.length; k += 1) {
    const from = marks[k].i
    const to = k + 1 < marks.length ? marks[k + 1].i : ls.length
    if (ls.slice(from, to).some((l) => /\[\s*3\s*점\s*\]/.test(l))) out.add(marks[k].no)
  }
  return out
}

/**
 * **단 나누기 품질** — 좌표계를 고르는 자.
 *
 * 두 가지만 센다. 둘 다 조판 구조에서 바로 읽히는 것이라 다른 코드가 바뀌어도 안 흔들린다:
 *   ① 줄머리에 온 문항 번호의 가짓수 — 많을수록 단이 제대로 갈렸다 (최대 45)
 *   ② **한 줄에 문항 번호가 둘 있는 줄** — 그 줄은 두 단이 붙어 있다는 증거다. 하나에 30점 벌점.
 *
 * ②의 벌점을 크게 준 이유: 그런 줄 하나가 문항 두 개의 지문을 통째로 망가뜨린다.
 * 번호 하나를 더 찾는 이득보다 훨씬 크다.
 */
export function splitQuality(text) {
  const ls = text.split('\n')
  const heads = new Set()
  let merged = 0
  for (const l of ls) {
    const m = l.match(/^\s*(\d{1,2})\s*[.．]/)
    if (m && +m[1] >= 1 && +m[1] <= 45) heads.add(+m[1])
    if (/(?:^|\s)\d{1,2}\s*[.．][\s\S]*?\s{2,}\d{1,2}\s*[.．]/.test(l)) merged += 1
  }
  return heads.size * 10 - merged * 30
}

/** 파일 하나가 무엇인지 — 파일명이 아니라 내용으로 판정한다 */
export function kindOf(raw) {
  if (/듣기평가\s*대본/.test(raw)) return '대본'
  if (parseKey(raw).length >= 40) return '정답표'
  const stems = new Set([...raw.matchAll(/^\s*(\d{1,2})\s*[.．]/gm)].map((m) => +m[1]).filter((n) => n >= 1 && n <= 45))
  if (stems.size >= 18) return '문제지'
  return '미상'
}
