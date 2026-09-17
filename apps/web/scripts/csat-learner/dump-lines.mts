// apps/web/scripts/csat-learner/dump-lines.mts
//
// 조사용 — 한 회차 문제지의 조각을 줄로 묶어 찍는다. **원문이 나오므로 출력은 저장소 밖으로.**
//   npx tsx scripts/csat-learner/dump-lines.mts 2026 > <스크래치패드>/2026.lines.txt

import fs from 'node:fs'
import path from 'node:path'

import { localPapers, pdfPages } from './env.mts'

const exam = process.argv[2] ?? '2026'
const anchors = JSON.parse(fs.readFileSync(path.resolve(`src/lib/csat/anchor-data/${exam}.json`), 'utf8'))
const file = localPapers().get(anchors.sha256)
if (!file) throw new Error(`${exam} 원본이 없다`)
const pages = await pdfPages(file)
for (const pg of pages.slice(0, anchors.form_pages)) {
  console.log(`=== page ${pg.p} ${pg.w}x${pg.h}`)
  const sorted = [...pg.frags].sort((a, b) => b.y - a.y || a.x - b.x)
  for (const f of sorted) console.log(`${f.y.toFixed(1).padStart(7)} ${f.x.toFixed(1).padStart(6)} w${f.w.toFixed(0).padStart(4)} h${f.h.toFixed(1)} |${f.str}|`)
}
