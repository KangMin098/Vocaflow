// apps/web/src/components/comic/ComicsTabs.tsx
//
// /comics 하위 2탭 — Adapted(도서 각색) / Restored(원본 복원).
//
// 두 만화는 **출처가 다르다**:
//   · Adapted  — 우리가 가진 원서를 모델로 각색해 그린 만화 (CCP). 원작 텍스트가 정본이고 만화는 그 표현형.
//   · Restored — 저작권 만료 만화 원본을 수집해 디지털 복원·현대화한 것 (PDCP). 원작이 만화 자체다.
// 학습자에겐 둘 다 "만화"이므로 메뉴는 하나(Comics)로 두고, 안에서 출처로 나눈다(사용자 결정 2026-08-09).
//
// 라벨을 과거분사 쌍(Adapted/Restored)으로 맞춘 이유: 기술(AI/스캔)이 아니라 **원작에 무슨 일이 있었는지**를
// 말하는 이름이라 오래 간다. "AI 만화"는 기술이 바뀌면 낡고, 학습자에게 품질 신호도 주지 못한다.
// LibraryTabs 와 동일한 탭 패턴(role=tablist + aria-selected + 44px) — 학습자가 이미 아는 구조.

'use client'

import { BookImage, ScanLine } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Adapted', ko: '도서 각색', href: '/comics/adapted', icon: BookImage },
  { label: 'Restored', ko: '원본 복원', href: '/comics/restored', icon: ScanLine },
] as const

export function ComicsTabs() {
  const pathname = usePathname()

  return (
    <nav
      role="tablist"
      aria-label="만화 탭"
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
            aria-label={`${tab.label} — ${tab.ko} 만화`}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-display text-[14px] font-[600] transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--active)] focus-visible:ring-offset-1 ${
              isActive
                ? 'border-[var(--active)] text-[var(--t1)]'
                : 'border-transparent text-[var(--t2)] hover:text-[var(--t1)]'
            }`}
          >
            <Icon size={16} aria-hidden />
            {tab.label}
            <span className="font-body text-[12px] font-[500] text-[var(--t2)]">{tab.ko}</span>
          </Link>
        )
      })}
    </nav>
  )
}
