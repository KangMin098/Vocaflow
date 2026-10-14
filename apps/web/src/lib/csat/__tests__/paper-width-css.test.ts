// apps/web/src/lib/csat/__tests__/paper-width-css.test.ts
//
// 원문 열의 CSS 기본 폭(--paper-w 가 걸리기 전)이 앱 기본 폭 공식(defaultPaperWidth)과 같은가.
// 2026-10-14: CSS 기본값이 24rem(384px)이라 첫 그림 · 본문 재마운트 순간에만 384 가 보였고 e2e 기하가 간헐적으로 384 를 쟀다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { defaultPaperWidth } from '../paper-width'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../../../components/csat/theater/theater.module.css'), 'utf8')

describe('원문 열 CSS 기본 폭 = defaultPaperWidth', () => {
  it('clamp(최소, 뷰포트 비율, 최대)가 공식과 같다', () => {
    const m = css.match(/var\(--paper-w,\s*clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\)\)/)
    expect(m, 'theater.module.css .body 의 --paper-w 기본값이 clamp(…px, …vw, …px) 여야 한다').not.toBeNull()
    const [min, ratio, max] = [Number(m![1]), Number(m![2]) / 100, Number(m![3])]
    for (const vw of [1024, 1280, 1366, 1440, 1600, 1920]) {
      const cssWidth = Math.round(Math.min(max, Math.max(min, vw * ratio)))
      expect(cssWidth, `${vw}px`).toBe(defaultPaperWidth(vw))
    }
  })
})
