// apps/web/src/components/textviewer/DiscoveryFooter.tsx
//
// TextViewer 허브 푸터 — /library 부드러운 전환
// CLAUDE.md §17.1 L0 ↔ L1 흐름 보강 (Discover → Acquire)

import { ArrowRight, Library } from 'lucide-react'
import Link from 'next/link'

export function DiscoveryFooter() {
  return (
    <Link
      href="/library"
      className="group flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4 transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--bg)]"
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--p)]/10 text-[var(--p)]"
        aria-hidden="true"
      >
        <Library size={16} strokeWidth={2} />
      </span>
      <div className="flex-1">
        <p className="font-display text-[13px] font-[700] text-[var(--t1)]">
          새로운 스크립트이 필요하신가요?
        </p>
        <p className="font-body text-[12px] text-[var(--t2)]">
          큐레이션된 스크립트을 라이브러리에서 찾아보세요
        </p>
      </div>
      <ArrowRight
        size={16}
        className="text-[var(--t2)] transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5 group-hover:text-[var(--p)]"
        aria-hidden="true"
      />
    </Link>
  )
}
