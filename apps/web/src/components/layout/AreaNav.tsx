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
import type { Tint } from '@/lib/design/tone'

// 2026-10-19 재참조(tines.com /library · /customers 1440 실캡처): 참조의 구역 줄은 **바탕 막대가 없다** —
//   왼쪽 옅은 라벤더 알약(구역 이름) · 꺾쇠 · 면 이름 글자 링크만 선다. 범주 색 막대(tone-*)는 화면마다 큰 색 띠를
//   하나 더 얹어 「AI 템플릿」 인상을 키웠다(사용자 지적). 고른 면만 라벤더 알약으로 채우고(색 + 굵기 두 신호),
//   나머지는 보라 글자 · 호버에만 옅은 면.
const PILL = 'bg-[var(--tint-lavender)]'

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
  /** 예전 막대 면 색 — 막대를 걷어 지금은 쓰지 않는다(호출부 호환) */
  tint?: Tint
}) {
  const { ref, hint, measure } = useScrollHint<HTMLElement>()

  useEffect(() => {
    scrollActiveIntoView(ref.current, '[aria-selected="true"]')
    measure()
  }, [watch, ref, measure])

  return (
    <div className="flex items-center gap-2">
      <span className={`hidden shrink-0 items-center rounded-full ${PILL} px-3 font-display text-[14px] font-[600] leading-[30px] text-[var(--ju)] sm:inline-flex`}>
        {area}
      </span>
      <span aria-hidden className="hidden text-[10px] text-[var(--ju)] opacity-60 sm:inline">▸</span>
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
              className={`flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 font-display text-[14px] text-[var(--ju)] transition-colors duration-[var(--dur-fast)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--p)] ${
                it.active ? `${PILL} font-[700]` : 'font-[500] hover:bg-[var(--bg3)]'
              }`}
            >
              {Icon && <Icon size={15} aria-hidden className="hidden sm:block" />}
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
