// scripts/csat/content-review/t0148-aggregate-lib.mjs
//
// **F5 — T-0148 사람 채점 집계(H1~H5).** 계약: lecture-audit-c-20261024/g/A_T0148_HUMAN_EVAL_CONTRACT.md
//
// 판정 키는 **이 집계기만** 읽는다(apps/web 은 키를 모른다). 키 그룹: 'bad' = 과잉 일반화 14 · 'good_*' = 정상 12.
// 결과는 RESUME_ALLOWED / NOT_MET / INCOMPLETE 뿐이다 — RESUME_ALLOWED 도 「재개 근거가 생겼다」일 뿐,
// 반려된 생성 지침(WRITER·GRADER)을 자동 승격하지 않는다. 승격은 별도 사람 결정이다.
// CSV 파서는 apps/web/src/lib/csat/content-review/t0148/scoring.ts 와 같은 규칙(따옴표·CRLF)이다.

export const CSV_COLUMNS = ['blind', 'score_A', 'score_B', 'teaches_wrong_rule_1', 'own_counterexample', 'ce_adjudication', 'teaches_wrong_rule_2', 'memo']
export const EXPECTED = { bad: 14, good: 12, total: 26 }
export const THRESHOLDS = { H2_goodDropMax: 0.5, H3_badDropMin: 1.5, H4_badLowMin: 10, H4_lowScore: 6 }

export function parseCsvRecords(text) {
  const out = []
  let row = []
  let cur = ''
  let q = false
  let closed = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++ } else { q = false; closed = true }
      } else if (!(ch === '\r' && s[i + 1] === '\n')) cur += ch
      continue
    }
    // 닫는 따옴표 바로 뒤에는 구분자만 올 수 있다 · 인용은 칸의 처음에서만 연다(RFC 4180)
    if (closed && ch !== ',' && ch !== '\r' && ch !== '\n') throw new Error('닫는 따옴표 뒤에 글자가 있다')
    closed = false
    if (ch === '"') {
      if (cur !== '') throw new Error('인용하지 않은 칸 중간에 따옴표가 있다')
      q = true
    } else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\r') { /* skip */ }
    else if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = '' }
    else cur += ch
  }
  if (q) throw new Error('닫히지 않은 따옴표가 있다')
  if (cur !== '' || row.length) { row.push(cur); out.push(row) }
  return out
}

/** 채점 CSV 하나 → { scorer, stage, rows, problems } */
export function readSheet(text, label = 'csv') {
  let recs
  try {
    recs = parseCsvRecords(text)
  } catch (e) {
    return { scorer: label, stage: null, rows: [], problems: [`${label}: ${e.message}`] }
  }
  let scorer = label
  let stage = null
  const problems = []
  if (recs[0]?.join(',').startsWith('#')) {
    const m = /scorer=([^;]*);stage=(\w+)/.exec(recs[0].join(','))
    if (m) { scorer = m[1] || label; stage = m[2] }
    recs.shift()
  }
  const cols = recs.shift()
  if (!cols || cols.join(',') !== CSV_COLUMNS.join(',')) {
    return { scorer, stage, rows: [], problems: [`${label}: 열이 계약과 다르다`] }
  }
  const rows = []
  for (const r of recs) {
    if (r.length === 1 && r[0] === '') continue
    if (r.length !== CSV_COLUMNS.length) { problems.push(`${label}: 열 수 ${r.length} 행`); continue }
    const o = Object.fromEntries(CSV_COLUMNS.map((c, i) => [c, r[i]]))
    // 공백만 있는 칸도 미입력이다 — Number(' ') 은 0 이라 그대로 두면 빈 점수가 0점으로 집계된다(T-0158 Codex 3차 P1)
    const A = o.score_A.trim() === '' ? null : Number(o.score_A)
    const B = o.score_B.trim() === '' ? null : Number(o.score_B)
    const okScore = (v) => Number.isInteger(v) && v >= 0 && v <= 10
    const ynu = (v) => v === '예' || v === '아니오' || v === '모름'
    if (!okScore(A) || !okScore(B)) problems.push(`${label} ${o.blind}: 점수 누락·범위 밖`)
    if (!ynu(o.teaches_wrong_rule_1)) problems.push(`${label} ${o.blind}: 1단계 「틀린 규칙」 미답`)
    if (!ynu(o.teaches_wrong_rule_2)) problems.push(`${label} ${o.blind}: 2단계 「틀린 규칙」 미답`)
    // 계약 §2 — 반례 후보 판정 없이 2단계를 냈으면 제출이 아니다(후보 없는 대본은 「해당 없음」)
    if (!o.ce_adjudication.trim()) problems.push(`${label} ${o.blind}: 2단계 반례 판정 빈칸`)
    rows.push({ ...o, score_A: A, score_B: B })
  }
  if (stage !== 'locked2') problems.push(`${label}: 2단계 잠금(locked2) 전 — 제출 파일이 아니다`)
  return { scorer, stage, rows, problems }
}

/** 키 → blind 별 집단. 'bad' | 'good'. 개수가 계약(14/12)과 다르면 오류 */
export function keyGroups(key) {
  const g = new Map()
  for (const k of key) g.set(k.blind, k.group === 'bad' ? 'bad' : k.group.startsWith('good') ? 'good' : 'unknown')
  const n = { bad: 0, good: 0, unknown: 0 }
  for (const v of g.values()) n[v]++
  const problems = []
  if (n.bad !== EXPECTED.bad || n.good !== EXPECTED.good || n.unknown) {
    problems.push(`키 집단 수가 계약과 다르다: bad ${n.bad}/${EXPECTED.bad} · good ${n.good}/${EXPECTED.good} · 미상 ${n.unknown}`)
  }
  return { groups: g, problems }
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const r3 = (x) => Math.round(x * 1000) / 1000

/**
 * @param sheets readSheet 결과 배열(1명 이상)
 * @param key grader_regression_key.json 내용
 * @param rekeyed H5 재감수로 바뀐 키 { [blind]: 'bad'|'good' } — 있으면 그 키로 H2~H4 재계산
 */
export function aggregate(sheets, key, rekeyed = {}) {
  const problems = []
  if (!sheets.length) problems.push('사람 채점 CSV 가 없다(H1)')
  for (const s of sheets) problems.push(...s.problems)
  const { groups, problems: kp } = keyGroups(key)
  problems.push(...kp)
  // H5 재감수 값은 'bad' | 'good' 만 — null·오타가 「해결됨」으로 세지 않게(T-0158 Codex 2차 P1)
  for (const [b, v] of Object.entries(rekeyed)) {
    if (!groups.has(b)) problems.push(`재감수: 키에 없는 대본 ${b}`)
    if (v !== 'bad' && v !== 'good') problems.push(`재감수: ${b} 값 ${JSON.stringify(v)} 는 bad/good 이 아니다`)
  }
  for (const s of sheets) {
    const blinds = new Set(s.rows.map((r) => r.blind))
    for (const b of groups.keys()) if (!blinds.has(b)) problems.push(`${s.scorer}: ${b} 행 없음`)
    for (const b of blinds) if (!groups.has(b)) problems.push(`${s.scorer}: 키에 없는 행 ${b}`)
    if (blinds.size !== s.rows.length) problems.push(`${s.scorer}: 중복 행`)
  }
  if (problems.length) return { verdict: 'INCOMPLETE', problems }

  // 채점자 평균(2명 이상이면 대본별 평균)
  const per = new Map()
  for (const b of groups.keys()) {
    const rs = sheets.map((s) => s.rows.find((r) => r.blind === b))
    per.set(b, { A: mean(rs.map((r) => r.score_A)), B: mean(rs.map((r) => r.score_B)), wrong2: rs.map((r) => r.teaches_wrong_rule_2) })
  }

  // H5 — 사람 2단계 「틀린 규칙」 다수와 키가 어긋난 대본
  const mismatches = []
  for (const [b, g] of groups) {
    const w = per.get(b).wrong2
    const yes = w.filter((x) => x === '예').length
    const no = w.filter((x) => x === '아니오').length
    const human = yes > no ? 'bad' : no > yes ? 'good' : 'undecided'
    if (human !== g) mismatches.push({ blind: b, key: g, human })
  }
  const unresolved = mismatches.filter((m) => !(m.blind in rekeyed))
  const eff = new Map([...groups].map(([b, g]) => [b, rekeyed[b] ?? g]))

  const drop = (grp) => mean([...eff].filter(([, g]) => g === grp).map(([b]) => per.get(b).A - per.get(b).B))
  const goodDrop = drop('good')
  const badDrop = drop('bad')
  const badBlinds = [...eff].filter(([, g]) => g === 'bad').map(([b]) => b)
  const badLow = badBlinds.filter((b) => per.get(b).B <= THRESHOLDS.H4_lowScore).length

  let agreement = null
  if (sheets.length >= 2) {
    const [x, y] = sheets
    const within = [...groups.keys()].filter((b) => {
      const p = x.rows.find((r) => r.blind === b)
      const q = y.rows.find((r) => r.blind === b)
      return Math.abs(p.score_A - q.score_A) <= 2 && Math.abs(p.score_B - q.score_B) <= 2
    }).length
    agreement = { pair: [x.scorer, y.scorer], withinTwo: within, total: groups.size, ratio: r3(within / groups.size) }
  }

  const H = {
    H1: { pass: sheets.length >= 1, value: sheets.length },
    H2: { pass: goodDrop <= THRESHOLDS.H2_goodDropMax, value: r3(goodDrop) },
    H3: { pass: badDrop >= THRESHOLDS.H3_badDropMin, value: r3(badDrop) },
    H4: { pass: badLow >= THRESHOLDS.H4_badLowMin, value: `${badLow}/${badBlinds.length}` },
    H5: { pass: unresolved.length === 0, value: `재감수 대상 ${mismatches.length} · 미해결 ${unresolved.length}` },
  }
  const allPass = Object.values(H).every((h) => h.pass)
  return {
    verdict: allPass ? 'RESUME_ALLOWED' : 'NOT_MET',
    H,
    mismatches,
    agreement,
    note: allPass
      ? '재개 기준 충족 — 생성 지침 승격은 별도 사람 결정(자동 승격 없음)'
      : '미충족 — GRADER 는 그대로 둔다. 다음 후보: 반례 점검 단계를 채점 전에 넣는 설계(계약 §4)',
  }
}
