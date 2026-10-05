// apps/web/src/components/layout/SectionSubNav.tsx
//
// 구역 보조 내비 줄 — 참조 하위 화면(/solutions/security · /webinars/*)이 모두 상단 막대 바로 아래에 두는 줄:
//   왼쪽 「Solutions › Security」 알약 이동 경로 · 오른쪽 같은 구역의 형제 링크.
// 항목은 새로 적지 않는다 — 상단 메뉴가 실제로 그리는 목록(`allEntryItems`)을 그대로 읽는다
// (적는 순간 셸이 두 목록을 갖고 조용히 갈라진다 · top-nav-data 머리말).
// PC 전용(디자인 범위 2026-10-03) · 서가는 자체 구역 탭이 이 자리를 맡는다 · CSAT 은 3B 범위라 서지 않는다.

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { pickCurrent } from '@/components/layout/nav-match'
import { BAR_ENTRIES, allEntryItems } from '@/components/layout/top-nav-data'
import { SCREEN_TYPES } from '@/lib/design/screen-types'
import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
/** 이 줄을 세우지 않는 경로 — 허브(자체 히어로) · 서가(구역 탭) · CSAT(3B) · 게임 판 · 본문 */
const SKIP = [/^\/hub$/, /^\/library(\/|$)/, /^\/csat(\/|$)/, /^\/play\//, /^\/text\/[^/]+/]
/** 세션은 화면 유형 정본이 정한다(2026-10-05) — 셸이 걷히는 화면과 같은 판정. */
const isSession = (p: string) => SCREEN_TYPES[p]?.type === 'session'
/** 오른쪽 링크는 참조처럼 한 줄 — 넘치면 앞에서부터 이만큼만 */
const MAX_LINKS = 7

export function SectionSubNav() {
  const pathname = usePathname() ?? ''
  if (!pathname || isFullScreenRoute(pathname) || isSession(pathname) || SKIP.some((re) => re.test(pathname))) return null

  for (const entry of BAR_ENTRIES) {
    if (entry.kind !== 'menu') continue
    const items = allEntryItems([entry]).filter((it, i, all) => all.findIndex((x) => x.href === it.href) === i)
    const current = pickCurrent(pathname, items)
    if (!current) continue
    const here = items.find((i) => i.href === current)!
    const links = items.slice(0, MAX_LINKS)
    return (
      <nav aria-label={`${entry.label} 구역`} className="hidden border-b border-[var(--bd)] md:block">
        <div className="mx-auto flex min-h-[48px] w-full max-w-[var(--ios-content-wide-max)] items-center gap-6 px-6">
          <ol className="flex shrink-0 items-center gap-2 font-display text-[12px] font-[600]">
            <li>
              <span className="inline-flex h-6 items-center rounded-full bg-[var(--tint-lavender)] px-2.5 text-[var(--ju)]">{entry.label}</span>
            </li>
            <li aria-hidden className="text-[var(--t3)]">›</li>
            <li>
              <span aria-current="page" className="text-[var(--ju)]">{here.label}</span>
            </li>
          </ol>
          <ul className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-5">
            {links.map((it) => {
              const on = it.href === current
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={on ? 'page' : undefined}
                    className={`inline-flex min-h-[44px] items-center font-display text-[12px] font-[600] text-[var(--ju)] underline-offset-4 transition-colors hover:underline ${on ? 'underline decoration-2' : ''} ${FOCUS}`}
                  >
                    {it.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>
    )
  }
  return null
}
