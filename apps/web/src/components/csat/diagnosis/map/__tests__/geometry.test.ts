// apps/web/src/components/csat/diagnosis/map/__tests__/geometry.test.ts
//
// 참조 일치 가드 — 지도 CSS 의 기하 변수(--g-*)가 측정 명세(docs/design/refs/3b/access-map/spec.json)와 같아야 한다.
// 값을 눈대중으로 고치면 이 테스트가 떨어진다: 고치려면 참조 스크린샷을 다시 재서(scripts/design/ref-measure.mjs) spec.json 부터.
// 브라우저가 필요한 실측 대조는 scripts/design/ref-compare.mjs(`pnpm design:ref-compare`).

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { LAYER_COLUMNS, layerIndexOf } from '@/lib/csat/map/core'

const ROOT = path.resolve(__dirname, '../../../../../../../..')
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/refs/3b/access-map/spec.json'), 'utf8')) as {
  node: { w: number; h: number }
  columns: { pitch: number }
  rows: { pitch: number }
  panel: { headH: number; firstGap: number }
  layout: { pattern: string; headerPitch: number; headerTextOffset: number; nodeColumnXs: number[]; headerTextXs: number[]; emptyColumnKeepsHeader: boolean }
  modal: { w: number; h: number; headH: number; footH: number; sideGap: number; cardGap: number; cardPadX: number; cardPadY: number }
}
const css = fs.readFileSync(path.join(__dirname, '../map.module.css'), 'utf8')
const px = (name: string) => {
  const m = css.match(new RegExp(`${name}:\\s*(\\d+(?:\\.\\d+)?)px`))
  if (!m) throw new Error(`${name} 변수를 찾지 못했다`)
  return Number(m[1])
}

const count = (name: string) => {
  const m = css.match(new RegExp(`${name}:\\s*(\\d+);`))
  if (!m) throw new Error(`${name} 변수를 찾지 못했다`)
  return Number(m[1])
}

describe('학습 지도 기하 = 참조 측정 명세', () => {
  it('노드 크기', () => {
    expect(px('--g-node-w')).toBe(spec.node.w)
    expect(px('--g-node-h')).toBe(spec.node.h)
  })
  it('열 피치와 행 간격(행 피치 − 노드 높이)', () => {
    expect(px('--g-pitch')).toBe(spec.columns.pitch)
    expect(px('--g-row-gap')).toBe(spec.rows.pitch - spec.node.h)
  })
  it('머리 줄 높이와 첫 노드까지의 간격', () => {
    expect(px('--g-head-h')).toBe(spec.panel.headH)
    expect(px('--g-first-y')).toBe(spec.panel.firstGap)
  })

  it('종류별 열 — 참조 구조(열 = 종류) · 열 수 = 최종 목표 + LAYER_COLUMNS', () => {
    expect(spec.layout.pattern).toBe('columns-by-type')
    // 측정값끼리의 일관성: 열 머리 피치 = 노드 열 피치, 머리 글자는 모든 열에서 같은 거리만큼 안쪽
    expect(spec.layout.headerPitch).toBe(spec.columns.pitch)
    const offs = spec.layout.headerTextXs.map((x, i) => x - spec.layout.nodeColumnXs[i])
    expect(new Set(offs)).toEqual(new Set([spec.layout.headerTextOffset]))
    // 그리는 열 수 = 최종 목표 1 + 종류별 열. 핵심 능력(A)은 혼자 첫 종류 열, 나머지 영역은 다른 열
    expect(count('--g-cols')).toBe(1 + LAYER_COLUMNS.length)
    expect(LAYER_COLUMNS[0].axes).toEqual(['A'])
    for (const a of ['B', 'C', 'D', 'I', 'J']) expect(layerIndexOf(a)).toBeGreaterThan(0)
    expect(layerIndexOf('Z')).toBe(LAYER_COLUMNS.length - 1)
    // 실측 대조 스크립트의 열 수 상수도 같은 정의를 따른다(.mjs 라 core.ts 를 못 읽는다 — 여기서 맞춘다)
    const compare = fs.readFileSync(path.join(ROOT, 'scripts/design/ref-compare.mjs'), 'utf8')
    expect(Number(compare.match(/const LAYERS = (\d+)/)?.[1])).toBe(LAYER_COLUMNS.length)
  })

  it('팝업 모달 크기 · 머리/바닥 · 카드 간격 · 카드 안쪽 여백', () => {
    expect(px('--p-w')).toBe(spec.modal.w)
    expect(px('--p-h')).toBe(spec.modal.h)
    expect(px('--p-head')).toBe(spec.modal.headH)
    expect(px('--p-foot')).toBe(spec.modal.footH)
    expect(px('--p-side')).toBe(spec.modal.sideGap)
    expect(px('--p-gap')).toBe(spec.modal.cardGap)
    expect(px('--p-card-px')).toBe(spec.modal.cardPadX)
    expect(px('--p-card-py')).toBe(spec.modal.cardPadY)
  })
})
