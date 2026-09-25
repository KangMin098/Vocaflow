// apps/web/src/lib/csat/reflow/__tests__/blanks.test.ts
//
// 빈칸 복원 규칙 회귀(REFLOW_VERSION 2). 합성 조각만 쓴다 — 원문 없이.
// 실측 근거: scripts/csat-learner/blank-probe.mts · blank-audit.mts (802문항 중 790 · 자리 대조 59/66, 어긋남은 DB 쪽)

import { describe, expect, it } from 'vitest'

import { blankFrags, hlinesOfOps } from '../pdf-frags'
import { summaryBlanks } from '../reflow'
import type { PdfFrag } from '../types'

const frag = (str: string, x: number, w: number, y = 700): PdfFrag => ({ str, x, y, w, h: 12 })

describe('hlinesOfOps — 그린 선을 쪽 좌표로', () => {
  const OPS = { save: 1, restore: 2, transform: 3, constructPath: 4 }
  it('변환 행렬을 따라가 가는 가로 사각형만 선으로 본다', () => {
    const ops = {
      fnArray: [1, 3, 4, 2, 4],
      argsArray: [[], [1, 0, 0, 1, 473, 698], [28, [], [0, 0, 48, 0.8]], [], [28, [], [0, 0, 10, 400]]],
    }
    expect(hlinesOfOps(ops, OPS)).toEqual([{ x0: 473, x1: 521, y: 698.4 }])
  })
})

describe('blankFrags — 빈칸 선과 밑줄 · 상자선을 가른다', () => {
  const row = [frag('a word', 448, 24), frag('word before', 400, 72), frag('after it', 527, 60)]
  it('기준선보다 약 2pt 아래 · 글자 틈을 메우는 선은 빈칸', () => {
    const out = blankFrags(row, [{ x0: 473, x1: 521, y: 698 }])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ str: '______', x: 473, y: 700 })
  })
  it('글자가 덮고 있는 선은 밑줄 — 빈칸이 아니다', () => {
    expect(blankFrags([frag('underlined phrase', 473, 48)], [{ x0: 473, x1: 521, y: 696.8 }])).toEqual([])
  })
  it('기준선보다 3pt 넘게 아래이거나 글자와 떨어진 선(상자선)은 빈칸이 아니다', () => {
    expect(blankFrags(row, [{ x0: 473, x1: 521, y: 696.6 }])).toEqual([])
    expect(blankFrags([frag('far', 100, 20)], [{ x0: 396, x1: 446, y: 698 }])).toEqual([])
  })
  it('겹쳐 그린 이중선은 하나로 친다', () => {
    expect(blankFrags(row, [{ x0: 473, x1: 521, y: 698 }, { x0: 473.5, x1: 521, y: 698.2 }])).toHaveLength(1)
  })
})

describe('summaryBlanks — 요약문 빈칸은 (A) · (B) 라벨 자리', () => {
  it('요약 문장의 라벨 뒤에 빈칸을 두고, 선지 표 머리 (A) (B) 는 건드리지 않는다', () => {
    const p = 'x x x. Summary says (A) of y and z are (B) here. (A) (B)'
    expect(summaryBlanks(p)).toBe('x x x. Summary says (A) ______ of y and z are (B) ______ here. (A) (B)')
  })
  it('라벨이 한 번씩이 아니면 손대지 않는다', () => {
    const p = 'no labels here ______ at all'
    expect(summaryBlanks(p)).toBe(p)
  })
})
