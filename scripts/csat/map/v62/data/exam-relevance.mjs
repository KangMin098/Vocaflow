// scripts/csat/map/v62/data/exam-relevance.mjs
//
// 시험별 TASK 관련 문항 · 배점 — 두 독립 AI 가 일치한 R1 후보만(pilot · r5r6 링크). 사람 검수 · NeedRank 입력이 아니다.
// R6 는 4값 κ 미달(.70)이고 direct 이분 κ 만 .95 → R6 는 direct 만 센다. R5 는 direct · indirect 를 나눠 센다.
//   node scripts/csat/map/v62/data/exam-relevance.mjs  → docs/csat-learner/v62/data-expansion/exam-relevance.json
import fs from 'node:fs'
import path from 'node:path'

import { LOCAL, ROOT } from './pilot-lib.mjs'

const DIR = path.join(ROOT, 'docs/csat-learner/v62/data-expansion')
const pts = new Map()
for (const f of ['pilot-input.json', 'expand-input.json']) for (const r of JSON.parse(fs.readFileSync(path.join(LOCAL, f), 'utf8')).rows) pts.set(r.item_id, { exam: r.item_id.split('#')[0], points: r.source.points ?? null })
const links = [
  ...JSON.parse(fs.readFileSync(path.join(DIR, 'pilot-links.json'), 'utf8')).links.filter((l) => l.task === 'r.central_meaning' || l.task === 'r.inference'),
  ...JSON.parse(fs.readFileSync(path.join(DIR, 'r5r6-links.json'), 'utf8')).links,
]
const exams = {}
for (const [id, p] of pts) (exams[p.exam] ??= { items: 0, points: 0, points_unknown: 0, R5_direct: [], R5_indirect: [], R6_direct: [], disputed: 0, source_defect: 0 }), exams[p.exam].items++, p.points == null ? exams[p.exam].points_unknown++ : (exams[p.exam].points += p.points)
for (const l of links) {
  const p = pts.get(l.item)
  if (!p) continue
  const e = exams[p.exam]
  if (l.state === 'SOURCE_DEFECT') { e.source_defect++; continue }
  if (l.state === 'DISPUTED') { e.disputed++; continue }
  if (l.task === 'r.central_meaning' && l.candidateRelevance === 'direct') e.R5_direct.push(l.item)
  if (l.task === 'r.central_meaning' && l.candidateRelevance === 'indirect') e.R5_indirect.push(l.item)
  if (l.task === 'r.inference' && l.candidateRelevance === 'direct') e.R6_direct.push(l.item)
}
const sumPts = (ids) => ids.reduce((s, id) => s + (pts.get(id).points ?? 0), 0)
const rows = Object.fromEntries(Object.entries(exams).sort().map(([k, e]) => [k, { reading_items: e.items, reading_points: e.points, points_unknown_items: e.points_unknown, R5_direct: { items: e.R5_direct.length, points: sumPts(e.R5_direct), ids: e.R5_direct.sort() }, R5_indirect: { items: e.R5_indirect.length, points: sumPts(e.R5_indirect) }, R6_direct: { items: e.R6_direct.length, points: sumPts(e.R6_direct), ids: e.R6_direct.sort() }, disputed_pairs: e.disputed, source_defect_pairs: e.source_defect }]))
fs.writeFileSync(path.join(DIR, 'exam-relevance.json'), JSON.stringify({ note: 'R1(두 독립 AI 일치) 후보 — 사람 검수 0 · relevance=unknown. 문항 수 · 배점은 독해 범위(18–45)만. 한 문항이 R5 · R6 에 함께 걸리면 각 TASK 에 센다(문항 배점을 TASK 간 합산하지 않는다).', exams: rows }, null, 1) + '\n')
const v = Object.values(rows)
const avg = (k) => (v.reduce((s, r) => s + r[k].points, 0) / v.length).toFixed(1)
console.log(`시험 ${v.length} · 평균 R5 direct ${avg('R5_direct')}점 · R6 direct ${avg('R6_direct')}점 / 독해 평균 ${(v.reduce((s, r) => s + r.reading_points, 0) / v.length).toFixed(1)}점`)
for (const [k, r] of Object.entries(rows).slice(-6)) console.log(`  ${k}: R5 ${r.R5_direct.items}문항 ${r.R5_direct.points}점 · R6 ${r.R6_direct.items}문항 ${r.R6_direct.points}점 · 갈림 ${r.disputed_pairs} · 결함 ${r.source_defect_pairs}`)
