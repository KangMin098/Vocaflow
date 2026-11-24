// apps/web/src/components/game/_shared/__tests__/game-done-link.test.tsx
// P-5 — GameDone 의 선택 link: 주면 버튼 줄 끝에 링크 하나, 주지 않으면 다른 게임의 끝화면 그대로.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GameDone } from '../gamekit'

const base = { stats: [{ num: 1, label: '점수' }], onRestart: () => {}, onExit: () => {} }

describe('GameDone link', () => {
  it('주지 않으면 링크 없음 — 버튼 3개', () => {
    const html = renderToString(<GameDone {...base} />)
    expect(html).not.toContain('data-testid="gk-done-link"')
    expect((html.match(/<button/g) ?? []).length).toBe(3)
  })
  it('주면 그 href·라벨, 48px 버튼 클래스(gk-btn)', () => {
    const html = renderToString(
      <GameDone {...base} link={{ href: '/wordvault/browse?filter=text%3At1', label: '이 자료의 단어 보기' }} />,
    )
    const a = /<a[^>]*data-testid="gk-done-link"[^>]*>/.exec(html)?.[0] ?? ''
    expect(a).toContain('href="/wordvault/browse?filter=text%3At1"')
    expect(a).toContain('class="gk-btn gk-btn--link"')
    expect(html).toContain('이 자료의 단어 보기')
  })
})
