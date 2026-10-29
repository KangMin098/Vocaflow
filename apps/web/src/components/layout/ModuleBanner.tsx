// apps/web/src/components/layout/ModuleBanner.tsx
//
// 모듈 머리띠(DD-68 · tines-mapping §16) — 참조는 모든 페이지가 **그림 있는 머리**로 시작하고, 면은 구간마다 다른 색이다.
// 우리 학습 화면 대부분은 그림 0 · 보라 외 색 0% 였다(ours-corpus). 셸에서 경로를 보고 그 모듈의 범주 색 면 +
// 진한 면 타일 + 물건 소품을 한 줄로 얹는다. 문구는 새로 짓지 않는다 — 사이드바 흐름 단계 이름과 한 줄(`says`)을 쓴다.
//
// 화면의 h1 은 페이지가 그대로 갖는다(여기는 머리말 · 장식 층). 그림은 alt="" 장식이다.

'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'

import { NAV_GROUPS, ASIDE_GROUP } from '@/components/layout/sidebar-config'
import { TINT_CLASS } from '@/lib/design/tone'
import { routeArt, wantsBanner } from '@/lib/design/route-art'
import { editorialModuleArtwork } from '@/lib/design/editorial-art'
import { getLearnerPalette } from '@/lib/design/learner-palette'

/** 경로가 속한 흐름 단계 — 사이드바가 가진 이름 · 한 줄을 그대로 읽는다(자기 머리를 그리는 화면도 같은 문구를 쓴다) */
export function stageOf(pathname: string): { label: string; says: string; item: string } | null {
  const hit = (href: string) => pathname === href || pathname.startsWith(href + '/')
  for (const g of [...NAV_GROUPS, ASIDE_GROUP]) {
    for (const it of g.items) {
      const child = it.children?.find((c) => hit(c.href))
      if (child) return { label: g.label, says: g.says, item: child.label }
      if (hit(it.href)) return { label: g.label, says: g.says, item: it.label }
    }
  }
  return null
}

export function ModuleBanner({ slot = 'main' }: { slot?: 'main' | 'library' }) {
  const pathname = usePathname() ?? ''
  if (!wantsBanner(pathname, slot)) return null
  // D4-UX01(F01): Stories 서가 · 판본 화면에서는 장식 머리띠를 생략한다 — 같은 자료 탭 · 레일이 이미 있고 작품이 시작 행동보다 아래로 밀렸다.
  // 다른 /library 경로 · 다른 모듈의 머리띠는 그대로다.
  if (slot === 'library' && (pathname === '/library/stories' || pathname.startsWith('/library/stories/'))) return null
  const art = routeArt(pathname)!
  const stage = stageOf(pathname)
  const desktopArt = getLearnerPalette(pathname) !== null ? editorialModuleArtwork(art.tile) : undefined
  return (
    <div data-module-banner className={`mx-auto w-full max-w-[var(--ios-content-wide-max)] ${slot === 'library' ? '' : 'px-4 pt-4 md:px-6 md:pt-5'}`}>
      <div className={`${TINT_CLASS[art.tint]} relative flex min-h-[112px] items-center gap-4 overflow-hidden rounded-[24px] py-4 pl-5 pr-[120px] md:min-h-[128px] md:pl-7 md:pr-[200px]`}>
        <div className="min-w-0">
          {stage && (
            <p className="inline-flex h-7 items-center rounded-full bg-[color-mix(in_srgb,var(--t1)_12%,transparent)] px-3 font-mono text-[12px] font-[700] uppercase tracking-[0.04em] text-[var(--t1)]">
              {stage.label} · {stage.item}
            </p>
          )}
          {stage && <p className="mt-2 break-keep font-serif text-[20px] leading-[1.25] text-[var(--t1)] md:text-[24px]">{stage.says}</p>}
        </div>
        <Image src={`/illustrations/tines/${art.spot}.webp`} alt="" width={1328} height={1328} className={`pointer-events-none absolute bottom-2 right-[108px] hidden w-[64px] select-none md:right-[132px] md:block ${desktopArt ? 'lg:hidden' : ''}`} />
        <Image src={`/illustrations/tines/${art.tile}.webp`} alt="" width={1328} height={1328} priority className={`pointer-events-none absolute right-3 top-1/2 w-[92px] -translate-y-1/2 select-none rounded-[14px] md:w-[108px] ${desktopArt ? 'lg:hidden' : ''}`} />
        {desktopArt && <Image src={desktopArt} alt="" width={1536} height={1024} sizes="180px" className="pointer-events-none absolute right-3 top-1/2 hidden h-auto w-[180px] -translate-y-1/2 select-none object-contain lg:block" />}
      </div>
    </div>
  )
}
