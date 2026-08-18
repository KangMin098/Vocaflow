// apps/web/src/app/admin/vocabulary/VocabularyBrowserClient.tsx
//
// 'use client' wrapper — search input + filter dropdowns + URL sync.

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'

import type {
  DictSearchFacets,
  DictSearchResult,
  DictWordDetail,
} from '@/lib/admin/dict/word-search'

import { VocabularyTable } from './VocabularyTable'
import { VocabularyDetailPanel } from './VocabularyDetailPanel'

interface CurrentFilters {
  q: string
  v: string
  cefr: string
  pos: string
  source: string
  verified: string
  page: number
  selected: string
}

interface VocabularyBrowserClientProps {
  result: DictSearchResult
  facets: DictSearchFacets
  selectedDetail: DictWordDetail | null
  currentFilters: CurrentFilters
}

export function VocabularyBrowserClient({
  result,
  facets,
  selectedDetail,
  currentFilters,
}: VocabularyBrowserClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 검색 input 로컬 state (debounced URL sync)
  const [qLocal, setQLocal] = useState(currentFilters.q)
  useEffect(() => {
    setQLocal(currentFilters.q)
  }, [currentFilters.q])

  // URL 갱신 helper — 특정 param 만 변경
  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === '') sp.delete(k)
        else sp.set(k, v)
      }
      // 필터 변경 시 page 리셋 (selected 제외)
      const filterChanged = Object.keys(updates).some(
        (k) => !['page', 'selected'].includes(k),
      )
      if (filterChanged) sp.delete('page')

      router.replace(`/admin/vocabulary?${sp.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  // q 디바운스 (350ms)
  useEffect(() => {
    if (qLocal === currentFilters.q) return
    const handle = setTimeout(() => {
      setParam({ q: qLocal.trim().length >= 2 ? qLocal.trim() : null })
    }, 350)
    return () => clearTimeout(handle)
  }, [qLocal, currentFilters.q, setParam])

  const onClear = () => {
    setQLocal('')
    setParam({
      q: null,
      v: null,
      cefr: null,
      pos: null,
      source: null,
      verified: null,
    })
  }

  const onSelectWord = (word: string) => setParam({ selected: word })
  const onCloseDetail = () => setParam({ selected: null })

  // V-Level options (0-11 + null)
  const vLevelOptions = useMemo(
    () => [
      { value: '', label: 'V-Level (전체)' },
      { value: 'null', label: 'V-Level NULL' },
      ...Array.from({ length: 12 }, (_, i) => ({
        value: String(i),
        label: `V${i}`,
      })),
    ],
    [],
  )

  const filterDirty =
    currentFilters.q !== '' ||
    currentFilters.v !== '' ||
    currentFilters.cefr !== '' ||
    currentFilters.pos !== '' ||
    currentFilters.source !== '' ||
    currentFilters.verified !== ''

  return (
    <div className="flex flex-col gap-4">
      {/* ── KPI 띠 ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2">
        <p className="font-mono text-[11px] text-[var(--t2)]">
          <span className="font-display font-[700] text-[var(--t1)]">
            {result.total.toLocaleString()}
          </span>{' '}
          words · page{' '}
          <span className="font-display font-[700] text-[var(--t1)]">{result.page}</span> ·
          {result.limit} / page
        </p>
        {filterDirty && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-display text-[10px] font-[600] text-[var(--t2)] hover:bg-[var(--bg3)]"
          >
            <X size={11} aria-hidden /> Reset filters
          </button>
        )}
      </div>

      {/* ── Toolbar — search + filters ── */}
      <div className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 shadow-[var(--sh-sm)]">
        <div className="relative">
          <Search
            size={14}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t2)]"
            aria-hidden
          />
          <input
            type="search"
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            placeholder="word · meaning_ko · lemma_band 검색 (2자 이상)"
            className="w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] py-2 pl-9 pr-3 font-body text-[13px] text-[var(--t1)] placeholder:text-[var(--t2)] focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <FilterSelect
            value={currentFilters.v}
            options={vLevelOptions}
            onChange={(v) => setParam({ v })}
          />
          <FilterSelect
            value={currentFilters.cefr}
            options={[
              { value: '', label: 'CEFR (전체)' },
              ...facets.cefrLevels.map((c) => ({ value: c, label: c })),
            ]}
            onChange={(v) => setParam({ cefr: v })}
          />
          <FilterSelect
            value={currentFilters.pos}
            options={[
              { value: '', label: 'POS (전체)' },
              ...facets.primaryPosList.map((p) => ({ value: p, label: p })),
            ]}
            onChange={(v) => setParam({ pos: v })}
          />
          <FilterSelect
            value={currentFilters.source}
            options={[
              { value: '', label: 'Source (전체)' },
              ...facets.sourceList.map((s) => ({ value: s, label: s })),
            ]}
            onChange={(v) => setParam({ source: v })}
          />
          <FilterSelect
            value={currentFilters.verified}
            options={[
              { value: '', label: 'Verified (전체)' },
              { value: 'true', label: '✓ verified' },
              { value: 'false', label: '✗ unverified' },
            ]}
            onChange={(v) => setParam({ verified: v })}
          />
        </div>
      </div>

      {/* ── Main: Table + Detail panel ── */}
      <div className="flex gap-4">
        <div className={selectedDetail ? 'min-w-0 flex-1 hidden lg:block' : 'min-w-0 flex-1'}>
          <VocabularyTable
            rows={result.rows}
            currentPage={result.page}
            hasNext={result.hasNext}
            selectedWord={currentFilters.selected}
            onSelect={onSelectWord}
            onPageChange={(p) => setParam({ page: p > 1 ? String(p) : null })}
          />
        </div>

        {selectedDetail && (
          <aside
            aria-label="word detail"
            className="sticky top-0 max-h-[calc(100vh-3rem)] w-full overflow-y-auto rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-md)] lg:w-[420px] lg:max-w-[420px] lg:shrink-0"
          >
            <VocabularyDetailPanel detail={selectedDetail} onClose={onCloseDetail} />
          </aside>
        )}
      </div>
    </div>
  )
}

function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-2 py-1.5 font-mono text-[11px] text-[var(--t1)] focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
