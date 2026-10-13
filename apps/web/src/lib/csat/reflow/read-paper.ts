// apps/web/src/lib/csat/reflow/read-paper.ts
//
// **학습자가 놓은 문제지 → 회차별 추출본.** (브라우저 전용)
//
//   파일 → SHA-256(이 브라우저에서) → /api/csat/paper (해시 64자만 나간다)
//        → 아는 해시: 커밋된 좌표 / 모르는 해시: 그 자리에서 번호 찾기(detect.ts) + 회차 식별
//        → PDF.js 로 글자 조각 → reflowExam → 기기에 저장(원본 바이트는 버린다)
//
// 추출에 실패한 문항은 **종이 그대로**(쪽 일부를 2.5배로 그린 그림)를 보여 줘야 한다(지시문 C6).
// 그 그림은 이 탭의 메모리에만 둔다 — 기기에 남기는 것은 글과 해시뿐이다(C7).

import { detectAnchors, examIdFromText } from './detect'
import { MARK_LINE_MIN, fragsOfContent, hlinesOfOps } from './pdf-frags'
import { CROP_PAD, CROP_PAD_TOP, CROP_SCALE, cropRects, markerKindOf, paperMarks, type CropRect, type MarkerKind } from './paper-marks'
import { REFLOW_VERSION, reflowExam } from './reflow'
import type { CachedPaper, PageFrags, ReflowAnchors, ReflowBox, ReflowItem } from './types'

type PdfDoc = {
  numPages: number
  getPage: (n: number) => Promise<PdfPage>
  destroy?: () => Promise<void>
}
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number; transform: number[] }
  getTextContent: () => Promise<{ items: unknown[] }>
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; transform?: number[] }) => {
    promise: Promise<void>
  }
}

/** 탭 메모리의 크롭 — `exam#no` → data URL */
/** 원본 크롭 + 그 크롭 위 밑줄 위치(F08) — 탭 메모리만. 같은 PDF 해시 · 회차 · 문항에 묶여 함께 생기고 함께 지워진다 */
export interface CropEntry {
  sha: string
  url: string
  /** 크롭 이미지 비율 좌표. null = 계산하지 않음(여러 쪽 문항 · 계산 실패) — 화면은 이유를 말한다 */
  marks: CropMarks | null
}
export interface CropMarks {
  kind: MarkerKind
  /** 기호 번호(①~⑤ 또는 (a)~(e) 순번) → 그 밑줄 사각형들. 대응 확정분만 */
  byMarker: Record<number, CropRect[]>
  /** 함축 밑줄(기호 없음) — 묶음이 정확히 하나일 때만 */
  implied: CropRect[] | null
  /** 기호 번호 → 표시하지 않은 이유 */
  issues: Record<number, 'no_underline' | 'ambiguous_underline'>
  /** 문항 단위 이유(implied_groups · marker_count · unclaimed_underline · multi_page) */
  itemIssues: string[]
}
const crops = new Map<string, CropEntry>()
export const cropOf = (examId: string, no: number) => crops.get(`${examId}#${no}`)?.url ?? null
export const cropEntryOf = (examId: string, no: number): CropEntry | null => crops.get(`${examId}#${no}`) ?? null

/** 원본 크롭 위 밑줄 위치 — 여러 쪽에 걸친 문항은 검증 전이라 계산하지 않는다(F08 수용 기준 5) */
export function cropMarksOf(pages: PageFrags[], boxes: ReflowBox[], gutter: number, type: string | null): CropMarks | null {
  const kind = markerKindOf(type)
  if (new Set(boxes.map((b) => b.p)).size > 1) return { kind, byMarker: {}, implied: null, issues: {}, itemIssues: ['multi_page'] }
  const r = paperMarks(pages, boxes, gutter, kind)
  const byMarker: Record<number, CropRect[]> = {}
  const issues: CropMarks['issues'] = {}
  let implied: CropRect[] | null = null
  for (const m of r.marks) {
    const rects = m.segs.length ? cropRects(m.segs, boxes, pages, gutter, 'underline') : []
    if (m.n === null) implied = rects.length === m.segs.length && rects.length ? rects : null
    else if (m.state === 'exact' && rects.length === m.segs.length && rects.length) byMarker[m.n] = rects
    else issues[m.n] = m.issue ?? 'no_underline'
  }
  return { kind, byMarker, implied, issues, itemIssues: r.issues }
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function openPdf(data: Uint8Array): Promise<PdfDoc> {
  // PDF.js 는 클라이언트에서만 부른다. 워커는 번들러가 자산으로 뽑는다 — CDN 을 가리키면
  // 사내망·오프라인에서 조용히 멈춘다(옛 오버레이와 같은 판단).
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  return (await pdfjs.getDocument({ data, verbosity: 0 }).promise) as unknown as PdfDoc
}

async function framesOf(doc: PdfDoc): Promise<PageFrags[]> {
  const pages: PageFrags[] = []
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    // 빈칸은 그린 선이다 — 선을 함께 모아야 reflow 가 빈칸을 복원한다(REFLOW_VERSION 2)
    const { OPS } = await import('pdfjs-dist')
    const ops = await page.getOperatorList()
    const lines = hlinesOfOps(ops, OPS)
    // 밑줄 위치용(4pt) — 같은 변환 · 최소 폭만 다르다. 빈칸 복원은 위 lines(12pt) 그대로
    const markLines = hlinesOfOps(ops, OPS, MARK_LINE_MIN)
    pages.push({ p, w: vp.width, h: vp.height, frags: fragsOfContent(content.items), lines, markLines })
  }
  return pages
}

// 크롭 배율 · 여백은 밑줄 위치 계산(paper-marks.cropRects)과 한 출처 — 어긋나면 표시가 빗나간다
const SCALE = CROP_SCALE

/** 추출 실패 문항 — 그 문항이 차지한 단 조각을 2.5배로 그린다. 여러 조각이면 세로로 잇는다. */
async function renderCrop(doc: PdfDoc, pages: PageFrags[], boxes: ReflowBox[], gutter: number): Promise<string | null> {
  if (!boxes.length || typeof document === 'undefined') return null
  const parts: HTMLCanvasElement[] = []
  for (const b of boxes) {
    const pg = pages.find((x) => x.p === b.p)
    if (!pg) continue
    const page = await doc.getPage(b.p)
    const left = b.col === 0 ? 0 : gutter
    const right = b.col === 0 ? gutter : pg.w
    const w = Math.max(1, (right - left) * SCALE)
    const h = Math.max(1, (b.top - b.bottom + CROP_PAD) * SCALE)
    const c = document.createElement('canvas')
    c.width = Math.round(w)
    c.height = Math.round(h)
    const ctx = c.getContext('2d')
    if (!ctx) continue
    const vp = page.getViewport({ scale: SCALE })
    // PDF 좌표(왼아래 원점) → 캔버스: 위 끝(top)이 0 이 되게 옮긴다
    const topPx = (pg.h - b.top - CROP_PAD_TOP) * SCALE
    await page.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, 1, -left * SCALE, -topPx] }).promise
    parts.push(c)
  }
  if (!parts.length) return null
  const out = document.createElement('canvas')
  out.width = Math.max(...parts.map((c) => c.width))
  out.height = parts.reduce((a, c) => a + c.height, 0)
  const ctx = out.getContext('2d')
  if (!ctx) return null
  let y = 0
  for (const c of parts) {
    ctx.drawImage(c, 0, y)
    y += c.height
  }
  return out.toDataURL('image/png')
}

export type ReadResult =
  | { kind: 'ok'; paper: CachedPaper; known: boolean; failed: number }
  /** 모르는 파일인데 첫 쪽 글자로 회차를 못 정했다 — 고르면 `finish(examId)` */
  | { kind: 'choose'; guess: string | null; finish: (examId: string) => Promise<ReadResult> }
  | { kind: 'error'; reason: 'not-pdf' | 'no-numbers' | 'network' | 'unknown-exam'; message: string }

export interface ReadOptions {
  /** 회차의 문항 → 유형(기호 선지 유형 판정용) */
  typeOf: (examId: string, no: number) => string | null
  /** 이 회차 문항만 저장한다(세션 후보) */
  wanted: (examId: string) => number[]
  /** 카탈로그에 있는 회차 */
  exams: string[]
}

export async function readPaper(file: File, opt: ReadOptions): Promise<ReadResult> {
  const buf = await file.arrayBuffer()
  const head = new Uint8Array(buf.slice(0, 5))
  if (String.fromCharCode(...head) !== '%PDF-') {
    return { kind: 'error', reason: 'not-pdf', message: 'PDF 파일이 아니에요.' }
  }
  const sha = await sha256Hex(buf)

  let known: { exam_id: string; anchors: ReflowAnchors } | null = null
  try {
    const res = await fetch('/api/csat/paper', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sha256: sha }),
    })
    const json = (await res.json()) as { ok: boolean; known?: boolean; exam_id?: string; anchors?: ReflowAnchors }
    if (json.ok && json.known && json.exam_id && json.anchors) known = { exam_id: json.exam_id, anchors: json.anchors }
  } catch {
    // 좌표를 못 받아도 그 자리에서 찾는 길이 있다 — 여기서 멈추지 않는다
  }

  const doc = await openPdf(new Uint8Array(buf))
  const pages = await framesOf(doc)

  const build = async (examId: string, anchors: ReflowAnchors): Promise<ReadResult> => {
    const wanted = opt.wanted(examId)
    const items = reflowExam(pages, anchors, (no) => opt.typeOf(examId, no), wanted)
    const gutterX = (() => {
      const right = anchors.items.filter((i) => i.col === 1).map((i) => i.x).sort((a, b) => a - b)
      return right.length ? right[Math.floor(right.length / 2)] - 10 : pages[0].w / 2
    })()
    const kept: ReflowItem[] = []
    let failed = 0
    for (const it of items.values()) {
      // A different PDF for the same exam must never inherit an older image.
      crops.delete(`${examId}#${it.no}`)
      if (!it.ok || it.needsOriginal) {
        if (!it.ok) failed += 1
        let url: string | null = null
        try {
          url = await renderCrop(doc, pages, it.boxes, gutterX)
        } catch {
          // One failed original crop must not discard other readable items.
        }
        // 위치는 크롭이 생겼을 때만 · 같은 PDF 의 같은 쪽 조각으로(계산 실패는 위치 없이 크롭만)
        let marks: CropMarks | null = null
        if (url) {
          try {
            marks = cropMarksOf(pages, it.boxes, gutterX, opt.typeOf(examId, it.no))
          } catch {
            marks = null
          }
        }
        if (url) crops.set(`${examId}#${it.no}`, { sha, url, marks })
        else {
          it.originalUnavailable = true
          if (it.ok) failed += 1
        }
      }
      kept.push(it)
    }
    if (typeof doc.destroy === 'function') await doc.destroy()
    return {
      kind: 'ok',
      known: known != null,
      failed,
      paper: { exam_id: examId, sha256: sha, version: REFLOW_VERSION, saved_at: new Date().toISOString(), items: kept },
    }
  }

  if (known) return build(known.exam_id, known.anchors)

  const detected = detectAnchors(pages)
  if (!detected) {
    if (typeof doc.destroy === 'function') await doc.destroy()
    return {
      kind: 'error',
      reason: 'no-numbers',
      message: '이 파일에서 문항 번호를 찾지 못했어요. 스캔한 그림 파일이면 글자를 읽을 수 없어요.',
    }
  }
  const guess = examIdFromText(pages[0].frags.map((f) => f.str).join(' '))
  if (guess && opt.exams.includes(guess)) return build(guess, detected)
  return {
    kind: 'choose',
    guess,
    finish: (examId: string) =>
      opt.exams.includes(examId)
        ? build(examId, detected)
        : Promise.resolve({ kind: 'error', reason: 'unknown-exam', message: '아직 준비되지 않은 회차예요.' } as const),
  }
}
