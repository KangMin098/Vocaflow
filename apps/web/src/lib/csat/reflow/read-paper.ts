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
import { fragsOfContent, hlinesOfOps } from './pdf-frags'
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
const crops = new Map<string, string>()
export const cropOf = (examId: string, no: number) => crops.get(`${examId}#${no}`) ?? null

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
    const lines = hlinesOfOps(await page.getOperatorList(), OPS)
    pages.push({ p, w: vp.width, h: vp.height, frags: fragsOfContent(content.items), lines })
  }
  return pages
}

const SCALE = 2.5

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
    const h = Math.max(1, (b.top - b.bottom + 8) * SCALE)
    const c = document.createElement('canvas')
    c.width = Math.round(w)
    c.height = Math.round(h)
    const ctx = c.getContext('2d')
    if (!ctx) continue
    const vp = page.getViewport({ scale: SCALE })
    // PDF 좌표(왼아래 원점) → 캔버스: 위 끝(top)이 0 이 되게 옮긴다
    const topPx = (pg.h - b.top - 4) * SCALE
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
      if (!it.ok) {
        failed += 1
        const url = await renderCrop(doc, pages, it.boxes, gutterX)
        if (url) crops.set(`${examId}#${it.no}`, url)
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
