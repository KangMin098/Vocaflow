// 위험 cue 916 감사(E · F + 3자 G) → sidecar-v2. 원본 대본은 읽기만. sidecar-final 은 고치지 않는다(새 버전 폴더).
// 사용: node review4-merge.mjs <scratch review4 폴더>
//
// 규칙: E=F → 그 값 · E≠F → G 가 E 나 F 와 같으면 그 값(2:1) · 셋 다 다르면 UNKNOWN.
// 근거 검증: quote 가 cue 원문 부분 문자열 · 해시 일치 · why 중복 없음 — 위반 판정은 버린다.
// 최종 지역 수준은 기존 최종값보다 낮추지 않는다(보수: 높은 쪽). 낮아질 판정은 「하향 이견」 으로 센다.
// 감사가 끝난 cue 는 risk_unaudited=false, review.audit4 에 판정 셋을 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const inDir = process.argv[2]
const L = ['NONE', 'HINT', 'DECISIVE', 'ANSWER']
const r = (x) => L.indexOf(x)

const text = {}
for (let k = 1; k <= 4; k++) for (const it of JSON.parse(fs.readFileSync(path.join(inDir, `part-${k}.json`), 'utf8')).items) for (const c of it.cues) text[`${it.lecture_id}|${c.cue_id}`] = { t: c.text, h: c.source_hash, judge: c.judge }
const load = (f) => {
  const o = JSON.parse(fs.readFileSync(path.join(here, 'review4', f), 'utf8'))
  const whys = {}
  for (const it of o.items) for (const c of it.cues) whys[c.why] = (whys[c.why] ?? 0) + 1
  const m = {}
  let bad = 0
  for (const it of o.items) for (const c of it.cues) {
    const key = `${it.lecture_id}|${c.cue_id}`
    const x = text[key]
    if (!x || x.h !== c.source_hash || !L.includes(c.local) || typeof c.quote !== 'string' || c.quote.length < 8 || !x.t.includes(c.quote) || whys[c.why] > 1) { bad++; continue }
    m[key] = c
  }
  return [m, bad]
}
const E = {}, F = {}, G = {}
const invalid = { E: 0, F: 0, G: 0 }
for (let k = 1; k <= 4; k++) { const [e, be] = load(`part-${k}.E.json`); const [f, bf] = load(`part-${k}.F.json`); Object.assign(E, e); Object.assign(F, f); invalid.E += be; invalid.F += bf }
for (let k = 1; k <= 2; k++) { const [g, bg] = load(`third-${k}.G.json`); Object.assign(G, g); invalid.G += bg }

const stats = { audited: 0, invalid, agree_EF: 0, resolved_by_G: 0, unresolved: 0, raised: 0, lowered_but_kept: 0, unchanged: 0, final_local: { NONE: 0, HINT: 0, DECISIVE: 0, ANSWER: 0, UNKNOWN: 0 }, raised_to: {} }
const src = path.join(here, 'sidecar-final')
const out = path.join(here, 'sidecar-v2')
fs.mkdirSync(out, { recursive: true })
for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.disclosure.json')).sort()) {
  const sc = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'))
  sc.schema = 'csat-lecture-disclosure-sidecar/v2'
  sc.derived_from = 'sidecar-final + 위험 cue 감사(review4: E · F · G, 지문 · 선지 맥락)'
  for (const l of sc.lectures) {
    let cum = 'NONE'
    let cumUnknown = false
    for (const c of l.cues) {
      if (!c.review?.reviewers || c.review.reviewers.length < 2) continue
      const key = `${l.lecture_id}|${c.cue_id}`
      if (c.review.risk_unaudited && text[key]?.judge) {
        stats.audited++
        const e = E[key], ff = F[key], g = G[key]
        let level = null
        if (e && ff && e.local === ff.local) { level = e.local; stats.agree_EF++ }
        else if (g && ((e && g.local === e.local) || (ff && g.local === ff.local))) { level = g.local; stats.resolved_by_G++ }
        else stats.unresolved++
        c.review.audit4 = { E: e ? { local: e.local, quote: e.quote, why: e.why, confidence: e.confidence } : null, F: ff ? { local: ff.local, quote: ff.quote, why: ff.why, confidence: ff.confidence } : null, G: g ? { local: g.local, quote: g.quote, why: g.why, confidence: g.confidence } : null, consensus: level }
        const prev = c.local_disclosure_level
        if (level == null) c.local_disclosure_level = 'UNKNOWN'
        else if (r(level) > r(prev)) { c.local_disclosure_level = level; stats.raised++; stats.raised_to[`${prev}->${level}`] = (stats.raised_to[`${prev}->${level}`] ?? 0) + 1 }
        else if (r(level) < r(prev)) stats.lowered_but_kept++
        else stats.unchanged++
        c.review.risk_unaudited = false
        c.review.final_source = level == null ? 'audit4_unresolved' : r(level) > r(prev) ? 'audit4_raised' : c.review.final_source ?? 'two_agree'
        stats.final_local[c.local_disclosure_level]++
      }
      if (c.local_disclosure_level === 'UNKNOWN') cumUnknown = true
      else cum = L[Math.max(r(cum), r(c.local_disclosure_level))]
      c.cumulative_lower_bound = L[Math.max(r(cum), r(c.cumulative_lower_bound ?? 'NONE'))]
      c.cumulative_disclosure_level = cumUnknown ? 'UNKNOWN' : c.cumulative_lower_bound
    }
  }
  fs.writeFileSync(path.join(out, f), JSON.stringify(sc, null, 1))
}
const remain = { risk_unaudited: 0, pre_answer: 0, local: { NONE: 0, HINT: 0, DECISIVE: 0, ANSWER: 0, UNKNOWN: 0 } }
for (const f of fs.readdirSync(out).filter((x) => x.endsWith('.disclosure.json'))) for (const l of JSON.parse(fs.readFileSync(path.join(out, f), 'utf8')).lectures) for (const c of l.cues) {
  if (!c.review?.reviewers || c.review.reviewers.length < 2) continue
  remain.pre_answer++
  remain.local[c.local_disclosure_level]++
  if (c.review.risk_unaudited) remain.risk_unaudited++
}
stats.after = remain
fs.writeFileSync(path.join(here, 'review4-summary.json'), JSON.stringify(stats, null, 1))
console.log(JSON.stringify(stats, null, 1))
