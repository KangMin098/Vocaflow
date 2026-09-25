// apps/web/scripts/csat-learner/blank-probe.mts
//
// **빈칸은 PDF 에서 무엇인가 — 글자인가, 그린 선인가.** (2026-09-25 · blank-audit 후속 탐침)
// 한 회차 한 문항의 쪽에서 (1) 글자 조각에 밑줄 문자가 있는지 (2) 가로 선 도형이 몇 개 그려지는지 센다.
// 원문은 찍지 않는다 — 좌표와 개수만.
//   npx tsx scripts/csat-learner/blank-probe.mts --exam M2706 --no 31

import fs from 'node:fs'
import path from 'node:path'

import { arg, localPapers } from './env.mts'

const exam = arg('exam') ?? 'M2706'
const no = Number(arg('no') ?? 31)
const anchors = JSON.parse(fs.readFileSync(path.resolve(`src/lib/csat/anchor-data/${exam}.json`), 'utf8'))
const file = localPapers().get(anchors.sha256)
if (!file) throw new Error('로컬 PDF 없음')
const at = anchors.items.find((i: { no: number }) => i.no === no)
const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)) }).promise
const page = await doc.getPage(at.p)

const text = await page.getTextContent()
const underscoreFrags = text.items.filter((t: { str?: string }) => /_{2,}|＿/.test(t.str ?? '')).length

const ops = await page.getOperatorList()
let paths = 0
let rects = 0
let hlines = 0
for (let i = 0; i < ops.fnArray.length; i++) {
  const fn = ops.fnArray[i]
  if (fn === OPS.constructPath) {
    paths++
    const args = ops.argsArray[i]
    const opList: number[] = Array.isArray(args[0]) ? args[0] : []
    if (opList.includes(OPS.rectangle)) rects++
    // 가로 선: minMax 가 [x0, y0, x1, y1] 로 오고 높이가 거의 0 이면 가로 선이다
    const mm = args.find?.((a: unknown) => Array.isArray(a) && a.length === 4 && typeof a[0] === 'number') ?? args[2]
    if (mm && Math.abs(mm[3] - mm[1]) < 1.5 && Math.abs(mm[2] - mm[0]) > 20) hlines++
  }
}
console.log(`${exam}#${no} · 쪽 ${at.p} · 밑줄 문자 조각 ${underscoreFrags} · 경로 ${paths} · 사각형 ${rects} · 가로 선(폭>20·높이<1.5) ${hlines}`)
