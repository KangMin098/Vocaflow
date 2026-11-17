// apps/web/src/components/library/vocab/__tests__/SubscribeSuccessToast.test.tsx
//
// 구독 토스트 문구 — **하지 않는 자동 추가 적재를 약속하지 않는다**(VOCAB-COPY-01).
// 문구는 서버가 보고한 이번 분량(importedCount·alreadyOwnedCount)만 말하고, 세트 전체 보유를
// 단정("모두" · "다 담겨")하지 않는다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SubscribeSuccessToast, type SubscribeToastData } from '../SubscribeSuccessToast'

vi.mock('next/navigation', () => ({ usePathname: () => '/library/vocab' }))

const render = (d: Omit<SubscribeToastData, 'setTitle'>) =>
  renderToString(<SubscribeSuccessToast data={{ setTitle: '수능 필수', ...d }} onClose={() => {}} />)

const PROMISES = ['채워집니다', '채워져요', '자동으로', '모두 이미', '다 담겨']

describe('SubscribeSuccessToast 문구', () => {
  it('일부(시작 분량) → 담은 수와 세트 전체만, 자동 적재 약속 없음 · 내 단어장 링크 유지', () => {
    const html = render({ importedCount: 40, alreadyOwnedCount: 0, totalWords: 300 })
    expect(html).toContain('40개로 시작해요 · 세트 전체 300개')
    expect(html).toContain('내 단어장에서 보기')
    for (const p of PROMISES) expect(html).not.toContain(p)
  })

  it('일부 + 기보유 → 같은 일부 문구', () => {
    const html = render({ importedCount: 30, alreadyOwnedCount: 10, totalWords: 300 })
    expect(html).toContain('30개로 시작해요 · 세트 전체 300개')
    for (const p of PROMISES) expect(html).not.toContain(p)
  })

  it('전부 이번에 등록 → 추가 수', () => {
    expect(render({ importedCount: 25, alreadyOwnedCount: 0, totalWords: 25 })).toContain('25개 단어가 추가됐어요')
  })

  it('새 등록 + 기보유로 세트 전량 → 새 단어 · 건너뜀', () => {
    const html = render({ importedCount: 20, alreadyOwnedCount: 5, totalWords: 25 })
    expect(html).toContain('새 단어 20개 추가 · 이미 보유 5개 건너뜀')
  })

  it('새 등록 0 · 기보유 N → 이번 시작 분량 한정, 세트 전체 보유 단정 없음 · 링크 없음', () => {
    const html = render({ importedCount: 0, alreadyOwnedCount: 40, totalWords: 300 })
    expect(html).toContain('이번 시작 분량 중 40개는 이미 내 단어장에 있어요')
    expect(html).not.toContain('내 단어장에서 보기')
    for (const p of PROMISES) expect(html).not.toContain(p)
  })

  it('새 등록 0 · 기보유 0 · 세트에 단어 있음 → 이번에 새로 담은 단어 없음', () => {
    const html = render({ importedCount: 0, alreadyOwnedCount: 0, totalWords: 300 })
    expect(html).toContain('이번에 새로 담은 단어가 없어요')
    for (const p of PROMISES) expect(html).not.toContain(p)
  })

  it('빈 세트 → 단어가 없는 세트', () => {
    expect(render({ importedCount: 0, alreadyOwnedCount: 0, totalWords: 0 })).toContain('단어가 없는 세트예요')
  })
})
