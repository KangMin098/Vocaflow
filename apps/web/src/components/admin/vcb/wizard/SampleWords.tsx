// apps/web/src/components/admin/vcb/wizard/SampleWords.tsx
// 매치 단어 상위 10개 미리보기. fetch on filters change.

'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { sampleMatchingWords, type SampleWord } from '@/lib/vcb/server/filter-actions'
import type { VocabFilters } from '@/lib/vcb/filters'

interface Props {
  filters: VocabFilters
}

export function SampleWords({ filters }: Props) {
  const [words, setWords] = useState<SampleWord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const result = await sampleMatchingWords(filters, 10)
      if (cancelled) return
      if (result.ok && result.data) setWords(result.data.words)
      setLoading(false)
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [filters])

  return (
    <div>
      <h4 className="font-display font-medium text-sm mb-3" style={{ color: 'var(--t1)' }}>
        샘플 단어 (상위 10개)
      </h4>

      {loading && words.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--t3)' }} />
        </div>
      ) : words.length === 0 ? (
        <div className="text-sm font-body py-6 text-center" style={{ color: 'var(--t3)' }}>
          매치 단어 없음
        </div>
      ) : (
        <div
          className="rounded-[var(--r-md)] border overflow-hidden"
          style={{ borderColor: 'var(--bd)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg2)', color: 'var(--t3)' }}>
                <th className="text-left px-3 py-2 font-display text-xs font-semibold">단어</th>
                <th className="text-left px-3 py-2 font-display text-xs font-semibold">의미</th>
                <th className="text-center px-2 py-2 font-display text-xs font-semibold">V</th>
                <th className="text-center px-2 py-2 font-display text-xs font-semibold">CEFR</th>
                <th className="text-center px-2 py-2 font-display text-xs font-semibold">품사</th>
                <th className="text-right px-3 py-2 font-display text-xs font-semibold">rank</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => (
                <tr
                  key={`${w.word}-${i}`}
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid var(--bd)',
                    color: 'var(--t1)',
                  }}
                >
                  <td className="px-3 py-2 font-english font-medium">{w.word}</td>
                  <td className="px-3 py-2 font-body text-[13px]" style={{ color: 'var(--t2)' }}>
                    {w.meaning_ko ?? '—'}
                  </td>
                  <td className="text-center px-2 py-2 font-mono text-xs" style={{ color: 'var(--t2)' }}>
                    {w.v_level ?? '—'}
                  </td>
                  <td className="text-center px-2 py-2 font-mono text-xs" style={{ color: 'var(--t2)' }}>
                    {w.cefr_level ?? '—'}
                  </td>
                  <td className="text-center px-2 py-2 text-xs" style={{ color: 'var(--t3)' }}>
                    {w.primary_pos ?? '—'}
                  </td>
                  <td className="text-right px-3 py-2 font-mono text-xs" style={{ color: 'var(--t3)' }}>
                    {w.frequency_rank?.toLocaleString() ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
