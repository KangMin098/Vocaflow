// apps/web/src/components/csat/theater/__tests__/workspace-geometry.test.ts
//
// 작업공간 기하 변수 ↔ 측정 명세(spec.json) 한 출처 가드. 이 테스트는 값의 일치만 본다 —
// 실제 렌더 치수 · 학습 흐름은 e2e(csat-workspace-compact)가 확인한다(CSS 값 대조만으로 화면 검증이라 하지 않는다).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { MAIN_MIN } from '@/lib/csat/paper-width'

const css = fs.readFileSync(path.resolve(__dirname, '../theater.module.css'), 'utf8')
const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../../../docs/design/refs/3b/workspace/spec.json'), 'utf8')) as {
  targets: Record<string, number | number[] | Record<string, number[]>>
  cssVars: Record<string, string>
}
const varPx = (name: string) => {
  const m = new RegExp(`${name}:\\s*(\\d+)px`).exec(css)
  return m ? Number(m[1]) : null
}

describe('작업공간 기하 — CSS 변수 = 측정 명세', () => {
  it('px 목표는 변수와 같다(범위 목표는 범위 안)', () => {
    for (const [v, key] of Object.entries(spec.cssVars)) {
      const want = spec.targets[key]
      const got = varPx(v)
      expect(got, v).not.toBeNull()
      if (typeof want === 'number') expect(got, v).toBe(want)
      else if (Array.isArray(want)) {
        expect(got!, v).toBeGreaterThanOrEqual(want[0])
        expect(got!, v).toBeLessThanOrEqual(want[1])
      }
    }
  })
  it('원문 폭 계산의 메인 최소 폭 = 명세', () => {
    expect(MAIN_MIN).toBe(spec.targets.mainMinWidth)
  })
})
