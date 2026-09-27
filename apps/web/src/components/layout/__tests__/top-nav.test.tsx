// apps/web/src/components/layout/__tests__/top-nav.test.tsx
//
// **상단 메뉴가 사이드바가 하던 일을 하나도 잃지 않았는가.**
//
// 왼쪽 레일을 걷어낼 때 조용히 사라질 수 있는 것이 넷이다:
//   ① 항목 — 막대·패널에 없으면 데스크톱에서 그 화면으로 가는 길이 사라진다.
//     (`wayfinding.test.ts` 는 **설정**이 소유를 선언했는지만 보지, 그 설정이 실제로
//      그려지는지는 보지 않는다. 그래서 그 파일만으로는 이 손실을 못 잡는다.)
//   ② 순서 — 흐름 다섯 단계의 번호가 배열 순서와 어긋나면 번호가 거짓말이 된다.
//   ③ 현재 위치 — 표식이 없으면 WCAG 2.4.8 이 비고, 둘이면 두 번 말해진다.
//   ④ 만화의 자리 — 번호가 붙거나 열 안에 들어가면 「여섯 번째 단계」가 된다.
//
// 목록은 손으로 적지 않는다 — `sidebar-config.ts`(IA 정본)에서 읽어 비교한다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ pathname: '/hub', search: new URLSearchParams() }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.search,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

import { AppHeader } from '../AppHeader'
import { ASIDE_GROUP, FOOTER_ITEMS, META_ITEMS, NAV_GROUPS } from '../sidebar-config'
import { BAR_ENTRIES, TOP_ENTRIES, allEntryItems, type TopEntry } from '../top-nav-data'

/** IA 정본이 파는 모든 주소 — 부모 · 자식 · 레일 밖까지. */
const CONFIG_HREFS = [
  ...META_ITEMS,
  ...META_ITEMS.flatMap((i) => i.children ?? []),
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => i.children ?? [])),
  ...ASIDE_GROUP.items,
  ...FOOTER_ITEMS,
].map((i) => i.href)

const render = (pathname: string, search = new URLSearchParams()) => {
  nav.pathname = pathname
  nav.search = search
  return renderToString(<AppHeader />)
}

const hrefsIn = (html: string) =>
  [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))

const marksIn = (html: string) =>
  [...html.matchAll(/href="([^"]+)"[^>]*aria-current="page"/g)].map((m) =>
    m[1].replace(/&amp;/g, '&'),
  )

describe('상단 메뉴 — 사이드바가 팔던 주소를 하나도 잃지 않는다', () => {
  it('IA 정본의 모든 주소가 막대나 패널에 있다', () => {
    const rendered = new Set(hrefsIn(render('/hub')))
    const missing = CONFIG_HREFS.filter((h) => !rendered.has(h))
    expect(
      missing,
      '이 주소들은 데스크톱 셸에서 사라졌다 — top-nav-data.ts 의 메뉴에 넣을 것',
    ).toEqual([])
  })

  it('같은 주소를 두 번 팔지 않는다 — 한 셸에 같은 링크가 두 벌이면 층위가 안 읽힌다', () => {
    const seen = new Map<string, number>()
    for (const i of allEntryItems()) seen.set(i.href, (seen.get(i.href) ?? 0) + 1)
    expect([...seen.entries()].filter(([, n]) => n > 1)).toEqual([])
  })

  it('막대는 다섯 칸이다 — 「더 보기」 같은 남은 것 통이 없다', () => {
    expect(BAR_ENTRIES).toHaveLength(5)
    for (const e of BAR_ENTRIES) {
      expect(e.label, '막대 칸은 이름으로 부른다').not.toMatch(/더 보기|기타|More/i)
    }
  })

  it('흐름 번호 = 배열 순서, 다섯 개 모두 패널 안에 있다 (번호가 순서를 말한다)', () => {
    const html = render('/hub')
    for (const g of NAV_GROUPS) {
      expect(
        html.includes(`흐름 ${g.step}번째 · ${g.label}`),
        `${g.step}단계 ${g.label} 의 순서 문장이 없다`,
      ).toBe(true)
    }
    // 화면에 나오는 순서도 배열 순서와 같다 — 패널을 열면 ①→⑤ 로 읽힌다.
    const shown = [...render('/hub').matchAll(/흐름 (\d)번째/g)].map((m) => Number(m[1]))
    expect(shown).toEqual([...shown].sort((a, b) => a - b))
  })

  it('만화는 열 밖 · 번호 밖 — 흐름 단계로 읽히지 않는다', () => {
    const html = render('/hub')
    for (const item of ASIDE_GROUP.items) {
      expect(hrefsIn(html), `${item.href} 로 가는 길이 없다`).toContain(item.href)
      // 만화 링크 바로 앞뒤에 흐름 번호 문장이 붙지 않는다
      const at = html.indexOf(`href="${item.href}"`)
      const around = html.slice(Math.max(0, at - 400), at + 400)
      expect(around, '만화에 흐름 번호가 붙었다').not.toMatch(/흐름 \d번째/)
    }
  })

  it('잠그지 않는다 — 자물쇠 어휘도, 비활성 링크도 없다', () => {
    const html = render('/hub')
    expect(html).not.toMatch(/잠김|잠금|불가|금지|차단/)
    expect(html).not.toMatch(/aria-disabled="true"/)
  })
})

describe('상단 메뉴 — 현재 위치를 정확히 한 번 말한다', () => {
  const cases: Array<[string, string]> = [
    ['/hub', '/hub'],
    ['/wordvault', '/wordvault'],
    // 하위 라우트에서도 그 항목이 위치를 말한다
    ['/wordvault/study', '/wordvault'],
    // 접힌 도구들(`owns`)은 Practice 가 대신 말한다
    ['/flashcard', '/practice'],
    ['/spellforge', '/practice'],
    // 패널 안 행이 부모 블록보다 구체적이면 행이 갖는다
    ['/library/books', '/library/books'],
    ['/library/scripts', '/library/scripts'],
    // Growth 의 자식 셋(v08.7 — owns 에서 children 으로)
    ['/diagnostic', '/diagnostic'],
    ['/diagnostic/history', '/diagnostic'],
    ['/reports', '/reports'],
    // 레일 밖 · 오른쪽 알약
    ['/comics/restored', '/comics/restored'],
    ['/settings', '/settings'],
    ['/csat', '/csat'],
    ['/teacher', '/teacher'],
  ]

  for (const [pathname, owner] of cases) {
    it(`${pathname} → ${owner} 하나만 aria-current`, () => {
      const marks = marksIn(render(pathname))
      expect(marks, '현재 위치 표식이 하나가 아니다').toHaveLength(1)
      expect(marks[0]).toBe(owner)
    })
  }

  it('쿼리 뷰(/text?view=) 는 그 면만 켜진다 — 넷이 동시에 켜지지 않는다', () => {
    const marks = marksIn(render('/text', new URLSearchParams('view=vocab')))
    expect(marks).toEqual(['/text?view=vocab'])
  })

  it('쿼리 없는 /text 는 자식이 아니라 부모가 말한다', () => {
    expect(marksIn(render('/text'))).toEqual(['/text'])
  })

  it('학습 세션(풀스크린)에서는 셸을 걷어낸다 — 나침반 띠 · 하단 탭과 같은 판정', () => {
    expect(render('/play/wordblitz')).toBe('')
  })
})

describe('상단 메뉴 — 패널 구성', () => {
  const menus = TOP_ENTRIES.filter((e): e is Extract<TopEntry, { kind: 'menu' }> => e.kind === 'menu')

  it('메뉴 칸은 자기 패널을 `aria-controls` 로 가리킨다', () => {
    const html = render('/hub')
    const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1])
    expect(controls).toHaveLength(menus.length)
    for (const id of controls) expect(html).toContain(`id="${id}"`)
  })

  it('닫힌 패널도 DOM 에 남는다(hidden) — 링크가 사라지면 목록을 잃는다', () => {
    expect(render('/hub').match(/hidden=""/g)?.length).toBe(menus.length)
  })

  it('패널마다 면 색이 다르다 — 참조처럼 메뉴가 색으로도 구별된다', () => {
    const tones = menus.map((m) => m.panel.tone)
    expect(new Set(tones).size).toBe(tones.length)
  })

  it('열은 눈썹을 갖고, 빈 열은 없다', () => {
    for (const m of menus) {
      for (const c of m.panel.columns) {
        expect(c.eyebrow.length, `${m.label} 에 이름 없는 열`).toBeGreaterThan(0)
        expect(
          c.features.length + c.rows.length,
          `${m.label} · ${c.eyebrow} 가 비어 있다`,
        ).toBeGreaterThan(0)
      }
    }
  })
})
