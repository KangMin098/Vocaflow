// 새 시드 탭 — 소스에서 GET batch + library_seed_catalog 리스트 뷰.
// 리스트형 행 디자인 (cover · title · author · source/장르/CEFR 칩 · enqueue 버튼).

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Download, Plus, BookOpen, ExternalLink, Search, AlertCircle, CheckCircle2, Info, Clock, Calendar, FileText, Trash2, ArrowRightLeft } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  enqueueSeedRow,
  listSeedCatalog,
  getCatalogStats,
  queueSeedCatalogForCuration,
  type SeedCatalogRow,
  type QueueCurationResult,
} from '@/lib/library/admin-queries'
import {
  AdvancedFetchPanel,
  DEFAULT_ADVANCED,
  buildAdvancedBody,
  type AdvancedState,
} from './AdvancedFetchPanel'
import { SeedDetailModal } from './SeedDetailModal'
import { FETCHERS } from '@/lib/library/seed-fetchers'

type SourceKey = 'gutenberg' | 'standard_ebooks' | 'wikibooks' | 'librivox' | 'simple_wikipedia' | 'lit2go' | 'storyweaver'

const SOURCE_OPTIONS: Array<{ value: SourceKey; label: string; color: string }> = [
  { value: 'simple_wikipedia', label: 'Simple English Wikipedia', color: 'var(--learn-known)' },
  { value: 'standard_ebooks', label: 'Standard Ebooks', color: 'var(--learn-known)' },
  { value: 'gutenberg', label: 'Project Gutenberg', color: 'var(--p)' },
  { value: 'wikibooks', label: 'Wikibooks', color: 'var(--info)' },
  { value: 'librivox', label: 'LibriVox', color: 'var(--active)' },
  // v06.43 — Lit2Go (USF) 추가. US grade 는 보정 참조용, V-Level 은 coverage 모델 (SSoT)
  { value: 'lit2go', label: 'Lit2Go (USF)', color: 'var(--memory-shaky)' },
  // v06.56 — StoryWeaver (Pratham Books) 그림책. 삽화+낭독, CC BY 4.0.
  { value: 'storyweaver', label: 'StoryWeaver (그림책)', color: 'var(--learn-review)' },
]

// v06.34 — fetcher.getOptions() 가 단일 진실 소스. UI 는 도출만.
const SOURCE_OPTS = Object.fromEntries(
  (['simple_wikipedia', 'standard_ebooks', 'gutenberg', 'wikibooks', 'librivox', 'lit2go', 'storyweaver'] as SourceKey[]).map((k) => [
    k,
    FETCHERS[k].getOptions(),
  ]),
) as Record<SourceKey, ReturnType<typeof FETCHERS['gutenberg']['getOptions']>>

// 난이도 밴드 — est_v_level 기준 (사용자 정책: 난이도 = V-Level). CEFR 은 보조 표기.
const V_BANDS: Array<{ value: string; label: string; min: number | null; max: number | null }> = [
  { value: 'all', label: '난이도 전체', min: null, max: null },
  { value: 'b1', label: '입문 · B1 (V5–6)', min: 5, max: 6 },
  { value: 'b2', label: '다독 · B2 (V7)', min: 7, max: 7 },
  { value: 'c1', label: '고급 · C1 (V8–9)', min: 8, max: 9 },
  { value: 'c2', label: '도전 · C2 (V10–11)', min: 10, max: 11 },
]

// 연령 버킷 — age_band(’6+’…’18+’) 3분할.
const AGE_BUCKETS: Array<{ value: string; label: string; bucket: 'child' | 'teen' | 'adult' | null }> = [
  { value: 'all', label: '연령 전체', bucket: null },
  { value: 'child', label: '아동 (≤9세)', bucket: 'child' },
  { value: 'teen', label: '청소년 (10–14세)', bucket: 'teen' },
  { value: 'adult', label: '성인 (15세+)', bucket: 'adult' },
]

// SE 중복 정리 상태 — 삭제 대상(SE 중복) / Gutenberg 단독(SE 변환 후보) 필터.
const DUP_OPTIONS: Array<{ value: 'all' | 'shadowed' | 'gutenberg_only'; label: string }> = [
  { value: 'all', label: 'SE 정리 전체' },
  { value: 'gutenberg_only', label: 'Gutenberg 단독 (SE 변환 후보)' },
  { value: 'shadowed', label: '삭제 대상 (SE 중복)' },
]

export function BulkFetchTab() {
  // Picker state
  const [source, setSource] = useState<SourceKey>('simple_wikipedia')
  const [sort, setSort] = useState<string>('popular')
  const [genre, setGenre] = useState<string>('')
  const [batchSize, setBatchSize] = useState<number>(32)
  // Advanced state — 소스 전환 시 초기화
  const [advanced, setAdvanced] = useState<AdvancedState>(DEFAULT_ADVANCED)
  const opts = SOURCE_OPTS[source]

  // Fetch state
  const [fetching, setFetching] = useState(false)
  const [fetchOffset, setFetchOffset] = useState(0)
  const [lastResult, setLastResult] = useState<{ inserted: number; skipped: number; total_available: number | null; next_offset: number | null } | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Catalog list state
  const [rows, setRows] = useState<SeedCatalogRow[]>([])
  const [total, setTotal] = useState(0)
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterGenre, setFilterGenre] = useState<string>('')
  const [filterVBand, setFilterVBand] = useState<string>('all')
  const [filterAge, setFilterAge] = useState<string>('all')
  const [filterImported, setFilterImported] = useState<'all' | 'imported' | 'not'>('all')
  const [filterDup, setFilterDup] = useState<'all' | 'shadowed' | 'gutenberg_only'>('all')
  const [search, setSearch] = useState('')
  const [listOffset, setListOffset] = useState(0)
  const PAGE = 30
  const [stats, setStats] = useState<{ total: number; bySource: Record<string, number>; imported: number; shadowed: number } | null>(null)
  const [enqueuingId, setEnqueuingId] = useState<string | null>(null)
  const [selectedRow, setSelectedRow] = useState<SeedCatalogRow | null>(null)
  const [showShadowed, setShowShadowed] = useState(false)
  // 큐레이션 메타 큐잉 (Claude Code 배치가 drain)
  const [queuingCuration, setQueuingCuration] = useState(false)
  const [curationResult, setCurationResult] = useState<QueueCurationResult | null>(null)
  // SE 중복 정리 — 행별 액션(삭제/변환) pending + 일괄 삭제 pending
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Reset sort/genre/advanced when source changes
  useEffect(() => {
    setSort(opts.sorts[0]?.value ?? 'popular')
    setGenre('')
    setFetchOffset(0)
    setBatchSize(opts.maxBatch)
    setAdvanced(DEFAULT_ADVANCED)
  }, [source, opts])

  const loadList = useCallback(async () => {
    const client = createClient() as unknown as SupabaseClient
    const vb = V_BANDS.find((b) => b.value === filterVBand) ?? V_BANDS[0]
    const ab = AGE_BUCKETS.find((b) => b.value === filterAge) ?? AGE_BUCKETS[0]
    const { rows, total } = await listSeedCatalog(client, {
      source: filterSource === 'all' ? null : filterSource,
      genreKeyword: filterGenre || null,
      search: search || null,
      importedOnly: filterImported === 'imported',
      notImportedOnly: filterImported === 'not',
      vLevelMin: vb.min,
      vLevelMax: vb.max,
      ageBucket: ab.bucket,
      limit: PAGE,
      offset: listOffset,
      sort: 'popularity',
      preferStandardEbooks: !showShadowed,
      dupState: filterDup,
    })
    setRows(rows)
    setTotal(total)
    const s = await getCatalogStats(client)
    setStats(s)
  }, [filterSource, filterGenre, filterVBand, filterAge, filterImported, filterDup, search, listOffset, showShadowed])

  useEffect(() => { void loadList() }, [loadList])

  async function handleFetch(append: boolean) {
    setFetching(true)
    setFetchError(null)
    try {
      const offset = append ? fetchOffset : 0
      const advancedBody = buildAdvancedBody(advanced, opts.advanced ?? [])
      const res = await fetch('/api/admin/library/fetch-seed-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          sort,
          genre: genre || null,
          offset,
          limit: batchSize,
          ...advancedBody,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setLastResult(data)
      setFetchOffset(data.next_offset ?? offset + batchSize)
      await loadList()
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'fetch 실패')
    } finally {
      setFetching(false)
    }
  }

  async function handleEnqueue(row: SeedCatalogRow) {
    setEnqueuingId(row.id)
    try {
      const client = createClient() as unknown as SupabaseClient
      await enqueueSeedRow(client, row)
      await loadList()
      // 모달이 떠 있다면 닫고 새 row 데이터로 갱신 표시 — 미실행
      setSelectedRow(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'enqueue 실패')
    } finally {
      setEnqueuingId(null)
    }
  }

  // 큐레이션 정보(유형·연령·학습도움·추정 V-Level·줄거리) 없는 후보를 인기순 큐잉.
  // 실제 생성은 Claude Code 배치가 curation_status='queued' 행을 drain.
  async function handleQueueCuration() {
    setQueuingCuration(true)
    try {
      const client = createClient() as unknown as SupabaseClient
      const res = await queueSeedCatalogForCuration(client, {
        limit: 100,
        source: filterSource === 'all' ? null : filterSource,
      })
      setCurationResult(res)
      await loadList()
    } catch (e) {
      alert(e instanceof Error ? e.message : '큐레이션 큐잉 실패')
    } finally {
      setQueuingCuration(false)
    }
  }

  // 요건 2 — Gutenberg 만 있는 도서를 SE 로 변환(교체). 제목 우선 유연 매칭.
  async function handleConvertToSe(row: SeedCatalogRow) {
    if (
      !window.confirm(
        `"${row.title}" 을(를) Standard Ebooks 판으로 변환할까요?\n` +
          '· SE 동일 도서(제목 우선 매칭)를 카탈로그에 추가합니다.\n' +
          '· 이 Gutenberg 행은 카탈로그에서 제거됩니다 (큐에 추가된 경우 보존).',
      )
    ) {
      return
    }
    setRowActionId(row.id)
    try {
      const res = await fetch('/api/admin/library/convert-to-se', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId: row.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`)
      if (data.found) {
        await loadList()
        alert(
          `Standard Ebooks 판으로 변환했어요 — "${data.seTitle}".` +
            (data.gutenbergDeleted
              ? '\nGutenberg 행은 카탈로그에서 제거되었습니다.'
              : '\n(이 Gutenberg 행은 큐에 추가돼 있어 보존했습니다.)'),
        )
      } else {
        alert('Standard Ebooks 에 동일 제목 도서가 없습니다 — Gutenberg 판을 그대로 사용하세요.')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'SE 변환 실패')
    } finally {
      setRowActionId(null)
    }
  }

  // 요건 1 — 삭제 대상(SE 가 대체한 Gutenberg 중복) 단건 삭제
  async function handleDeleteRow(row: SeedCatalogRow) {
    if (
      !window.confirm(
        `"${row.title}" (Gutenberg) 을(를) 카탈로그에서 삭제할까요?\n` +
          'Standard Ebooks 판이 이미 있는 중복 행입니다.',
      )
    ) {
      return
    }
    setRowActionId(row.id)
    try {
      const res = await fetch('/api/admin/library/delete-seed-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [row.id] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`)
      if (data.deleted === 0 && data.skipped > 0) {
        alert('이미 큐에 추가된 행이라 보호되어 삭제하지 않았어요.')
      }
      await loadList()
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setRowActionId(null)
    }
  }

  // 요건 1 — 삭제 대상 전체 일괄 삭제 (shadowed_by_se=true 인 Gutenberg 모두)
  async function handleDeleteAllShadowed() {
    const n = stats?.shadowed ?? 0
    if (n === 0) return
    if (
      !window.confirm(
        `Standard Ebooks 가 대체한 Gutenberg 중복 ${n}건을 모두 삭제할까요?\n` +
          '큐에 이미 추가된 행은 보호됩니다.',
      )
    ) {
      return
    }
    setBulkDeleting(true)
    try {
      const client = createClient() as unknown as SupabaseClient
      const { data, error } = await client
        .from('library_seed_catalog_view')
        .select('id')
        .eq('shadowed_by_se', true)
      if (error) throw new Error(error.message)
      const ids = (data ?? []).map((r) => (r as { id: string }).id)
      if (ids.length === 0) {
        setBulkDeleting(false)
        return
      }
      const res = await fetch('/api/admin/library/delete-seed-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`)
      alert(`${j.deleted}건 삭제${j.skipped ? ` · ${j.skipped}건 보호(큐 추가됨)` : ''}`)
      await loadList()
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 삭제 실패')
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Picker */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">
            소스에서 가져오기 (GET batch)
          </h2>
          {opts.hint && (
            <span className="hidden font-body text-[10.5px] text-[var(--t3)] sm:inline">
              {opts.hint}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <PickerField label="소스">
            <select value={source} onChange={(e) => setSource(e.target.value as SourceKey)}
              className={selectCls} disabled={fetching}>
              {/* LibriVox 는 독립 GET 제외 — Gutenberg/SE 도서에 '보이스 연결'로만 사용 (본문 검수에서 매칭) */}
              {SOURCE_OPTIONS.filter((s) => s.value !== 'librivox').map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </PickerField>
          <PickerField label="정렬">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls} disabled={fetching}>
              {opts.sorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </PickerField>
          <PickerField label="장르/카테고리">
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className={selectCls} disabled={fetching}>
              {opts.genres.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </PickerField>
          <PickerField label={`배치 (최대 ${opts.maxBatch})`}>
            <input type="number" min={1} max={opts.maxBatch} value={batchSize}
              onChange={(e) => setBatchSize(Math.min(opts.maxBatch, Math.max(1, Number(e.target.value))))}
              className={selectCls} disabled={fetching} />
          </PickerField>
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => handleFetch(false)} disabled={fetching}
              className={primaryBtn}>
              {fetching ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {fetching ? '가져오는 중…' : `${batchSize}권 가져오기`}
            </button>
          </div>
        </div>

        {/* Advanced 패널 — 소스별 동적 표시 */}
        <div className="mt-3">
          <AdvancedFetchPanel
            enabled={opts.advanced ?? []}
            popularLanguages={opts.popularLanguages}
            state={advanced}
            onChange={setAdvanced}
            disabled={fetching}
          />
        </div>

        {lastResult && !fetchError && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--r-sm)] bg-[var(--bg2)] p-2.5 font-mono text-[11px] text-[var(--t2)]">
            {lastResult.inserted === 0 && lastResult.skipped === 0 ? (
              <>
                <AlertCircle size={12} className="text-[var(--learn-review)]" />
                <span className="text-[var(--learn-review)]">
                  결과 0건 — 카테고리/필터가 매치되는 항목이 없거나 이미 모두 카탈로그에 있어요
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 size={12} className="text-[var(--learn-known)]" />
                신규 <strong className="text-[var(--learn-known)]">{lastResult.inserted}</strong>건 ·
                중복 <span className="text-[var(--t3)]">{lastResult.skipped}</span>건
                {lastResult.total_available != null && (
                  <span>· 소스 전체 ~{lastResult.total_available.toLocaleString()}권</span>
                )}
              </>
            )}
            {lastResult.next_offset != null && (
              <button type="button" onClick={() => handleFetch(true)} disabled={fetching}
                className="ml-auto inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p-light)] px-3 py-1 font-display text-[11px] font-[600] text-[var(--p)] hover:bg-[var(--p)] hover:text-[var(--ti)]">
                <Plus size={11} /> 더 가져오기 ({batchSize}권)
              </button>
            )}
          </div>
        )}
        {fetchError && (
          <div className="mt-3 flex items-center gap-2 rounded-[var(--r-sm)] border border-[var(--learn-error)] bg-[var(--learn-error-light)] p-2.5 font-body text-[12px] text-[var(--learn-error)]">
            <AlertCircle size={12} /> {fetchError}
          </div>
        )}
      </section>

      {/* Stats */}
      {stats && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <StatPill label="카탈로그 전체" n={stats.total} tone="neutral" />
          <StatPill label="큐에 추가됨" n={stats.imported} tone="success" />
          {SOURCE_OPTIONS.map((s) => (
            <StatPill key={s.value} label={s.label} n={stats.bySource[s.value] ?? 0} tone="info" />
          ))}
          {stats.shadowed > 0 && (
            <label
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--learn-review)] bg-[var(--learn-review-light)] px-2 py-1 font-mono text-[10px] text-[var(--learn-review)]"
              title="Standard Ebooks 가 같은 책을 가진 Gutenberg 행 — 기본 숨김"
            >
              <input
                type="checkbox"
                checked={showShadowed}
                onChange={(e) => { setShowShadowed(e.target.checked); setListOffset(0) }}
                className="h-3 w-3"
              />
              Std Ebooks 가 대체한 Gutenberg <strong className="font-display tabular-nums">{stats.shadowed}</strong>건 표시
            </label>
          )}
          {stats.shadowed > 0 && showShadowed && (
            <button
              type="button"
              onClick={handleDeleteAllShadowed}
              disabled={bulkDeleting}
              title="SE 가 대체한 Gutenberg 중복 행 전체 삭제 (큐 추가된 행은 보호)"
              className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--learn-error)] bg-[var(--learn-error-light)] px-2 py-1 font-mono text-[10px] font-[700] text-[var(--learn-error)] hover:opacity-90 disabled:opacity-50"
            >
              {bulkDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              삭제 대상 {stats.shadowed}건 모두 삭제
            </button>
          )}
        </div>
      )}

      {/* Filter row — 큐레이션 차원(난이도 V-Level · 연령 · 유형) 현행화 */}
      <section className="flex flex-wrap items-center gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] p-3">
        <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setListOffset(0) }} className={filterCls}>
          <option value="all">모든 소스</option>
          {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterVBand} onChange={(e) => { setFilterVBand(e.target.value); setListOffset(0) }} className={filterCls} title="난이도 = 추정 V-Level 기준">
          {V_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <select value={filterAge} onChange={(e) => { setFilterAge(e.target.value); setListOffset(0) }} className={filterCls}>
          {AGE_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <input type="text" placeholder="유형 키워드 (소설 · 추리 · 시집 등)" value={filterGenre}
          onChange={(e) => { setFilterGenre(e.target.value); setListOffset(0) }} className={filterCls} />
        <select value={filterImported} onChange={(e) => { setFilterImported(e.target.value as 'all' | 'imported' | 'not'); setListOffset(0) }} className={filterCls}>
          <option value="all">큐 상태 전체</option>
          <option value="imported">이미 큐에 있음</option>
          <option value="not">미추가</option>
        </select>
        <select
          value={filterDup}
          onChange={(e) => { setFilterDup(e.target.value as 'all' | 'shadowed' | 'gutenberg_only'); setListOffset(0) }}
          className={filterCls}
          title="SE 중복 정리 상태 — 삭제 대상(SE 중복) / Gutenberg 단독(SE 변환 후보)"
        >
          {DUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="relative ml-auto flex-1 max-w-xs">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--t3)]" />
          <input type="text" placeholder="제목/저자 검색" value={search}
            onChange={(e) => { setSearch(e.target.value); setListOffset(0) }}
            className={`${filterCls} w-full pl-7`} />
        </div>
      </section>

      {/* 큐레이션 메타 배치 — Claude Code 가 drain */}
      <section className="flex flex-wrap items-center gap-2 rounded-[var(--r-sm)] border border-[var(--p)]/40 bg-[var(--p-light)]/40 p-3">
        <Info size={13} className="text-[var(--p)]" aria-hidden />
        <span className="font-body text-[11px] text-[var(--t2)]">
          큐레이션 선택 정보(유형·연령·학습 도움·추정 V-Level·줄거리)를 Claude Code 배치로 획득
        </span>
        <button
          type="button"
          onClick={handleQueueCuration}
          disabled={queuingCuration}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p)] px-3 font-display text-[11px] font-[600] text-[var(--ti)] hover:opacity-90 disabled:opacity-50"
        >
          {queuingCuration ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          정보 없는 도서 큐에 추가 (인기순 top 100)
        </button>
        {curationResult && (
          <span className="w-full font-mono text-[11px] text-[var(--t2)]">
            큐 추가 <strong className="text-[var(--p)]">{curationResult.queued}</strong>건 · 대기{' '}
            <strong>{curationResult.total_queued}</strong>건 · 미처리{' '}
            {curationResult.total_pending}건 — Claude Code 가 생성 후 done 표시
          </span>
        )}
      </section>

      {/* List */}
      <section className="overflow-hidden rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]">
        {rows.length === 0 ? (
          <div className="p-8 text-center font-body text-[12px] text-[var(--t3)]">
            카탈로그가 비어있습니다. 위 picker로 GET 하세요.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--bd)]">
            {rows.map((r) => {
              const cm = r.curation_meta
              return (
                <li
                  key={r.id}
                  className={`group flex items-start gap-3 p-3 transition-colors hover:bg-[var(--bg2)] ${r.shadowed_by_se ? 'opacity-50' : ''}`}
                >
                  {/* Cover — 클릭 시 상세 모달 */}
                  <button
                    type="button"
                    onClick={() => setSelectedRow(r)}
                    title="상세 보기"
                    className="h-16 w-12 shrink-0 overflow-hidden rounded-[var(--r-sm)] bg-[var(--bg3)] shadow-[var(--sh-xs)] transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                    aria-label={`${r.title} 상세 보기`}
                  >
                    {r.cover_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={r.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--t4)]">
                        <BookOpen size={20} />
                      </div>
                    )}
                  </button>

                  {/* 도서 정보 — 디폴트 노출 (각 항목 1회만 · 중복 제거) */}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedRow(r)}
                      className="block w-full text-left truncate font-display text-[13px] font-[600] text-[var(--t1)] transition-colors hover:text-[var(--p)] focus-visible:outline-none focus-visible:underline"
                    >
                      {r.title}
                    </button>
                    <div className="truncate font-body text-[11px] text-[var(--t2)]">{r.author ?? '—'}</div>

                    {/* 칩 행 — 출처/장르/난이도/연령/인기/언어/상태 + 소스 stat */}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <SourcePill source={r.source} />
                      {r.shadowed_by_se && (
                        <span
                          className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--learn-error)] bg-[var(--learn-error-light)] px-2 py-0.5 font-mono text-[9px] font-[700] text-[var(--learn-error)]"
                          title="Standard Ebooks 에 동일 도서 존재 — 이 Gutenberg 행은 삭제 대상"
                        >
                          <Trash2 size={9} aria-hidden /> 삭제 대상
                        </span>
                      )}
                      {(cm?.genre_norm || r.genre) && <Chip>{cm?.genre_norm ?? r.genre}</Chip>}
                      {r.est_v_level != null && (
                        <span
                          title={`추정 난이도 (ingest 후 실측 대체): ${cm?.est_basis ?? ''}`}
                          className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--p-light)] px-2 py-0.5 font-mono text-[9px] font-[700] text-[var(--p)]"
                        >
                          ~V{r.est_v_level}
                          {cm?.est_cefr ? `·${cm.est_cefr}` : ''}
                        </span>
                      )}
                      {cm?.age_band && <Chip subtle>{cm.age_band}</Chip>}
                      {r.popularity_rank != null && <Chip subtle>↓ {r.popularity_rank.toLocaleString()}</Chip>}
                      {r.language && r.language !== 'en' && <Chip subtle>{r.language}</Chip>}
                      {r.published_year && (
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] text-[var(--t3)]">
                          <Calendar size={10} /> {r.published_year}
                        </span>
                      )}
                      {r.word_count && (
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] text-[var(--t3)]">
                          <FileText size={10} /> {r.word_count.toLocaleString()}
                        </span>
                      )}
                      {r.reading_time_minutes && (
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] text-[var(--t3)]">
                          <Clock size={10} />{' '}
                          {r.reading_time_minutes >= 60
                            ? `${Math.floor(r.reading_time_minutes / 60)}h ${r.reading_time_minutes % 60}m`
                            : `${r.reading_time_minutes}m`}
                        </span>
                      )}
                    </div>

                    {/* 줄거리 (curation) → 없으면 소스 description → 둘 다 없고 큐 대기면 안내 */}
                    {cm?.synopsis_ko ? (
                      <p className="mt-1.5 font-body text-[12px] leading-relaxed text-[var(--t1)] line-clamp-2">
                        {cm.synopsis_ko}
                      </p>
                    ) : r.description ? (
                      <p className="mt-1.5 font-body text-[12px] leading-relaxed text-[var(--t2)] line-clamp-2">
                        {r.description}
                      </p>
                    ) : r.curation_status === 'queued' ? (
                      <p className="mt-1.5 inline-flex items-center gap-1 font-body text-[11px] italic text-[var(--t3)]">
                        <Clock size={10} /> 큐레이션 정보 생성 대기 중
                      </p>
                    ) : null}

                    {/* 학습 도움 */}
                    {cm?.learning_value && (
                      <p className="mt-1 font-body text-[11px] leading-relaxed text-[var(--t2)] line-clamp-1">
                        <strong className="text-[var(--t1)]">학습 도움:</strong> {cm.learning_value}
                      </p>
                    )}

                    {/* 테마 */}
                    {cm?.themes && cm.themes.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {cm.themes.map((th, i) => (
                          <span
                            key={`${th}-${i}`}
                            className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[9px] text-[var(--t2)]"
                          >
                            {th}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {r.source_url && (
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="원문 보기"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {/* 요건 2 — Gutenberg 만 있음(SE 없음) → SE 로 변환 */}
                    {r.source === 'gutenberg' && !r.shadowed_by_se && (
                      <button
                        type="button"
                        onClick={() => handleConvertToSe(r)}
                        disabled={rowActionId === r.id}
                        title="Standard Ebooks 에서 같은 도서를 찾아 카탈로그에 추가 (있으면 이 Gutenberg 는 삭제 대상으로 전환)"
                        className="inline-flex h-8 items-center gap-1 rounded-[var(--r-sm)] border border-[var(--learn-known)] bg-[var(--learn-known-light)] px-2 font-display text-[10px] font-[600] text-[var(--learn-known)] hover:opacity-90 disabled:opacity-50"
                      >
                        {rowActionId === r.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <ArrowRightLeft size={11} />
                        )}
                        SE 변환
                      </button>
                    )}
                    {/* 요건 1 — 삭제 대상(SE 가 대체한 Gutenberg 중복) → 삭제 */}
                    {r.shadowed_by_se && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(r)}
                        disabled={rowActionId === r.id}
                        title="SE 가 대체한 Gutenberg 중복 행 삭제"
                        aria-label={`${r.title} Gutenberg 중복 삭제`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] text-[var(--learn-error)] hover:bg-[var(--learn-error-light)] disabled:opacity-50"
                      >
                        {rowActionId === r.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    )}
                    {r.imported_to_books ? (
                      <span className="inline-flex h-8 items-center gap-1 rounded-[var(--r-sm)] border border-[var(--learn-known)] bg-[var(--learn-known-light)] px-2.5 font-mono text-[10px] font-[700] text-[var(--learn-known)]">
                        <CheckCircle2 size={11} /> 큐
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEnqueue(r)}
                        disabled={enqueuingId === r.id}
                        className="inline-flex h-8 items-center gap-1 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p)] px-2.5 font-display text-[11px] font-[600] text-[var(--ti)] hover:opacity-90 disabled:opacity-50"
                      >
                        {enqueuingId === r.id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        enqueue
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {total > PAGE && (
          <div className="flex items-center justify-between border-t border-[var(--bd)] bg-[var(--bg2)] p-2 font-mono text-[11px] text-[var(--t3)]">
            <span>{listOffset + 1}–{Math.min(listOffset + PAGE, total)} / {total}</span>
            <div className="flex gap-1">
              <button type="button" disabled={listOffset === 0}
                onClick={() => setListOffset(Math.max(0, listOffset - PAGE))}
                className="rounded border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 hover:bg-[var(--bg2)] disabled:opacity-50">이전</button>
              <button type="button" disabled={listOffset + PAGE >= total}
                onClick={() => setListOffset(listOffset + PAGE)}
                className="rounded border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 hover:bg-[var(--bg2)] disabled:opacity-50">다음</button>
            </div>
          </div>
        )}
      </section>

      {/* 도서 상세 모달 */}
      <SeedDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onEnqueue={handleEnqueue}
        enqueuing={enqueuingId === selectedRow?.id}
      />
    </div>
  )
}

function SourcePill({ source }: { source: string }) {
  const cfg = SOURCE_OPTIONS.find((s) => s.value === source)
  return (
    <span className="inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[9px] font-[700]"
      style={{ color: cfg?.color, backgroundColor: cfg ? `color-mix(in srgb, ${cfg.color} 12%, transparent)` : 'var(--bg2)' }}>
      {cfg?.label ?? source}
    </span>
  )
}

function Chip({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[9px] font-[600] ${
      subtle ? 'bg-[var(--bg2)] text-[var(--t3)]' : 'bg-[var(--bg2)] text-[var(--t2)]'
    }`}>{children}</span>
  )
}

function StatPill({ label, n, tone }: { label: string; n: number; tone: 'neutral' | 'success' | 'info' }) {
  const color = tone === 'success' ? 'var(--learn-known)' : tone === 'info' ? 'var(--p)' : 'var(--t3)'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-mono text-[10px] text-[var(--t2)]">
      {label} <strong className="font-display tabular-nums" style={{ color }}>{n.toLocaleString()}</strong>
    </span>
  )
}

function PickerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">{label}</span>
      {children}
    </label>
  )
}

const selectCls =
  'h-9 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[12px] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]'
const filterCls =
  'h-8 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[12px] text-[var(--t1)]'
const primaryBtn =
  'inline-flex h-9 items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p)] px-3 font-display text-[12px] font-[600] text-[var(--ti)] hover:opacity-90 disabled:opacity-50'
