// scripts/csat/f08-paper-marks-pilot.mts
//
// **F08 파일럿 — 원본 크롭 위 밑줄 · 선지 기호 위치 검증.** 로컬 공개 문제지 PDF 로 학습자 기기와 같은 길(pdf.js 조각 · 가로선 →
// reflowExam 의 문항 자리 → renderCrop 과 같은 크롭)을 밟고, paper-marks 가 계산한 위치를 크롭 위에 겹쳐 PNG 로 남긴다.
// 사람이 PNG 를 보고 성공 · 오탐 · 미대응을 판정한다. 서버 · DB 에 아무것도 쓰지 않는다(유형 조회만).
//
// 실행: node --env-file=<메인 apps/web/.env.local> --import tsx scripts/csat/f08-paper-marks-pilot.mts <출력 폴더> [회차:번호 ...]
//   CSAT_LOCAL_PAPER_DIRS 가 없으면 dev-paper 기본 폴더. 선 최소 폭은 F08_MIN_LINE(기본 4pt) — 제품 hlinesOfOps 는 12pt.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { localPaperPath } from '../../apps/web/src/lib/csat/reflow/dev-paper'
import { fragsOfContent } from '../../apps/web/src/lib/csat/reflow/pdf-frags'
import { cropRects, markerKindOf, paperMarks, CROP_PAD, CROP_PAD_TOP, CROP_SCALE } from '../../apps/web/src/lib/csat/reflow/paper-marks'
import { reflowExam } from '../../apps/web/src/lib/csat/reflow/reflow'
import type { HLine, PageFrags, ReflowAnchors } from '../../apps/web/src/lib/csat/reflow/types'

const req = createRequire(path.resolve('apps/web/package.json'))
const pdfjs = await import(pathToFileURL(req.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href)
const { createCanvas } = req(path.resolve('node_modules/.pnpm/@napi-rs+canvas@1.0.9/node_modules/@napi-rs/canvas'))

const OUT = process.argv[2]
if (!OUT) throw new Error('출력 폴더를 주세요')
fs.mkdirSync(OUT, { recursive: true })
const MIN_LINE = Number(process.env.F08_MIN_LINE ?? 4)
const DEFAULT = ['2014A:27', '2014A:28', '2014A:44', '2018:28', '2018:29', '2018:30', '2018:44', '2022:21', '2022:29', '2022:30', '2022:42', '2022:44', '2026:21', '2026:29', '2026:30', '2026:42', '2026:44', 'M2309:21', 'M2309:29', 'M2309:30', 'M2309:42', 'M2309:44', 'M2706:21', 'M2706:29', 'M2706:30', 'M2706:42', 'M2706:44']
const targets = (process.argv.length > 3 ? process.argv.slice(3) : DEFAULT).map((t) => { const [e, n] = t.split(':'); return { exam: e, no: Number(n) } })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

// pdf-frags.hlinesOfOps 와 같은 계산 — 최소 폭만 바꿔 짧은 낱말 밑줄(예: it · 8pt)을 본다
function hlines(ops: { fnArray: number[]; argsArray: unknown[] }, OPS: Record<string, number>): HLine[] {
  const mul = (m: number[], n: number[]) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]]
  const apply = (m: number[], x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
  const out: HLine[] = []
  const stack: number[][] = []
  let ctm = [1, 0, 0, 1, 0, 0]
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i] as unknown[]
    if (fn === OPS.save) stack.push(ctm)
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0]
    else if (fn === OPS.transform) ctm = mul(args.map(Number), ctm)
    else if (fn === OPS.constructPath) {
      const mm = args[args.length - 1] as ArrayLike<number> | null
      if (!mm || mm.length !== 4) continue
      const [ax, ay] = apply(ctm, mm[0], mm[1])
      const [bx, by] = apply(ctm, mm[2], mm[3])
      if (Math.abs(by - ay) < 1.6 && Math.abs(bx - ax) >= MIN_LINE) out.push({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), y: (ay + by) / 2 })
    }
  }
  return out
}

const rows: Record<string, unknown>[] = []
for (const exam of [...new Set(targets.map((t) => t.exam))]) {
  const file = localPaperPath(exam)
  if (!file) { for (const t of targets.filter((x) => x.exam === exam)) rows.push({ id: `${exam}#${t.no}`, result: 'no_local_pdf' }); continue }
  const anchors = JSON.parse(fs.readFileSync(path.resolve(`apps/web/src/lib/csat/anchor-data/${exam}.json`), 'utf8')) as ReflowAnchors
  const { data: types } = await db.from('csat_items').select('no, type_id').eq('exam_id', exam)
  const typeOf = (no: number) => types?.find((r) => r.no === no)?.type_id ?? null
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise
  const pages: PageFrags[] = []
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    pages.push({ p, w: vp.width, h: vp.height, frags: fragsOfContent((await page.getTextContent()).items), lines: hlines(await page.getOperatorList(), pdfjs.OPS) })
  }
  const right = anchors.items.filter((i) => i.col === 1).map((i) => i.x).sort((a, b) => a - b)
  const gutter = right.length ? right[Math.floor(right.length / 2)] - 10 : pages[0].w / 2
  const wanted = targets.filter((t) => t.exam === exam).map((t) => t.no)
  const items = reflowExam(pages, anchors, typeOf, wanted)
  for (const no of wanted) {
    const it = items.get(no)
    const id = `${exam}#${no}`
    if (!it || !it.boxes.length) { rows.push({ id, type: typeOf(no), result: 'no_box' }); continue }
    const res = paperMarks(pages, it.boxes, gutter, markerKindOf(typeOf(no)))
    // renderCrop 과 같은 크롭
    const parts = []
    for (const b of it.boxes) {
      const pg = pages.find((x) => x.p === b.p)!
      const left = b.col === 0 ? 0 : gutter
      const rightX = b.col === 0 ? gutter : pg.w
      const c = createCanvas(Math.round(Math.max(1, (rightX - left) * CROP_SCALE)), Math.round(Math.max(1, (b.top - b.bottom + CROP_PAD) * CROP_SCALE)))
      const page = await doc.getPage(b.p)
      const vp = page.getViewport({ scale: CROP_SCALE })
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp, transform: [1, 0, 0, 1, -left * CROP_SCALE, -(pg.h - b.top - CROP_PAD_TOP) * CROP_SCALE] }).promise
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
    const draw = (rs: ReturnType<typeof cropRects>, color: string, label?: string) => {
      for (const r of rs) {
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.strokeRect(r.left * W, r.top * H, r.width * W, r.height * H)
      }
      if (label && rs[0]) { ctx.fillStyle = color; ctx.font = 'bold 26px sans-serif'; ctx.fillText(label, rs[0].left * W, rs[0].top * H - 4) }
    }
    for (const m of res.marks) {
      const color = m.state === 'exact' || m.state === 'underline_only' ? 'rgba(0,140,60,0.9)' : 'rgba(220,40,40,0.9)'
      draw(cropRects(m.segs, it.boxes, pages, gutter, 'underline'), color, m.n ? String(m.n) : '밑줄')
      if (m.marker) draw(cropRects([m.marker], it.boxes, pages, gutter, 'marker'), 'rgba(30,90,220,0.9)')
    }
    const png = path.join(OUT, `${exam}-${no}.png`)
    fs.writeFileSync(png, out.toBuffer('image/png'))
    rows.push({
      id, type: typeOf(no), boxes: it.boxes.length, pages: [...new Set(it.boxes.map((b) => b.p))].length, cols: [...new Set(it.boxes.map((b) => `${b.p}:${b.col}`))].length,
      inline: it.inline, needsOriginal: it.needsOriginal ?? false, issues: res.issues,
      marks: res.marks.map((m) => ({ n: m.n, state: m.state, issue: m.issue, segs: m.segs.length })), png,
    })
  }
  if (typeof doc.destroy === 'function') await doc.destroy()
}
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(rows, null, 2))
for (const r of rows) console.log(JSON.stringify({ id: r.id, type: r.type, result: r.result, issues: r.issues, marks: (r.marks as { n: number | null; state: string; segs: number }[] | undefined)?.map((m) => `${m.n ?? '-'}:${m.state}${m.segs > 1 ? `x${m.segs}` : ''}`).join(' ') }))
