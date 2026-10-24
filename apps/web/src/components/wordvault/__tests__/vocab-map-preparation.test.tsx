// apps/web/src/components/wordvault/__tests__/vocab-map-preparation.test.tsx
// T-0086 — 지도에서 온 V1 준비: Workspace 내 단어장 링크 · 빈 복습 · 완료 뒤 목록 링크가 같은 문맥을 싣고, 일반 진입은 그대로
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/components/wordvault/StudyMode', () => ({ StudyMode: () => null }))
vi.mock('@/components/illustrations/Illustration', () => ({ Illustration: () => null }))

import { VocabLearningCard } from '@/components/csat/diagnosis/map/VocabLearningCard'
import { MapReturnBar, WordVaultStudyClient } from '@/components/wordvault/WordVaultStudyClient'
import { vocabMapReturnHref } from '@/lib/csat/map-return'

const sp = { from: 'map', map_task: 'v.core_meaning', ws: 'ws.vocab-context', map_ws: '11111111-2222-4333-8444-555555555555', map_plan: '3', map_goal: '7' }
const ctx = { mapTask: sp.map_task, ws: sp.ws, mapWs: sp.map_ws, mapPlan: sp.map_plan, mapGoal: sp.map_goal }
const back = vocabMapReturnHref(sp)!
const hrefs = (html: string, re: RegExp) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&')).filter((h) => re.test(h))
const ctxOf = (h: string) => { const u = new URL(h, 'http://x'); return Object.fromEntries(['from', 'map_task', 'ws', 'map_ws', 'map_plan', 'map_goal'].map((k) => [k, u.searchParams.get(k)])) }

describe('지도 → 어휘 준비 링크(T-0086)', () => {
  it('Workspace 카드의 내 단어장 링크 = 같은 문맥 · 수행 ID 없음(카드가 받은 map_item/attempt 도 버림)', () => {
    const html = renderToStaticMarkup(<VocabLearningCard kind="support" taskName="기본 의미 접근" ctx={{ ...ctx, mapItem: 'authored:x', mapAttempt: '42' }} />)
    const [h] = hrefs(html, /\/wordvault\/browse/)
    expect(ctxOf(h)).toEqual(sp)
    expect(h).not.toMatch(/map_item|map_attempt/)
  })
  it('지도에서 온 빈 복습 = 단어 모으기 링크에 같은 문맥 · 막대 「학습 지도로」', () => {
    const html = renderToStaticMarkup(<WordVaultStudyClient words={[]} mode="review" mapBack={back} backHref={back} />)
    expect(ctxOf(hrefs(html, /\/wordvault\/browse/)[0])).toEqual(sp)
    expect(html).toContain('data-testid="vocab-map-return"')
  })
  it('조회 실패 ≠ 빈 목록 — 실패 안내 · 단어 모으기 0건으로 위장하지 않음', () => {
    const html = renderToStaticMarkup(<WordVaultStudyClient words={[]} mode="review" mapBack={back} loadFailed />)
    expect(html).toContain('vocab-load-failed')
    expect(html).not.toContain('아직 복습할 내 단어가 없어요')
  })
  it('일반 진입 = 지도 막대 · 문맥 없음(기존 「단어 둘러보기」 그대로)', () => {
    const html = renderToStaticMarkup(<WordVaultStudyClient words={[]} mode="review" />)
    expect(html).not.toContain('vocab-map-bar')
    expect(hrefs(html, /\/wordvault\/browse/)).toEqual(['/wordvault/browse'])
  })
  it('공통 막대 — 다음 행동 링크는 선택 prop · 없으면 기존 한 버튼', () => {
    const one = renderToStaticMarkup(<MapReturnBar href={back} />)
    expect(one).not.toContain('vocab-map-next')
    const two = renderToStaticMarkup(<MapReturnBar href={back} next={{ href: '/wordvault/review?from=map', label: '모은 단어 복습하기 →' }} />)
    expect(two).toContain('vocab-map-next')
  })
})
