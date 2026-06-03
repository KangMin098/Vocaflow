// apps/web/src/components/admin/vcb/wizard/LiveCountBadge.tsx
// 필터 변경 → 350ms debounce → vcb_count_words_matching RPC → 매치 수 표시.

'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { countMatchingWords } from '@/lib/vcb/server/filter-actions'
import type { VocabFilters } from '@/lib/vcb/filters'

interface Props {
  filters: VocabFilters
  maxWords: number | null
  /** 상위에 매치 수 알리기 (Next 버튼 활성화 조건) */
  onCount?: (count: number) => void
}

export function LiveCountBadge({ filters, maxWords, onCount }: Props) {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const result = await countMatchingWords(filters)
      if (cancelled) return
      if (!result.ok || !result.data) {
        setError(result.error ?? 'count failed')
        setCount(null)
      } else {
        setCount(result.data.count)
        onCount?.(result.data.count)
      }
      setLoading(false)
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [filters, onCount])

  const finalCount = count === null ? null : maxWords === null ? count : Math.min(count, maxWords)
  const isEmpty = count === 0
  const isCapped = count !== null && maxWords !== null && count > maxWords

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-[var(--r-md)] border"
      style={{
        background: isEmpty ? 'var(--error-light)' : 'var(--bg2)',
        borderColor: isEmpty ? 'var(--error)' : 'var(--bd)',
      }}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--p)' }} />
      ) : isEmpty ? (
        <AlertCircle className="w-5 h-5" style={{ color: 'var(--error)' }} />
      ) : (
        <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--p)' }} />
      )}

      <div className="flex-1 min-w-0">
        {error ? (
          <div className="text-sm font-body" style={{ color: 'var(--error)' }}>
            카운트 실패: {error}
          </div>
        ) : count === null ? (
          <div className="text-sm font-body" style={{ color: 'var(--t2)' }}>
            계산 중...
          </div>
        ) : isEmpty ? (
          <div className="text-sm font-display font-medium" style={{ color: 'var(--error)' }}>
            매치 0건 — 필터를 완화하세요
          </div>
        ) : (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="font-display font-semibold text-xl"
              style={{ color: 'var(--p)' }}
            >
              {finalCount?.toLocaleString()}
            </span>
            <span className="text-sm font-body" style={{ color: 'var(--t2)' }}>
              단어 매치
            </span>
            {isCapped && (
              <span
                className="text-xs font-body px-2 py-0.5 rounded-[var(--r-full)]"
                style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}
              >
                전체 {count.toLocaleString()} → 상위 {maxWords?.toLocaleString()} 컷
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
