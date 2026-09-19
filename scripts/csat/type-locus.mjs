// scripts/csat/type-locus.mjs
//
// **유형마다 정답 근거가 지문의 어디에 있는가 — 실측 분포.**
//
// 유형 화면은 「정답 근거는 어디 있나」를 **산문 1,763자**(최대 5,931자)로 말한다. 그건 주장이고,
// 주장은 학습자가 검증할 수 없다. 우리에게는 골격이 있으므로 **세어서 보여 줄 수 있다.**
//
// ── DB 를 타지 않는다 ─────────────────────────────────────────────────
// 골격 JSON 이 `type_id` 를 함께 들고 있으므로(2026-09-15부터) 이 분석은 **오프라인**이다.
// 그전에는 `item → type` 매핑이 DB 에만 있어서, 망이 끊긴 사이클마다 미뤄졌다(실측 3회).
//
// ── 무엇을 세는가 ─────────────────────────────────────────────────────
// 정답 앵커가 걸린 문장의 **상대 위치** = 문장번호 / (문장수 − 1). 0 이 첫 문장, 1 이 끝 문장.
// 문장이 하나뿐인 지문은 분모가 0 이라 뺀다(안내문 유형에 있다).
//
// ⚠️ **표본이 적은 유형은 수치를 내지 않는다.** 8문항 미만에서 「대개 뒤쪽」이라고 적으면
//    그건 관찰이 아니라 우연이다. 이 저장소가 되풀이해 경계하는 것이다.
//
// 읽기 전용.   node scripts/csat/type-locus.mjs [--min 8]

import fs from 'node:fs'
import path from 'node:path'

const MIN = (() => {
  const i = process.argv.indexOf('--min')
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : 8
})()

const DIR = path.resolve('apps/web/src/lib/csat/skeleton-data')
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'))
const items = index.exams.flatMap(
  (e) => JSON.parse(fs.readFileSync(path.join(DIR, `${e.exam_id}.json`), 'utf8')).items,
)

const byType = new Map()
let noType = 0
let tooShort = 0
for (const it of items) {
  const a = (it.anchors ?? []).find((x) => x.id === 'answer')
  if (!a || !a.sentences.length) continue
  if (it.sentences.length < 2) { tooShort += 1; continue }
  if (!it.type_id) { noType += 1; continue }
  const mid = a.sentences.reduce((s, x) => s + x, 0) / a.sentences.length
  const rel = mid / (it.sentences.length - 1)
  if (!byType.has(it.type_id)) byType.set(it.type_id, [])
  byType.get(it.type_id).push(rel)
}

const band = (r) => (r < 0.2 ? '앞머리' : r < 0.4 ? '앞' : r < 0.6 ? '가운데' : r < 0.8 ? '뒤' : '끝')
const all = [...byType.values()].flat()

console.log(`\n정답 근거 위치 — 문항 ${all.length} · 유형 ${byType.size}`)
console.log(`  (문장 1개뿐이라 제외 ${tooShort} · type_id 없음 ${noType})\n`)

const rows = [...byType]
  .filter(([, v]) => v.length >= MIN)
  .map(([t, v]) => {
    const avg = v.reduce((a, b) => a + b, 0) / v.length
    const late = v.filter((r) => r >= 0.6).length / v.length
    const early = v.filter((r) => r < 0.4).length / v.length
    return { type: t, n: v.length, avg, late, early }
  })
  .sort((a, b) => b.avg - a.avg)

const pct = (x) => `${Math.round(x * 100)}%`
console.log('유형'.padEnd(14) + 'n'.padStart(4) + '평균위치'.padStart(10) + '뒤·끝'.padStart(8) + '앞'.padStart(7))
for (const r of rows) {
  console.log(
    r.type.padEnd(14) + String(r.n).padStart(4) + r.avg.toFixed(2).padStart(10) +
      pct(r.late).padStart(8) + pct(r.early).padStart(7),
  )
}

const avgAll = all.reduce((a, b) => a + b, 0) / all.length
console.log(`\n전체 평균 ${avgAll.toFixed(2)} · 유형 편차(최대−최소) ${(rows[0].avg - rows[rows.length - 1].avg).toFixed(2)}`)
console.log(`표본 ${MIN} 미만이라 뺀 유형 ${byType.size - rows.length}개 — 적은 표본으로 규칙을 말하지 않는다`)

const dist = {}
for (const r of all) dist[band(r)] = (dist[band(r)] || 0) + 1
console.log('\n전체 분포')
for (const k of ['앞머리', '앞', '가운데', '뒤', '끝']) {
  const n = dist[k] || 0
  console.log('  ' + k.padEnd(5) + String(n).padStart(4) + ' ' + '█'.repeat(Math.round((n / all.length) * 50)))
}
