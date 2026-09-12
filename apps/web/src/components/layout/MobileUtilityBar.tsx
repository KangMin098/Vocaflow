// apps/web/src/components/layout/MobileUtilityBar.tsx
//
// 레일 밖 유틸리티(Class · Settings)의 **모바일 유일 통로**.
//
// ── 왜 이것이 필요한가 (실측 2026-08-26) ──────────────────────────────
// `FOOTER_ITEMS` 두 항목은 `Sidebar.tsx` 에서만 렌더되는데 사이드바는 `hidden md:flex` 다.
// 그래서 폰에서는 `/teacher` 와 `/settings` 로 **가는 길이 한 줄도 없었다.**
// 전수 grep 결과 그 두 주소를 가리키는 링크는 랜딩(`app/page.tsx`)과
// `SendToClassButton` 뿐이고, 둘 다 로그인 뒤의 상시 동선이 아니다.
//
// 이것이 그냥 불편인 것이 아니라 **산술의 문제**인 이유: 진단(§6)이 10만 학습자에
// 이르는 CAC 0 경로를 "교사 3,500명 × 학급 30명" 하나로 좁혔고, `funnel_events` 의
// `teacher_hub_view` 는 그 경로의 첫 칸이다. 교사가 폰에서 `/teacher` 에 닿을 수 없으면
// 그 칸은 **영원히 0** 이고, 우리는 "교사가 안 온다" 와 "교사가 못 온다" 를 구별할 수 없다.
//
// ── 왜 하단 탭에 다섯 번째를 넣지 않는가 ──────────────────────────────
// `MobileTabBar` 는 `SURFACE_ORDER`(4개)를 그대로 읽고 자기 목록을 갖지 않는다.
// 다섯 번째를 넣으려면 그 규칙을 깨야 하고, `lib/framework/axes.ts` 는
// "활동은 Surface 가 아니다" 로 이미 표면을 넷으로 못 박았다. 교사 화면은 학습 표면이
// 아니라 **역할 표면**이라 더더욱 그 넷에 낄 자리가 없다.
//
// ── 왜 StatusRibbon 안에 넣지 않는가 ─────────────────────────────────
// ADR 0006 D2 — 띠는 **상태 표면 하나**다. 거기에 내비를 섞으면 그 결정이 되돌아간다.
//
// ── 왜 메뉴(펼침)가 아닌가 ───────────────────────────────────────────
// 항목이 둘뿐이다. 열고 닫는 상태를 만들면 탭 한 번이 두 번이 되고, 여는 순간
// 오버레이가 화면을 덮는다(CLAUDE.md §학습 UX — 모달로 학습 중단 금지).
//
// 목록은 `FOOTER_ITEMS` 를 그대로 읽는다 — 사이드바와 같은 출처여야 갈라지지 않는다.

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { FOOTER_ITEMS } from '@/components/layout/sidebar-config'
import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'

export interface MobileUtilityBarProps {
  /** 비로그인이면 그리지 않는다 — 두 주소 모두 로그인 뒤의 화면이다. */
  signedIn: boolean
}

export function MobileUtilityBar({ signedIn }: MobileUtilityBarProps) {
  const pathname = usePathname() ?? ''

  // 학습 세션은 셸을 걷어낸다 — 작업기억 보호(학습원칙 ⑥). Sidebar·StatusRibbon·
  // MobileTabBar 와 **같은 판정**을 써야 한 화면에서 넷이 따로 놀지 않는다.
  if (!signedIn || isFullScreenRoute(pathname)) return null

  const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`)

  return (
    <nav
      aria-label="클래스·설정"
      // md 이상은 사이드바가 같은 일을 한다 — 둘을 동시에 띄우면 같은 링크가 두 번이다.
      className="flex items-center justify-end gap-1 border-b border-[var(--bd)] bg-[var(--bg)] px-2 md:hidden"
    >
      {FOOTER_ITEMS.map((item) => {
        const Icon = item.icon
        const active = under(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            aria-label={item.ariaLabel}
            // ⚠️ 간격은 4의 배수만 쓴다(`design-tokens/spacing` 이 전부 4배수다).
            //    여기 `gap-1.5`(6px)가 화면마다 항목 수만큼 격자를 깼고, 2026-09-01 에
            //    `FOOTER_ITEMS` 가 셋으로 늘면서 그만큼 더 깨졌다 — UX 벤치 D4 가 잡았다.
            // 44px 하한은 프로젝트 절대 규칙 — 아이콘은 16px 이고 누를 면적만 넓힌다.
            className={`inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-md)] px-3 font-body text-[12px] transition-[color,transform] duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-inset active:scale-[0.98] ${
              active
                ? 'font-[700] text-[var(--p)]'
                : 'font-[500] text-[var(--t2)] hover:text-[var(--t1)]'
            }`}
          >
            <Icon size={16} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
            {/* 색만으로 현재 위치를 알리지 않는다 — 굵기로도 구분(색맹 대응) */}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
