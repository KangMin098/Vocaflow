// apps/web/src/components/csat/home/__tests__/csat-rail.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CsatRail, type RailPlace } from '../CsatRail'

const pages: [RailPlace, string][] = [
  ['home', '/csat'], ['browse', '/csat/browse'], ['item', '/csat/browse'],
  ['need', '/csat/browse'], ['type', '/csat/browse'], ['exam', '/csat/browse'],
  ['continue', '/csat?view=continue'], ['record', '/csat/record'],
  ['diagnosis', '/csat/diagnosis'], ['formulas', '/csat/formulas'],
  ['practice', '/csat/practice'], ['dissect', '/csat/dissect'],
]
const render = (place: RailPlace) => renderToStaticMarkup(<CsatRail place={place} exams={[]} dueCount={2} />)
const links = (html: string) => [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(m => m[0])
const signature = (html: string) => links(html).map(a => [a.match(/href="([^"]+)"/)?.[1], a.replace(/<[^>]+>/g, '')])

describe('CSAT 공통 메뉴', () => {
  it.each(pages)('%s도 홈과 같은 항목·순서·접힘 기본값을 가진다', (place) => {
    const html = render(place)
    expect(signature(html)).toEqual(signature(render('home')))
    expect(html).toContain('data-collapsed="false"')
    for (const label of ['이어서 · 복습', '내 기록', '내 진단', '내 공식', '연습 · 주장과 근거', '기출 찾기']) expect(html).toContain(label)
  })
  it.each(pages)('%s에서는 해당 목적지 하나만 현재 메뉴다', (place, expectedHref) => {
    const active = links(render(place)).filter(a => a.includes('aria-current="page"'))
    expect(active).toHaveLength(1)
    expect(active[0]).toContain(`href="${expectedHref}"`)
  })
})
