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

/** 경로가 속한 흐름 단계 — 사이드바가 가진 이름 · 한 줄을 그대로 읽는다 */
function stageOf(pathname: string): { label: string; says: string; item: string } | null {
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
  const art = routeArt(pathname)!
  const stage = stageOf(pathname)
  return (
    <div className={`mx-auto w-full max-w-[var(--ios-content-wide-max)] ${slot === 'library' ? '' : 'px-4 pt-4 md:px-6 md:pt-5'}`}>
      <div className={`${TINT_CLASS[art.tint]} relative flex min-h-[112px] items-center gap-4 overflow-hidden rounded-[24px] py-4 pl-5 pr-[120px] md:min-h-[128px] md:pl-7 md:pr-[200px]`}>
        <div className="min-w-0">
          {stage && (
            <p className="inline-flex h-7 items-center rounded-full bg-[color-mix(in_srgb,var(--t1)_12%,transparent)] px-3 font-mono text-[12px] font-[700] uppercase tracking-[0.04em] text-[var(--t1)]">
              {stage.label} · {stage.item}
            </p>
          )}
          {stage && <p className="mt-2 break-keep font-serif text-[20px] leading-[1.25] text-[var(--t1)] md:text-[24px]">{stage.says}</p>}
        </div>
        <Image src={`/illustrations/tines/${art.spot}.webp`} alt="" width={1328} height={1328} className="pointer-events-none absolute bottom-2 right-[108px] hidden w-[64px] select-none md:right-[132px] md:block" />
        <Image src={`/illustrations/tines/${art.tile}.webp`} alt="" width={1328} height={1328} priority className="pointer-events-none absolute right-3 top-1/2 w-[92px] -translate-y-1/2 select-none rounded-[14px] md:w-[108px]" />
      </div>
    </div>
  )
}
