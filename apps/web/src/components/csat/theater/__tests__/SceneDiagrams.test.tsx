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
