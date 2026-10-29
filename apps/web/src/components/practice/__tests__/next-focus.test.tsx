// apps/web/src/components/practice/__tests__/next-focus.test.tsx
// T-0249 — 「다음 · 마치기」 뒤 초점 인계: 판정은 순수 함수, 실제 activeElement · focus-visible 은 PC 하네스(pc-t249)가 잰다.
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { DcpItem } from '@/lib/learner/dcp'

vi.mock('@/lib/learner/dcp-actions', () => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))

import { DcpPlayer, focusTargetAfter } from '../DcpPlayer'

describe('focusTargetAfter — 의도와 단계가 맞을 때만', () => {
  it('다음 의도 + 답하기 단계 → 새 문항 시작 영역 · 마치기 의도 + 완료 → 완료 제목', () => {
    expect(focusTargetAfter('item', 'answering')).toBe('item')
    expect(focusTargetAfter('done', 'done')).toBe('done')
  })
  it('의도 없음(부모 재렌더 · 일반 갱신)은 어떤 단계에서도 이동 0', () => {
    for (const ph of ['answering', 'grading', 'graded', 'done'] as const) expect(focusTargetAfter(null, ph)).toBeNull()
  })
  it('의도와 단계가 엇갈리면 이동 0', () => {
    expect(focusTargetAfter('item', 'graded')).toBeNull()
    expect(focusTargetAfter('item', 'done')).toBeNull()
    expect(focusTargetAfter('done', 'answering')).toBeNull()
    expect(focusTargetAfter('done', 'grading')).toBeNull()
  })
})

describe('초점 대상 마크업 — tabIndex=-1 · 보이는 초점', () => {
  const A: DcpItem = { id: 'a', type: 'title', paragraphIdx: 0, payload: { passage: 'One. Two.', choices: ['a', 'b', 'c', 'd', 'e'], stemKo: '제목은?', underline: null, summarySentence: null } }
  it('문항 시작 영역은 tabIndex=-1 · 「1번 문항」 이름 · focus-visible 링', () => {
    const html = renderToString(<DcpPlayer items={[A]} />)
    expect(html).toMatch(/data-testid="dcp-item-start"/)
    expect(html).toMatch(/tabindex="-1"[^>]*role="group"[^>]*aria-label="1번 문항"|role="group"[^>]*aria-label="1번 문항"/)
    expect(html).toContain('focus-visible:ring-2')
  })
})

describe('DcpPlayer 배선 — 사용자 전환에만 의도를 남긴다', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../DcpPlayer.tsx'), 'utf8')
  it('handleNext 첫 줄에서 의도를 정하고, 효과가 focusTargetAfter 로 한 번 옮긴 뒤 비운다', () => {
    const next = src.slice(src.indexOf('function handleNext('), src.indexOf('// ── 완료 요약 ──'))
    expect(next).toMatch(/focusIntent\.current = isLast \? 'done' : 'item'/)
    expect(src).toMatch(/const target = focusTargetAfter\(focusIntent\.current, phase\)\s+if \(!target\) return\s+focusIntent\.current = null/)
    expect(src).toMatch(/\}, \[idx, phase\]\)/)
    // 의도를 남기는 곳은 handleNext 하나뿐(부모 재렌더 · 채점 · 복기에서는 남기지 않는다)
    expect(src.match(/focusIntent\.current = (isLast|'item'|'done')/g)).toHaveLength(1)
  })
  it('완료 제목은 ref · tabIndex=-1 · 보이는 초점', () => {
    expect(src).toMatch(/ref=\{doneHeadRef\}\s+tabIndex=\{-1\}\s+data-testid="dcp-done-title"/)
  })
})
