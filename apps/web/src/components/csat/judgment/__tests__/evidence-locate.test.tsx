// apps/web/src/components/csat/judgment/__tests__/evidence-locate.test.tsx
// T-0253 — 가리킨 단위가 여럿이면 각각 화면 밖 여부를 보고, 밖인 것마다 위치 칩. 실제 스크롤 · 키보드 · 초점은 PC 하네스(pe-t253)가 덮는다.
// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EvidencePassage, edgeOutside, locateTargets, type LocateEdge } from '../EvidencePassage'

const ORDER = ['u1', 'u2', 'u3', 'u4', 'u5']
const edges = (m: Record<string, LocateEdge>) => (id: string) => m[id] ?? null

describe('locateTargets', () => {
  it('첫 문장만 보이고 둘째가 밖 → 둘째 하나만', () => {
    expect(locateTargets(['u2', 'u3'], ORDER, edges({ u3: 'bottom' }))).toEqual([{ id: 'u3', edge: 'bottom' }])
  })
  it('두 문장 모두 밖 → 둘 다(원문 순서) · 방향은 각자', () => {
    expect(locateTargets(['u4', 'u2'], ORDER, edges({ u2: 'top', u4: 'top' }))).toEqual([{ id: 'u2', edge: 'top' }, { id: 'u4', edge: 'top' }])
    expect(locateTargets(['u1', 'u5'], ORDER, edges({ u1: 'top', u5: 'bottom' }))).toEqual([{ id: 'u1', edge: 'top' }, { id: 'u5', edge: 'bottom' }])
  })
  it('단일 근거 · 둘 다 보임 · 없음', () => {
    expect(locateTargets(['u3'], ORDER, edges({ u3: 'top' }))).toEqual([{ id: 'u3', edge: 'top' }])
    expect(locateTargets(['u2', 'u3'], ORDER, edges({}))).toEqual([])
    expect(locateTargets([], ORDER, edges({ u1: 'top' }))).toEqual([])
  })
  it('잘못된 id 는 건너뛰고 중복은 한 번', () => {
    expect(locateTargets(['nope', 'u3', 'u3'], ORDER, edges({ nope: 'top', u3: 'bottom' }))).toEqual([{ id: 'u3', edge: 'bottom' }])
  })
})

describe('edgeOutside', () => {
  const pane = { top: 100, bottom: 500 }
  it('위 밖 · 아래 밖 · 안(8px 여유)', () => {
    expect(edgeOutside({ top: 40, bottom: 90 }, pane)).toBe('top')
    expect(edgeOutside({ top: 495, bottom: 520 }, pane)).toBe('bottom')
    expect(edgeOutside({ top: 200, bottom: 230 }, pane)).toBeNull()
    expect(edgeOutside({ top: 80, bottom: 110 }, pane)).toBeNull()
  })
})

describe('EvidencePassage 초기 마크업', () => {
  it('렌더만으로는 위치 칩 0(화면 밖 판정은 effect · 스크롤 뒤) · 가리킨 문장 표시', () => {
    const units = ORDER.map((id, i) => ({ id, n: i + 1, text: `Sentence ${i + 1}.`, kind: 'sentence' as const }))
    const html = renderToString(<EvidencePassage units={units} focus={['u2', 'u3']} />)
    expect(html).not.toContain('data-locate')
    expect(html.match(/data-state="focus"/g)).toHaveLength(2)
  })
})
