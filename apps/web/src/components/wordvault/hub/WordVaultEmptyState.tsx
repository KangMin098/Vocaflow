// apps/web/src/components/wordvault/hub/WordVaultEmptyState.tsx
//
// WordVault 허브 빈 상태 — 단어가 아직 0개인 사용자용
// 두 가지 출발점 제시:
//   - 새 스크립트 추가 (TextViewer 진입)
//   - 라이브러리에서 고르기

'use client'

import { ArrowRight, FileText, Library, Sparkles } from 'lucide-react'
import Link from 'next/link'

export function WordVaultEmptyState() {
  return (
    <section
      aria-label="첫 단어 시작"
      className="relative overflow-hidden rounded-[var(--r-2xl)] border border-[var(--bd)] bg-gradient-to-br from-[var(--p)]/10 to-[var(--bg2)] p-8 md:p-12"
    >
      <div className="absolute right-6 top-6 opacity-20" aria-hidden="true">
        <Sparkles size={64} className="text-[var(--p)]" />
      </div>

      <div className="relative max-w-2xl">
        <p className="mb-3 font-mono text-[10px] font-[700] uppercase tracking-[0.15em] text-[var(--t2)]">
          — 단어장이 비어 있어요
        </p>

        <h2 className="mb-3 font-display text-[28px] font-[800] leading-[1.15] tracking-tight text-[var(--t1)] md:text-[32px]">
          스크립트을 추가하면
          <br />
          <span className="text-[var(--p)]">단어장이 시작됩니다</span>
        </h2>

        <p className="mb-8 max-w-lg font-body text-[14px] leading-relaxed text-[var(--t2)] md:text-[15px]">
          좋아하는 책, 강연, 기사를 추가하면 AI가 핵심 단어를 추출해 학습 단어장을 만들어 드립니다.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/text/new"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-gradient-to-br from-[#6366F1] to-[#4338CA] px-5 py-3 font-display text-[14px] font-[700] text-white shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:scale-[1.02] hover:shadow-[var(--sh-md)] active:scale-[0.99]"
          >
            <FileText size={16} aria-hidden="true" />
            <span>스크립트 추가하기</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>

          <Link
            href="/library"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-5 py-3 font-display text-[14px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)]"
          >
            <Library size={16} aria-hidden="true" />
            <span>라이브러리 둘러보기</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
