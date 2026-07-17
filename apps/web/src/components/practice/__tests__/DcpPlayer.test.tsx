// apps/web/src/components/practice/__tests__/DcpPlayer.test.tsx
//
// DCP 플레이어 초기 렌더 검증(renderToString) — order/insert 문항 표면.
// 서버 액션(grade/record)은 렌더 시 호출 안 되지만 server-only import 회피 위해 스텁.
// 채점 계약은 grade_dcp_item DB 실측 + correctOrderFromKey 단위테스트로 별도 확인.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { DcpItem } from '@/lib/learner/dcp'

import { DcpPlayer } from '../DcpPlayer'

vi.mock('@/lib/learner/dcp-actions', () => ({
  gradeDcpItem: vi.fn(),
  recordDcpErrorCause: vi.fn(),
}))

const ORDER_ITEM: DcpItem = {
  id: 'order-1',
  type: 'order',
  paragraphIdx: 0,
  payload: { presented: ['Alpha sentence.', 'Bravo sentence.', 'Charlie sentence.'] },
}

const INSERT_ITEM: DcpItem = {
  id: 'insert-1',
  type: 'insert',
  paragraphIdx: 0,
  payload: { remaining: ['First stays.', 'Third stays.'], insert_sentence: 'Middle goes here.', gap_count: 3 },
}

describe('DcpPlayer', () => {
  it('order 문항: presented 문장 + 이동 버튼 + 제출 + 진행표시 렌더', () => {
    const html = renderToString(<DcpPlayer items={[ORDER_ITEM]} />)
    expect(html).toContain('Alpha sentence.')
    expect(html).toContain('Bravo sentence.')
    expect(html).toContain('Charlie sentence.')
    expect(html).toContain('위로 이동')
    expect(html).toContain('아래로 이동')
    expect(html).toContain('제출')
    expect(html).toContain('올바른 순서로 배열')
    // React 주석 마커 삽입("1<!-- --> / <!-- -->1") 허용 매칭
    expect(html).toMatch(/1[\s\S]{0,20}\/[\s\S]{0,20}1/)
  })

  it('insert 문항: 삽입 문장 + remaining + 슬롯 버튼 + 제출 렌더', () => {
    const html = renderToString(<DcpPlayer items={[INSERT_ITEM]} />)
    expect(html).toContain('Middle goes here.')
    expect(html).toContain('First stays.')
    expect(html).toContain('Third stays.')
    expect(html).toContain('들어갈 위치를 고르세요')
    expect(html).toContain('번째 위치에 삽입')
    expect(html).toContain('제출')
  })

  it('빈 items → null(렌더 없음)', () => {
    const html = renderToString(<DcpPlayer items={[]} />)
    expect(html).toBe('')
  })

  it('여러 문항 → 진행 표시 총계 반영', () => {
    const html = renderToString(<DcpPlayer items={[ORDER_ITEM, INSERT_ITEM]} />)
    expect(html).toMatch(/1[\s\S]{0,20}\/[\s\S]{0,20}2/)
  })
})
