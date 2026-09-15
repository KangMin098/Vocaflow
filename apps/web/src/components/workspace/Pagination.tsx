// apps/web/src/components/workspace/Pagination.tsx

'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

interface PaginationProps {
  textId: string
  currentPage: number
  totalPages: number
}

export function Pagination({ textId, currentPage, totalPages }: PaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const goTo = (page: number) => {
    if (page < 1 || page > totalPages) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`/text/${textId}?${params.toString()}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 페이지 번호 생성: 1 2 3 4 5 ... last
  const pageNumbers: (number | 'gap')[] = []
  const showEllipsis = totalPages > 7

  if (!showEllipsis) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i)
  } else {
    if (currentPage <= 4) {
      pageNumbers.push(1, 2, 3, 4, 5, 'gap', totalPages)
    } else if (currentPage >= totalPages - 3) {
      pageNumbers.push(
        1,
        'gap',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      )
    } else {
      pageNumbers.push(1, 'gap', currentPage - 1, currentPage, currentPage + 1, 'gap', totalPages)
    }
  }

  return (
    <nav
      aria-label="페이지 이동"
      className="mt-12 flex items-center justify-between gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-6 py-5"
    >
      <button
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage <= 1}
        className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2 font-display text-[13px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--bg)] hover:text-[var(--t1)] hover:shadow-[var(--sh-sm)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--bd)] disabled:hover:bg-[var(--bg2)] disabled:hover:text-[var(--t2)] disabled:hover:shadow-none"
      >
        <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
        <span>이전</span>
      </button>

      <div className="flex items-center gap-1">
        {pageNumbers.map((p, i) => {
          if (p === 'gap') {
            return (
              <span key={`gap-${i}`} className="px-1 font-display font-[700] text-[var(--t2)]">
                ⋯
              </span>
            )
          }
          return (
            <button
              key={p}
              onClick={() => goTo(p)}
              aria-current={p === currentPage ? 'page' : undefined}
              className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-[var(--r-md)] px-2 font-display text-[13px] font-[600] transition-all duration-[var(--dur-normal)] ${
                p === currentPage
                  ? 'bg-[var(--p)] text-white shadow-[var(--sh-sm)] hover:bg-[var(--p-hover)]'
                  : 'text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
              } `}
            >
              {p}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2 font-display text-[13px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--bg)] hover:text-[var(--t1)] hover:shadow-[var(--sh-sm)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--bd)] disabled:hover:bg-[var(--bg2)] disabled:hover:text-[var(--t2)] disabled:hover:shadow-none"
      >
        <span>다음</span>
        <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </nav>
  )
}
