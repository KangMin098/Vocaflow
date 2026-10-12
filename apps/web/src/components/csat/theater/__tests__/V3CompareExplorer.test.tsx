// apps/web/src/components/csat/theater/__tests__/V3CompareExplorer.test.tsx
//
// 기출 비교 탐구(M5) — 선택 전 안내 · 주소 쌍으로 연 상세 · 숨긴 쌍의 이유 · 상대 이동 링크(back · from=map) · 복귀 링크
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { V3PairView } from '@/lib/csat/inquiry/labels'
import { V3CompareExplorer } from '../V3CompareExplorer'

const pair = (id: string, kind: V3PairView['kind'] = 'same_structure'): V3PairView => ({
  pairId: id, kind, focus: '두 오답 모두 같은 규칙으로 지워진다', otherSlug: 'M2706-38', otherLabel: '2027학년도 6월 모의평가 38번',
  mappings: [{ self: { sentences: [5, 6], choices: [3] }, other: { sentences: [5, 6], choices: [2] }, relation: '지시어가 받을 앞 문장을 끊는다' }],
  shared: ['주어진 문장과 근거 사이에 끼우면 연결이 끊긴다'], differences: [], principle: null, limitation: '두 문항 범위',
})
const base = { withheld: { held: 0, missing: 0, changed: 0 }, initialPairId: null, currentSlug: '2026-38', fromMap: false, returnTo: null, onEvidence: () => {}, linkable: true, selectedKey: null, absence: null }
const render = (over: Partial<Parameters<typeof V3CompareExplorer>[0]> = {}) => renderToStaticMarkup(<V3CompareExplorer pairs={[pair('a~b'), pair('a~c', 'boundary')]} {...base} {...over} />)

describe('V3CompareExplorer', () => {
  it('선택 전에는 목록 · 종류 필터 · 안내만, 상세는 없다', () => {
    const html = render()
    expect(html).toContain('검수된 기출 비교 2쌍')
    expect(html).toContain('role="listbox"')
    expect(html).toContain('같은 판단 구조 1')
    expect(html).toContain('원리가 통하는 경계 1')
    expect(html).not.toContain('data-testid="v3-pair"')
    expect(html).toContain('하나 고르세요')
  })
  it('주소의 쌍으로 열면 대응 표 · 이 문항 근거 버튼 · 상대 이동(back) 링크가 있다', () => {
    const html = render({ initialPairId: 'a~b' })
    expect(html).toContain('data-testid="v3-pair"')
    expect(html).toContain('5 · 6번 문장 · ③ 지문에서 보기')
    expect(html).toContain('/csat/item/M2706-38?scene=compare&amp;pair=a~b&amp;back=2026-38')
    expect(html).not.toContain('from=map')
    expect(render({ initialPairId: 'a~b', fromMap: true })).toContain('back=2026-38&amp;from=map')
  })
  it('없는 쌍 id 로 열면 선택하지 않는다', () => {
    expect(render({ initialPairId: 'zzz' })).not.toContain('data-testid="v3-pair"')
  })
  it('숨긴 쌍은 이유별 수를 밝히고, 남은 쌍이 없으면 absence 문구', () => {
    expect(render({ withheld: { held: 2, missing: 1, changed: 0 } })).toContain('상대 문항 비공개 2 · 상대 문항이 공개 목록에 없음 1')
    const empty = render({ pairs: [], absence: 'partner_changed', withheld: { held: 0, missing: 0, changed: 3 } })
    expect(empty).toContain('data-reason="partner_changed"')
    expect(empty).toContain('상대 분석이 바뀜 3')
  })
  it('다른 문항에서 넘어왔으면 복귀 링크', () => {
    expect(render({ returnTo: { href: '/csat/item/M2706-38?scene=compare&pair=a~b', label: '2027학년도 6월 모의평가 38번' } })).toContain('← 2027학년도 6월 모의평가 38번로 돌아가기')
  })
})
