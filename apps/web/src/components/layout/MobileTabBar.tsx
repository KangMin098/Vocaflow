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

/** 표면 → 아이콘. 이름·경로는 레지스트리가 갖고, 그림만 여기서 고른다. */
const ICON: Record<SurfaceId, LucideIcon> = {
  today: Home,
  library: BookOpen,
  vault: Layers,
  growth: BarChart3,
}

/** 표면별 한국어 라벨 — 영문 정식명은 축의 것이고, 탭에는 학습자 말을 쓴다. */
const LABEL: Record<SurfaceId, string> = {
  today: '오늘',
  library: '서재',
  vault: '내 단어',
  growth: '성장',
}

/**
 * 현재 경로가 그 표면에 속하는가.
 * 하위 경로까지 활성으로 본다 — `/library/books` 에서 '서재' 가 꺼져 있으면
 * 학습자는 자기가 어디 있는지 알 수 없다.
 */
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}

export function MobileTabBar() {
  const pathname = usePathname()

  // 학습 세션은 셸을 걷어낸다 — 작업기억 보호(§학습원칙6). 사이드바·FlowNav 와 같은 판정을 쓴다.
  if (isFullScreenRoute(pathname)) return null

  return (
    <nav
      aria-label="주요 화면"
      // md 이상은 사이드바가 같은 일을 한다 — 둘을 동시에 띄우면 같은 링크가 두 번이다.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--bd)] bg-[var(--bg)] md:hidden"
      style={{
        // 홈 인디케이터에 탭이 깔리지 않게 (iOS)
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
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
                // 44px 하한은 프로젝트 절대 규칙 — h-14(56px)로 여유를 둔다.
                className={`flex h-14 flex-col items-center justify-center gap-0.5 transition-colors duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-inset ${
                  active ? 'text-[var(--p)]' : 'text-[var(--t2)]'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {/* 색만으로 현재 위치를 알리지 않는다 — 굵기로도 구분(색맹 대응) */}
                <span
                  className={`font-body text-[11px] leading-none ${active ? 'font-[700]' : 'font-[500]'}`}
                >
                  {LABEL[id]}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
