// apps/web/src/components/layout/__tests__/mobile-reach.test.tsx
//
// **도달 가능성** 회귀 — 옆 파일 `wayfinding.test.ts` 가 재지 않는 것을 잰다.
//
// 그 파일은 "지금 어디에 있는가"(aria-current 소유자)를 재고, 그래서 `/teacher` 를
// EXEMPT 로, `/settings` 를 TABBAR_EXEMPT 로 **면제**한다 — 둘 다 학습 표면이 아니라
// 맞는 판단이다. 그런데 그 면제가 가린 것이 있었다: 위치 표시를 면제받은 화면은
// **거기까지 가는 길이 있는지도 아무도 재지 않았다.**
//
// 실측 2026-08-26 — `FOOTER_ITEMS`(Class · Settings)는 `Sidebar.tsx` 에서만 렌더되고
// 사이드바는 `hidden md:flex` 다. 즉 폰에서는 두 화면으로 **가는 길이 0개**였다.
// `/teacher` 는 진단(§6)이 10만 학습자의 유일한 CAC 0 경로로 지목한 교사 채널의 입구다.
//
// 그래서 여기서는 한 가지만 묻는다 — **좁은 화면에서 이 주소들에 닿을 수 있는가.**

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ pathname: '/hub' }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
}))

vi.mock('next/link', () => ({
  // 실제 next/link 는 나머지 props(aria-current·aria-label·className)를 그대로 넘긴다 —
  // 목이 href 만 넘기면 **컴포넌트가 멀쩡한데 테스트만 빨개진다**(실제로 한 번 그랬다).
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { MobileUtilityBar } from '../MobileUtilityBar'
import { FOOTER_ITEMS } from '../sidebar-config'

const render = (props: { signedIn: boolean }) => renderToString(<MobileUtilityBar {...props} />)

describe('모바일 도달 가능성 — 레일 밖 유틸리티', () => {
  it('FOOTER_ITEMS 가 하나도 빠짐없이 링크로 나온다', () => {
    nav.pathname = '/hub'
    const html = render({ signedIn: true })

    // 목록을 눈으로 세지 않는다 — 설정 파일이 자라면 이 단언도 같이 자란다.
    expect(FOOTER_ITEMS.length).toBeGreaterThan(0)
    for (const item of FOOTER_ITEMS) {
      expect(html, `${item.label}(${item.href}) 로 가는 길이 모바일에 없다`).toContain(
        `href="${item.href}"`,
      )
    }
  })

  it('자기 목록을 들지 않는다 — 사이드바와 같은 출처를 읽는다', () => {
    nav.pathname = '/hub'
    const hrefs = [...render({ signedIn: true }).matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    // 여기서 어긋나면 두 내비가 갈라진 것이다(같은 화면이 기기마다 다른 목록을 갖는다).
    expect(hrefs).toEqual(FOOTER_ITEMS.map((i) => i.href))
  })

  it('학습 세션(풀스크린)에서는 셸을 걷어낸다 — 다른 셋과 같은 판정', () => {
    nav.pathname = '/play/wordblitz'
    expect(render({ signedIn: true })).toBe('')
  })

  it('비로그인에는 그리지 않는다 — 두 주소 모두 로그인 뒤의 화면이다', () => {
    nav.pathname = '/hub'
    expect(render({ signedIn: false })).toBe('')
  })

  it('현재 화면이면 aria-current 로 말한다 — 색만으로 알리지 않는다', () => {
    nav.pathname = '/teacher'
    const html = render({ signedIn: true })
    expect(html).toContain('aria-current="page"')
  })
})
