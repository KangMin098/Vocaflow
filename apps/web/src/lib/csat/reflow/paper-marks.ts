// apps/web/src/lib/csat/reflow/paper-marks.ts
//
// **원본 크롭 위의 밑줄 · 선지 기호 위치** (v3 F08 파일럿) — 문제지 PDF 의 그린 가로선과 글자 좌표에서만 계산한다.
//
// 밑줄은 글자가 아니라 선이다(blank-probe 실측 · pdf-frags.blankFrags 주석): 빈칸 선은 기준선 약 2.0pt 아래 · 글자 틈을 메움,
// 어휘 · 함축 **밑줄**은 약 3.1~3.4pt 아래 · 글자가 선을 91~97% 덮음, 상자선은 약 3.2pt 아래 · 글자와 떨어짐.
// 그래서 밑줄 = 「기준선이 선보다 0.8~4.8pt 위인 글자가 선 길이의 절반 넘게 덮는 선」(2018 문제지는 약 1.9pt — F08 파일럿 실측). 빈칸은 덮임 30% 미만이라 갈린다. 빈칸 · 상자선 · 도표선은 여기서 빠진다.
//
// 대응(기호 ↔ 밑줄)이 없거나 모호하면 표시하지 않고 이유 코드를 남긴다 — 없는 범위를 만들어 내지 않는다.
// 좌표는 PDF 좌표(왼아래 원점)로 두고, 화면은 `cropRects` 로 크롭 이미지 비율(%)로 바꾼다(확대/축소와 무관).

import type { HLine, PageFrags, PdfFrag, ReflowBox } from './types'

const CIRC = '①②③④⑤'
/** 크롭 렌더 배율 · 여백 — read-paper.renderCrop 과 같은 값이어야 한다(가드: paper-marks.test) */
export const CROP_SCALE = 2.5
export const CROP_PAD_TOP = 4
export const CROP_PAD = 8

export interface MarkSeg { p: number; x0: number; x1: number; y: number; h: number }
export interface PaperMark {
  /** 1~5 = ①~⑤ 또는 (a)~(e) 순번 · 함축(기호 없음)은 null */
  n: number | null
  /** 선지 기호 자리(없으면 null) */
  marker: MarkSeg | null
  /** 밑줄 조각(여러 줄이면 여러 개) — 대응 실패면 빈 배열 */
  segs: MarkSeg[]
  /** exact = 기호와 밑줄 대응 확정 · marker_only = 기호는 있으나 밑줄 대응 없음/모호 · underline_only = 기호 없는 밑줄(함축) */
  state: 'exact' | 'marker_only' | 'underline_only'
  issue: null | 'no_underline' | 'ambiguous_underline'
}
export interface MarkResult {
  marks: PaperMark[]
  /** 문항 단위 문제 — unclaimed_underline(기호에 안 붙은 밑줄) · marker_count(기호 수가 5 가 아님) · implied_groups(함축 밑줄 묶음이 1 이 아님) */
  issues: string[]
}

interface Region { p: number; left: number; right: number; top: number; bottom: number; textLeft?: number; textRight?: number }

function regionsOf(boxes: ReflowBox[], pages: PageFrags[], gutter: number): Region[] {
  return boxes.map((b) => {
    const pg = pages.find((x) => x.p === b.p)
    return { p: b.p, left: b.col === 0 ? 0 : gutter, right: b.col === 0 ? gutter : pg?.w ?? gutter * 2, top: b.top + CROP_PAD_TOP, bottom: b.bottom - (CROP_PAD - CROP_PAD_TOP) }
  })
}
const inRegion = (r: Region, p: number, x: number, y: number) => r.p === p && x >= r.left - 1 && x <= r.right + 1 && y >= r.bottom && y <= r.top

/** 밑줄 선만 — 기준선이 선보다 0.8~4.8pt 위인 글자가 선 길이의 50% 넘게 덮는다. 같은 자리 이중선은 하나로 */
export function underlineSegs(frags: PdfFrag[], lines: HLine[], p: number, colWidth: number): MarkSeg[] {
  const out: MarkSeg[] = []
  for (const ln of lines) {
    const width = ln.x1 - ln.x0
    if (width > colWidth * 0.9) continue
    const row = frags.filter((f) => {
      const dy = f.y - ln.y
      return dy >= 0.8 && dy <= 4.8 && f.x < ln.x1 && f.x + f.w > ln.x0
    })
    if (!row.length) continue
    const covered = row.reduce((s, f) => s + Math.max(0, Math.min(f.x + f.w, ln.x1) - Math.max(f.x, ln.x0)), 0)
    if (covered < width * 0.5) continue
    const y0 = row[0].y
    if (frags.some((f) => Math.abs(f.y - y0) < 1.5 && /[가-힣]/.test(f.str))) continue
    const y = ln.y
    const h = Math.max(...row.map((f) => f.h))
    const dup = out.find((s) => Math.abs(s.y - y) < 1 && s.x0 < ln.x1 + 2 && ln.x0 < s.x1 + 2)
    if (dup) {
      dup.x0 = Math.min(dup.x0, ln.x0)
      dup.x1 = Math.max(dup.x1, ln.x1)
      continue
    }
    out.push({ p, x0: ln.x0, x1: ln.x1, y, h })
  }
  return out.sort((a, b) => b.y - a.y || a.x0 - b.x0)
}

/** 선지 기호 — ①~⑤ 또는 (a)~(e). 조각 안 글자 위치는 조각 폭을 글자 수로 나눠 어림한다 */
export type MarkerKind = 'circled' | 'letters' | 'none'
/** 유형 → 지문 안 기호. 세트(X-)는 (a)~(e) · 함축은 기호 없음(아래 선지 ①~⑤ 는 지문 기호가 아니다) · 그 밖 기호 선지 유형은 ①~⑤ */
export function markerKindOf(type: string | null): MarkerKind {
  if (!type) return 'none'
  if (type.startsWith('X-')) return 'letters'
  if (type === 'R-IMPLY') return 'none'
  return 'circled'
}

export function markersOf(frags: PdfFrag[], p: number, kind: MarkerKind = 'circled'): (MarkSeg & { n: number })[] {
  const out: (MarkSeg & { n: number })[] = []
  for (const f of frags) {
    const len = Math.max(1, f.str.length)
    const cw = f.w / len
    for (let i = 0; kind === 'circled' && i < f.str.length; i += 1) {
      const c = CIRC.indexOf(f.str[i])
      if (c >= 0) out.push({ p, n: c + 1, x0: f.x + cw * i, x1: f.x + cw * (i + 1), y: f.y, h: f.h })
    }
    const re = /\(([a-e])\)/g
    let m: RegExpExecArray | null
    while (kind === 'letters' && (m = re.exec(f.str))) out.push({ p, n: m[1].charCodeAt(0) - 96, x0: f.x + cw * m.index, x1: f.x + cw * (m.index + 3), y: f.y, h: f.h })
  }
  return out
}

/** 한 밑줄 조각에서 이어지는 다음 줄 조각(줄 끝까지 간 밑줄 → 다음 줄 단 왼쪽에서 시작) */
function continuation(seg: MarkSeg, all: MarkSeg[], r: Region): MarkSeg | null {
  // 기준은 단 경계가 아니라 실제 글자 여백(양쪽 정렬 줄의 끝 · 다음 줄 시작) — F08 파일럿: 단 경계로 재면 두 줄 밑줄을 못 잇는다
  const right = r.textRight ?? r.right
  const left = r.textLeft ?? r.left
  if (seg.x1 < right - 30) return null
  return all.find((s) => s !== seg && inRegion(r, s.p, (s.x0 + s.x1) / 2, s.y) && s.y < seg.y && seg.y - s.y < seg.h * 2.2 && s.x0 < left + 12) ?? null
}

/**
 * 문항 하나의 밑줄 · 기호 위치. pages = 그 PDF 의 쪽 조각 · boxes = reflow 가 정한 그 문항 자리 · gutter = 단 경계.
 * 기호가 있는 유형은 기호 바로 뒤(같은 줄 · 14pt 안)에서 시작하는 밑줄을 그 기호의 밑줄로 본다.
 */
export function paperMarks(pages: PageFrags[], boxes: ReflowBox[], gutter: number, kind: MarkerKind): MarkResult {
  const regions = regionsOf(boxes, pages, gutter)
  const segs: MarkSeg[] = []
  const markers: (MarkSeg & { n: number })[] = []
  for (const r of regions) {
    const pg = pages.find((x) => x.p === r.p)
    if (!pg) continue
    const frags = pg.frags.filter((f) => inRegion(r, r.p, f.x + f.w / 2, f.y))
    // 글자 여백 — 가장 흔한 줄 시작(들여쓰기 · 각주 제외)과 가장 오른쪽 끝
    if (frags.length) {
      const starts = frags.map((f) => Math.round(f.x))
      const freq = new Map<number, number>()
      starts.forEach((x) => freq.set(x, (freq.get(x) ?? 0) + 1))
      r.textLeft = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
      r.textRight = Math.max(...frags.map((f) => f.x + f.w))
    }
    const lines = (pg.markLines ?? pg.lines ?? []).filter((l) => inRegion(r, r.p, (l.x0 + l.x1) / 2, l.y))
    segs.push(...underlineSegs(frags, lines, r.p, r.right - r.left))
    markers.push(...markersOf(frags, r.p, kind))
  }
  const regionOf = (s: MarkSeg) => regions.find((r) => inRegion(r, s.p, (s.x0 + s.x1) / 2, s.y)) ?? regions[0]
  const issues: string[] = []
  const claimed = new Set<MarkSeg>()
  const chain = (first: MarkSeg) => {
    const out = [first]
    let cur: MarkSeg | null = first
    while ((cur = continuation(cur, segs, regionOf(cur))) && !out.includes(cur)) out.push(cur)
    return out
  }

  if (kind === 'none') {
    // 함축 — 기호 없는 밑줄 묶음이 정확히 하나여야 한다
    const starts = segs.filter((s) => !segs.some((o) => o !== s && continuation(o, segs, regionOf(o)) === s))
    if (starts.length !== 1) {
      issues.push('implied_groups')
      return { marks: [], issues }
    }
    return { marks: [{ n: null, marker: null, segs: chain(starts[0]), state: 'underline_only', issue: null }], issues }
  }

  // 같은 번호가 여러 번이면(세트 문항의 다른 문항 기호 등) 모호 — 번호별로 하나만 쓴다
  const byN = new Map<number, (MarkSeg & { n: number })[]>()
  for (const m of markers) byN.set(m.n, [...(byN.get(m.n) ?? []), m])
  if (byN.size !== 5) issues.push('marker_count')
  const marks: PaperMark[] = []
  const candsOf = (m: MarkSeg) => segs.filter((s) => s.p === m.p && m.y - s.y >= 0.8 && m.y - s.y <= 4.8 && s.x0 >= m.x0 - 30 && s.x0 - m.x1 < 30)
  for (const n of [...byN.keys()].sort()) {
    const withSeg = byN.get(n)!.filter((m) => candsOf(m).length > 0)
    if (withSeg.length !== 1) {
      const only = byN.get(n)!.length === 1 ? byN.get(n)![0] : null
      marks.push({ n, marker: only, segs: [], state: 'marker_only', issue: withSeg.length ? 'ambiguous_underline' : 'no_underline' })
      continue
    }
    const m = withSeg[0]
    const cands = candsOf(m)
    // 후보가 둘 이상이면 거리와 무관하게 모호 — 어느 밑줄인지 단정하지 않는다(F08 수용 기준 3)
    if (cands.length !== 1) {
      marks.push({ n, marker: m, segs: [], state: 'marker_only', issue: 'ambiguous_underline' })
      continue
    }
    const c = chain(cands[0])
    c.forEach((s) => claimed.add(s))
    marks.push({ n, marker: m, segs: c, state: 'exact', issue: null })
  }
  // 한 밑줄 조각이 여러 기호에 붙었으면 그 기호들은 모두 모호(어느 선지의 밑줄인지 단정하지 않는다)
  const owners = new Map<MarkSeg, PaperMark[]>()
  for (const m of marks) for (const s of m.segs) owners.set(s, [...(owners.get(s) ?? []), m])
  for (const ms of owners.values()) {
    if (ms.length < 2) continue
    for (const m of ms) Object.assign(m, { segs: [], state: 'marker_only', issue: 'ambiguous_underline' })
  }
  if (segs.some((s) => !claimed.has(s))) issues.push('unclaimed_underline')
  return { marks, issues }
}

/** 크롭 이미지 안의 위치(비율 0~1) — read-paper.renderCrop 과 같은 계산(조각을 세로로 잇는다) */
export interface CropRect { left: number; top: number; width: number; height: number }
export function cropRects(segs: MarkSeg[], boxes: ReflowBox[], pages: PageFrags[], gutter: number, kind: 'underline' | 'marker'): CropRect[] {
  const parts = boxes.map((b) => {
    const pg = pages.find((x) => x.p === b.p)
    const left = b.col === 0 ? 0 : gutter
    const right = b.col === 0 ? gutter : pg?.w ?? gutter * 2
    return { b, left, w: Math.round(Math.max(1, (right - left) * CROP_SCALE)), h: Math.round(Math.max(1, (b.top - b.bottom + CROP_PAD) * CROP_SCALE)) }
  })
  const W = Math.max(...parts.map((x) => x.w))
  const H = parts.reduce((a, x) => a + x.h, 0)
  const out: CropRect[] = []
  for (const s of segs) {
    let off = 0
    for (const part of parts) {
      const { b } = part
      const right = part.left + part.w / CROP_SCALE
      const mid = (s.x0 + s.x1) / 2
      if (b.p === s.p && mid >= part.left && mid <= right && s.y <= b.top + CROP_PAD_TOP && s.y >= b.bottom - (CROP_PAD - CROP_PAD_TOP)) {
        // 밑줄 = 선에서 글자 높이만큼 위까지 · 기호 = 글자 상자
        const yTop = kind === 'underline' ? s.y + s.h + 1 : s.y + s.h * 0.85
        const yBot = kind === 'underline' ? s.y - 1 : s.y - s.h * 0.2
        out.push({
          left: ((s.x0 - part.left) * CROP_SCALE) / W,
          top: ((b.top + CROP_PAD_TOP - yTop) * CROP_SCALE + off) / H,
          width: ((s.x1 - s.x0) * CROP_SCALE) / W,
          height: ((yTop - yBot) * CROP_SCALE) / H,
        })
        break
      }
      off += part.h
    }
  }
  return out
}
