'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Eye, AlertTriangle, RefreshCcw, RefreshCw, XCircle } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import {
  importSeedList,
  deleteSeedListArtifacts,
  type SeedPreviewData,
} from '@/lib/vcb/server/seed'
import { VcbPreviewHero } from './VcbPreviewHero'
import { VcbPreviewFilters, type PreviewFilters } from './VcbPreviewFilters'
import { VcbPreviewList } from './VcbPreviewList'
import { VcbPreviewDetail } from './VcbPreviewDetail'
import { VcbPreviewActionBar } from './VcbPreviewActionBar'

interface Props {
  runId: number
  initial: SeedPreviewData
}

const DEFAULT_FILTERS: PreviewFilters = {
  search: '',
  cefr: [],
  pos: [],
  tier: [],
  confMin: 0,
  attentionOnly: false,
}

function rejectionsKey(runId: number) {
  return `vcb-preview-rejections-${runId}`
}

export function VcbSeedPreviewClient({ runId, initial }: Props) {
  const router = useRouter()
  const [data] = useState<SeedPreviewData>(initial)
  const [filters, setFilters] = useState<PreviewFilters>(DEFAULT_FILTERS)
  const [rejections, setRejections] = useState<Set<string>>(new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<{ inserted: number; total: number } | null>(null)

  // Hydrate rejections from sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = sessionStorage.getItem(rejectionsKey(runId))
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        if (Array.isArray(arr)) setRejections(new Set(arr))
      }
    } catch {
      /* ignore */
    }
  }, [runId])

  // Persist rejections to sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(
        rejectionsKey(runId),
        JSON.stringify(Array.from(rejections)),
      )
    } catch {
      /* ignore */
    }
  }, [rejections, runId])

  const specCefrSet = useMemo(() => new Set(data.spec.target_cefr_range), [data.spec])
  const mustExcludeSet = useMemo(
    () => new Set(data.spec.must_exclude_keywords.map((k) => k.toLowerCase())),
    [data.spec],
  )

  const posOptions = useMemo(() => {
    const s = new Set<string>()
    for (const it of data.items) s.add(it.pos)
    return Array.from(s).sort()
  }, [data.items])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const cefrSet = new Set(filters.cefr)
    const posSet = new Set(filters.pos)
    const tierSet = new Set(filters.tier)

    return data.items.filter((it) => {
      // Attention mode: low conf OR not in spec OR matches must_exclude
      if (filters.attentionOnly) {
        const isAttention =
          it.confidence < 0.7 ||
          !specCefrSet.has(it.cefr_estimate) ||
          mustExcludeSet.has(it.lemma.toLowerCase())
        if (!isAttention) return false
      }
      if (q) {
        if (!it.lemma.toLowerCase().includes(q)) return false
      }
      if (cefrSet.size > 0 && !cefrSet.has(it.cefr_estimate as never)) return false
      if (posSet.size > 0 && !posSet.has(it.pos)) return false
      if (tierSet.size > 0 && !tierSet.has(it.frequency_tier as never)) return false
      if (it.confidence < filters.confMin) return false
      return true
    })
  }, [data.items, filters, specCefrSet, mustExcludeSet])

  const total = data.items.length
  const confAvg =
    data.validation.confidence_avg ??
    (total > 0 ? data.items.reduce((s, x) => s + x.confidence, 0) / total : 0)

  const warning = useMemo<string | null>(() => {
    const target = data.spec.target_count
    if (target !== null && target !== undefined && target > 0) {
      const ratio = total / target
      if (ratio < 0.5 || ratio > 1.5) {
        return `목표 대비 ${Math.round(ratio * 100)}% — 재생성을 고려하세요`
      }
    }
    if (confAvg < 0.7) {
      return `평균 신뢰도 ${confAvg.toFixed(2)} — 시드 품질이 낮습니다`
    }
    return null
  }, [total, confAvg, data.spec.target_count])

  const toggleReject = useCallback((key: string) => {
    setRejections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const onSelect = useCallback((key: string) => {
    setSelectedKey(key)
  }, [])

  const selectedItem = useMemo(() => {
    if (!selectedKey) return null
    return data.items.find((it) => `${it.lemma}|${it.pos}` === selectedKey) ?? null
  }, [data.items, selectedKey])

  // Bulk actions
  const rejectFiltered = useCallback(() => {
    setRejections((prev) => {
      const next = new Set(prev)
      for (const it of filtered) next.add(`${it.lemma}|${it.pos}`)
      return next
    })
  }, [filtered])

  const rejectSpecOutsiders = useCallback(() => {
    setRejections((prev) => {
      const next = new Set(prev)
      for (const it of data.items) {
        if (!specCefrSet.has(it.cefr_estimate)) {
          next.add(`${it.lemma}|${it.pos}`)
        }
      }
      return next
    })
  }, [data.items, specCefrSet])

  const clearRejections = useCallback(() => setRejections(new Set()), [])

  const specOutsidersCount = useMemo(() => {
    let c = 0
    for (const it of data.items) {
      if (!specCefrSet.has(it.cefr_estimate)) c++
    }
    return c
  }, [data.items, specCefrSet])

  const importableCount = total - rejections.size

  // Keyboard navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'

      // `/` to focus search (anywhere except inside another input)
      if (e.key === '/' && !isInput) {
        e.preventDefault()
        const el = document.querySelector<HTMLInputElement>(
          'input[aria-label="lemma 검색"]',
        )
        el?.focus()
        return
      }
      if (isInput) return

      // Esc — clear filters
      if (e.key === 'Escape') {
        setFilters(DEFAULT_FILTERS)
        return
      }

      // r — toggle reject on selected
      if (e.key === 'r' && selectedKey) {
        const item = data.items.find((it) => `${it.lemma}|${it.pos}` === selectedKey)
        if (item) toggleReject(selectedKey)
        return
      }

      // ↑/↓ — navigate
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (filtered.length === 0) return
        const currentIdx = selectedKey
          ? filtered.findIndex((it) => `${it.lemma}|${it.pos}` === selectedKey)
          : -1
        const delta = e.key === 'ArrowDown' ? 1 : -1
        const nextIdx =
          currentIdx === -1
            ? (delta === 1 ? 0 : filtered.length - 1)
            : Math.max(0, Math.min(filtered.length - 1, currentIdx + delta))
        const nextItem = filtered[nextIdx]
        if (nextItem) setSelectedKey(`${nextItem.lemma}|${nextItem.pos}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filtered, selectedKey, data.items, toggleReject])

  const handleRegenerate = () => {
    setImportError(null)
    if (
      !window.confirm(
        '생성된 시드를 삭제하고 재생성 단계로 돌아갑니다.\n거부 표시도 함께 초기화됩니다.\n진행할까요?',
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await deleteSeedListArtifacts(runId)
      if (!result.ok) {
        setImportError(result.error ?? '재생성 실패')
        return
      }
      try {
        sessionStorage.removeItem(rejectionsKey(runId))
      } catch {
        /* ignore */
      }
      router.push(`/admin/vocab/runs/${runId}/seed`)
      router.refresh()
    })
  }

  const handleImport = () => {
    setImportError(null)
    setImportSuccess(null)
    startTransition(async () => {
      const result = await importSeedList(runId, {
        excluded_keys: Array.from(rejections),
      })
      if (!result.ok || !result.data) {
        setImportError(result.error ?? 'import 실패')
        return
      }
      // Clear rejections + sessionStorage
      try {
        sessionStorage.removeItem(rejectionsKey(runId))
      } catch {
        /* ignore */
      }
      setImportSuccess({
        inserted: result.data.inserted,
        total: result.data.total,
      })
      // Refresh & redirect after a brief moment so user sees success
      setTimeout(() => {
        router.push(`/admin/vocab/runs/${runId}/seed`)
        router.refresh()
      }, 1500)
    })
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <AdminPageHeader
        icon={Eye}
        title="시드 미리보기"
        description={`${data.spec.collection_title} · ${data.seed_list_file}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] font-display text-sm border disabled:opacity-50"
              style={{
                color: 'var(--warning)',
                borderColor: 'var(--warning)',
                background: 'var(--warning-light)',
              }}
              title="seed-list.jsonl 삭제 후 Step 2 로 복귀"
            >
              <RefreshCcw className="w-4 h-4" />
              재생성
            </button>
            <Link
              href={`/admin/vocab/runs/${runId}/seed`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] font-display text-sm border"
              style={{
                color: 'var(--t2)',
                borderColor: 'var(--bd)',
                background: 'var(--bg)',
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              시드 페이지로
            </Link>
          </div>
        }
      />

      {warning && (
        <div
          className="flex items-start gap-3 p-4 rounded-[var(--r-md)] border"
          style={{
            background: 'var(--warning-light)',
            borderColor: 'var(--warning)',
            color: 'var(--warning)',
          }}
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm">{warning}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--t2)' }}>
              시드 페이지에서 재생성하거나, 거부 표시 후 부분 import 할 수 있어요.
            </div>
          </div>
        </div>
      )}

      <VcbPreviewHero items={data.items} spec={data.spec} validation={data.validation} />

      <VcbPreviewFilters
        filters={filters}
        onChange={setFilters}
        visibleCount={filtered.length}
        totalCount={total}
        posOptions={posOptions}
      />

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        {filtered.length > 0 && filtered.length < total && (
          <button
            type="button"
            onClick={rejectFiltered}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-xs font-display border"
            style={{
              background: 'var(--error-light)',
              color: 'var(--error)',
              borderColor: 'var(--error)',
            }}
          >
            <XCircle className="w-3.5 h-3.5" />
            필터 결과 {filtered.length}건 일괄 거부
          </button>
        )}
        {specOutsidersCount > 0 && (
          <button
            type="button"
            onClick={rejectSpecOutsiders}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-xs font-display border"
            style={{
              background: 'var(--warning-light)',
              color: 'var(--warning)',
              borderColor: 'var(--warning)',
            }}
          >
            <XCircle className="w-3.5 h-3.5" />
            spec 외 CEFR {specOutsidersCount}건 일괄 거부
          </button>
        )}
        {rejections.size > 0 && (
          <button
            type="button"
            onClick={clearRejections}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-xs font-display border ml-auto"
            style={{
              background: 'var(--bg)',
              color: 'var(--t2)',
              borderColor: 'var(--bd)',
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            거부 표시 초기화 ({rejections.size})
          </button>
        )}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 3fr)' }}>
        <VcbPreviewList
          items={filtered}
          rejections={rejections}
          selectedKey={selectedKey}
          specCefrSet={specCefrSet}
          onSelect={onSelect}
          onToggleReject={toggleReject}
        />
        <VcbPreviewDetail
          selected={selectedItem}
          spec={data.spec}
          isRejected={selectedKey !== null && rejections.has(selectedKey)}
          onToggleReject={() => {
            if (selectedKey && selectedItem) toggleReject(selectedKey)
          }}
        />
      </div>

      {importError && (
        <div
          className="flex items-start gap-2 p-3 rounded-[var(--r-md)] border"
          style={{
            background: 'var(--error-light)',
            borderColor: 'var(--error)',
            color: 'var(--error)',
          }}
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="text-sm">{importError}</span>
        </div>
      )}

      {importSuccess && (
        <div
          className="flex items-start gap-2 p-3 rounded-[var(--r-md)] border"
          style={{
            background: 'var(--success-light)',
            borderColor: 'var(--success)',
            color: 'var(--success)',
          }}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold">Import 완료 · {importSuccess.inserted}건 적재</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--t2)' }}>
              시드 페이지로 돌아갑니다…
            </div>
          </div>
        </div>
      )}

      <VcbPreviewActionBar
        totalCount={total}
        rejectedCount={rejections.size}
        importableCount={importableCount}
        isPending={isPending}
        hasWarning={warning !== null}
        onImport={handleImport}
      />
    </div>
  )
}
