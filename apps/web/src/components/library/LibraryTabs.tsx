// apps/web/src/components/library/LibraryTabs.tsx
//
// /library 하위 4탭 네비게이션 — 도서 / 만화 / 스크립트 / 공용 단어장.
// 스크립트 = ACP(/admin/articles) 게시 아티클(짧은 글) 학습.
// 만화(v07) = 도서의 다른 표현형(Expression) — 별도 콘텐츠가 아니라 같은 책의 다른 입구.
//   탭은 '입구' 축, 데이터는 도서에 앵커된 포맷 facet (docs/CCP_LIBRARY_INTEGRATION.md D1·D2).
// usePathname 기반 활성 표현, 보라(#8B5CF6) 일관.

'use client'

import { BookImage, BookOpen, FileText, Layers } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: '도서', href: '/library/books', icon: BookOpen },
  { label: '만화', href: '/library/comics', icon: BookImage },
  { label: '스크립트', href: '/library/scripts', icon: FileText },
  { label: '공용 단어장', href: '/library/vocab', icon: Layers },
] as const

export function LibraryTabs() {
  const pathname = usePathname()

  return (
    <nav
      role="tablist"
      aria-label="라이브러리 탭"
      // 4탭 — 390px 에서 가로 스크롤 폴백(라벨 줄바꿈/찌그러짐 방지)
      className="flex gap-1 overflow-x-auto border-b border-[var(--bd)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-display text-[14px] font-[600] transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 ${
              isActive
                ? 'border-[#8B5CF6] text-[var(--t1)]'
                : 'border-transparent text-[var(--t3)] hover:text-[var(--t1)]'
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
