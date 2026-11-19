// apps/web/src/lib/csat/__tests__/paper-width-css.test.ts
//
// 원문 열의 CSS 기본 폭(--paper-w 가 걸리기 전)이 앱 폭 공식(defaultPaperWidth · shownPaperWidth)과 같은가.
// 2026-10-14: CSS 기본값이 24rem(384px)이라 첫 그림 · 본문 재마운트 순간에만 384 가 보였고 e2e 기하가 간헐적으로 384 를 쟀다.
// 2026-10-25(T-0152 r3): 기본 폭만 맞추고 메인 최소 폭 제한을 빼서 1280 첫 그림이 313px — 메인 열 703px(명세 ≥712)였다.
//   CSS 도 max(PAPER_MIN, min(기본 폭, 100% − MAIN_MIN)) 로 JS 표시 폭과 같은 제한을 건다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { MAIN_MIN, PAPER_MIN, defaultPaperWidth, shownPaperWidth } from '../paper-width'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../../../components/csat/theater/theater.module.css'), 'utf8')
const RE = /var\(--paper-w,\s*max\((\d+)px,\s*min\(clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\),\s*calc\(100%\s*-\s*(\d+)px\)\)\)\)/

describe('원문 열 CSS 기본 폭 = 앱 표시 폭 공식', () => {
  const m = css.match(RE)
  it('형식: var(--paper-w, max(PAPER_MIN, min(clamp(…), calc(100% − MAIN_MIN))))', () => {
    expect(m, 'theater.module.css .body 의 --paper-w 기본값 형식이 바뀌었다').not.toBeNull()
  })
  it('하한 · 메인 최소 폭 상수가 lib 와 같다', () => {
    expect(Number(m![1])).toBe(PAPER_MIN)
    expect(Number(m![5])).toBe(MAIN_MIN)
  })
  it('clamp(최소, 뷰포트 비율, 최대)가 defaultPaperWidth 와 같다', () => {
    const [min, ratio, max] = [Number(m![2]), Number(m![3]) / 100, Number(m![4])]
    for (const vw of [1024, 1280, 1366, 1440, 1600, 1920]) {
      expect(Math.round(Math.min(max, Math.max(min, vw * ratio))), `${vw}px`).toBe(defaultPaperWidth(vw))
    }
  })
  it('본문 폭이 주어지면 CSS 첫 그림 폭 = JS 표시 폭(기본 선호) — 1280 · 1440 실측 본문 폭 포함', () => {
    const [floor, min, ratio, max, mainMin] = [Number(m![1]), Number(m![2]), Number(m![3]) / 100, Number(m![4]), Number(m![5])]
    for (const [vw, body] of [[1280, 1016], [1440, 1176], [1366, 1102], [1024, 760], [1920, 1656]] as const) {
      const cssWidth = Math.round(Math.max(floor, Math.min(Math.min(max, Math.max(min, vw * ratio)), body - mainMin)))
      expect(cssWidth, `${vw}px / 본문 ${body}`).toBe(shownPaperWidth(defaultPaperWidth(vw), body))
    }
  })
})
