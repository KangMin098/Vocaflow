// apps/web/src/components/csat/diagnosis/map/__tests__/vocab-learning.test.tsx
// T-0069 — V1 기본 의미 카드 · 어휘 복습 화면의 지도 복귀 상태(빈 단어 · 조회 실패 · 문맥 없는 일반 진입 대조군)
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }))

import { WordVaultStudyClient } from '@/components/wordvault/WordVaultStudyClient'

import { VocabLearningCard } from '../VocabLearningCard'

const ctx = { mapTask: 'v.core_meaning', ws: 'ws.vocab-context', mapWs: '11111111-2222-4333-8444-555555555555', mapPlan: '2', mapGoal: '5', mapItem: 'x-1', mapAttempt: '9' }
const BACK = '/csat/diagnosis?tab=map&view=full&map_task=v.core_meaning&ws=ws.vocab-context'
const amp = (s: string) => s.replace(/&/g, '&amp;')

describe('VocabLearningCard', () => {
  const html = renderToStaticMarkup(<VocabLearningCard kind="support" taskName="기본 의미" ctx={ctx} />)
  it('보조 TASK 표기 · 기존 WordVault 복습으로 가는 링크(지도 문맥 · 자료 · 수행 id 없음)', () => {
    expect(html).toContain('보조 TASK')
    expect(html).toContain('href="/wordvault/review?from=map&amp;map_task=v.core_meaning&amp;ws=ws.vocab-context')
    expect(html).not.toContain('map_item=')
    expect(html).not.toContain('map_attempt=')
  })
  it('학습 활동은 근거가 아니며 V1 직접 확인 도구가 없다고 알린다 · 숫자를 지어내지 않는다', () => {
    expect(html).toContain('지도의 확인 · 해소 근거로 세지 않고')
    expect(html).toContain('확인 도구는 아직 없어요')
    expect(html).not.toMatch(/[0-9]+ ?(개|단어|회)/)
  })
})

describe('WordVaultStudyClient — 지도에서 온 복습', () => {
  const word = { id: 'w1', word: 'vivid', meaning: '생생한' } as never
  it('복습 화면 위에 「학습 지도로」(같은 문맥)와 근거 아님 안내', () => {
    const html = renderToStaticMarkup(<WordVaultStudyClient words={[word]} mode="review" mapBack={BACK} backHref={BACK} />)
    expect(html).toContain('data-testid="vocab-map-bar"')
    expect(html).toContain(`href="${amp(BACK)}"`)
    expect(html).toContain('근거로 세지 않아요')
  })
  it('빈 단어 = 단어 모으기 안내(「잘 따라가고 있어요」 아님) · 복귀 유지', () => {
    const html = renderToStaticMarkup(<WordVaultStudyClient words={[]} mode="review" mapBack={BACK} backHref={BACK} />)
    expect(html).toContain('data-testid="vocab-empty"')
    expect(html).toContain('내 단어장에서 단어 모으기')
    expect(html).not.toContain('잘 따라가고 있어요')
    expect(html).toContain('data-testid="vocab-map-return"')
  })
  it('조회 실패 ≠ 0개 · 복귀 유지', () => {
    const html = renderToStaticMarkup(<WordVaultStudyClient words={[]} mode="review" mapBack={BACK} loadFailed />)
    expect(html).toContain('data-testid="vocab-load-failed"')
    expect(html).toContain('복습할 단어가 없다는 뜻이 아니에요')
    expect(html).not.toContain('vocab-empty')
    expect(html).toContain('data-testid="vocab-map-return"')
  })
  it('문맥 없는 일반 진입 — 지도 막대 없음 · 기존 빈 상태 그대로', () => {
    const html = renderToStaticMarkup(<WordVaultStudyClient words={[]} mode="review" />)
    expect(html).not.toContain('vocab-map-bar')
    expect(html).toContain('지금 복습할 단어가 없어요')
  })
})
