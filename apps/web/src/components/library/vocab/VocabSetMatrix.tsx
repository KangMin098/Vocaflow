// apps/web/src/components/library/vocab/VocabSetMatrix.tsx
//
// 2D 매트릭스 v3 — 다차원 레벨 시스템.
//
// 영감: Periodic table groups · Airtable · Bloomberg · Stripe dashboard · iOS Segmented Control
//
// 핵심:
// - X축 3 모드 toggle: V-Level(11) / CEFR(6) / 단어 규모(5)
// - X축에도 시각 그룹 밴드 (초급/중급/고급/전문)
// - chip 에 V-Level 배지 + CEFR side stripe + 단어수 동시 인코딩 (3축 동시 시각화)
// - 사용자가 보고 싶은 축으로 자유 전환, 다른 축은 chip 으로 보존
//
// 접근성:
// - role="grid" + aria-rowcount/colcount
// - 축 toggle 은 segmented control (radio group)
// - 색 + 텍스트 + 형태 3중 인코딩 (색맹 대응)

'use client'

import { useMemo, useRef, useState } from 'react'

import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

import { VOCAB_CATEGORIES, type VocabCategoryId } from './categories'

// ─────────────────────────────────────────────
// 다차원 레벨 시스템
// ─────────────────────────────────────────────

type AxisMode = 'vlevel' | 'track' | 'domain' | 'cefr' | 'size'

interface AxisCol {
  id: string
  label: string
  sub?: string
}
interface AxisGroup {
  label: string
  color: string
  cols: string[]
}
interface AxisConfig {
  cols: AxisCol[]
  groups: AxisGroup[]
  /** 세트 → col id 매핑 ('—' 이면 미지정) */
  resolve: (set: PublishedVocabSet) => string
}

// V-Level 1~11 + 그룹 밴드 (한국 학습자 단계 정렬)
const V_LEVEL_AXIS: AxisConfig = {
  cols: Array.from({ length: 11 }, (_, i) => ({
    id: `V${i + 1}`,
    label: `V${i + 1}`,
  })),
  groups: [
    { label: '초급', color: '#84CC16', cols: ['V1', 'V2', 'V3'] },
    { label: '중급', color: '#06B6D4', cols: ['V4', 'V5', 'V6'] },
    { label: '고급', color: '#F59E0B', cols: ['V7', 'V8', 'V9'] },
    { label: '전문', color: '#8B5CF6', cols: ['V10', 'V11'] },
  ],
  resolve: deriveVLevel,
}

const CEFR_AXIS: AxisConfig = {
  cols: [
    { id: 'A1', label: 'A1', sub: '입문' },
    { id: 'A2', label: 'A2', sub: '초급' },
    { id: 'B1', label: 'B1', sub: '중급' },
    { id: 'B2', label: 'B2', sub: '중상' },
    { id: 'C1', label: 'C1', sub: '상급' },
    { id: 'C2', label: 'C2', sub: '숙달' },
  ],
  groups: [
    { label: '기초', color: '#84CC16', cols: ['A1', 'A2'] },
    { label: '중급', color: '#06B6D4', cols: ['B1', 'B2'] },
    { label: '상급', color: '#F59E0B', cols: ['C1', 'C2'] },
  ],
  // CEFR null 인 세트는 V-Level 기반 fallback 으로 배치 (다차원 정합)
  resolve: (s) => {
    if (s.cefrLevel) return s.cefrLevel
    const v = deriveVLevel(s)
    const vToCefr: Record<string, string> = {
      V1: 'A1',
      V2: 'A1',
      V3: 'A2',
      V4: 'A2',
      V5: 'B1',
      V6: 'B1',
      V7: 'B2',
      V8: 'B2',
      V9: 'C1',
      V10: 'C1',
      V11: 'C2',
    }
    return vToCefr[v] ?? 'B1'
  },
}

// ── Track 차원 (학습 트랙: 수능·비즈니스·학술·일반) ──
// VRL Phase 2B.2/2B.3 track diagnostic 정합 (csat_korean / business / academic)
function deriveTrack(s: PublishedVocabSet): string {
  const t = `${s.title} ${s.description ?? ''}`.toLowerCase()
  if (/csat|kice|수능|내신/.test(t)) return 'csat'
  if (/bsl|business|비즈/.test(t)) return 'business'
  if (/nawl|academic|학술|학업/.test(t)) return 'academic'
  if (s.category === 'csat' || s.category === 'civil') return 'csat'
  if (s.category === 'business') return 'business'
  return 'general'
}

const TRACK_AXIS: AxisConfig = {
  cols: [
    { id: 'csat', label: '수능', sub: 'CSAT' },
    { id: 'business', label: '비즈', sub: 'BSL' },
    { id: 'academic', label: '학술', sub: 'NAWL' },
    { id: 'general', label: '일반', sub: 'General' },
  ],
  groups: [
    { label: '입시·시험', color: '#F59E0B', cols: ['csat'] },
    { label: '실무·학술', color: '#06B6D4', cols: ['business', 'academic'] },
    { label: '범용', color: '#94A3B8', cols: ['general'] },
  ],
  resolve: deriveTrack,
}

// ── Domain 차원 (전문 도메인: 의료·비즈·문학·학술·일반) ──
function deriveDomain(s: PublishedVocabSet): string {
  const t = `${s.title} ${s.description ?? ''}`.toLowerCase()
  if (/medical|moel|의료|의학/.test(t)) return 'medical'
  if (/literary|bel|문학|문예/.test(t)) return 'literary'
  if (/academic|nawl|학술/.test(t)) return 'academic'
  if (/business|bsl|비즈/.test(t) || s.category === 'business') return 'business'
  return 'general'
}

const DOMAIN_AXIS: AxisConfig = {
  cols: [
    { id: 'medical', label: '의료', sub: 'MOEL' },
    { id: 'business', label: '비즈', sub: 'BSL' },
    { id: 'literary', label: '문학', sub: 'BEL' },
    { id: 'academic', label: '학술', sub: 'NAWL' },
    { id: 'general', label: '일반', sub: 'General' },
  ],
  groups: [
    { label: '전문 도메인', color: '#8B5CF6', cols: ['medical', 'business', 'literary', 'academic'] },
    { label: '범용', color: '#94A3B8', cols: ['general'] },
  ],
  resolve: deriveDomain,
}

const SIZE_AXIS: AxisConfig = {
  cols: [
    { id: 'xs', label: 'XS', sub: '< 100' },
    { id: 's', label: 'S', sub: '100·300' },
    { id: 'm', label: 'M', sub: '300·700' },
    { id: 'l', label: 'L', sub: '700·1.5k' },
    { id: 'xl', label: 'XL', sub: '1.5k+' },
  ],
  groups: [
    { label: '소형', color: '#84CC16', cols: ['xs', 's'] },
    { label: '중형', color: '#06B6D4', cols: ['m'] },
    { label: '대형', color: '#F59E0B', cols: ['l', 'xl'] },
  ],
  resolve: (s) => {
    const n = s.wordCount
    if (n < 100) return 'xs'
    if (n < 300) return 's'
    if (n < 700) return 'm'
    if (n < 1500) return 'l'
    return 'xl'
  },
}

const AXES: Record<AxisMode, AxisConfig> = {
  vlevel: V_LEVEL_AXIS,
  track: TRACK_AXIS,
  domain: DOMAIN_AXIS,
  cefr: CEFR_AXIS,
  size: SIZE_AXIS,
}

// 세트 → V-Level 유도 (title 패턴 → CEFR fallback)
function deriveVLevel(set: PublishedVocabSet): string {
  const m = set.title.match(/V(\d{1,2})\b/i)
  if (m) {
    const n = parseInt(m[1], 10)
    if (n >= 1 && n <= 11) return `V${n}`
  }
  const cefrToV: Record<string, string> = {
    A1: 'V2',
    A2: 'V4',
    B1: 'V5',
    B2: 'V7',
    C1: 'V9',
    C2: 'V11',
  }
  return set.cefrLevel ? (cefrToV[set.cefrLevel] ?? '—') : '—'
}

// CEFR mono dot (chip 안 시각 인코딩)
const CEFR_TONE: Record<string, string> = {
  A1: '#E2E8F0',
  A2: '#CBD5E1',
  B1: '#94A3B8',
  B2: '#64748B',
  C1: '#334155',
  C2: '#0F172A',
}

// Y축 그룹 — 학습자 여정
const ROW_GROUPS: Record<string, { label: string; color: string }> = {
  preschool: { label: '기초', color: '#84CC16' },
  elementary: { label: '기초', color: '#84CC16' },
  middle: { label: '학교', color: '#06B6D4' },
  high: { label: '학교', color: '#06B6D4' },
  csat: { label: '시험', color: '#F59E0B' },
  eng_test: { label: '시험', color: '#F59E0B' },
  civil: { label: '시험', color: '#F59E0B' },
  business: { label: '실무', color: '#8B5CF6' },
  themed: { label: '실무', color: '#8B5CF6' },
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

interface VocabSetMatrixProps {
  sets: PublishedVocabSet[]
  subscribedIds: Set<string>
  onSelectSet: (set: PublishedVocabSet) => void
  onSelectCategory: (categoryId: VocabCategoryId) => void
}

export function VocabSetMatrix({
  sets,
  subscribedIds,
  onSelectSet,
  onSelectCategory,
}: VocabSetMatrixProps) {
  const [axis, setAxis] = useState<AxisMode>('vlevel')
  const [compact, setCompact] = useState(true) // 빈 행·열 압축 (단어장 클러스터링)
  const config = AXES[axis]
  const allRows = VOCAB_CATEGORIES.filter((c) => c.id !== 'all')

  // ── Horizontal drag-to-scroll (마우스 드래그 토글식) ──
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  })
  const [isDragging, setIsDragging] = useState(false)

  function handleMouseDown(e: React.MouseEvent) {
    if (!scrollRef.current) return
    // 인터랙티브 요소(chip/button) 클릭은 드래그 진입 X
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, [role="button"]')) return
    dragRef.current = {
      isDown: true,
      startX: e.pageX,
      scrollLeft: scrollRef.current.scrollLeft,
      moved: false,
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragRef.current.isDown || !scrollRef.current) return
    const dx = e.pageX - dragRef.current.startX
    if (Math.abs(dx) > 4) {
      dragRef.current.moved = true
      setIsDragging(true)
      e.preventDefault()
      scrollRef.current.scrollLeft = dragRef.current.scrollLeft - dx
    }
  }

  function endDrag() {
    dragRef.current.isDown = false
    // 클릭 이벤트가 chip에 전달되도록 약간 지연 후 해제
    if (dragRef.current.moved) {
      setTimeout(() => setIsDragging(false), 0)
    } else {
      setIsDragging(false)
    }
  }

  // 드래그 중 우발 클릭 차단 (capture phase)
  function handleClickCapture(e: React.MouseEvent) {
    if (dragRef.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current.moved = false
    }
  }

  // ── 매트릭스 빌드 ──
  const { matrix, rowTotals, colTotals } = useMemo(() => {
    const m = new Map<string, Map<string, PublishedVocabSet[]>>()
    const rTot = new Map<string, number>()
    const cTot = new Map<string, number>()
    for (const cat of allRows) {
      const inner = new Map<string, PublishedVocabSet[]>()
      for (const c of config.cols) inner.set(c.id, [])
      m.set(cat.id, inner)
      rTot.set(cat.id, 0)
    }
    for (const c of config.cols) cTot.set(c.id, 0)
    for (const s of sets) {
      const inner = m.get(s.category)
      if (!inner) continue
      const colId = config.resolve(s)
      if (!inner.has(colId)) continue
      inner.get(colId)!.push(s)
      rTot.set(s.category, (rTot.get(s.category) ?? 0) + 1)
      cTot.set(colId, (cTot.get(colId) ?? 0) + 1)
    }
    return { matrix: m, rowTotals: rTot, colTotals: cTot }
  }, [sets, config, allRows])

  // ── Compact mode: 빈 행/열 압축 (클러스터링) ──
  const rows = useMemo(
    () => (compact ? allRows.filter((r) => (rowTotals.get(r.id) ?? 0) > 0) : allRows),
    [allRows, rowTotals, compact],
  )
  const visibleCols = useMemo(
    () =>
      compact
        ? config.cols.filter((c) => (colTotals.get(c.id) ?? 0) > 0)
        : config.cols,
    [config.cols, colTotals, compact],
  )
  const hiddenRowCount = allRows.length - rows.length
  const hiddenColCount = config.cols.length - visibleCols.length

  // 최대 density (heatmap 정규화용)
  const maxCellCount = useMemo(() => {
    let max = 0
    for (const inner of matrix.values()) {
      for (const arr of inner.values()) {
        if (arr.length > max) max = arr.length
      }
    }
    return Math.max(max, 1)
  }, [matrix])

  // ── 컬럼 그룹 인덱스 (X축 헤더 밴드용) ──
  const colGroupMap = new Map<string, { label: string; color: string }>()
  for (const g of config.groups) {
    for (const c of g.cols) colGroupMap.set(c, g)
  }

  let prevRowGroup: string | null = null
  let prevColGroup: string | null = null

  return (
    <div className="space-y-4">
      {/* ── Toolbar: 축 toggle + 범례 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Segmented control */}
        <div
          role="radiogroup"
          aria-label="X축 차원 선택"
          className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(
            [
              { id: 'vlevel', label: 'V-Level', sub: '11단계' },
              { id: 'track', label: '트랙', sub: '4축' },
              { id: 'domain', label: '도메인', sub: '5축' },
              { id: 'cefr', label: 'CEFR', sub: '6단계' },
              { id: 'size', label: '규모', sub: '5단계' },
            ] as { id: AxisMode; label: string; sub: string }[]
          ).map((opt) => {
            const active = axis === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAxis(opt.id)}
                className={`relative inline-flex flex-col items-center gap-0 rounded-[var(--r-md)] px-4 py-1.5 transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t1)]/30 ${
                  active
                    ? 'bg-[var(--bg)] shadow-[var(--sh-sm)]'
                    : 'hover:bg-[var(--bg)]/60'
                }`}
              >
                <span
                  className={`font-display text-[12px] font-[700] ${
                    active ? 'text-[var(--t1)]' : 'text-[var(--t2)]'
                  }`}
                >
                  {opt.label}
                </span>
                <span
                  className={`font-mono text-[9px] ${
                    active ? 'text-[var(--t2)]' : 'text-[var(--t2)]'
                  }`}
                >
                  {opt.sub}
                </span>
              </button>
            )
          })}
        </div>

        {/* 범례 */}
        <div className="flex items-center gap-3 font-body text-[11px] text-[var(--t2)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--t1)]"
            />
            구독중
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full border border-[var(--bd)] bg-[var(--bg)]"
            />
            미구독
          </span>
          {axis !== 'cefr' && (
            <span className="hidden items-center gap-1 sm:inline-flex">
              <span className="font-mono">CEFR</span>
              {Object.entries(CEFR_TONE).map(([k, v]) => (
                <span
                  key={k}
                  aria-label={k}
                  title={k}
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: v }}
                />
              ))}
            </span>
          )}
          {/* 압축 모드 토글 — 빈 행·열 숨김으로 단어장 클러스터링 */}
          <button
            type="button"
            onClick={() => setCompact((v) => !v)}
            aria-pressed={compact}
            className={`inline-flex items-center gap-1.5 rounded-[var(--r-full)] border px-2.5 py-0.5 font-mono text-[10px] font-[700] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t1)]/30 ${
              compact
                ? 'border-[var(--t1)] bg-[var(--t1)] text-[var(--bg)]'
                : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:text-[var(--t1)]'
            }`}
            title={
              compact
                ? '빈 셀이 있는 행·열을 숨기는 중. 클릭하면 전체 매트릭스 표시.'
                : '전체 매트릭스 표시 중. 클릭하면 데이터 있는 부분만.'
            }
          >
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                compact ? 'bg-[var(--bg)]' : 'bg-[var(--t3)]'
              }`}
            />
            {compact ? '압축' : '전체'}
            {compact && (hiddenRowCount > 0 || hiddenColCount > 0) && (
              <span className="font-mono text-[9px] opacity-70">
                −{hiddenRowCount}r/−{hiddenColCount}c
              </span>
            )}
          </button>
          <span
            aria-hidden
            className="hidden items-center gap-1 rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[10px] font-[600] text-[var(--t2)] md:inline-flex"
            title="가로로 드래그해서 탐색하세요"
          >
            ← drag →
          </span>
        </div>
      </div>

      {/* ── Matrix (horizontal drag-to-scroll 지원) ── */}
      <div className="relative">
        {/* 드래그 힌트 - 우측 fade gradient */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 z-30 h-full w-12 rounded-r-[var(--r-xl)] bg-gradient-to-l from-[var(--bg)] to-transparent opacity-50"
        />
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onClickCapture={handleClickCapture}
          className={`overflow-x-auto rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }}
        >
        <div
          role="grid"
          aria-label={`단어장 매트릭스 — 학습 단계 × ${
            axis === 'vlevel'
              ? 'V-Level'
              : axis === 'track'
                ? '학습 트랙'
                : axis === 'domain'
                  ? '전문 도메인'
                  : axis === 'cefr'
                    ? 'CEFR'
                    : '단어 규모'
          }`}
          aria-rowcount={rows.length + 3}
          aria-colcount={visibleCols.length + 2}
          className="grid"
          style={{
            gridTemplateColumns: `196px repeat(${visibleCols.length}, minmax(112px, 1fr)) 68px`,
            minWidth: 196 + visibleCols.length * 112 + 68,
          }}
        >
          {/* === 그룹 밴드 행 (column groups) === */}
          <div className="sticky left-0 top-0 z-30 border-b border-r border-[var(--bd)] bg-[var(--bg2)]" />
          {visibleCols.map((col, colIdx) => {
            const grp = colGroupMap.get(col.id)
            const isStart = grp?.label !== prevColGroup
            prevColGroup = grp?.label ?? null
            // span = 이 그룹에 속하면서 visibleCols 에도 있는 col 개수
            const span = grp
              ? visibleCols.filter((c) => colGroupMap.get(c.id) === grp).length
              : 1
            return isStart && grp ? (
              <div
                key={`grp-${colIdx}`}
                className="sticky top-0 z-20 flex items-center justify-center gap-1.5 border-b border-r border-[var(--bd)] bg-[var(--bg)] px-2 py-1.5"
                style={{ gridColumn: `span ${span} / span ${span}` }}
              >
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: grp.color }}
                />
                <span
                  className="font-mono text-[10px] font-[700] uppercase tracking-wider"
                  style={{ color: grp.color }}
                >
                  {grp.label}
                </span>
              </div>
            ) : null
          })}
          <div className="sticky top-0 z-20 border-b border-[var(--bd)] bg-[var(--bg2)]" />

          {/* === Header row (axis labels) === */}
          <div
            role="columnheader"
            aria-colindex={1}
            className="sticky left-0 z-20 border-b border-r border-[var(--bd)] bg-[var(--bg2)] p-3"
          >
            <div className="font-mono text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]">
              단계 ↓
            </div>
            <div className="mt-0.5 font-display text-[12px] font-[700] text-[var(--t1)]">
              {axis === 'vlevel'
                ? 'V-Level →'
                : axis === 'track'
                  ? '학습 트랙 →'
                  : axis === 'domain'
                    ? '도메인 →'
                    : axis === 'cefr'
                      ? 'CEFR →'
                      : '단어 규모 →'}
            </div>
          </div>
          {visibleCols.map((col, i) => {
            const total = colTotals.get(col.id) ?? 0
            return (
              <div
                key={col.id}
                role="columnheader"
                aria-colindex={i + 2}
                className="sticky top-0 z-10 border-b border-r border-[var(--bd)] bg-[var(--bg2)] p-2 text-center"
              >
                <div className="font-mono text-[13px] font-[800] tracking-wider text-[var(--t1)]">
                  {col.label}
                </div>
                {col.sub && (
                  <div className="font-mono text-[9px] font-[500] text-[var(--t2)]">
                    {col.sub}
                  </div>
                )}
                <div
                  className={`mt-1 font-mono text-[11px] font-[700] tabular-nums ${
                    total === 0 ? 'text-[var(--t2)]' : 'text-[var(--t2)]'
                  }`}
                >
                  {total}
                </div>
              </div>
            )
          })}
          <div
            role="columnheader"
            aria-colindex={visibleCols.length + 2}
            className="sticky top-0 z-10 border-b border-[var(--bd)] bg-[var(--bg2)] p-2 text-center font-mono text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]"
          >
            합계
          </div>

          {/* === Data rows === */}
          {rows.map((cat, rowIdx) => {
            const groupInfo = ROW_GROUPS[cat.id]
            const groupLabel = groupInfo?.label ?? ''
            const isGroupStart = groupLabel !== prevRowGroup
            prevRowGroup = groupLabel
            const inner = matrix.get(cat.id)!
            const total = rowTotals.get(cat.id) ?? 0
            const isEmptyRow = total === 0

            return (
              <div
                key={cat.id}
                role="row"
                aria-rowindex={rowIdx + 3}
                className="contents"
              >
                {/* Y축 행 라벨 + 그룹 stripe */}
                <div
                  role="rowheader"
                  aria-colindex={1}
                  className={`sticky left-0 z-10 flex items-stretch border-r border-b border-[var(--bd)] bg-[var(--bg)] ${
                    isGroupStart ? 'border-t-2 border-t-[var(--bd)]' : ''
                  }`}
                >
                  <div
                    aria-hidden
                    className="w-1 shrink-0"
                    style={{ background: groupInfo?.color ?? 'transparent' }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onSelectCategory(cat.id as VocabCategoryId)
                    }
                    disabled={isEmptyRow}
                    className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--t1)]/30 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`${cat.label} 카테고리만 보기 · ${total}개`}
                  >
                    <span aria-hidden className="text-[22px] leading-none">
                      {cat.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                          {cat.label}
                        </span>
                        {isGroupStart && groupInfo && (
                          <span
                            className="font-mono text-[9px] font-[700] uppercase tracking-wider"
                            style={{ color: groupInfo.color }}
                          >
                            {groupInfo.label}
                          </span>
                        )}
                      </div>
                      <div className="truncate font-body text-[10px] text-[var(--t2)]">
                        {cat.hint}
                      </div>
                    </div>
                  </button>
                </div>

                {/* 데이터 cells */}
                {visibleCols.map((col, colIdx) => {
                  const items = inner.get(col.id) ?? []
                  const n = items.length
                  const cellEmpty = n === 0
                  // density = 0~1 정규화 → opacity 변조
                  const density = n / maxCellCount
                  return (
                    <div
                      key={col.id}
                      role="gridcell"
                      aria-colindex={colIdx + 2}
                      aria-label={`${cat.label} · ${col.label}${col.sub ? ` (${col.sub})` : ''} — ${n}개`}
                      className={`relative border-b border-r border-[var(--bd)] transition-colors ${
                        cellEmpty
                          ? 'bg-[repeating-linear-gradient(135deg,transparent_0,transparent_5px,var(--bg2)_5px,var(--bg2)_6px)]'
                          : 'bg-[var(--bg)]'
                      }`}
                    >
                      {/* density 인디케이터 (cell 좌상단 점) */}
                      {!cellEmpty && (
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 bg-[var(--t1)]"
                          style={{ opacity: density * 0.04 }}
                        />
                      )}
                      {cellEmpty ? (
                        <div
                          aria-hidden
                          className="flex h-full min-h-[68px] items-center justify-center"
                        >
                          <span className="font-mono text-[10px] text-[var(--t2)]">
                            ∅
                          </span>
                        </div>
                      ) : (
                        <div className="relative flex flex-col gap-1 p-1.5">
                          {items.slice(0, 3).map((s) => (
                            <MatrixSetChip
                              key={s.id}
                              set={s}
                              isSubscribed={subscribedIds.has(s.id)}
                              axis={axis}
                              onClick={() => onSelectSet(s)}
                            />
                          ))}
                          {items.length > 3 && (
                            <button
                              type="button"
                              onClick={() =>
                                onSelectCategory(cat.id as VocabCategoryId)
                              }
                              className="rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] bg-[var(--bg)] py-1 text-center font-mono text-[10px] font-[700] text-[var(--t2)] transition-colors hover:border-[var(--t1)] hover:text-[var(--t1)]"
                            >
                              +{items.length - 3} 더보기
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* 행 합계 */}
                <div
                  role="rowheader"
                  aria-colindex={visibleCols.length + 2}
                  className={`border-b border-[var(--bd)] p-2 text-center font-mono text-[13px] font-[800] tabular-nums ${
                    total === 0
                      ? 'bg-[var(--bg2)] text-[var(--t2)]'
                      : 'bg-[var(--bg2)] text-[var(--t2)]'
                  }`}
                >
                  {total}
                </div>
              </div>
            )
          })}

          {/* === Footer row (합계) === */}
          <div
            role="rowheader"
            aria-colindex={1}
            className="sticky left-0 z-10 border-r border-[var(--bd)] bg-[var(--t1)] p-2 font-mono text-[10px] font-[700] uppercase tracking-wider text-[var(--bg)]"
          >
            합계
          </div>
          {visibleCols.map((col, i) => (
            <div
              key={col.id}
              role="gridcell"
              aria-colindex={i + 2}
              className="border-r border-[var(--bd)] bg-[var(--t1)] p-2 text-center font-mono text-[13px] font-[800] tabular-nums text-[var(--bg)]"
            >
              {colTotals.get(col.id) ?? 0}
            </div>
          ))}
          <div
            role="gridcell"
            aria-colindex={visibleCols.length + 2}
            className="bg-[var(--t1)] p-2 text-center font-mono text-[14px] font-[800] tabular-nums text-[var(--bg)]"
          >
            {sets.length}
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Chip — 다축 정보 동시 인코딩
// ─────────────────────────────────────────────

interface MatrixSetChipProps {
  set: PublishedVocabSet
  isSubscribed: boolean
  axis: AxisMode
  onClick: () => void
}

function MatrixSetChip({
  set,
  isSubscribed,
  axis,
  onClick,
}: MatrixSetChipProps) {
  const vLevel = deriveVLevel(set)
  const cefr = set.cefrLevel
  const cefrTone = cefr ? CEFR_TONE[cefr] : 'transparent'

  // 현재 X축이 어떤 차원이냐에 따라 chip 안 메인 배지 결정 (중복 회피)
  const showVBadge = axis !== 'vlevel' && vLevel !== '—'
  const showCefrStripe = axis !== 'cefr' && cefr

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${set.title} · ${set.wordCount}단어${cefr ? ` · CEFR ${cefr}` : ''}${vLevel !== '—' ? ` · ${vLevel}` : ''}`}
      aria-label={`${set.title} — ${set.wordCount}단어${cefr ? `, CEFR ${cefr}` : ''}${vLevel !== '—' ? `, ${vLevel}` : ''}${isSubscribed ? ', 구독중' : ''}`}
      className={`group/chip relative flex w-full items-center gap-1.5 overflow-hidden rounded-[var(--r-sm)] border px-1.5 py-1 text-left transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t1)]/30 focus-visible:ring-offset-1 ${
        isSubscribed
          ? 'border-[var(--t1)] bg-[var(--t1)] text-[var(--bg)] hover:bg-[var(--t1)]/90'
          : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:-translate-y-[1px] hover:border-[var(--t1)] hover:shadow-[var(--sh-sm)]'
      }`}
    >
      {/* CEFR side stripe (V-Level 또는 Size 모드에서 노출) */}
      {showCefrStripe && (
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-[3px]"
          style={{ background: cefrTone }}
        />
      )}

      {/* V-Level 배지 (CEFR / Size 모드에서 노출) */}
      {showVBadge && (
        <span
          className={`shrink-0 rounded-[3px] px-1 font-mono text-[9px] font-[800] leading-[14px] tabular-nums ${
            isSubscribed
              ? 'bg-[var(--bg)]/20 text-[var(--bg)]'
              : 'bg-[var(--bg3)] text-[var(--t2)]'
          }`}
        >
          {vLevel}
        </span>
      )}

      {/* CEFR mono dot (V-Level / Size 모드 hover시 보강) */}
      {axis === 'vlevel' && cefr && (
        <span
          aria-hidden
          className="shrink-0 inline-block h-2 w-2 rounded-full"
          style={{ background: cefrTone }}
        />
      )}

      {set.coverEmoji && (
        <span aria-hidden className="shrink-0 text-[13px] leading-none">
          {set.coverEmoji}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-display text-[11px] font-[600] leading-tight">
        {set.title}
      </span>
      <span
        className={`shrink-0 font-mono text-[10px] tabular-nums ${
          isSubscribed ? 'text-[var(--bg)]/70' : 'text-[var(--t2)]'
        }`}
      >
        {set.wordCount}
      </span>
    </button>
  )
}
