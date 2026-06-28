// apps/web/src/components/plan/PlanClient.tsx
// 학습 계획 구성 — 일정(주당 리듬) + 자료(도서/스크립트/공용단어장/내 스크립트)별 활동 (리틀팍스형).
// 비주얼 우선: 도서 표지 · 스크립트 소스 배지 · 단어장 이모지. Calm UI · Progressive Disclosure.
// 텍스트 위주 → 시각/선택 위주로 재구성 (학습 의욕).

'use client'

import {
  BookMarked,
  BookOpen,
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  Headphones,
  Layers,
  Mic2,
  Newspaper,
  Pencil,
  PencilLine,
  Play,
  Plus,
  ScrollText,
  Shuffle,
  Sparkles,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useMemo, useTransition } from 'react'

import {
  ACTIVITY_BY_ID,
  activitiesForType,
  activityLaunchHref,
  articleSourceLabel,
  isActivityScoped,
  materialHref,
  MATERIAL_LABEL,
  PLAN_ACTIVITIES,
  WEEKDAYS,
  weekdayLabel,
  wordsetCategoryLabel,
  type MaterialType,
  type PlanActivity,
} from '@/lib/learner/plan-activities'
import { V_BANDS, vBandOf, type VBand } from '@/lib/library/genres'
import {
  removePlanItem,
  savePlanItem,
  type AvailableMaterials,
  type MaterialOption,
  type PlanItem,
} from '@/lib/learner/plan-actions'

const ACTIVITY_ICON: Record<string, LucideIcon> = {
  Headphones,
  BookOpen,
  Mic2,
  Layers,
  Zap,
  Shuffle,
  Pencil,
  ScrollText,
  PencilLine,
}

const MATERIAL_ICON: Record<MaterialType, LucideIcon> = {
  book: BookMarked,
  article: Newspaper,
  word_set: Layers,
  script: FileText,
}

const TYPE_TABS: MaterialType[] = ['book', 'article', 'word_set', 'script']

function keyOf(type: MaterialType, id: string): string {
  return `${type}:${id}`
}

export function PlanClient({
  initialItems,
  materials,
}: {
  initialItems: PlanItem[]
  materials: AvailableMaterials
}) {
  const [items, setItems] = useState<PlanItem[]>(initialItems)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // 추가 picker
  const [activeTab, setActiveTab] = useState<MaterialType>('book')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [pickedActivities, setPickedActivities] = useState<Set<PlanActivity>>(new Set())
  const [pickedChapters, setPickedChapters] = useState<Set<number>>(new Set())
  const [pickedWeekdays, setPickedWeekdays] = useState<Set<number>>(new Set())
  const [bandFilter, setBandFilter] = useState<VBand | 'all'>('all')
  const [subFilter, setSubFilter] = useState<string | null>(null) // article=source · word_set=category
  const [adding, setAdding] = useState(false)

  const addedKeys = useMemo(
    () => new Set(items.map((i) => keyOf(i.materialType, i.materialId))),
    [items],
  )

  const tabMaterials: Record<MaterialType, MaterialOption[]> = {
    book: materials.books,
    article: materials.articles,
    word_set: materials.wordSets,
    script: materials.scripts,
  }

  // 서브필터 옵션 — 스크립트=소스 / 단어장=주제
  const subFilterOptions: { value: string; label: string }[] =
    activeTab === 'article'
      ? (Array.from(new Set(materials.articles.map((a) => a.source).filter(Boolean))) as string[]).map(
          (v) => ({ value: v, label: articleSourceLabel(v) }),
        )
      : activeTab === 'word_set'
        ? (Array.from(new Set(materials.wordSets.map((w) => w.category).filter(Boolean))) as string[]).map(
            (v) => ({ value: v, label: wordsetCategoryLabel(v) }),
          )
        : []

  // 후보 = 담은 자료 제외 + 서브필터
  const candidates = tabMaterials[activeTab]
    .filter((m) => !addedKeys.has(keyOf(activeTab, m.id)))
    .filter((m) =>
      !subFilter ? true : (activeTab === 'article' ? m.source : m.category) === subFilter,
    )

  // V밴드 그룹 (입문→고급 + 레벨무관)
  const groupedBands: { key: VBand | 'none'; label: string; short: string; items: MaterialOption[] }[] = [
    ...V_BANDS.map((b) => ({ key: b.key as VBand | 'none', label: b.label, short: b.short, items: [] as MaterialOption[] })),
    { key: 'none' as const, label: '레벨 무관', short: '', items: [] as MaterialOption[] },
  ]
  for (const c of candidates) {
    const band = (c.vLevel ? vBandOf(c.vLevel) : null) ?? 'none'
    groupedBands.find((g) => g.key === band)?.items.push(c)
  }
  const visibleBands = groupedBands.filter(
    (g) => g.items.length > 0 && (bandFilter === 'all' || g.key === bandFilter),
  )

  function resetPicker() {
    setPickedId(null)
    setPickedActivities(new Set())
    setPickedChapters(new Set())
    setPickedWeekdays(new Set())
  }

  // 주간 overview — 요일별 자료 수 (담은 항목의 weekdays 집계, 읽기 전용)
  const weekdayCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const it of items) for (const d of it.weekdays) m.set(d, (m.get(d) ?? 0) + 1)
    return m
  }, [items])

  // ── 담은 자료: 활동/챕터/요일 수정 (즉시 저장) ──
  function persistItem(
    item: PlanItem,
    patch: { modules?: PlanActivity[]; chapters?: number[]; weekdays?: number[] },
  ) {
    const modules = patch.modules ?? item.modules
    const chapters = patch.chapters ?? item.chapters
    const weekdays = patch.weekdays ?? item.weekdays
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, modules, chapters, weekdays } : it)),
    )
    setError(null)
    startTransition(async () => {
      const res = await savePlanItem({
        materialType: item.materialType,
        materialId: item.materialId,
        modules,
        chapters,
        weekdays,
      })
      if (!res.ok) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, modules: item.modules, chapters: item.chapters, weekdays: item.weekdays }
              : it,
          ),
        )
        setError(res.error ?? '저장에 실패했어요.')
      }
    })
  }
  function toggleItemActivity(item: PlanItem, a: PlanActivity) {
    const has = item.modules.includes(a)
    persistItem(item, { modules: has ? item.modules.filter((m) => m !== a) : [...item.modules, a] })
  }
  function toggleItemChapter(item: PlanItem, n: number) {
    const has = item.chapters.includes(n)
    persistItem(item, {
      chapters: has ? item.chapters.filter((c) => c !== n) : [...item.chapters, n].sort((x, y) => x - y),
    })
  }
  function toggleItemWeekday(item: PlanItem, d: number) {
    const has = item.weekdays.includes(d)
    persistItem(item, {
      weekdays: has ? item.weekdays.filter((x) => x !== d) : [...item.weekdays, d].sort((x, y) => x - y),
    })
  }
  function handleRemove(item: PlanItem) {
    setItems((prev) => prev.filter((it) => it.id !== item.id))
    setError(null)
    startTransition(async () => {
      const res = await removePlanItem(item.id)
      if (!res.ok) {
        setItems((prev) => [...prev, item])
        setError(res.error ?? '삭제에 실패했어요.')
      }
    })
  }

  // ── 자료 추가 ──
  function pickMaterial(m: MaterialOption) {
    if (pickedId === m.id) {
      resetPicker()
      return
    }
    setPickedId(m.id)
    const defaults: PlanActivity[] =
      activeTab === 'word_set' ? ['vocab', 'flashcard'] : ['read', 'vocab', 'flashcard']
    setPickedActivities(new Set(defaults.filter((a) => activitiesForType(activeTab).includes(a))))
    setPickedChapters(new Set()) // 빈 = 전체
    setPickedWeekdays(new Set()) // 빈 = 요일 미정
  }
  function togglePicked(a: PlanActivity) {
    setPickedActivities((prev) => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a)
      else next.add(a)
      return next
    })
  }
  function togglePickedChapter(n: number) {
    setPickedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }
  function togglePickedWeekday(d: number) {
    setPickedWeekdays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }
  function handleAdd() {
    if (!pickedId) return
    const m = tabMaterials[activeTab].find((x) => x.id === pickedId)
    if (!m) return
    const modules = Array.from(pickedActivities)
    if (modules.length === 0) {
      setError('활동을 하나 이상 골라 주세요.')
      return
    }
    const chapters = activeTab === 'book' ? Array.from(pickedChapters).sort((a, b) => a - b) : []
    const weekdays = Array.from(pickedWeekdays).sort((a, b) => a - b)
    setError(null)
    setAdding(true)
    const type = activeTab
    startTransition(async () => {
      const res = await savePlanItem({ materialType: type, materialId: m.id, modules, chapters, weekdays })
      setAdding(false)
      if (!res.ok) {
        setError(res.error ?? '추가에 실패했어요.')
        return
      }
      const newItem: PlanItem = {
        id: `tmp-${type}-${m.id}`,
        materialType: type,
        materialId: m.id,
        modules,
        title: m.title,
        subtitle: m.subtitle,
        href: materialHref({ type, id: m.id, slug: m.slug }),
        slug: m.slug,
        vLevel: m.vLevel,
        chapters,
        weekdays,
        chapterCount: m.chapterCount,
        coverUrl: m.coverUrl,
        coverEmoji: m.coverEmoji,
        source: m.source,
      }
      setItems((prev) => [...prev, newItem])
      resetPicker()
    })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 md:py-12">
      {/* Hero */}
      <header>
        <span
          className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-lg)] bg-[var(--p-light)] text-[var(--p)]"
          aria-hidden
        >
          <Sparkles size={20} strokeWidth={1.75} />
        </span>
        <h1 className="font-display text-[24px] font-[800] text-[var(--t1)]">나의 학습 계획</h1>
        <p className="mt-2 font-english text-[15px] italic leading-relaxed text-[var(--t2)]">
          언제·무엇을·어떻게 — 마음 가는 자료를 고르고 나만의 리듬을 정해요.
        </p>
      </header>

      {error && (
        <p role="alert" className="font-body text-[13px] text-[var(--error)]">
          {error}
        </p>
      )}

      {/* 주간 overview — 요일별 학습 자료 수 (담은 항목 집계, 읽기 전용) */}
      {items.length > 0 && <WeeklyOverview counts={weekdayCounts} />}

      {/* 담은 자료 */}
      <section aria-label="내 학습 계획" className="flex flex-col gap-3">
        <h2 className="font-display text-[13px] font-[800] uppercase tracking-[0.06em] text-[var(--t3)]">
          담은 자료 {items.length > 0 && <span className="text-[var(--p)]">{items.length}</span>}
        </h2>
        {items.length === 0 ? (
          <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] px-5 py-8 text-center">
            <p className="font-body text-[14px] text-[var(--t3)]">
              아직 담은 자료가 없어요. 아래에서 골라 담아 보세요.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <PlanItemCard
                key={item.id}
                item={item}
                onToggleActivity={(a) => toggleItemActivity(item, a)}
                onToggleChapter={(n) => toggleItemChapter(item, n)}
                onToggleWeekday={(d) => toggleItemWeekday(item, d)}
                onRemove={() => handleRemove(item)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 자료 추가 */}
      <section
        aria-label="자료 추가"
        className="flex flex-col gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
      >
        <h2 className="flex items-center gap-1.5 font-display text-[15px] font-[800] text-[var(--t1)]">
          <Plus size={16} strokeWidth={2} className="text-[var(--p)]" aria-hidden /> 자료 추가
        </h2>

        {/* 자료유형 탭 */}
        <div role="tablist" aria-label="자료 유형" className="flex flex-wrap gap-2">
          {TYPE_TABS.map((t) => {
            const Icon = MATERIAL_ICON[t]
            const active = activeTab === t
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => {
                  setActiveTab(t)
                  resetPicker()
                  setBandFilter('all')
                  setSubFilter(null)
                }}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--r-md)] border px-3.5 font-display text-[13px] font-[700] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                  active
                    ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
                    : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
                }`}
              >
                <Icon size={14} strokeWidth={1.75} aria-hidden />
                {MATERIAL_LABEL[t]}
                <span className="font-mono text-[11px] opacity-70">{tabMaterials[t].length}</span>
              </button>
            )
          })}
        </div>

        {/* V밴드 필터 (모든 탭 공통) */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip label="전체 레벨" active={bandFilter === 'all'} onClick={() => setBandFilter('all')} />
          {V_BANDS.map((b) => (
            <FilterChip
              key={b.key}
              label={`${b.label} ${b.short}`}
              active={bandFilter === b.key}
              onClick={() => setBandFilter(b.key)}
            />
          ))}
        </div>

        {/* 서브필터 — 스크립트 소스 / 단어장 주제 */}
        {subFilterOptions.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="전체" small active={subFilter === null} onClick={() => setSubFilter(null)} />
            {subFilterOptions.map((o) => (
              <FilterChip
                key={o.value}
                label={o.label}
                small
                active={subFilter === o.value}
                onClick={() => setSubFilter(o.value)}
              />
            ))}
          </div>
        )}

        {/* V밴드 섹션 그룹 — 나열식이 아니라 레벨별 구조 */}
        {visibleBands.length === 0 ? (
          <p className="px-1 py-3 font-body text-[13px] text-[var(--t3)]">
            {tabMaterials[activeTab].length === 0
              ? activeTab === 'script'
                ? '내 스크립트가 아직 없어요. 스크립트를 등록하면 여기 나타나요.'
                : '표시할 자료가 없어요.'
              : '조건에 맞는 자료가 없어요. 필터를 바꿔 보세요.'}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleBands.map((g) => (
              <div key={g.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-[12px] font-[800] text-[var(--t2)]">{g.label}</h3>
                  {g.short && <span className="font-mono text-[10px] text-[var(--t3)]">{g.short}</span>}
                  <span className="font-mono text-[10px] text-[var(--t3)]">· {g.items.length}</span>
                  <span className="h-px flex-1 bg-[var(--bd)]" aria-hidden />
                </div>
                {activeTab === 'book' ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {g.items.map((m) => (
                      <BookGridItem key={m.id} m={m} picked={pickedId === m.id} onPick={() => pickMaterial(m)} />
                    ))}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {g.items.map((m) => (
                      <MaterialRow key={m.id} m={m} type={activeTab} picked={pickedId === m.id} onPick={() => pickMaterial(m)} />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 선택 자료 구성 (챕터 + 활동) */}
        {pickedId &&
          (() => {
            const m = tabMaterials[activeTab].find((x) => x.id === pickedId)
            if (!m) return null
            return (
              <div className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p-light)] p-4">
                <p className="font-display text-[13px] font-[800] text-[var(--t1)]">
                  {m.title}
                </p>

                {/* 도서 챕터 선택 */}
                {activeTab === 'book' && m.chapterCount > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="font-body text-[12px] text-[var(--t3)]">
                      챕터 — 안 고르면 전체 ({m.chapterCount}개)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: m.chapterCount }, (_, i) => i + 1).map((n) => (
                        <ChapterChip
                          key={n}
                          n={n}
                          selected={pickedChapters.has(n)}
                          onClick={() => togglePickedChapter(n)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 활동 선택 */}
                <div className="flex flex-col gap-1.5">
                  <p className="font-body text-[12px] text-[var(--t3)]">이 자료로 할 활동</p>
                  <div className="flex flex-wrap gap-2">
                    {activitiesForType(activeTab).map((a) => (
                      <ActivityChip
                        key={a}
                        activity={a}
                        selected={pickedActivities.has(a)}
                        onClick={() => togglePicked(a)}
                      />
                    ))}
                  </div>
                </div>

                {/* 요일 선택 (자료와 결합) */}
                <div className="flex flex-col gap-1.5">
                  <p className="font-body text-[12px] text-[var(--t3)]">학습 요일 — 안 고르면 요일 미정</p>
                  <WeekdayChips selected={pickedWeekdays} onToggle={togglePickedWeekday} />
                </div>

                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={adding || pickedActivities.size === 0}
                  className="inline-flex h-11 items-center justify-center gap-1.5 self-start rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--ti)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {adding
                    ? '담는 중…'
                    : `계획에 추가 (${pickedActivities.size}활동${
                        activeTab === 'book' && pickedChapters.size > 0 ? ` · ${pickedChapters.size}챕터` : ''
                      }${pickedWeekdays.size > 0 ? ` · ${pickedWeekdays.size}일` : ''})`}
                </button>
              </div>
            )
          })()}
      </section>
    </div>
  )
}

// ── 주간 overview (담은 자료의 요일 집계, 읽기 전용) ──
function WeeklyOverview({ counts }: { counts: Map<number, number> }) {
  return (
    <section
      aria-label="주간 계획"
      className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[rgba(59,130,246,0.2)] bg-gradient-to-br from-[var(--p-light)] to-[var(--bg2)] p-4"
    >
      <h2 className="flex items-center gap-1.5 font-display text-[13px] font-[800] text-[var(--t1)]">
        <CalendarDays size={15} strokeWidth={1.75} className="text-[var(--p)]" aria-hidden /> 주간 계획
      </h2>
      <div className="flex justify-between gap-1">
        {WEEKDAYS.map((d) => {
          const n = counts.get(d.value) ?? 0
          return (
            <div key={d.value} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={`font-display text-[12px] font-[700] ${n > 0 ? 'text-[var(--p)]' : 'text-[var(--t3)]'}`}
              >
                {d.label}
              </span>
              <span
                className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1 font-mono text-[11px] font-[700] tabular-nums ${
                  n > 0 ? 'bg-[var(--p)] text-[var(--ti)]' : 'bg-[var(--bg3)] text-[var(--t3)]'
                }`}
              >
                {n > 0 ? n : '·'}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── 요일 칩 (월~일 토글) — 추가 패널 + 카드 공용 ──
function WeekdayChips({
  selected,
  onToggle,
}: {
  selected: Set<number> | number[]
  onToggle: (d: number) => void
}) {
  const has = (d: number) => (Array.isArray(selected) ? selected.includes(d) : selected.has(d))
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((d) => {
        const on = has(d.value)
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => onToggle(d.value)}
            aria-pressed={on}
            aria-label={`${d.label}요일`}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border font-display text-[12px] font-[700] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
              on
                ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
                : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
            }`}
          >
            {d.label}
          </button>
        )
      })}
    </div>
  )
}

// ── 도서 표지 (img + onError 폴백) ──
function Cover({ url, title, className }: { url: string | null; title: string; className?: string }) {
  const [broken, setBroken] = useState(false)
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${title} 표지`}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`object-cover ${className ?? ''}`}
      />
    )
  }
  return (
    <span
      className={`flex items-center justify-center bg-gradient-to-br from-[var(--p-light)] to-[var(--bg3)] text-[var(--p)] ${className ?? ''}`}
      aria-hidden
    >
      <BookMarked size={20} strokeWidth={1.5} />
    </span>
  )
}

// ── 도서 그리드 아이템 (표지) ──
function BookGridItem({ m, picked, onPick }: { m: MaterialOption; picked: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      className={`group flex flex-col gap-1.5 rounded-[var(--r-md)] border p-1.5 text-left transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
        picked ? 'border-[var(--p)] bg-[var(--p-light)]' : 'border-transparent hover:border-[var(--bd)]'
      }`}
    >
      <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-[var(--r-sm)] border border-[var(--bd)]">
        <Cover url={m.coverUrl} title={m.title} className="h-full w-full transition-transform duration-[var(--dur-normal)] group-hover:scale-[1.04]" />
        {picked && (
          <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--p)] text-[var(--ti)]" aria-hidden>
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="line-clamp-2 px-0.5 font-display text-[11px] font-[700] leading-tight text-[var(--t1)]">
        {m.title}
      </span>
    </button>
  )
}

// ── 비-도서 목록 행 ──
function MaterialRow({
  m,
  type,
  picked,
  onPick,
}: {
  m: MaterialOption
  type: MaterialType
  picked: boolean
  onPick: () => void
}) {
  return (
    <li
      className={`rounded-[var(--r-md)] border transition-colors duration-[var(--dur-normal)] ${
        picked ? 'border-[var(--p)] bg-[var(--p-light)]' : 'border-[var(--bd)] bg-[var(--bg2)]'
      }`}
    >
      <button
        type="button"
        onClick={onPick}
        aria-expanded={picked}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <MaterialBadge type={type} m={m} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-[14px] font-[700] text-[var(--t1)]">{m.title}</span>
          {m.subtitle && (
            <span className="truncate font-body text-[12px] text-[var(--t3)]">{m.subtitle}</span>
          )}
        </span>
        {m.vLevel != null && m.vLevel > 0 && (
          <span className="shrink-0 rounded-[var(--r-sm)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[11px] font-[700] text-[var(--t2)]">
            V{m.vLevel}
          </span>
        )}
        <span className={`shrink-0 transition-transform duration-[var(--dur-normal)] ${picked ? 'rotate-45' : ''}`} aria-hidden>
          <Plus size={16} strokeWidth={2} className="text-[var(--p)]" />
        </span>
      </button>
    </li>
  )
}

/** 목록 행 좌측 배지 — 스크립트=소스/Newspaper · 단어장=이모지 · 내 글=FileText */
function MaterialBadge({ type, m }: { type: MaterialType; m: MaterialOption }) {
  if (type === 'word_set' && m.coverEmoji) {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg)] text-[18px]" aria-hidden>
        {m.coverEmoji}
      </span>
    )
  }
  const Icon = type === 'article' ? Newspaper : type === 'word_set' ? Layers : FileText
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--p)]" aria-hidden>
      <Icon size={16} strokeWidth={1.75} />
    </span>
  )
}

// ── 담은 자료 카드 ──
function PlanItemCard({
  item,
  onToggleActivity,
  onToggleChapter,
  onToggleWeekday,
  onRemove,
}: {
  item: PlanItem
  onToggleActivity: (a: PlanActivity) => void
  onToggleChapter: (n: number) => void
  onToggleWeekday: (d: number) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const allowed = activitiesForType(item.materialType)
  const ref = { type: item.materialType, id: item.materialId, slug: item.slug }
  const selected = PLAN_ACTIVITIES.filter((a) => item.modules.includes(a.id))
  const isBook = item.materialType === 'book'
  const hasChapters = isBook && item.chapterCount > 1

  return (
    <article className="flex gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 shadow-[var(--sh-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)]">
      {/* 좌측 비주얼 */}
      <div className="shrink-0">
        {isBook ? (
          <Cover url={item.coverUrl} title={item.title} className="h-[72px] w-[48px] rounded-[var(--r-sm)] border border-[var(--bd)]" />
        ) : item.materialType === 'word_set' && item.coverEmoji ? (
          <span className="inline-flex h-[48px] w-[48px] items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg2)] text-[22px]" aria-hidden>
            {item.coverEmoji}
          </span>
        ) : (
          <span className="inline-flex h-[48px] w-[48px] items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--p)]" aria-hidden>
            <MaterialTypeIcon type={item.materialType} />
          </span>
        )}
      </div>

      {/* 본문 */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <header className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-display text-[14px] font-[800] text-[var(--t1)]">{item.title}</span>
              <span className="shrink-0 rounded-[var(--r-sm)] bg-[var(--bg3)] px-1.5 py-0.5 font-display text-[10px] font-[700] text-[var(--t3)]">
                {MATERIAL_LABEL[item.materialType]}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-x-2 font-body text-[12px] text-[var(--t3)]">
              {item.subtitle && <span className="truncate">{item.subtitle}</span>}
              {hasChapters && (
                <span className="text-[var(--p)]">
                  {item.chapters.length === 0 ? '전체 챕터' : `Ch ${item.chapters.join('·')}`}
                </span>
              )}
              <span className={item.weekdays.length > 0 ? 'font-[700] text-[var(--p)]' : 'text-[var(--t3)]'}>
                {item.weekdays.length > 0
                  ? item.weekdays.map((d) => weekdayLabel(d)).join('·')
                  : '요일 미정'}
              </span>
            </span>
          </div>
          <Link
            href={item.href}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-2.5 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            열기 <ExternalLink size={12} strokeWidth={2} aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            aria-label="활동·챕터 편집"
            title="편집"
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] transition-colors duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
              editing ? 'bg-[var(--p)] text-[var(--ti)]' : 'text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--p)]'
            }`}
          >
            <Pencil size={14} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${item.title} 계획에서 빼기`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <Trash2 size={14} strokeWidth={1.75} aria-hidden />
          </button>
        </header>

        {editing ? (
          <div className="flex flex-col gap-2.5 border-t border-[var(--bd)] pt-2.5">
            {hasChapters && (
              <div className="flex flex-col gap-1.5">
                <p className="font-body text-[12px] text-[var(--t3)]">챕터 (안 고르면 전체)</p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: item.chapterCount }, (_, i) => i + 1).map((n) => (
                    <ChapterChip key={n} n={n} selected={item.chapters.includes(n)} onClick={() => onToggleChapter(n)} />
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <p className="font-body text-[12px] text-[var(--t3)]">활동 (켜고 끄면 바로 저장)</p>
              <div className="flex flex-wrap gap-1.5">
                {allowed.map((a) => (
                  <ActivityChip key={a} activity={a} selected={item.modules.includes(a)} onClick={() => onToggleActivity(a)} small />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="font-body text-[12px] text-[var(--t3)]">학습 요일</p>
              <WeekdayChips selected={item.weekdays} onToggle={onToggleWeekday} />
            </div>
          </div>
        ) : selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((a) => (
              <LaunchChip
                key={a.id}
                activity={a.id}
                href={activityLaunchHref(ref, a.id)}
                scoped={isActivityScoped(item.materialType, a.id)}
              />
            ))}
          </div>
        ) : (
          <p className="font-body text-[13px] text-[var(--t3)]">
            아직 활동이 없어요.{' '}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-display font-[700] text-[var(--p)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              편집
            </button>
            에서 골라요.
          </p>
        )}
      </div>
    </article>
  )
}

function MaterialTypeIcon({ type }: { type: MaterialType }) {
  const Icon = MATERIAL_ICON[type]
  return <Icon size={20} strokeWidth={1.5} aria-hidden />
}

// ── 칩들 ──
function FilterChip({
  label,
  active,
  onClick,
  small,
}: {
  label: string
  active: boolean
  onClick: () => void
  small?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full border font-display font-[700] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
        small ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-[12px]'
      } ${
        active
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
          : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
      }`}
    >
      {label}
    </button>
  )
}

function ChapterChip({ n, selected, onClick }: { n: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex h-8 min-w-[40px] items-center justify-center rounded-[var(--r-sm)] border px-2 font-mono text-[12px] font-[700] tabular-nums transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
        selected
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
          : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
      }`}
    >
      {n}
    </button>
  )
}

/** 활동 토글 칩 — 선택 시 채움 + 체크. 색상 외 아이콘으로도 구분(색맹 대응). */
function ActivityChip({
  activity,
  selected,
  onClick,
  small,
}: {
  activity: PlanActivity
  selected: boolean
  onClick: () => void
  small?: boolean
}) {
  const def = ACTIVITY_BY_ID[activity]
  const Icon = ACTIVITY_ICON[def.icon] ?? Layers
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={def.layer}
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-md)] border px-2.5 font-display font-[700] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
        small ? 'text-[12px]' : 'text-[13px]'
      } ${
        selected
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
          : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
      }`}
    >
      {selected ? <Check size={13} strokeWidth={2.5} aria-hidden /> : <Icon size={13} strokeWidth={1.75} aria-hidden />}
      {def.label}
    </button>
  )
}

/** 선택 활동 실행 링크 — scoped(이 자료로 바로)=Play / hub(모듈에서)=↗. 아이콘으로 구분. */
function LaunchChip({ activity, href, scoped }: { activity: PlanActivity; href: string; scoped: boolean }) {
  const def = ACTIVITY_BY_ID[activity]
  const Icon = ACTIVITY_ICON[def.icon] ?? Layers
  return (
    <Link
      href={href}
      title={scoped ? `${def.label} — 이 자료로 바로 시작` : `${def.label} — 모듈에서 시작`}
      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <Icon size={13} strokeWidth={1.75} aria-hidden />
      {def.label}
      {scoped ? (
        <Play size={11} strokeWidth={2} className="text-[var(--p)] opacity-80" aria-hidden />
      ) : (
        <ExternalLink size={11} strokeWidth={2} className="opacity-50" aria-hidden />
      )}
    </Link>
  )
}
