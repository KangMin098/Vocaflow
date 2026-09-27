// apps/web/src/lib/csat/reflow/pdf-frags.ts
//
// PDF.js `getTextContent().items` → 글자 조각. 브라우저와 측정 스크립트가 **같은 함수**를 쓴다 —
// 두 벌이면 측정은 통과하는데 화면은 다르게 뽑는 일이 생긴다.
//
// `scripts/csat/pdf-anchors.mjs` 의 `pageItems` 와 같은 변환이다(좌표 색인이 그걸로 만들어졌다).

import type { HLine, PdfFrag } from './types'

interface RawItem {
  str?: unknown
  transform?: unknown
  width?: unknown
  height?: unknown
}

export function fragsOfContent(items: unknown[]): PdfFrag[] {
  const out: PdfFrag[] = []
  for (const raw of items) {
    const it = raw as RawItem
    if (typeof it.str !== 'string' || !it.str.length || !Array.isArray(it.transform)) continue
    const [a, , , d, e, f] = it.transform as number[]
    out.push({
      str: it.str,
      x: e,
      y: f,
      w: typeof it.width === 'number' ? it.width : 0,
      h: (typeof it.height === 'number' && it.height) || Math.abs(d) || Math.abs(a),
    })
  }
  return out
}

// ── 빈칸 선 (2026-09-25) ────────────────────────────────────────────────
// 시험지의 빈칸은 **글자가 아니라 그린 가로 선**이다 — 밑줄 문자 조각이 0개이고, 빈칸 문항 쪽에만
// 가로 선이 더 있다(`scripts/csat-learner/blank-probe.mts`). 글자만 읽으면 빈칸이 통째로 사라진다
// (`blank-audit.mts` 실측: R-BLANK 115 중 114). 그래서 선을 모아 빈칸 자리에 `______` 조각을 끼운다.

type Ops = { fnArray: number[]; argsArray: unknown[] }
type OpCodes = { save: number; restore: number; transform: number; constructPath: number }

/** 행렬 곱 m × n (PDF 6원소 행렬) */
function mul(m: number[], n: number[]): number[] {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ]
}
const apply = (m: number[], x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

/**
 * 그리기 명령 → 쪽 좌표의 가로 선. pdf.js 6.x 는 선을 **가는 채움 사각형**으로 그리고
 * `constructPath` 인자의 마지막에 경계 상자 `[x0, y0, x1, y1]` 를 준다(지역 좌표 — CTM 을 따라간다).
 */
export function hlinesOfOps(ops: Ops, OPS: OpCodes): HLine[] {
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
      const w = Math.abs(bx - ax)
      const h = Math.abs(by - ay)
      if (h < 1.6 && w >= 12) out.push({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), y: (ay + by) / 2 })
    }
  }
  return out
}

/**
 * 가로 선 중 **빈칸**인 것 → `______` 조각.
 *
 * 실측(blank-probe · M2706 5쪽): 빈칸 선은 같은 단 글자 기준선보다 **약 2.0pt 아래**에 있고 그 줄의
 * **글자 틈**을 메운다(글자가 선 바로 앞뒤에서 끝나고 시작한다). 어휘·함축의 **밑줄**은 약 3.1~3.4pt
 * 아래이고 글자가 선을 덮는다(91~97%). 상자선은 약 3.2pt 아래에 글자와 떨어져 있다. 그래서 셋을 본다:
 *   · 같은 단의 글자(선에서 가로 380pt 안)만 본다 — 다른 단의 같은 높이 글자에 속지 않게
 *   · 기준선이 선보다 0.8~2.8pt 위 · 선 위를 글자가 30% 넘게 덮지 않는다
 *   · 선 바로 앞(끝이 선 시작 10pt 안) 또는 바로 뒤(시작이 선 끝 10pt 안)에 글자가 붙어 있다
 * 같은 자리에 겹쳐 그린 선(이중선)은 하나로 친다.
 */
export function blankFrags(frags: PdfFrag[], lines: HLine[]): PdfFrag[] {
  const out: PdfFrag[] = []
  for (const ln of lines) {
    const width = ln.x1 - ln.x0
    if (width > 320) continue
    const row = frags.filter((f) => {
      const dy = f.y - ln.y
      return dy >= 0.8 && dy <= 2.8 && f.x < ln.x1 + 380 && f.x + f.w > ln.x0 - 380
    })
    if (!row.length) continue
    const covered = row.reduce((s, f) => s + Math.max(0, Math.min(f.x + f.w, ln.x1 - 1) - Math.max(f.x, ln.x0 + 1)), 0)
    if (covered > width * 0.3) continue
    const touches = row.some((f) => Math.abs(f.x + f.w - ln.x0) <= 10 || Math.abs(f.x - ln.x1) <= 10)
    if (!touches) continue
    const y = row[0].y
    if (out.some((b) => Math.abs(b.y - y) < 1 && Math.abs(b.x - ln.x0) < 2)) continue
    out.push({ str: '______', x: ln.x0, y, w: width, h: row[0].h })
  }
  return out
}
