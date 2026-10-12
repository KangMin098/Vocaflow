// apps/web/src/components/csat/theater/__tests__/SceneDiagrams.test.tsx
//
// 장면 도식 — 설계 가설임을 밝힌다 · 단위 대응이 불확실하면 번호를 지어내지 않는다 · 빈 주석이면 그리지 않는다
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { PassageDesign } from '@/lib/csat/design'
import { DesignSelection, StructureDiagram, TransformDiagram } from '../SceneDiagrams'

const design: PassageDesign = {
  roles: ['background', 'turn', 'topic', 'example'],
  alternatives: [{ index: 3, role: 'support' }],
  pattern: 'myth_rebuttal',
  selection: '통념을 뒤집는 전환이 있어 빈칸이 그 반박 자리를 요구한다',
  transform: 'abstraction',
  transform_note: '구체 사례를 일반 명제로 끌어올렸다',
  cues: ['connective'],
}

describe('장면 도식', () => {
  it('지문 구조 — 역할 사슬 · 패턴 · 허용 대안 · 단서, 설계 가설 라벨', () => {
    const html = renderToStaticMarkup(<StructureDiagram design={design} sentenceCount={4} />)
    expect(html).toContain('통념-반박')
    expect(html).toContain('주제문')
    expect(html).toContain('또는 근거')
    expect(html).toContain('연결어')
    expect(html).toContain('설계 가설')
    expect(html).toContain('data-aligned="true"')
  })

  it('지도 문장 수와 역할 수가 다르면 번호 없이 순서만 · 안내', () => {
    const html = renderToStaticMarkup(<StructureDiagram design={design} sentenceCount={5} />)
    expect(html).toContain('data-aligned="false"')
    expect(html).toContain('번호 없이 역할 순서만')
  })

  it('정답 설계 — 변환 종류와 설명', () => {
    const html = renderToStaticMarkup(<TransformDiagram design={design} />)
    expect(html).toContain('추상화')
    expect(html).toContain('일반 명제로')
  })

  it('비어 있으면 그리지 않는다', () => {
    expect(renderToStaticMarkup(<DesignSelection design={{ ...design, selection: ' ' }} />)).toBe('')
    expect(renderToStaticMarkup(<TransformDiagram design={{ ...design, transform: 'none', transform_note: '' }} />)).toBe('')
    expect(renderToStaticMarkup(<StructureDiagram design={{ ...design, roles: [] }} sentenceCount={null} />)).toBe('')
  })
})

describe('오답 설계 · 원리 도식', () => {
  it('유지 / 바뀜을 라벨과 기호로 보이고, 맞는 선지는 왜곡 없이 note 만', async () => {
    const { DistractorDesign } = await import('../SceneDiagrams')
    const html = renderToStaticMarkup(
      <DistractorDesign
        distractors={[
          { n: 2, truth: 'false', operation: 'scope', preserved: [{ component: '대상', text: '습관' }], altered: [{ component: '범위', from: '일부', to: '모두' }], note: '범위만 넓혔다' },
          { n: 4, truth: 'true', operation: 'none', preserved: [], altered: [], note: '정상 형태라 맞는 말이다' },
        ]}
      />,
    )
    expect(html).toContain('= 유지')
    expect(html).toContain('≠ 바뀜 · 범위')
    expect(html).toContain('범위 바꿈')
    expect(html).toContain('내용은 맞지만 정답 아님')
    expect(html.split('≠ 바뀜').length - 1).toBe(1)
  })
  it('원리는 통하는 조건과 적용하면 안 되는 조건을 함께', async () => {
    const { PrincipleDesign } = await import('../SceneDiagrams')
    const html = renderToStaticMarkup(<PrincipleDesign principle={{ statement: '범위 한정어가 같아야 일치한다', when_applies: ['한정어가 있을 때'], when_not: ['전칭 주장일 때'] }} />)
    expect(html).toContain('통하는 조건')
    expect(html).toContain('적용하면 안 되는 조건')
    expect(html).toContain('전칭 주장일 때')
  })
})

describe('검수 상태 라벨(v3 공개 가드)', () => {
  it('legacy 는 「1차 검수(v1)」, verified 는 「독립 검수」 — legacy 를 독립 검수처럼 보이지 않는다', async () => {
    const { DistractorDesign, PrincipleDesign } = await import('../SceneDiagrams')
    const d = [{ n: 1, truth: 'false' as const, operation: 'scope', preserved: [{ component: '대상', text: 'x' }], altered: [{ component: '범위', from: 'a', to: 'b' }], note: '범위를 넓혔다' }]
    expect(renderToStaticMarkup(<DistractorDesign distractors={d} review="legacy" />)).toContain('1차 검수(v1)')
    expect(renderToStaticMarkup(<DistractorDesign distractors={d} review="verified" />)).toContain('독립 검수')
    const pr = { statement: '조건부 원리 문장입니다', when_applies: ['조건 하나'], when_not: ['경계 하나'] }
    expect(renderToStaticMarkup(<PrincipleDesign principle={pr} review="legacy" />)).toContain('1차 검수(v1)')
    expect(renderToStaticMarkup(<PrincipleDesign principle={pr} review="legacy" />)).not.toContain('독립 검수')
  })
})
