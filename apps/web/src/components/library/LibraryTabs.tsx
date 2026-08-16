// apps/web/src/components/library/LibraryTabs.tsx
//
// /library 하위 3탭 네비게이션 — 도서 / 스크립트 / 공용 단어장.
// 스크립트 = ACP(/admin/articles) 게시 아티클(짧은 글) 학습.
// 만화(v07)는 여기 탭이 아니라 **사이드바 최상위 메뉴 `/comics`** 로 분리(사용자 결정 2026-08-09).
//   데이터는 여전히 도서에 앵커된 포맷(Expression)이고, 도서 카드의 만화 배지/포맷 필터는 유지된다.
//   (docs/CCP_LIBRARY_INTEGRATION.md D1·D2)
// usePathname 기반 활성 표현, 보라(#8B5CF6) 일관.

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LIBRARY_TABS } from '@/lib/library/tabs'

// 목록·라벨은 `lib/library/tabs.ts` 하나가 갖는다 — 이 파일도, 사이드바 서브메뉴도 거기서 읽는다.
//   여기서 다시 적으면 사이드바와 갈라진다(같은 실패: 하단 탭이 자체 라벨을 들었던 v06.141).
//   라벨 자체의 출처는 그 파일이 참조하는 `MATERIAL_LABEL` 이다.

export function LibraryTabs() {
  const pathname = usePathname()

  return (
    <nav
      role="tablist"
      aria-label="라이브러리 탭"
      // 390px 에서 가로 스크롤 폴백(라벨 줄바꿈/찌그러짐 방지)
      className="flex gap-1 overflow-x-auto border-b border-[var(--bd)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {LIBRARY_TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            aria-label={`${tab.label} — ${tab.says}`}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-display text-[14px] font-[600] transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 ${
              isActive
                ? 'border-[#8B5CF6] text-[var(--t1)]'
                : 'border-transparent text-[var(--t2)] hover:text-[var(--t1)]'
            }`}
          >
            <Icon size={16} aria-hidden />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
