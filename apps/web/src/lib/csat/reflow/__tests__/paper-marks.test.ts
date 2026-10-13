// apps/web/src/lib/csat/reflow/__tests__/paper-marks.test.ts
//
// F08 — 원본 크롭 위 밑줄 위치. 합성 쪽 조각으로 판정 규칙을 고정한다(실측 근거: docs/csat-learner/v3/F08_PILOT.md).
import { describe, expect, it } from 'vitest'

import { BLANK_LINE_MIN, MARK_LINE_MIN, hlinesOfOps } from '../pdf-frags'
import { CROP_PAD, CROP_PAD_TOP, CROP_SCALE, cropRects, markerKindOf, paperMarks, underlineSegs } from '../paper-marks'
import type { HLine, PageFrags, PdfFrag, ReflowBox } from '../types'

const f = (str: string, x: number, y: number, w: number, h = 12): PdfFrag => ({ str, x, y, w, h })
const line = (x0: number, x1: number, y: number): HLine => ({ x0, x1, y })
const BOX: ReflowBox[] = [{ p: 1, col: 0, top: 800, bottom: 600 }]
const page = (frags: PdfFrag[], lines: HLine[]): PageFrags[] => [{ p: 1, w: 842, h: 1191, frags, lines: [], markLines: lines }]
const GUTTER = 421

describe('underlineSegs — 밑줄 · 빈칸 · 상자선 · 발문 강조 가르기', () => {
  it('글자가 선을 50% 넘게 덮으면 밑줄(기준선 거리 1.9pt 2018 · 3.3pt 최신 모두)', () => {
    expect(underlineSegs([f('have noticed', 100, 700, 60)], [line(100, 125, 698.1)], 1, 380)).toHaveLength(1)
    expect(underlineSegs([f('to solve the', 100, 700, 60)], [line(100, 140, 696.7)], 1, 380)).toHaveLength(1)
  })
  it('빈칸(글자 틈 · 덮임 30% 미만) · 상자선(위에 글자 없음) · 단 폭 선은 밑줄이 아니다', () => {
    expect(underlineSegs([f('the', 60, 700, 30), f('of', 160, 700, 12)], [line(92, 158, 698)], 1, 380)).toHaveLength(0)
    expect(underlineSegs([f('text', 100, 760, 30)], [line(100, 200, 698)], 1, 380)).toHaveLength(0)
    expect(underlineSegs([f('x'.repeat(80), 20, 700, 360)], [line(20, 380, 697)], 1, 380)).toHaveLength(0)
  })
  it('한글이 있는 줄(발문 「틀린」 · 「밑줄 친 …」)의 선은 지문 밑줄이 아니다', () => {
    expect(underlineSegs([f('밑줄 친', 60, 700, 30), f('the ghost', 100, 700, 50)], [line(100, 150, 697)], 1, 380)).toHaveLength(0)
  })
  it('같은 자리 이중선은 하나', () => {
    expect(underlineSegs([f('being', 100, 700, 30)], [line(100, 130, 697), line(100.5, 130, 696.8)], 1, 380)).toHaveLength(1)
  })
})

describe('paperMarks — 기호 ↔ 밑줄 대응', () => {
  const five = () => {
    const frags: PdfFrag[] = []
    const lines: HLine[] = []
    for (let i = 0; i < 5; i++) {
      const y = 780 - i * 30
      frags.push(f('lead', 40, y, 40), f('①②③④⑤'[i], 90, y, 10), f('word', 102, y, 40), f('tail text', 150, y, 200))
      lines.push(line(102, 142, y - 3.2))
    }
    return { frags, lines }
  }
  it('①~⑤ 각각 바로 뒤 밑줄 — 모두 exact', () => {
    const { frags, lines } = five()
    const r = paperMarks(page(frags, lines), BOX, GUTTER, 'circled')
    expect(r.marks.map((m) => m.state)).toEqual(['exact', 'exact', 'exact', 'exact', 'exact'])
    expect(r.issues).toEqual([])
  })
  it('기호 뒤에 밑줄이 없으면 marker_only(no_underline) — 표시하지 않는다', () => {
    const { frags, lines } = five()
    const r = paperMarks(page(frags, lines.slice(1)), BOX, GUTTER, 'circled')
    expect(r.marks[0]).toMatchObject({ n: 1, state: 'marker_only', issue: 'no_underline', segs: [] })
  })
  it('후보 둘이 비슷하게 가까우면 모호', () => {
    const frags = [f('①', 90, 780, 10), f('aa bb cc', 102, 780, 200)]
    const r = paperMarks(page(frags, [line(102, 106, 776.8), line(108.5, 125, 776.8)]), BOX, GUTTER, 'circled')
    expect(r.marks[0]).toMatchObject({ state: 'marker_only', issue: 'ambiguous_underline' })
  })
  it('후보가 둘이면 거리 차가 커도 모호(가까운 쪽으로 단정하지 않는다)', () => {
    const frags = [f('①', 90, 780, 10), f('aa bb cc dd', 102, 780, 200)]
    const r = paperMarks(page(frags, [line(102, 110, 776.8), line(125, 140, 776.8)]), BOX, GUTTER, 'circled')
    expect(r.marks[0]).toMatchObject({ state: 'marker_only', issue: 'ambiguous_underline' })
  })
  it('두 줄 밑줄 잇기는 같은 단 안에서만 — 다른 단의 같은 높이 선을 잇지 않는다', () => {
    const boxes: ReflowBox[] = [{ p: 1, col: 0, top: 800, bottom: 600 }, { p: 1, col: 1, top: 800, bottom: 600 }]
    const frags = [f('aaa bbb ccc ddd eee', 460, 780, 340), f('fff', 460, 765, 300), f('left col text here', 40, 765, 300)]
    const r = paperMarks(page(frags, [line(700, 800, 776.8), line(40, 120, 761.8)]), boxes, GUTTER, 'none')
    // 잇지 않으면 묶음이 둘(오른쪽 단 · 왼쪽 단) — 함축 밑줄을 하나로 정할 수 없어 표시하지 않는다
    expect(r.marks).toEqual([])
    expect(r.issues).toContain('implied_groups')
  })
  it('한 밑줄이 두 기호에 붙으면 둘 다 모호(어느 선지의 밑줄인지 단정하지 않는다)', () => {
    const frags = [f('①', 90, 780, 10), f('②', 104, 780, 10), f('word word', 116, 780, 60)]
    const r = paperMarks(page(frags, [line(116, 170, 776.8)]), BOX, GUTTER, 'circled')
    expect(r.marks.filter((m) => m.state === 'exact')).toHaveLength(0)
    expect(r.marks.every((m) => m.issue === 'ambiguous_underline')).toBe(true)
  })
  it('세트는 (a)~(e) 만 — 아래 선지 ①~⑤ 는 기호로 보지 않는다', () => {
    const frags = [f('like (a) she is', 40, 780, 100), f('① (a)', 40, 620, 40)]
    const r = paperMarks(page(frags, [line(80, 94, 776.8)]), BOX, GUTTER, 'letters')
    expect(r.marks).toHaveLength(1)
    expect(r.marks[0]).toMatchObject({ n: 1, state: 'exact' })
  })
  it('함축 — 기호 없이 밑줄 한 묶음, 줄 끝까지 간 밑줄은 다음 줄 글자 여백에서 잇는다', () => {
    const frags = [f('in effect not knowing whether to make ready for', 40, 780, 340), f('the morning commute or not.', 40, 765, 180), f('next line', 40, 750, 300)]
    const r = paperMarks(page(frags, [line(200, 380, 776.8), line(40, 215, 761.8)]), BOX, GUTTER, 'none')
    expect(r.marks).toHaveLength(1)
    expect(r.marks[0]).toMatchObject({ n: null, state: 'underline_only' })
    expect(r.marks[0].segs).toHaveLength(2)
  })
  it('함축 밑줄 묶음이 둘이면 표시하지 않는다(implied_groups)', () => {
    const frags = [f('aaa bbb ccc ddd', 40, 780, 200), f('eee fff ggg', 40, 720, 200)]
    const r = paperMarks(page(frags, [line(40, 80, 776.8), line(40, 80, 716.8)]), BOX, GUTTER, 'none')
    expect(r.marks).toEqual([])
    expect(r.issues).toContain('implied_groups')
  })
})

describe('markerKindOf', () => {
  it('세트 = 글자 기호 · 함축 = 없음 · 기호 선지 = 원문자', () => {
    expect(markerKindOf('X-REFER')).toBe('letters')
    expect(markerKindOf('X-VOCAB')).toBe('letters')
    expect(markerKindOf('R-IMPLY')).toBe('none')
    expect(markerKindOf('R-GRAMMAR')).toBe('circled')
    expect(markerKindOf(null)).toBe('none')
  })
})

describe('cropRects — renderCrop 과 같은 좌표(배율 · 여백 · 조각 세로 잇기)', () => {
  it('한 조각: 왼쪽 단 위 끝 + 여백이 0, 비율 좌표', () => {
    const [r] = cropRects([{ p: 1, x0: 100, x1: 150, y: 700, h: 12 }], BOX, page([], []), GUTTER, 'underline')
    const W = Math.round(GUTTER * CROP_SCALE)
    const H = Math.round((800 - 600 + CROP_PAD) * CROP_SCALE)
    expect(r.left).toBeCloseTo((100 * CROP_SCALE) / W)
    expect(r.width).toBeCloseTo((50 * CROP_SCALE) / W)
    expect(r.top).toBeCloseTo(((800 + CROP_PAD_TOP - (700 + 12 + 1)) * CROP_SCALE) / H)
  })
  it('두 조각(두 단 세트): 둘째 조각 좌표는 첫 조각 높이만큼 내려간다', () => {
    const boxes: ReflowBox[] = [{ p: 1, col: 0, top: 800, bottom: 700 }, { p: 1, col: 1, top: 900, bottom: 600 }]
    const [r] = cropRects([{ p: 1, x0: 500, x1: 540, y: 850, h: 12 }], boxes, page([], []), GUTTER, 'underline')
    const h1 = Math.round((100 + CROP_PAD) * CROP_SCALE)
    const H = h1 + Math.round((300 + CROP_PAD) * CROP_SCALE)
    expect(r.top).toBeCloseTo(((900 + CROP_PAD_TOP - 863) * CROP_SCALE + h1) / H)
    expect(r.left).toBeGreaterThan(0)
  })
})

describe('hlinesOfOps — 빈칸 12pt · 위치 4pt 분리(같은 변환)', () => {
  const OPS = { save: 1, restore: 2, transform: 3, constructPath: 4 }
  const ops = { fnArray: [4, 4], argsArray: [[0, [], [100, 700, 108, 700.5]], [0, [], [100, 680, 140, 680.5]]] as unknown[] }
  it('기본(빈칸 복원)은 12pt 미만을 버린다 — 기존 동작 그대로', () => {
    expect(BLANK_LINE_MIN).toBe(12)
    expect(hlinesOfOps(ops, OPS)).toHaveLength(1)
  })
  it('위치용(4pt)은 한 글자 밑줄(8pt)도 모은다', () => {
    expect(MARK_LINE_MIN).toBe(4)
    expect(hlinesOfOps(ops, OPS, MARK_LINE_MIN)).toHaveLength(2)
  })
})

describe('cropMarksOf — 밑줄 유형만', () => {
  it('도표(R-CHART)는 선지 근처 수평선이 있어도 계산하지 않는다', async () => {
    const { cropMarksOf } = await import('../read-paper')
    const frags = [f('①', 90, 780, 10), f('word tail', 102, 780, 200)]
    const m = cropMarksOf(page(frags, [line(102, 140, 776.8)]), BOX, GUTTER, 'R-CHART')
    expect(m).toMatchObject({ byMarker: {}, implied: null, itemIssues: ['not_underline_type'] })
    expect(cropMarksOf(page(frags, [line(102, 140, 776.8)]), BOX, GUTTER, 'R-GRAMMAR')?.byMarker[1]).toHaveLength(1)
  })
})
