// 위험 cue 916 감사 — 검토자 E · F 비교 · 근거 엄격 검증 · 불일치 추출(3자 G 입력). 원본 대본은 읽기만.
// 사용: node review4-compare.mjs <scratch review4 폴더(part-N.json 입력)>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const inDir = process.argv[2]
const L = ['NONE', 'HINT', 'DECISIVE', 'ANSWER']
const stats = { judged: 0, both_valid: 0, rejected: { E: 0, F: 0 }, reject_reason: {}, agree_local: 0, conflict_local: 0, agree_cumulative: 0, confusion: {}, duplicate_why: { E: 0, F: 0 } }
const conflicts = []
const pairs = []
for (let k = 1; k <= 4; k++) {
  const inp = JSON.parse(fs.readFileSync(path.join(inDir, `part-${k}.json`), 'utf8'))
  const meta = {}
  for (const it of inp.items) for (const c of it.cues) if (c.judge) meta[`${it.lecture_id}|${c.cue_id}`] = c
  const out = {}
  for (const w of ['E', 'F']) {
    const o = JSON.parse(fs.readFileSync(path.join(here, 'review4', `part-${k}.${w}.json`), 'utf8'))
    const whys = {}
    for (const it of o.items) for (const c of it.cues) whys[c.why] = (whys[c.why] ?? 0) + 1
    for (const it of o.items) for (const c of it.cues) {
      const key = `${it.lecture_id}|${c.cue_id}`
      const m = meta[key]
      let bad = null
      if (!m) bad = 'unknown_cue'
      else if (c.source_hash !== m.source_hash) bad = 'hash'
      else if (!L.includes(c.local) || !L.includes(c.cumulative)) bad = 'label'
      else if (typeof c.quote !== 'string' || c.quote.length < 8 || !m.text.includes(c.quote)) bad = 'quote'
      else if (whys[c.why] > 1) { bad = 'duplicate_why'; stats.duplicate_why[w]++ }
      if (bad) { stats.rejected[w]++; stats.reject_reason[bad] = (stats.reject_reason[bad] ?? 0) + 1; continue }
      ;(out[key] ??= {})[w] = c
    }
  }
  for (const [key, m] of Object.entries(meta)) {
    stats.judged++
    const { E, F } = out[key] ?? {}
    if (!E || !F) { conflicts.push({ key, part: k, why: 'missing_valid_review' }); continue }
    stats.both_valid++
    pairs.push([E.local, F.local])
    stats.confusion[`${E.local}/${F.local}`] = (stats.confusion[`${E.local}/${F.local}`] ?? 0) + 1
    if (E.cumulative === F.cumulative) stats.agree_cumulative++
    if (E.local === F.local) stats.agree_local++
    else { stats.conflict_local++; conflicts.push({ key, part: k, why: 'local_conflict' }) }
  }
}
const n = pairs.length
const po = pairs.filter(([a, b]) => a === b).length / n
const pe = L.reduce((s, x) => s + (pairs.filter(([a]) => a === x).length / n) * (pairs.filter(([, b]) => b === x).length / n), 0)
stats.agreement = { observed: Number(po.toFixed(3)), kappa: Number(((po - pe) / (1 - pe)).toFixed(3)), pairs: n }
stats.conflicts = conflicts.length

// 3자 G 입력 — 불일치 cue 만 judge, 같은 강의의 다른 cue 는 맥락(지문 · 선지 포함은 scratch 쪽 파일에만)
const byLecture = {}
for (const c of conflicts) (byLecture[c.key.split('|')[0]] ??= new Set()).add(c.key.split('|')[1])
const gParts = [[], []]
const load = [0, 0]
for (let k = 1; k <= 4; k++) {
  const inp = JSON.parse(fs.readFileSync(path.join(inDir, `part-${k}.json`), 'utf8'))
  for (const it of inp.items) {
    const need = byLecture[it.lecture_id]
    if (!need) continue
    const item = { ...it, cues: it.cues.map((c) => ({ ...c, judge: need.has(c.cue_id) })) }
    const j = load[0] <= load[1] ? 0 : 1
    gParts[j].push(item)
    load[j] += need.size
  }
}
gParts.forEach((p, i) => fs.writeFileSync(path.join(inDir, `third-${i + 1}.json`), JSON.stringify({ items: p }, null, 1)))
stats.third_parts = load
fs.writeFileSync(path.join(here, 'review4-compare-summary.json'), JSON.stringify(stats, null, 1))
console.log(JSON.stringify(stats, null, 1))
