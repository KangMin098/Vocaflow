// apps/web/src/components/csat/__tests__/PassageMap.test.tsx
//
// 마크업 불변식 회귀. 「무엇이 열리는가」는 `lib/csat/__tests__/passage-map-model.test.ts`
// 가 지키고, 여기서는 **화면이 지켜야 할 약속**만 본다 — 색 말고도 말하는가, 손가락이
// 닿는가, 지문이 통째로 나오지 않는가.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { SkeletonSentence } from '@/lib/csat/passage-skeleton'

import { PassageMap, type MapAnchor } from '../PassageMap'

const SENTENCES: SkeletonSentence[] = [
  { chars: 120, reveals: [] },
  { chars: 80, reveals: [{ anchorId: 'reject:1', start: 10, end: 30, text: 'twenty chars exactly' }] },
  { chars: 200, reveals: [{ anchorId: 'answer', start: 50, end: 68, text: 'it proceeds slowly' }] },
]
const ANCHORS: MapAnchor[] = [
  { id: 'answer', label: '③', kind: 'answer', detail: '③이 답인 이유' },
  { id: 'reject:1', label: '①', kind: 'reject', detail: '①을 지우는 근거', tempting: '①이 끌리는 이유' },
  { id: 'reject:2', label: '②', kind: 'reject', detail: '②를 지우는 근거' },
]
const PLACEMENTS = [
  { id: 'answer', sentences: [2] },
  { id: 'reject:1', sentences: [1] },
  { id: 'reject:2', sentences: [] },
]

const html = () =>
  renderToString(<PassageMap sentences={SENTENCES} anchors={ANCHORS} placements={PLACEMENTS} />)

describe('PassageMap — 화면이 지켜야 할 약속', () => {
  it('문장 수만큼 막대가 있다', () => {
    const h = html()
    for (let i = 1; i <= SENTENCES.length; i += 1) expect(h).toContain(`${i}번째 문장`)
  })

  it('서버 렌더에서 이미 정답 근거가 열려 있다 — 클릭 0 으로 증명이 보인다', () => {
    // 첫 화면이 «아무것도 안 열린 상태» 면 학습자는 무엇을 눌러야 하는지 모른다.
    // 그리고 크롤러가 읽을 것이 없다.
    const h = html()
    expect(h).toContain('it proceeds slowly')
    expect(h).toContain('지금 보는 근거가 여기 있어요')
  })

  it('색 말고도 말한다 — 기호와 글자가 함께 있다', () => {
    const h = html()
    expect(h).toContain('✓')
    expect(h).toContain('답이 왜 ③인가')
    expect(h).toContain('① 아닌 이유')
  })

  it('모든 칩이 44px 이상이다', () => {
    const h = html()
    const buttons = h.match(/<button[^>]*>/g) ?? []
    expect(buttons.length).toBe(ANCHORS.length)
    for (const b of buttons) expect(b).toContain('min-h-[44px]')
  })

  it('고른 칩만 aria-pressed 가 참이다', () => {
    const h = html()
    expect((h.match(/aria-pressed="true"/g) ?? []).length).toBe(1)
    expect((h.match(/aria-pressed="false"/g) ?? []).length).toBe(ANCHORS.length - 1)
  })

  it('위치를 못 찾은 근거는 칩에 그렇게 적는다', () => {
    expect(html()).toContain('위치 없음')
  })

  it('열리지 않은 문장의 글자는 나가지 않는다', () => {
    // 지금 고른 앵커(answer)의 조각만 보여야 한다. 다른 앵커의 인용문이 함께 나가면
    // 지문이 한 화면에 통째로 쌓인다.
    const h = html()
    expect(h).not.toContain('twenty chars exactly')
  })

  it('전환은 opacity·colors 뿐이고 motion-reduce 를 존중한다', () => {
    const h = html()
    expect(h).toContain('motion-reduce:transition-none')
    expect(h).not.toMatch(/animate-(bounce|ping|spin|pulse)/)
  })

  it('한글에 break-keep 이 붙어 있다 — 390px 에서 낱말이 쪼개진다', () => {
    expect(html()).toContain('break-keep')
  })

  it('문장이 없으면 아무것도 그리지 않는다 — 빈 막대는 «지문 없음» 으로 읽힌다', () => {
    expect(renderToString(<PassageMap sentences={[]} anchors={ANCHORS} placements={PLACEMENTS} />)).toBe('')
  })

  it('앵커가 없어도 터지지 않는다', () => {
    const h = renderToString(<PassageMap sentences={SENTENCES} anchors={[]} placements={[]} />)
    expect(h).toContain('번째 문장')
    expect(h).not.toContain('<button')
  })
})
