// apps/web/src/components/layout/AreaNav.tsx
//
// 구역 내비(DD-68 · tines-mapping §7) — 참조 `AreaNav`: 라벤더 알약 막대 안에 구역 이름 · 구역 안 면들 ·
// 오른쪽 자리. 실측 모서리 50px/990px · 면 #ece8fd / 선택 #ddd8fe · 링크 16px/400 · 이름 14px/600.
// 서가(`LibraryTabs`) · 만화(`ComicsTabs`)가 같이 쓴다.
//
// 의미 구조는 두 탭이 원래 갖던 그대로다 — role=tablist + aria-label + tab + aria-selected + 44px.
//   e2e(`11-comic-discovery` · `12-navigation` · `25-textbook-shelf`)가 이 이름·역할로 찾는다.
// 390px 에서는 막대가 가로로 넘친다 — `data-scroll-hint` 가 넘친 쪽을 흐리게 해 「더 있다」를 알린다.

'use client'

import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

import { scrollActiveIntoView, useScrollHint } from '@/hooks/useScrollHint'

// 참조 선택 면 #ddd8fe — 막대 면(라벤더)에 보라 12% 를 섞어 만든다. 다크에서는 같은 식이 한 단 밝은 면이 된다.
//   Tailwind 는 글자 그대로 적힌 클래스만 만든다 — `hover:${…}` 로 조립하지 않고 두 벌을 적는다.
const DEEP = 'bg-[color-mix(in_srgb,var(--ju)_12%,var(--tint-lavender))]'
const DEEP_HOVER = 'hover:bg-[color-mix(in_srgb,var(--ju)_12%,var(--tint-lavender))]'

export type AreaNavItem = {
  href: string
  label: string
  icon?: LucideIcon
  /** 보조 한 줄 — 넓은 화면에서만 라벨 옆에 보인다 */
  note?: string
  /** 스크린리더용 설명(없으면 라벨) */
  ariaLabel?: string
  active: boolean
}

export function AreaNav({
  area,
  ariaLabel,
  items,
  right,
  watch,
}: {
  /** 구역 이름 — 막대 맨 앞 알약 */
  area: string
  /** tablist 이름 — e2e 가 이 이름으로 찾는다 */
  ariaLabel: string
  items: AreaNavItem[]
  right?: React.ReactNode
  /** 바뀌면 선택 면을 화면 안으로 끌어온다(보통 pathname) */
  watch?: string
}) {
  const { ref, hint, measure } = useScrollHint<HTMLElement>()

  useEffect(() => {
    scrollActiveIntoView(ref.current, '[aria-selected="true"]')
    measure()
  }, [watch, ref, measure])

  return (
    <div className="flex items-center gap-2 rounded-[50px] bg-[var(--tint-lavender)] p-1.5">
      <span className={`hidden shrink-0 items-center rounded-[50px] ${DEEP} px-4 font-display text-[14px] font-[600] leading-[36px] text-[var(--t1)] sm:inline-flex`}>
        {area}
      </span>
      <nav
        ref={ref}
        role="tablist"
        aria-label={ariaLabel}
        data-scroll-hint={hint === 'none' ? undefined : hint}
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden data-[scroll-hint=both]:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)] data-[scroll-hint=end]:[mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] data-[scroll-hint=start]:[mask-image:linear-gradient(to_right,transparent,black_24px)]"
      >
        {items.map((it) => {
          const Icon = it.icon
          return (
            <Link
              key={it.href}
              href={it.href}
              role="tab"
              aria-selected={it.active}
              aria-label={it.ariaLabel ?? it.label}
              className={`flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-[50px] px-4 font-display text-[15px] transition-colors duration-[var(--dur-fast)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--p)] md:text-[16px] ${
                it.active
                  ? 'bg-[var(--bg)] font-[600] text-[var(--t1)]'
                  : `font-[400] text-[var(--t1)] ${DEEP_HOVER} active:bg-[var(--bg)]`
              }`}
            >
              {Icon && <Icon size={16} aria-hidden className="hidden text-[var(--ju)] sm:block" />}
              {it.label}
              {it.note && <span className="hidden font-body text-[12.5px] font-[400] text-[var(--t2)] lg:inline">{it.note}</span>}
            </Link>
          )
        })}
      </nav>
      {right && <div className="hidden shrink-0 md:block">{right}</div>}
    </div>
  )
}
