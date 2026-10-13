// scripts/csat/f08-paper-marks-audit.mts
//
// **F08 전량 감사 — 원본 크롭 위 밑줄 위치의 대응 가능 여부 · 이유 분포 + 빈칸 복원 회귀.**
// 로컬 공개 문제지가 있는 회차 전부에서 학습자 기기와 같은 길(pdf.js → reflowExam → cropMarksOf)을 밟는다.
//   · 밑줄 유형(VISUAL_PAPER_TYPES · 도표 제외) 문항마다: 선지별 대응(exact) · 이유(no_underline · ambiguous_underline) · 문항 이유
//   · 눈 대조용 PNG: 미대응 · 모호 문항 전부 + 성공 표본(유형별 회차마다 1)
//   · 빈칸 복원 회귀: 모든 문항 지문의 `______` 수를 기준 파일(--baseline)과 비교 — 기준은 main 코드로 만든 같은 출력
// 개발 전용(로컬 PDF) · 서버 · DB 에 쓰지 않는다(유형 조회만). 이 숫자는 이 PC 의 문제지 판본에 대한 결과다.
//
// 실행: NODE_ENV=development node --env-file=<메인 .env.local> --import tsx scripts/csat/f08-paper-marks-audit.mts <출력 폴더> [--baseline <blanks.json>]

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { localPaperPath } from '../../apps/web/src/lib/csat/reflow/dev-paper'
import { MARK_LINE_MIN, fragsOfContent, hlinesOfOps } from '../../apps/web/src/lib/csat/reflow/pdf-frags'
import { CROP_PAD, CROP_PAD_TOP, CROP_SCALE, markerKindOf } from '../../apps/web/src/lib/csat/reflow/paper-marks'
import { cropMarksOf } from '../../apps/web/src/lib/csat/reflow/read-paper'
import { VISUAL_PAPER_TYPES, reflowExam } from '../../apps/web/src/lib/csat/reflow/reflow'
import type { PageFrags, ReflowAnchors } from '../../apps/web/src/lib/csat/reflow/types'

const req = createRequire(path.resolve('apps/web/package.json'))
const pdfjs = await import(pathToFileURL(req.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href)
const { createCanvas } = req(path.resolve('node_modules/.pnpm/@napi-rs+canvas@1.0.9/node_modules/@napi-rs/canvas'))

const OUT = process.argv[2]
if (!OUT) throw new Error('출력 폴더를 주세요')
const bi = process.argv.indexOf('--baseline')
const baseline: Record<string, number> | null = bi > 0 ? JSON.parse(fs.readFileSync(process.argv[bi + 1], 'utf8')) : null
fs.mkdirSync(path.join(OUT, 'png'), { recursive: true })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const exams = fs.readdirSync(path.resolve('apps/web/src/lib/csat/anchor-data')).filter((f) => /^(M\d{4}|\d{4}[AB]?)\.json$/.test(f)).map((f) => f.replace('.json', ''))

const blanks: Record<string, number> = {}
const rows: Record<string, unknown>[] = []
const sampled = new Set<string>()
for (const exam of exams) {
  const file = localPaperPath(exam)
  if (!file) { rows.push({ exam, result: 'no_local_pdf' }); continue }
  const anchors = JSON.parse(fs.readFileSync(path.resolve(`apps/web/src/lib/csat/anchor-data/${exam}.json`), 'utf8')) as ReflowAnchors
  const { data: types, error } = await db.from('csat_items').select('no, type_id').eq('exam_id', exam)
  if (error) throw new Error(`유형 조회 실패 ${exam}: ${error.message}`)
  const typeOf = (no: number) => types?.find((r) => r.no === no)?.type_id ?? null
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise
  const pages: PageFrags[] = []
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const ops = await page.getOperatorList()
    pages.push({ p, w: vp.width, h: vp.height, frags: fragsOfContent((await page.getTextContent()).items), lines: hlinesOfOps(ops, pdfjs.OPS), markLines: hlinesOfOps(ops, pdfjs.OPS, MARK_LINE_MIN) })
  }
  const right = anchors.items.filter((i) => i.col === 1).map((i) => i.x).sort((a, b) => a - b)
  const gutter = right.length ? right[Math.floor(right.length / 2)] - 10 : pages[0].w / 2
  const items = reflowExam(pages, anchors, typeOf, anchors.items.map((a) => a.no))
  for (const it of items.values()) {
    blanks[`${exam}#${it.no}`] = (it.passage.match(/_{6}/g) ?? []).length
    const type = typeOf(it.no)
    if (!type || !VISUAL_PAPER_TYPES.has(type) || type.endsWith('CHART')) continue
    const id = `${exam}#${it.no}`
    if (!it.boxes.length) { rows.push({ id, type, result: 'no_box' }); continue }
    const m = cropMarksOf(pages, it.boxes, gutter, type)
    const kind = markerKindOf(type)
    const shown = kind === 'none' ? (m?.implied ? 1 : 0) : Object.keys(m?.byMarker ?? {}).length
    const expected = kind === 'none' ? 1 : 5
    const reasons = [...(m?.itemIssues ?? []), ...Object.values(m?.issues ?? {})]
    const ok = shown === expected
    const sampleKey = `${type}:${exam}`
    const png = !ok || !sampled.has(sampleKey)
    if (ok) sampled.add(sampleKey)
    let pngPath: string | null = null
    if (png) {
      const parts = []
      for (const b of it.boxes) {
        const pg = pages.find((x) => x.p === b.p)!
        const left = b.col === 0 ? 0 : gutter
        const rx = b.col === 0 ? gutter : pg.w
        const c = createCanvas(Math.round(Math.max(1, (rx - left) * CROP_SCALE)), Math.round(Math.max(1, (b.top - b.bottom + CROP_PAD) * CROP_SCALE)))
        const page = await doc.getPage(b.p)
        await page.render({ canvasContext: c.getContext('2d'), viewport: page.getViewport({ scale: CROP_SCALE }), transform: [1, 0, 0, 1, -left * CROP_SCALE, -(pg.h - b.top - CROP_PAD_TOP) * CROP_SCALE] }).promise
        parts.push(c)
      }
      const W = Math.max(...parts.map((c) => c.width))
      const H = parts.reduce((a, c) => a + c.height, 0)
      const out = createCanvas(W, H)
      const ctx = out.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)
      let y = 0
      for (const c of parts) { ctx.drawImage(c, 0, y); y += c.height }
      const rects = [...Object.entries(m?.byMarker ?? {}).map(([n, rs]) => ({ n, rs })), ...(m?.implied ? [{ n: '밑줄', rs: m.implied }] : [])]
      for (const { n, rs } of rects) {
        ctx.strokeStyle = 'rgba(0,140,60,0.9)'
        ctx.lineWidth = 3
        for (const r of rs) ctx.strokeRect(r.left * W, r.top * H, r.width * W, r.height * H)
        ctx.fillStyle = 'rgba(0,140,60,0.9)'
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(String(n), rs[0].left * W, rs[0].top * H - 3)
      }
      pngPath = path.join(OUT, 'png', `${ok ? 'ok' : 'miss'}-${exam}-${it.no}.png`)
      fs.writeFileSync(pngPath, out.toBuffer('image/png'))
    }
    rows.push({ id, type, kind, shown, expected, ok, pages: new Set(it.boxes.map((b) => b.p)).size, reasons, png: pngPath })
  }
  if (typeof doc.destroy === 'function') await doc.destroy()
}

const judged = rows.filter((r) => 'ok' in r)
const byType: Record<string, { items: number; full: number; marks: number; expected: number }> = {}
const reasonCount: Record<string, number> = {}
for (const r of judged as { type: string; ok: boolean; shown: number; expected: number; reasons: string[] }[]) {
  const t = (byType[r.type] ??= { items: 0, full: 0, marks: 0, expected: 0 })
  t.items++
  if (r.ok) t.full++
  t.marks += r.shown
  t.expected += r.expected
  for (const x of r.reasons) reasonCount[x] = (reasonCount[x] ?? 0) + 1
}
let blankDiff: { id: string; base: number; now: number }[] | null = null
if (baseline) blankDiff = Object.keys({ ...baseline, ...blanks }).filter((k) => baseline[k] !== blanks[k]).map((k) => ({ id: k, base: baseline[k], now: blanks[k] }))
const summary = { exams: exams.length, noLocal: rows.filter((r) => r.result === 'no_local_pdf').map((r) => r.exam), noBox: rows.filter((r) => r.result === 'no_box').map((r) => r.id), byType, reasonCount, blankItems: Object.keys(blanks).length, blankTotal: Object.values(blanks).reduce((a, b) => a + b, 0), blankDiff }
fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify(rows, null, 2))
fs.writeFileSync(path.join(OUT, 'blanks.json'), JSON.stringify(blanks, null, 2))
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
