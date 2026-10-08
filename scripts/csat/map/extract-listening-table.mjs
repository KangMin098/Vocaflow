// scripts/csat/map/extract-listening-table.mjs
//
// 승인된 B1–B5 듣기 번호표 → source/listening-approved.json.
// 입력은 Codex 가 원본 시험지 PDF 발문과 대조해 남긴 대조표 JSON(approvalStatus 는 승인 전 pending).
// 승인된 6회(2026-10-02)만 담는다 — 다른 회차에는 자동 적용하지 않는다. 발문 · PDF 경로는 옮기지 않고 SHA256 만 남긴다.
//
//   node scripts/csat/map/extract-listening-table.mjs <대조표.json>

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'source', 'listening-approved.json')
const APPROVED = ['M2706', '2026', 'M2609', 'M2606', '2025', 'M2509']
const LINES = new Set(['B1', 'B2', 'B3', 'B4', 'B5'])

const src = process.argv[2]
if (!src) {
  console.error('사용: node scripts/csat/map/extract-listening-table.mjs <대조표.json>')
  process.exit(1)
}
const d = JSON.parse(fs.readFileSync(src, 'utf8'))

const exams = APPROVED.map((id) => {
  const e = d.exams.find((x) => x.examId === id)
  if (!e) throw new Error(`대조표에 ${id} 가 없다`)
  if (e.items.length !== 17) throw new Error(`${id}: 듣기 17문항이 아니다(${e.items.length})`)
  for (const i of e.items) if (!LINES.has(i.proposedLine)) throw new Error(`${id} ${i.no}번: 알 수 없는 라인 ${i.proposedLine}`)
  return { examId: id, label: e.label, sha256: e.sha256, items: e.items.map((i) => ({ no: i.no, line: i.proposedLine, verifiedType: i.verifiedType })) }
})

// 여섯 회차가 같은 구성인지 — 다르면 승인 범위를 다시 본다
const sig = (e) => e.items.map((i) => `${i.no}:${i.line}`).join(',')
const same = exams.every((e) => sig(e) === sig(exams[0]))
if (!same) throw new Error('여섯 회차의 번호표가 서로 다르다 — 회차별로 확인이 필요하다')

const out = {
  approvedAt: '2026-10-02',
  scope: '명시된 6회만. 다른 회차에는 공통 적용하지 않는다.',
  note: 'B4 = 11~15번(대화 응답 · 상황에 적절한 말). 대본으로 확인하지 않은 대화 길이는 유형에 넣지 않는다.',
  exams,
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
const byLine = {}
for (const i of exams[0].items) (byLine[i.line] ??= []).push(i.no)
console.log(`승인 ${exams.length}회 · 회차마다 ${exams[0].items.length}문항 · 구성 동일`)
for (const [l, nos] of Object.entries(byLine)) console.log(`  ${l}: ${nos.join('·')}`)
