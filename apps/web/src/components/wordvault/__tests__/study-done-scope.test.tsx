// apps/web/src/components/wordvault/__tests__/study-done-scope.test.tsx
// @vitest-environment node
// 학습 완료 화면 — 출처 목록(text:/set:)에서 왔으면 필터 없는 전체 목록 링크를 두지 않고, 지도 · 일반 진입은 그대로
// R0: 지도가 아니면 마지막에 「다른 글 살펴보기」(/library/scripts) 보조 선택 하나 — 지도 복습에는 없다
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/components/wordvault/StudyMode', () => ({ StudyMode: () => null }))
vi.mock('@/components/illustrations/Illustration', () => ({ Illustration: () => null }))

import { StudyDoneScreen } from '@/components/wordvault/WordVaultStudyClient'

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))

describe('StudyDoneScreen', () => {
  it('출처 범위: 그 목록으로만 돌아가고 필터 없는 /wordvault/browse 링크가 없다', () => {
    const back = '/wordvault/browse?filter=text%3Aabc'
    const html = renderToStaticMarkup(
      <StudyDoneScreen count={3} screenName="학습" backHref={back} mapBack={null} source={{ total: 3, conditions: '' }} />,
    )
    expect(hrefs(html)).toEqual([back, '/library/scripts'])
    expect(html).toContain('이 목록으로 돌아가기')
    expect(html).not.toContain('내 단어 보기')
  })

  it('지도에서 온 경우: 지도 복귀 + 지도 문맥을 실은 내 단어 보기(기존 동작)', () => {
    const mapBack = '/csat/map?from=map&map_task=v.core_meaning&ws=ws.vocab-context&map_plan=3&map_goal=7'
    const html = renderToStaticMarkup(
      <StudyDoneScreen count={2} screenName="복습" backHref={mapBack} mapBack={mapBack} source={null} />,
    )
    const hs = hrefs(html)
    expect(hs).toHaveLength(2)
    expect(hs[0]).toBe(mapBack)
    expect(hs[1].startsWith('/wordvault/browse?')).toBe(true)
    expect(hs[1]).toContain('map_task=v.core_meaning')
    expect(html).toContain('학습 지도로 돌아가기')
    expect(html).not.toContain('다른 글 살펴보기')
  })

  it('일반 진입: 돌아가기 + 내 단어 보기(기존 동작)', () => {
    const html = renderToStaticMarkup(
      <StudyDoneScreen count={1} screenName="학습" backHref="/wordvault" mapBack={null} source={null} />,
    )
    expect(hrefs(html)).toEqual(['/wordvault', '/wordvault/browse', '/library/scripts'])
  })
})
