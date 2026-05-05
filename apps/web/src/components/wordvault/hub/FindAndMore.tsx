// apps/web/src/components/wordvault/hub/FindAndMore.tsx
//
// FindAndMore — 검색 진입 + 보조 작업 링크 (Tier 4)
// CLAUDE.md §17.10 IA — Hub vs Browse 책임 분리 정합
//
// 본 컴포넌트는 검색 결과를 hub 안에서 처리하지 않음 — Enter 시 browse view 로 진입.
// 검색·정렬·필터의 실제 작업은 browse view 책임.
//
// 디자인 의도:
//   - input 자동 focus X (모바일 키보드 자동 호출 방지)
//   - Enter → /wordvault?view=browse&q=<query>  (빈 값이면 q 파라미터 생략)
//   - 일괄 작업은 Phase 2 — disabled + tooltip
//
// 5관점:
//   - 실용: 검색 진입 1단계 (hub 입력 → browse 결과)
//   - 접근성: <form role="search">, aria-label, Enter/Esc 키보드
//   - 디자인: hub 가 검색 결과를 렌더하지 않음 (DRY)

'use client'

import { ArrowRight, Layers, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type KeyboardEvent } from 'react'

export function FindAndMore() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const submit = (e?: FormEvent | KeyboardEvent) => {
    e?.preventDefault()
    const q = query.trim()
    if (q.length === 0) {
      router.push('/wordvault?view=browse')
    } else {
      router.push(`/wordvault?view=browse&q=${encodeURIComponent(q)}`)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setQuery('')
    }
  }

  return (
    <section
      aria-label="찾기 및 더 많은 작업"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
    >
      <header className="mb-3">
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
          찾기 / 더 많은 작업
        </h2>
        <p className="font-body text-[11px] text-[var(--t3)]">
          검색하거나 전체 자산을 둘러보세요
        </p>
      </header>

      {/* 검색 input — Enter 시 browse 진입 */}
      <form role="search" onSubmit={submit} className="mb-3">
        <div className="relative">
          <Search
            size={15}
            strokeWidth={2}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="단어 · 의미 · 예문 검색"
            aria-label="단어 검색"
            className="h-11 w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] pl-10 pr-14 font-body text-[14px] text-[var(--t1)] placeholder:text-[var(--t3)] transition-colors duration-[var(--dur-normal)] focus:border-[var(--p)] focus:bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
          />
          <kbd
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[10px] font-[600] text-[var(--t3)]"
            aria-hidden="true"
          >
            Enter
          </kbd>
        </div>
      </form>

      {/* 보조 링크 — 전체 둘러보기 / 일괄 작업 (Phase 2) */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/wordvault?view=browse"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1"
        >
          전체 둘러보기
          <ArrowRight size={12} aria-hidden="true" />
        </Link>

        <span
          aria-disabled="true"
          tabIndex={-1}
          title="Phase 2 — 단어 다중 선택 후 태그·이동·삭제"
          className="inline-flex min-h-[36px] cursor-not-allowed items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t3)] opacity-50"
        >
          <Layers size={12} aria-hidden="true" />
          일괄 작업 (Phase 2)
        </span>
      </div>
    </section>
  )
}
