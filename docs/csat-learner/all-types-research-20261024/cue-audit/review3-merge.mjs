// 3자 판정(C) · 위험 표본 감사(D)를 sidecar-reviewed 에 더해 sidecar-final 을 만든다 — 원본 대본은 읽기만.
// 사용: node review3-merge.mjs
//
// 근거 품질 검증(엄격): C · D 의 판정은 quote 가 cue 원문의 부분 문자열(8자 이상)이고, why 가 다른 판정과 같은 문구가 아니며,
// source_hash 가 sidecar 와 같을 때만 반영한다. 통과 못 한 판정은 버리고 수를 센다.
//
// 반영 규칙:
//  · 불일치 · 저확신 · 누적 불일치 cue: C 가 A · B 중 한쪽과 같으면 그 값으로 확정(final_source='third', 2:1), 셋이 모두 다르면 UNKNOWN 유지
//  · 위험 표본(합의 NONE/HINT): D 가 더 높게 보면 그 cue 를 「과소 판정 의심」 으로 표시하고 최종값을 올린다(높은 쪽 · 보수)
//  · 위험 표지가 있으나 감사하지 않은 합의 cue 는 risk_unaudited=true — 제품에서 「결정적 단서 가능」 으로 다룬다
//  · 승격(promoted)은 2인 합의 + high 이면서 위험 표지 없음 또는 감사 통과일 때만
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const L = ['NONE', 'HINT', 'DECISIVE', 'ANSWER']
const r = (x) => L.indexOf(x)
const read = (p) => JSON.parse(fs.readFileSync(path.join(here, p), 'utf8'))

const text = {}
for (let g = 1; g <= 5; g++) for (const it of read(`review/group-${g}.json`).items) for (const c of it.cues) text[`${it.lecture_id}|${c.cue_id}`] = c.text
const riskIn = read('review3/risk-sample.json')

const stats = { third: { files: [], judged: 0, rejected_quote: 0, rejected_hash: 0, rejected_label: 0, duplicate_why: 0, resolved_2to1: 0, still_unknown: 0, raised_over_both: 0 }, audit: { judged: 0, rejected: 0, under_rated: 0, by_risk: {} }, risk_population: riskIn.population, risk_unaudited: 0 }
const valid = (c, key) => {
  const t = text[key]
  if (!t) return 'nokey'
  if (!L.includes(c.local) || (c.cumulative && !L.includes(c.cumulative))) return 'label'
  if (typeof c.quote !== 'string' || c.quote.length < 8 || !t.includes(c.quote)) return 'quote'
  return null
}

const third = {}
const whyCount = {}
for (let p = 1; p <= 3; p++) {
  const f = `review3/third-${p}.C.json`
  if (!fs.existsSync(path.join(here, f))) continue
  stats.third.files.push(f)
  for (const it of read(f).items) for (const c of it.cues) { whyCount[c.why] = (whyCount[c.why] ?? 0) + 1; third[`${it.lecture_id}|${c.cue_id}`] = c }
}
const audit = {}
if (fs.existsSync(path.join(here, 'review3/risk-sample.D.json'))) for (const c of read('review3/risk-sample.D.json').items) audit[`${c.lecture_id}|${c.cue_id}`] = c
const riskKeys = new Map(riskIn.items.map((x) => [`${x.lecture_id}|${x.cue_id}`, x.risk]))

// 위험 표지 전체 모집단(감사 안 된 것 포함)을 다시 계산 — risk-sample 생성 규칙과 같다
const idx = JSON.parse(execFileSync('git', ['-C', process.env.REPO ?? 'D:/workspace/Vocaflow', 'show', 'main:apps/web/src/lib/csat/lecture-data/index.json'], { encoding: 'utf8' })).items
const riskOf = (lecture_id, c, t, type) => {
  const m = []
  if (c.auto.rules.some((x) => x.startsWith('R4') || x.startsWith('R5'))) m.push('names_option')
  if (c.target === 'analysis:intent') m.push('intent')
  if (c.target === 'analysis:map' && /ORDER|INSERT/.test(type ?? '')) m.push('map_order')
  if (/(줄|자리|조건만|뒤집|하나만|빼고|나머지|가장 먼저)/.test(t ?? '')) m.push('locator_phrase')
  return m
}

const out = path.join(here, 'sidecar-final')
fs.mkdirSync(out, { recursive: true })
for (const f of fs.readdirSync(path.join(here, 'sidecar-reviewed')).filter((x) => x.endsWith('.disclosure.json')).sort()) {
  const sc = read(`sidecar-reviewed/${f}`)
  for (const l of sc.lectures) {
    let cum = 'NONE'
    let cumUnknown = false
    for (const c of l.cues) {
      if (!c.review.reviewers || c.review.reviewers.length < 2) continue // 확정 공개 이후 · 규칙 확정
      const key = `${l.lecture_id}|${c.cue_id}`
      const [A, B] = c.review.reviewers
      // 3자 판정
      const C = third[key]
      if (C) {
        stats.third.judged++
        const bad = C.source_hash !== c.source_hash ? 'hash' : valid(C, key)
        if (bad === 'hash') stats.third.rejected_hash++
        else if (bad === 'quote') stats.third.rejected_quote++
        else if (bad) stats.third.rejected_label++
        else if (whyCount[C.why] > 3) stats.third.duplicate_why++
        else {
          c.review.third = { local: C.local, cumulative: C.cumulative, channels: C.channels, quote: C.quote, why: C.why, confidence: C.confidence }
          const votes = [A.local, B.local, C.local]
          const maj = L.find((x) => votes.filter((v) => v === x).length >= 2)
          if (maj) { c.local_disclosure_level = maj; c.review.final_source = 'third'; c.review.conflict = false; stats.third.resolved_2to1++ }
          else { c.local_disclosure_level = 'UNKNOWN'; c.review.final_source = 'unresolved'; stats.third.still_unknown++ }
          if (r(C.local) > Math.max(r(A.local), r(B.local))) stats.third.raised_over_both++
        }
      }
      // 위험 감사
      const D = audit[key]
      if (D) {
        stats.audit.judged++
        const bad = D.source_hash !== c.source_hash || valid(D, key)
        if (bad) stats.audit.rejected++
        else {
          c.review.audit = { local: D.local, cumulative: D.cumulative, under_rated: D.under_rated, quote: D.quote, why: D.why, confidence: D.confidence }
          if (r(D.local) > r(c.local_disclosure_level)) {
            stats.audit.under_rated++
            for (const m of riskKeys.get(key) ?? []) stats.audit.by_risk[m] = (stats.audit.by_risk[m] ?? 0) + 1
            c.local_disclosure_level = D.local
            c.review.final_source = 'audit_raised'
          }
        }
      }
      const marks = riskOf(l.lecture_id, c, text[key], idx[l.lecture_id]?.type)
      c.review.risk_markers = marks
      c.review.risk_unaudited = marks.length > 0 && !c.review.audit && ['NONE', 'HINT'].includes(c.local_disclosure_level)
      if (c.review.risk_unaudited) stats.risk_unaudited++
      c.review.promoted = Boolean(c.review.promoted && !c.review.risk_unaudited && c.review.final_source !== 'audit_raised')
      // 누적(확정 공개 전): 최종 지역값의 단조 최대. UNKNOWN 이 끼면 이후 UNKNOWN
      if (c.local_disclosure_level === 'UNKNOWN') cumUnknown = true
      else cum = L[Math.max(r(cum), r(c.local_disclosure_level))]
      c.cumulative_lower_bound = L[Math.max(r(cum), r(c.cumulative_lower_bound ?? 'NONE'))]
      c.cumulative_disclosure_level = cumUnknown ? 'UNKNOWN' : c.cumulative_lower_bound
    }
  }
  fs.writeFileSync(path.join(out, f), JSON.stringify(sc, null, 1))
}

// 최종 상태 집계(확정 공개 전 cue)
const fin = { NONE: 0, HINT: 0, DECISIVE: 0, ANSWER: 0, UNKNOWN: 0 }
const src = {}
let pre = 0
let promoted = 0
for (const f of fs.readdirSync(out).filter((x) => x.endsWith('.disclosure.json'))) {
  for (const l of read(`sidecar-final/${f}`).lectures) for (const c of l.cues) {
    if (!c.review.reviewers || c.review.reviewers.length < 2) continue
    pre++
    fin[c.local_disclosure_level]++
    const s = c.review.final_source ?? (c.review.status === 'reviewed_agree' ? 'two_agree' : c.review.status)
    src[s] = (src[s] ?? 0) + 1
    if (c.review.promoted) promoted++
  }
}
stats.final = { pre_answer_cues: pre, local: fin, source: src, promoted }
fs.writeFileSync(path.join(here, 'review3-summary.json'), JSON.stringify(stats, null, 1))
console.log(JSON.stringify(stats, null, 1))
