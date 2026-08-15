// apps/web/src/components/layout/MobileTabBar.tsx
//
// 모바일 전역 내비 — 최상위 4 표면 하단 탭.
//
// 왜 이것이 먼저인가 (docs/VOCAB_FRAMEWORK_PROPOSAL.md §4):
//   실측 **모바일 전역 내비 링크 0개**. 사이드바가 `hidden md:flex` 라 좁은 화면에서는
//   어떤 표면으로도 갈 수 없었다 — 링크를 타고 들어가면 되돌아 나올 길이 없다.
//   그 상태에서 데스크톱 사이드바를 다듬으면 모바일은 그대로다. 그래서 설계안이
//   **"4개 최상위를 하단 탭으로 먼저 설계하고 데스크톱을 그 확장으로 둔다"** 고 못 박았다.
//
// 이 컴포넌트가 하는 일은 그 4개를 노출하는 것뿐이다 — **메뉴 개편(Phase 3)이 아니다.**
// 표면이 흡수할 대상(`SURFACES[].absorbs`)은 아직 각자 라우트에 있고, 여기서는 진입점만 준다.
//
// 목록을 자체로 갖지 않는다: 탭이 자기 배열을 들면 그게 **10번째 내비 표면**이 되고,
// 표면이 바뀔 때 갈라진다. `SURFACE_ORDER` + `SURFACES[].href` 가 단일 출처다.

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, BookOpen, Home, Layers, type LucideIcon } from 'lucide-react'

import { SURFACES, SURFACE_ORDER, type SurfaceId } from '@/lib/framework/axes'
import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'
import type { TodayStatus } from '@/lib/learner/today-status'

/** 표면 → 아이콘. 이름·경로는 레지스트리가 갖고, 그림만 여기서 고른다. */
const ICON: Record<SurfaceId, LucideIcon> = {
  today: Home,
  library: BookOpen,
  vault: Layers,
  growth: BarChart3,
}

// 라벨은 `SURFACES[].name`(축 레지스트리)를 그대로 쓴다 — 별도 목록을 두지 않는다.
//   v06.141 이전에는 여기에 한국어 라벨('오늘'·'서재'·'내 단어'·'성장')을 따로 들고 있었다.
//   그래서 데스크톱 사이드바는 Today/Growth 인데 모바일 하단 탭은 오늘/성장이라,
//   같은 표면이 기기에 따라 다른 이름으로 불렸다. 이 파일이 목록을 갖지 않는 이유와 같은 이유다.

/**
 * 현재 경로가 그 표면에 속하는가.
 * 하위 경로까지 활성으로 본다 — `/library/books` 에서 '서재' 가 꺼져 있으면
 * 학습자는 자기가 어디 있는지 알 수 없다.
 */
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}

export interface MobileTabBarProps {
  /** 오늘 진행 — 실(thread)과 Today 점의 근거. 비로그인이면 null */
  status?: TodayStatus | null
}

export function MobileTabBar({ status = null }: MobileTabBarProps) {
  const pathname = usePathname()

  // 학습 세션은 셸을 걷어낸다 — 작업기억 보호(§학습원칙6). 사이드바·StatusRibbon 과 같은 판정.
  if (isFullScreenRoute(pathname)) return null

  // ADR 0006 D3 — 진행은 **실 한 가닥**. 숫자도 퍼센트도 없다(철학 ④ Implicit Progress).
  // 상태 띠는 스크롤되어 사라지지만 탭 바는 고정이라, 이 실이 주변시에 남는 유일한 신호다.
  const total = status?.total ?? 0
  const ratio = total > 0 ? Math.min(1, Math.max(0, (status?.done ?? 0) / total)) : 0
  // 남은 것이 있으면 Today 에 **점 하나**. 숫자 배지는 "밀린 일" 로 읽혀 압박이 된다(철학 ③).
  const hasRemaining = total > 0 && (status?.done ?? 0) < total

  return (
    <>
      {/* 탭이 콘텐츠 끝을 덮지 않게 하는 여백. **탭을 그리는 쪽이 같이 낸다** —
          레이아웃에 두면 탭이 없는 화면(풀스크린 세션)에도 남는다.
          높이는 `--tabbar-h` 하나가 정하고, 페이지 소유 하단 고정 UI 도 같은 값을 쓴다. */}
      <div aria-hidden className="h-[var(--tabbar-h)] shrink-0" />
      <nav
        aria-label="주요 화면"
        // md 이상은 사이드바가 같은 일을 한다 — 둘을 동시에 띄우면 같은 링크가 두 번이다.
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--bd)] bg-[var(--bg)] md:hidden"
        style={{
          // 홈 인디케이터에 탭이 깔리지 않게 (iOS)
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* 오늘 진행 실 — 상단 경계선 위에 겹쳐 그린다. 0이면 아예 없다. */}
        {ratio > 0 && (
          <span
            aria-hidden
            className="absolute inset-x-0 top-[-1px] h-[2px] origin-left bg-[var(--p)] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)]"
            style={{ transform: `scaleX(${ratio})` }}
          />
        )}
        <ul className="flex items-stretch">
          {SURFACE_ORDER.map((id) => {
            const surface = SURFACES[id]
            const Icon = ICON[id]
            const active = isActive(pathname ?? '', surface.href)
            return (
              <li key={id} className="flex-1">
                <Link
                  href={surface.href}
                  aria-current={active ? 'page' : undefined}
                  // 점은 aria-hidden 이라, 남은 개수는 이름으로 전한다(색·점만으로 알리지 않는다).
                  aria-label={
                    id === 'today' && hasRemaining
                      ? `${surface.name} — ${total - (status?.done ?? 0)}개 남음`
                      : undefined
                  }
                  // 44px 하한은 프로젝트 절대 규칙 — h-14(56px)로 여유를 둔다.
                  className={`flex h-14 flex-col items-center justify-center gap-0.5 transition-colors duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-inset ${
                    active ? 'text-[var(--p)]' : 'text-[var(--t2)]'
                  }`}
                >
                  <span className="relative">
                    <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                    {id === 'today' && hasRemaining && (
                      <span
                        aria-hidden
                        className="absolute -right-1 -top-0.5 h-[6px] w-[6px] rounded-full bg-[var(--p)]"
                      />
                    )}
                  </span>
                  {/* 색만으로 현재 위치를 알리지 않는다 — 굵기로도 구분(색맹 대응) */}
                  <span
                    className={`font-body text-[11px] leading-none ${active ? 'font-[700]' : 'font-[500]'}`}
                  >
                    {surface.name}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
