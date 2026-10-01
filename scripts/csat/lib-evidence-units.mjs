// scripts/csat/lib-evidence-units.mjs
//
// **근거 단위(evidence unit) 목록 — 분석·검수가 같은 번호를 쓰게 하는 정본 생성기.**
//
// 왜: 분석자와 검수자가 지문 문장을 **각자 셌다.** 2026-09-29 학평 8문항 검수 시험에서 revise 대부분이
// 문장 번호 오류였고(16문항 중 4건 — 없는 11번 문장, 한 칸 밀림), 검수자끼리도 8문장/9문장으로 갈렸다.
// 저장소에 splitSentences 가 9벌 있고 서로 다르다. 그래서 **한 번 만들어 DB(csat_item_units)에 두고**
// export·검수 CLI·validator 가 그 목록만 읽는다. 여기 규칙을 바꾸면 UNITS_VERSION 을 올린다 —
// 버전이 바뀐 목록으로는 옛 번호 참조·승인이 재사용되지 않는다(DB 게이트).
//
// 이름이 «문장» 이 아니라 «근거 단위» 인 이유: 안내문 목록 한 줄·도표 제목처럼 문법 문장이 아닌 것도
// 한 단위가 된다. 분석 서술에서 위치를 가리킬 때는 `[u5]` 로 쓴다.
//
// ── 규칙(v1) ──────────────────────────────────────────────────────────
//   1. 종결부호 `.` `!` `?` 뒤(닫는 따옴표·괄호는 앞 단위에 붙는다) + 공백 + 다음 단위 시작 글자에서 끊는다.
//      시작 글자: 대문자 · 여는 따옴표 · `(` `[` · ①–⑤ · 목록 기호.
//   2. 약어에서는 끊지 않는다: ABBREV(Mr. Dr. e.g. i.e. U.S. a.m. p.m. No. Fig. …). **한 글자 이니셜은 약어로 보지 않는다** — «Gen X.» «vitamin C.» 가 문장 끝인 경우가 이름 이니셜보다 흔하다(도표 선지 ⑤ 가 앞 단위에 삼켜졌다).
//      소수점(3.5)은 뒤에 공백이 없으므로 규칙 1 에서 이미 안 끊긴다.
//   3. **따옴표 안에서는 끊지 않는다.** “…A. B.…” 는 한 단위 — 따옴표를 닫은 **바로 뒤**에서는 끊을 수 있다
//      (“Which came first…?” For bees… → 두 단위). 짝이 안 맞는 따옴표가 있으면 이 규칙을 끈다(전부 삼키지 않게).
//   4. ①–⑤ 는 경계를 만들지 않지만, 종결부호 뒤에 오면 **다음 단위의 머리**다(위치형·도표 선지 문장).
//   5. 목록 기호 `∙` `•` `▪` `▰` `※` 앞은 언제나 경계(kind=line). ` - ` 는 **R-NOTICE 에서만** 목록으로 본다
//      (산문의 대시와 섞이지 않게).
//   6. 빈칸 `____` 는 경계가 아니다.
//
// 자기 검사(buildUnits 가 throw): 단위가 비지 않고 · 오프셋이 증가하며 겹치지 않고 ·
// text === passage.slice(start, end) · 단위 사이 틈은 공백뿐(글자 누락 0).

import crypto from 'node:crypto'

export const UNITS_VERSION = 1
/** 사전 검사(precheckAnalysis·checkUnitRefs) 규칙 버전 — 검사 기준이 바뀌면 올린다(기록된 결과를 어느 기준으로 냈는지 남기려고) */
// v2(2026-10-01): DB 행 사전 검사가 풀이 절차·측정 능력·설계 의도의 [uN] 도 본다(v1 은 정답 근거·선지 해설만 읽어 놓쳤다 — Codex 리뷰)
export const PRECHECK_VERSION = 2

const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|Mt|vs|etc|e\.g|i\.e|U\.S|U\.K|a\.m|p\.m|No|Fig|approx|cf|Inc|Ltd|Co)\.$/
const CLOSERS = /["'’”)\]]/
const STARTERS = /[A-Z“"('‘[①②③④⑤∙•▪▰※]/
const BULLETS = new Set(['∙', '•', '▪', '▰', '※'])
const OPEN_Q = '“'
const CLOSE_Q = '”'

/** 따옴표 안쪽 구간 [열림, 닫힘) — 짝이 하나라도 안 맞으면 null(규칙 3 끔) */
function quoteSpans(p) {
  const spans = []
  let open = -1
  for (let i = 0; i < p.length; i += 1) {
    if (p[i] === OPEN_Q) {
      if (open >= 0) return null
      open = i
    } else if (p[i] === CLOSE_Q) {
      if (open < 0) return null
      spans.push([open, i])
      open = -1
    }
  }
  return open >= 0 ? null : spans
}

const inside = (spans, k) => !!spans && spans.some(([a, b]) => k > a && k <= b)

/** 경계 목록(다음 단위의 시작 오프셋) */
function boundaries(p, typeId) {
  const cuts = new Set()
  const spans = quoteSpans(p)
  let unitStart = 0
  for (let i = 0; i < p.length; i += 1) {
    const ch = p[i]

    // 규칙 5 — 목록 기호 앞
    const notice = typeId === 'R-NOTICE'
    const dashItem = notice && ch === '-' && i > 0 && p[i - 1] === ' ' && p[i + 1] === ' '
    if ((BULLETS.has(ch) || dashItem) && i > 0 && p.slice(unitStart, i).trim()) {
      cuts.add(i)
      unitStart = i
      continue
    }

    if (ch !== '.' && ch !== '!' && ch !== '?') continue
    let j = i + 1
    while (j < p.length && CLOSERS.test(p[j])) j += 1
    if (j < p.length && !/\s/.test(p[j])) continue // 소수점·약어 내부
    if (ABBREV.test(p.slice(unitStart, j))) continue
    if (inside(spans, j - 1) && !(j > i + 1 && p.slice(i + 1, j).includes(CLOSE_Q))) continue // 규칙 3
    let k = j
    while (k < p.length && /\s/.test(p[k])) k += 1
    if (k >= p.length) break
    if (!STARTERS.test(p[k])) continue
    cuts.add(k)
    unitStart = k
    i = k - 1
  }
  return [...cuts].sort((a, b) => a - b)
}

/**
 * @param {string} passage
 * @param {{ typeId?: string }} [opts]
 * @returns {{ version: number, units: { n: number, id: string, start: number, end: number, text: string, kind: 'sentence'|'line' }[] }}
 */
export function buildUnits(passage, opts = {}) {
  const p = String(passage ?? '')
  const units = []
  if (!p.trim()) return { version: UNITS_VERSION, units }
  const cuts = [0, ...boundaries(p, opts.typeId), p.length]
  for (let c = 0; c < cuts.length - 1; c += 1) {
    let start = cuts[c]
    let end = cuts[c + 1]
    while (start < end && /\s/.test(p[start])) start += 1
    while (end > start && /\s/.test(p[end - 1])) end -= 1
    if (start === end) continue
    const text = p.slice(start, end)
    const kind = BULLETS.has(text[0]) || (opts.typeId === 'R-NOTICE' && text.startsWith('- ')) ? 'line' : 'sentence'
    units.push({ n: units.length + 1, id: `u${units.length + 1}`, start, end, text, kind })
  }
  checkUnits(p, units)
  return { version: UNITS_VERSION, units }
}

/** 자기 검사 — 어긋나면 throw. 목록을 DB 에서 읽은 쪽도 이 함수로 다시 확인할 수 있다 */
export function checkUnits(passage, units) {
  let prev = 0
  for (const [i, u] of units.entries()) {
    if (u.n !== i + 1 || u.id !== `u${i + 1}`) throw new Error(`단위 번호가 연속이 아니다: ${u.id}`)
    if (!(u.start >= prev && u.end > u.start)) throw new Error(`단위 ${u.id} 오프셋이 겹치거나 역순이다`)
    if (passage.slice(u.start, u.end) !== u.text) throw new Error(`단위 ${u.id} 글자가 원문과 다르다`)
    if (passage.slice(prev, u.start).trim()) throw new Error(`단위 ${u.id} 앞에 빠진 글자가 있다`)
    prev = u.end
  }
  if (passage.slice(prev).trim()) throw new Error('마지막 단위 뒤에 빠진 글자가 있다')
}

/** 목록 해시 — 버전과 경계만 담는다(글자는 원문 해시가 이미 묶는다) */
export function unitsHash(built) {
  const sig = `${built.version}|${built.units.map((u) => `${u.start}-${u.end}`).join(',')}`
  return crypto.createHash('sha256').update(sig).digest('hex')
}

const norm = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

/** 인용이 걸친 단위 번호들(못 찾으면 []) */
export function unitsOfQuote(passage, units, quote) {
  const q = norm(quote)
  if (!q) return []
  // 정규화하면 길이가 바뀌므로 단위별 정규화 텍스트를 이어 붙여 위치를 역산한다
  let flat = ''
  const spans = []
  for (const u of units) {
    const t = norm(u.text)
    const s = flat.length ? flat.length + 1 : 0
    flat += (flat.length ? ' ' : '') + t
    spans.push([s, s + t.length, u.n])
  }
  const at = flat.indexOf(q)
  if (at < 0) return []
  const end = at + q.length
  return spans.filter(([s, e]) => s < end && e > at).map(([, , n]) => n)
}

/**
 * **V9 근거 단위 번호** — 청크가 실어 보낸 목록(DB csat_item_units)으로만 센다.
 *
 * 기계가 보는 것은 **번호가 있는가 · 인용이 걸친 단위가 번호에 들어 있는가** 둘뿐이다.
 * 그 단위가 실제로 주장을 뒷받침하는지(의미)는 **보지 않는다** — 범위 안의 엉뚱한 번호
 * (H1803G3#31: 근거는 u5 인데 [1,6])는 여기를 통과하고 독립 검수가 잡는다(회귀가 이 한계를 고정한다).
 */
export function checkUnitRefs(a, units, bad, warn, id) {
  const N = units.length
  const inRange = (k) => Number.isInteger(k) && k >= 1 && k <= N
  const idx = a.answer_locus?.sentence_index ?? []
  for (const k of idx) if (!inRange(k)) bad(id, `answer_locus.sentence_index 에 없는 단위 u${k} (이 지문은 u1–u${N})`)
  for (const c of a.choices ?? []) {
    for (const k of c.confirmed_at?.sentence_index ?? []) if (!inRange(k)) bad(id, `선지 ${c.n} confirmed_at 에 없는 단위 u${k} (u1–u${N})`)
  }
  const q = a.answer_locus?.quote
  if (q) {
    const at = unitsOfQuote('', units, q)
    if (at.length && !at.every((k) => idx.includes(k))) {
      bad(id, `인용이 걸친 단위 [${at.map((k) => `u${k}`).join(',')}] 가 answer_locus.sentence_index [${idx.join(',')}] 에 없다`)
    }
  }
  const prose = JSON.stringify(a)
  for (const m of prose.matchAll(/\[u(\d+)\]/g)) if (!inRange(Number(m[1]))) bad(id, `서술에 없는 단위 [u${m[1]}] (u1–u${N})`)
  if (/\d+\s*번\s*(?:째\s*)?문장/.test(prose)) warn(id, '서술에 「N번 문장」 표기가 있다 — 근거 단위 번호 [uN] 으로 쓴다')
}

/**
 * **옛 분석(DB 행)도 같은 V9 검사를 거친다** — 목록 이전에 쓰인 분석은 units_hash 가 없어 validator 의 V9 를
 * 건너뛰었다. 그래서 반려의 대부분(2026-09-30 배치 4: 4/4)이 기계로 잡을 수 있던 번호 결함이었다.
 * 블라인드 검수 **전에** 이 함수로 거르고, 걸린 문항은 검수가 아니라 교정으로 보낸다.
 *
 * DB 행 모양(choice_analysis)과 드레인 결과 모양(choices)을 둘 다 받는다.
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function precheckAnalysis(row, units) {
  const a = { ...row, choices: row.choices ?? row.choice_analysis ?? [] }
  const errors = []
  const warnings = []
  if (!units?.length) return { errors: ['근거 단위 목록 없음 — units-build 필요'], warnings }
  checkUnitRefs(a, units, (_, m) => errors.push(m), (_, m) => warnings.push(m), a.item_id ?? '')
  const q = a.answer_locus?.quote
  if (q && !a.answer_unknown && !unitsOfQuote('', units, q).length) errors.push('answer_locus.quote 가 근거 단위 목록 어디에도 없다')
  return { errors, warnings }
}
