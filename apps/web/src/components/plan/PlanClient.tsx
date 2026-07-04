// apps/web/src/components/plan/PlanClient.tsx
// 학습 계획 — 컴포저 + 주간 보드 (나열식 탈피, 한눈에 클릭클릭).
//   · 주간 보드: 담은 자료를 요일(월~일, 이번 주 날짜 병기)에 배치 — 칩에 활동 아이콘·챕터 배지.
//   · 컴포저(2-pane): 좌=자료 고르기(탭·V밴드·표지) / 우=챕터 리스트(제목)·활동·요일 칩 한 화면.
// 데이터: study_plan_items(modules/chapters/weekdays) + library_chapters_master(챕터 제목).
// Calm UI · 색+아이콘 이중(색맹) · 날짜는 서버 KST 산출 주입(하이드레이션 안전).

'use client'

import {
  BookMarked,
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  Layers,
  ListChecks,
  Newspaper,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'

import { ACTIVITY_ICON, MATERIAL_ICON } from '@/lib/learner/activity-icons'

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
  fetchBookChapters,
  removePlanItem,
  savePlanItem,
  type AvailableMaterials,
  type BookChapter,
  type MaterialOption,
  type PlanItem,
} from '@/lib/learner/plan-actions'

const TYPE_TABS: MaterialType[] = ['book', 'article', 'word_set', 'script']

interface Draft {
  type: MaterialType
  option: MaterialOption
  activities: Set<PlanActivity>
  chapters: Set<number>
  weekdays: Set<number>
}

function defaultActivities(type: MaterialType): Set<PlanActivity> {
  const base: PlanActivity[] = type === 'word_set' ? ['vocab', 'flashcard'] : ['read', 'vocab', 'flashcard']
  return new Set(base.filter((a) => activitiesForType(type).includes(a)))
}

export function PlanClient({
  initialItems,
  materials,
  todayWeekday,
  weekDates,
}: {
  initialItems: PlanItem[]
  materials: AvailableMaterials
  todayWeekday: number
  /** 이번 주(월~일) 날짜 'M/D' 7개 — index 0=월 (서버 KST 산출) */
  weekDates: string[]
}) {
  const [items, setItems] = useState<PlanItem[]>(initialItems)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // 컴포저 상태 — draft(신규 자료) 또는 editId(담은 자료) 중 하나만 활성
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // picker
  const [activeTab, setActiveTab] = useState<MaterialType>('book')
  const [bandFilter, setBandFilter] = useState<VBand | 'all'>('all')
  const [subFilter, setSubFilter] = useState<string | null>(null)

  const editItem = items.find((i) => i.id === editId) ?? null
  /** 담은 자료 — picker 에서 숨기지 않고 '담김' 배지 + 클릭=편집으로 연결 */
  const addedByKey = new Map(items.map((i) => [`${i.materialType}:${i.materialId}`, i]))

  const tabMaterials: Record<MaterialType, MaterialOption[]> = {
    book: materials.books,
    article: materials.articles,
    word_set: materials.wordSets,
    script: materials.scripts,
  }

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

  const candidates = tabMaterials[activeTab]
    .filter((m) => (!subFilter ? true : (activeTab === 'article' ? m.source : m.category) === subFilter))
    .filter((m) => bandFilter === 'all' || ((m.vLevel ? vBandOf(m.vLevel) : null) ?? 'none') === bandFilter)

  // 탭별 그룹핑 — 도서/내 스크립트=V밴드, 스크립트=소스별, 공용단어장=카테고리별
  interface PickerGroup {
    key: string
    label: string
    short?: string
    items: MaterialOption[]
  }
  let groups: PickerGroup[]
  if (activeTab === 'article') {
    const order = ['voa', 'nasa', 'nih', 'simple_wikipedia', 'wikinews', 'the_conversation']
    const bySource = new Map<string, MaterialOption[]>()
    for (const c of candidates) {
      const k = c.source ?? 'etc'
      if (!bySource.has(k)) bySource.set(k, [])
      bySource.get(k)!.push(c)
    }
    const keys = Array.from(bySource.keys()).sort(
      (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
    )
    groups = keys.map((k) => ({ key: k, label: articleSourceLabel(k), items: bySource.get(k)! }))
  } else if (activeTab === 'word_set') {
    const order = ['csat', 'eng_test', 'elementary', 'middle', 'high', 'themed', 'library_book', 'library_article']
    const byCat = new Map<string, MaterialOption[]>()
    for (const c of candidates) {
      const k = c.category ?? 'etc'
      if (!byCat.has(k)) byCat.set(k, [])
      byCat.get(k)!.push(c)
    }
    const keys = Array.from(byCat.keys()).sort(
      (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
    )
    groups = keys.map((k) => ({ key: k, label: wordsetCategoryLabel(k), items: byCat.get(k)! }))
  } else {
    const bands: PickerGroup[] = [
      ...V_BANDS.map((b) => ({ key: b.key as string, label: b.label, short: b.short, items: [] as MaterialOption[] })),
      { key: 'none', label: '레벨 무관', items: [] as MaterialOption[] },
    ]
    for (const c of candidates) {
      const band = ((c.vLevel ? vBandOf(c.vLevel) : null) ?? 'none') as string
      bands.find((g) => g.key === band)?.items.push(c)
    }
    groups = bands
  }
  const visibleGroups = groups.filter((g) => g.items.length > 0)

  // ── 선택/구성 ──
  /** picker 클릭 — 이미 담은 자료면 그 항목 편집으로, 아니면 신규 draft */
  function pickMaterial(m: MaterialOption) {
    const existing = addedByKey.get(`${activeTab}:${m.id}`)
    if (existing) {
      editExisting(existing)
      return
    }
    pickNew(m)
  }

  function pickNew(m: MaterialOption) {
    setEditId(null)
    setError(null)
    if (draft?.option.id === m.id && draft.type === activeTab) {
      setDraft(null)
      return
    }
    setDraft({
      type: activeTab,
      option: m,
      activities: defaultActivities(activeTab),
      chapters: new Set(),
      // 기본 요일 = 오늘 — 담자마자 '요일 미정'에 떨어지지 않게 (해제하면 미정으로 담김)
      weekdays: new Set([todayWeekday]),
    })
  }
  function editExisting(item: PlanItem) {
    setDraft(null)
    setError(null)
    setEditId((cur) => (cur === item.id ? null : item.id))
  }
  function closeComposer() {
    setDraft(null)
    setEditId(null)
  }

  function patchDraft(patch: Partial<Pick<Draft, 'activities' | 'chapters' | 'weekdays'>>) {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }

  function commitDraft() {
    if (!draft) return
    const modules = Array.from(draft.activities)
    if (modules.length === 0) {
      setError('활동을 하나 이상 골라 주세요.')
      return
    }
    const chapters = draft.type === 'book' ? Array.from(draft.chapters).sort((a, b) => a - b) : []
    const weekdays = Array.from(draft.weekdays).sort((a, b) => a - b)
    const m = draft.option
    const type = draft.type
    setError(null)
    setAdding(true)
    startTransition(async () => {
      const res = await savePlanItem({ materialType: type, materialId: m.id, modules, chapters, weekdays })
      setAdding(false)
      if (!res.ok) {
        setError(res.error ?? '추가에 실패했어요.')
        return
      }
      const tmpId = `tmp-${type}-${m.id}`
      const newItem: PlanItem = {
        id: tmpId,
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
      setDraft(null)
      setEditId(tmpId) // 담은 뒤 바로 편집 상태 유지
    })
  }

  // 담은 항목 즉시 저장(수정)
  function persistItem(item: PlanItem, patch: { modules?: PlanActivity[]; chapters?: number[]; weekdays?: number[] }) {
    const modules = patch.modules ?? item.modules
    const chapters = patch.chapters ?? item.chapters
    const weekdays = patch.weekdays ?? item.weekdays
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, modules, chapters, weekdays } : it)))
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
  function removeItem(item: PlanItem) {
    setItems((prev) => prev.filter((it) => it.id !== item.id))
    if (editId === item.id) setEditId(null)
    setError(null)
    startTransition(async () => {
      const res = await removePlanItem(item.id)
      if (!res.ok) {
        setItems((prev) => [...prev, item])
        setError(res.error ?? '삭제에 실패했어요.')
      }
    })
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 md:py-10">
      {/* Hero */}
      <header>
        <h1 className="flex items-center gap-2 font-display text-[22px] font-[800] text-[var(--t1)]">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--p-light)] text-[var(--p)]"
            aria-hidden
          >
            <Sparkles size={18} strokeWidth={1.75} />
          </span>
          나의 학습 계획
        </h1>
        <p className="mt-1.5 font-english text-[14px] italic text-[var(--t2)]">
          자료를 고르고 — 챕터·활동·요일을 클릭, 주간 보드에 쌓여요.
        </p>
      </header>

      {error && (
        <p role="alert" className="font-body text-[13px] text-[var(--error)]">
          {error}
        </p>
      )}

      {/* 오늘의 학습 */}
      {items.length > 0 && <TodayStrip items={items} today={todayWeekday} weekDates={weekDates} />}

      {/* 주간 보드 */}
      <WeekBoard
        items={items}
        editId={editId}
        today={todayWeekday}
        weekDates={weekDates}
        onSelect={editExisting}
      />

      {/* 컴포저 (2-pane) */}
      <section
        aria-label="자료 추가·구성"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {/* 좌: 고르기 */}
        <div className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]">
          <h2 className="flex items-center gap-1.5 font-display text-[14px] font-[800] text-[var(--t1)]">
            <Plus size={15} strokeWidth={2} className="text-[var(--p)]" aria-hidden /> 자료 고르기
          </h2>

          <div role="tablist" aria-label="자료 유형" className="flex flex-wrap gap-1.5">
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
                    setBandFilter('all')
                    setSubFilter(null)
                  }}
                  className={`inline-flex min-h-[36px] items-center gap-1 rounded-[var(--r-md)] border px-2.5 font-display text-[12px] font-[700] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                    active
                      ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
                      : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
                  }`}
                >
                  <Icon size={13} strokeWidth={1.75} aria-hidden />
                  {MATERIAL_LABEL[t]}
                  <span className="font-mono text-[10px] opacity-70">{tabMaterials[t].length}</span>
                </button>
              )
            })}
          </div>

          {/* V밴드 필터 */}
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="전체" small active={bandFilter === 'all'} onClick={() => setBandFilter('all')} />
            {V_BANDS.map((b) => (
              <FilterChip
                key={b.key}
                label={b.label}
                small
                active={bandFilter === b.key}
                onClick={() => setBandFilter(b.key)}
              />
            ))}
          </div>

          {/* 서브필터 */}
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

          {/* 그룹 섹션 (도서=V밴드 · 스크립트=소스 · 단어장=카테고리) */}
          <div className="max-h-[420px] overflow-y-auto pr-1">
            {visibleGroups.length === 0 ? (
              <p className="px-1 py-3 font-body text-[13px] text-[var(--t3)]">
                {tabMaterials[activeTab].length === 0
                  ? activeTab === 'script'
                    ? '내 스크립트가 아직 없어요.'
                    : '표시할 자료가 없어요.'
                  : '조건에 맞는 자료가 없어요. 필터를 바꿔 보세요.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {visibleGroups.map((g) => (
                  <div key={g.key} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-[11px] font-[800] text-[var(--t2)]">{g.label}</h3>
                      {g.short && <span className="font-mono text-[10px] text-[var(--t3)]">{g.short}</span>}
                      <span className="font-mono text-[10px] text-[var(--t3)]">{g.items.length}</span>
                      <span className="h-px flex-1 bg-[var(--bd)]" aria-hidden />
                    </div>
                    {activeTab === 'book' ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {g.items.map((m) => {
                          const added = addedByKey.get(`${activeTab}:${m.id}`)
                          return (
                            <BookGridItem
                              key={m.id}
                              m={m}
                              picked={draft?.option.id === m.id}
                              added={!!added}
                              editing={!!added && editId === added.id}
                              onPick={() => pickMaterial(m)}
                            />
                          )
                        })}
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {g.items.map((m) => {
                          const added = addedByKey.get(`${activeTab}:${m.id}`)
                          return (
                            <MaterialRow
                              key={m.id}
                              m={m}
                              type={activeTab}
                              picked={draft?.option.id === m.id}
                              added={!!added}
                              editing={!!added && editId === added.id}
                              onPick={() => pickMaterial(m)}
                            />
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 우: 구성 */}
        <div className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]">
          {draft ? (
            <DraftConfig
              draft={draft}
              adding={adding}
              weekDates={weekDates}
              today={todayWeekday}
              onPatch={patchDraft}
              onCommit={commitDraft}
              onClose={closeComposer}
            />
          ) : editItem ? (
            <ItemConfig
              item={editItem}
              weekDates={weekDates}
              today={todayWeekday}
              onToggleActivity={(a) =>
                persistItem(editItem, {
                  modules: editItem.modules.includes(a)
                    ? editItem.modules.filter((m) => m !== a)
                    : [...editItem.modules, a],
                })
              }
              onToggleChapter={(n) =>
                persistItem(editItem, {
                  chapters: editItem.chapters.includes(n)
                    ? editItem.chapters.filter((c) => c !== n)
                    : [...editItem.chapters, n].sort((x, y) => x - y),
                })
              }
              onToggleWeekday={(d) =>
                persistItem(editItem, {
                  weekdays: editItem.weekdays.includes(d)
                    ? editItem.weekdays.filter((x) => x !== d)
                    : [...editItem.weekdays, d].sort((x, y) => x - y),
                })
              }
              onRemove={() => removeItem(editItem)}
              onClose={closeComposer}
            />
          ) : (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg2)] text-[var(--t3)]" aria-hidden>
                <Pencil size={18} strokeWidth={1.5} />
              </span>
              <p className="font-body text-[13px] text-[var(--t3)]">
                왼쪽에서 자료를 고르거나
                <br />
                위 보드의 담은 자료를 눌러 구성해요.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

// ── 오늘의 학습 (오늘 요일 항목 → 바로 시작) ──
function TodayStrip({ items, today, weekDates }: { items: PlanItem[]; today: number; weekDates: string[] }) {
  const todayItems = items.filter((i) => i.weekdays.includes(today))
  const dayLabel = weekdayLabel(today)
  return (
    <section
      aria-label="오늘의 학습"
      className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--p)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]"
    >
      <h2 className="flex items-center gap-1.5 font-display text-[14px] font-[800] text-[var(--t1)]">
        <CalendarDays size={15} strokeWidth={1.75} className="text-[var(--p)]" aria-hidden />
        오늘의 학습{' '}
        <span className="font-mono text-[12px] text-[var(--p)]">
          {weekDates[today - 1]} {dayLabel}요일
        </span>
      </h2>
      {todayItems.length === 0 ? (
        <p className="font-body text-[13px] text-[var(--t3)]">
          오늘({dayLabel})은 계획된 학습이 없어요 — 아래에서 자료에 {dayLabel}요일을 더해 보세요.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {todayItems.map((it) => (
            <TodayRow key={it.id} item={it} />
          ))}
        </div>
      )}
    </section>
  )
}

function TodayRow({ item }: { item: PlanItem }) {
  const ref = { type: item.materialType, id: item.materialId, slug: item.slug }
  const acts = PLAN_ACTIVITIES.filter((a) => item.modules.includes(a.id))
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5">
        <MiniMaterialGlyph item={item} />
        <span className="truncate font-display text-[13px] font-[800] text-[var(--t1)]">{item.title}</span>
        {item.materialType === 'book' && item.chapterCount > 1 && (
          <span className="font-mono text-[11px] text-[var(--t3)]">
            {item.chapters.length === 0 ? '전체' : `Ch ${item.chapters.join('·')}`}
          </span>
        )}
      </span>
      {acts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {acts.map((a) => (
            <LaunchChip
              key={a.id}
              activity={a.id}
              href={activityLaunchHref(ref, a.id)}
              scoped={isActivityScoped(item.materialType, a.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 주간 보드 ──
function WeekBoard({
  items,
  editId,
  today,
  weekDates,
  onSelect,
}: {
  items: PlanItem[]
  editId: string | null
  today: number
  weekDates: string[]
  onSelect: (item: PlanItem) => void
}) {
  const unscheduled = items.filter((i) => i.weekdays.length === 0)
  return (
    <section
      aria-label="주간 보드"
      className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[rgba(59,130,246,0.2)] bg-gradient-to-br from-[var(--p-light)] to-[var(--bg2)] p-3"
    >
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => {
          const dayItems = items.filter((i) => i.weekdays.includes(d.value))
          const isToday = d.value === today
          return (
            <div
              key={d.value}
              className={`flex min-h-[76px] flex-col gap-1 rounded-[var(--r-md)] p-1.5 ${
                isToday ? 'bg-[var(--bg)] ring-2 ring-[var(--p)]' : 'bg-[var(--bg)]'
              }`}
            >
              <span
                className={`text-center font-display text-[11px] font-[800] ${
                  isToday ? 'text-[var(--p)]' : 'text-[var(--t2)]'
                }`}
              >
                {d.label}
                {isToday && <span className="ml-0.5 align-top text-[8px]">오늘</span>}
              </span>
              <span
                className={`-mt-1 text-center font-mono text-[9px] tabular-nums ${
                  isToday ? 'text-[var(--p)]' : 'text-[var(--t3)]'
                }`}
              >
                {weekDates[d.value - 1]}
              </span>
              <div className="flex flex-col items-center gap-1">
                {dayItems.length === 0 ? (
                  <span className="font-mono text-[12px] text-[var(--t3)]" aria-hidden>
                    ·
                  </span>
                ) : (
                  dayItems.map((it) => (
                    <BoardChip key={it.id} item={it} active={editId === it.id} onClick={() => onSelect(it)} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {unscheduled.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-[rgba(59,130,246,0.2)] pt-2">
          <p className="font-body text-[11px] text-[var(--t3)]">
            <span className="font-display font-[700] text-[var(--t2)]">요일 미정</span> — 아직 요일을 안 정한
            계획이에요. 칩을 누르고 요일을 고르면 위 보드에 배치돼요.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {unscheduled.map((it) => (
              <BoardChip key={it.id} item={it} active={editId === it.id} onClick={() => onSelect(it)} wide />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** 보드 칩에 보여줄 활동 아이콘 최대 수 — 초과분은 +n 으로 접기 */
const CHIP_MAX_ICONS = 4

function BoardChip({
  item,
  active,
  onClick,
  wide,
}: {
  item: PlanItem
  active: boolean
  onClick: () => void
  wide?: boolean
}) {
  const acts = PLAN_ACTIVITIES.filter((a) => item.modules.includes(a.id))
  const shown = acts.slice(0, CHIP_MAX_ICONS)
  const overflow = acts.length - shown.length
  const hasChapters = item.materialType === 'book' && item.chapterCount > 1
  const chapterLabel = hasChapters ? (item.chapters.length === 0 ? '전체' : `${item.chapters.length}장`) : null
  const actLabels = acts.map((a) => a.label).join('·')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${item.title}${chapterLabel ? ` — 챕터 ${chapterLabel}` : ''}${actLabels ? ` — ${actLabels}` : ''}`}
      className={`flex max-w-full flex-col items-center gap-0.5 rounded-[var(--r-sm)] border px-1.5 py-1 transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
        active
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
          : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t1)] hover:border-[var(--p)]'
      } ${wide ? 'max-w-[240px]' : 'w-full'}`}
    >
      <span className={`flex max-w-full items-center gap-1 ${wide ? '' : 'justify-center'}`}>
        <MiniMaterialGlyph item={item} />
        {wide && <span className="truncate font-display text-[11px] font-[700]">{item.title}</span>}
      </span>
      {(shown.length > 0 || chapterLabel) && (
        <span
          className={`flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5 ${
            active ? 'text-[var(--ti)]' : 'text-[var(--t3)]'
          }`}
        >
          {chapterLabel && (
            <span className="inline-flex items-center gap-0.5 font-mono text-[9px] tabular-nums" aria-hidden>
              <ListChecks size={10} strokeWidth={2} />
              {chapterLabel}
            </span>
          )}
          {shown.map((a) => {
            const Icon = ACTIVITY_ICON[a.icon] ?? Layers
            return <Icon key={a.id} size={11} strokeWidth={2} aria-hidden />
          })}
          {overflow > 0 && (
            <span className="font-mono text-[9px]" aria-hidden>
              +{overflow}
            </span>
          )}
          <span className="sr-only">
            {chapterLabel ? `챕터 ${chapterLabel}, ` : ''}활동: {actLabels || '없음'}
          </span>
        </span>
      )}
    </button>
  )
}

function MiniMaterialGlyph({ item }: { item: PlanItem }) {
  if (item.materialType === 'word_set' && item.coverEmoji) {
    return <span className="text-[13px] leading-none" aria-hidden>{item.coverEmoji}</span>
  }
  if (item.materialType === 'book' && item.coverUrl) {
    return <Cover url={item.coverUrl} title={item.title} className="h-[22px] w-[16px] rounded-[2px]" />
  }
  const Icon = MATERIAL_ICON[item.materialType]
  return <Icon size={13} strokeWidth={1.75} aria-hidden />
}

// ── 우측 구성 — 신규 draft ──
function DraftConfig({
  draft,
  adding,
  weekDates,
  today,
  onPatch,
  onCommit,
  onClose,
}: {
  draft: Draft
  adding: boolean
  weekDates: string[]
  today: number
  onPatch: (p: Partial<Pick<Draft, 'activities' | 'chapters' | 'weekdays'>>) => void
  onCommit: () => void
  onClose: () => void
}) {
  const { type, option: m } = draft
  const toggleA = (a: PlanActivity) => {
    const next = new Set(draft.activities)
    if (next.has(a)) next.delete(a)
    else next.add(a)
    onPatch({ activities: next })
  }
  const toggleC = (n: number) => {
    const next = new Set(draft.chapters)
    if (next.has(n)) next.delete(n)
    else next.add(n)
    onPatch({ chapters: next })
  }
  const toggleW = (d: number) => {
    const next = new Set(draft.weekdays)
    if (next.has(d)) next.delete(d)
    else next.add(d)
    onPatch({ weekdays: next })
  }
  return (
    <div className="flex flex-col gap-3">
      <ConfigHeader title={m.title} subtitle={MATERIAL_LABEL[type]} onClose={onClose} />
      {type === 'book' && m.chapterCount > 1 && (
        <ConfigBlock label={`챕터 — 안 고르면 전체 (${m.chapterCount})`}>
          <ChapterList bookId={m.id} count={m.chapterCount} selected={draft.chapters} onToggle={toggleC} />
        </ConfigBlock>
      )}
      <ConfigBlock label="활동 (학습 수단)">
        <div className="flex flex-wrap gap-1.5">
          {activitiesForType(type).map((a) => (
            <ActivityChip key={a} activity={a} selected={draft.activities.has(a)} onClick={() => toggleA(a)} />
          ))}
        </div>
      </ConfigBlock>
      <ConfigBlock label="학습 요일 — 안 고르면 보드의 '요일 미정'에 담겨요">
        <WeekdayChips selected={draft.weekdays} weekDates={weekDates} today={today} onToggle={toggleW} />
      </ConfigBlock>
      <button
        type="button"
        onClick={onCommit}
        disabled={adding || draft.activities.size === 0}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--ti)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {adding
          ? '담는 중…'
          : `계획에 담기 (${draft.activities.size}활동${
              draft.weekdays.size > 0 ? ` · 주 ${draft.weekdays.size}일` : ' · 요일 미정'
            })`}
      </button>
    </div>
  )
}

// ── 우측 구성 — 담은 항목 편집 (즉시 저장) ──
function ItemConfig({
  item,
  weekDates,
  today,
  onToggleActivity,
  onToggleChapter,
  onToggleWeekday,
  onRemove,
  onClose,
}: {
  item: PlanItem
  weekDates: string[]
  today: number
  onToggleActivity: (a: PlanActivity) => void
  onToggleChapter: (n: number) => void
  onToggleWeekday: (d: number) => void
  onRemove: () => void
  onClose: () => void
}) {
  const ref = { type: item.materialType, id: item.materialId, slug: item.slug }
  const selected = PLAN_ACTIVITIES.filter((a) => item.modules.includes(a.id))
  const hasChapters = item.materialType === 'book' && item.chapterCount > 1
  return (
    <div className="flex flex-col gap-3">
      <ConfigHeader
        title={item.title}
        subtitle={MATERIAL_LABEL[item.materialType]}
        onClose={onClose}
        right={
          <Link
            href={item.href}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-2.5 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-colors hover:border-[var(--p)] hover:text-[var(--p)]"
          >
            열기 <ExternalLink size={12} strokeWidth={2} aria-hidden />
          </Link>
        }
      />

      {hasChapters && (
        <ConfigBlock label="챕터 (안 고르면 전체)">
          <ChapterList
            bookId={item.materialId}
            count={item.chapterCount}
            selectedArr={item.chapters}
            onToggle={onToggleChapter}
          />
        </ConfigBlock>
      )}
      <ConfigBlock label="활동 (켜고 끄면 바로 저장)">
        <div className="flex flex-wrap gap-1.5">
          {activitiesForType(item.materialType).map((a) => (
            <ActivityChip key={a} activity={a} selected={item.modules.includes(a)} onClick={() => onToggleActivity(a)} small />
          ))}
        </div>
      </ConfigBlock>
      <ConfigBlock label="학습 요일">
        <WeekdayChips selected={item.weekdays} weekDates={weekDates} today={today} onToggle={onToggleWeekday} />
      </ConfigBlock>

      {selected.length > 0 && (
        <ConfigBlock label="바로 시작">
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
        </ConfigBlock>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[700] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--error)] hover:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <Trash2 size={13} strokeWidth={1.75} aria-hidden /> 계획에서 빼기
      </button>
    </div>
  )
}

// ── 구성 공용 ──
function ConfigHeader({
  title,
  subtitle,
  onClose,
  right,
}: {
  title: string
  subtitle: string
  onClose: () => void
  right?: React.ReactNode
}) {
  return (
    <header className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-display text-[15px] font-[800] text-[var(--t1)]">{title}</span>
        <span className="font-display text-[11px] font-[700] text-[var(--t3)]">{subtitle}</span>
      </div>
      {right}
      <button
        type="button"
        onClick={onClose}
        aria-label="구성 닫기"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--t3)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <X size={15} strokeWidth={2} aria-hidden />
      </button>
    </header>
  )
}

function ConfigBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-body text-[12px] text-[var(--t3)]">{label}</p>
      {children}
    </div>
  )
}

// ── 챕터 리스트 (번호 + 제목, 체크 선택) ──
// 제목은 library_chapters_master 에서 지연 로드 — 번호는 즉시 렌더, 제목이 도착하면 채워진다.
const chapterTitleCache = new Map<string, BookChapter[]>()

function ChapterList({
  bookId,
  count,
  selected,
  selectedArr,
  onToggle,
}: {
  bookId: string
  count: number
  selected?: Set<number>
  selectedArr?: number[]
  onToggle: (n: number) => void
}) {
  const [loaded, setLoaded] = useState<BookChapter[] | null>(chapterTitleCache.get(bookId) ?? null)
  useEffect(() => {
    const cached = chapterTitleCache.get(bookId)
    if (cached) {
      setLoaded(cached)
      return
    }
    let alive = true
    setLoaded(null)
    fetchBookChapters(bookId).then((cs) => {
      chapterTitleCache.set(bookId, cs)
      if (alive) setLoaded(cs)
    })
    return () => {
      alive = false
    }
  }, [bookId])

  const titleByIdx = new Map((loaded ?? []).map((c) => [c.idx, c.title]))
  const has = (n: number) => (selectedArr ? selectedArr.includes(n) : (selected?.has(n) ?? false))
  return (
    <ul className="flex max-h-[240px] flex-col gap-1 overflow-y-auto pr-1" aria-label="챕터 목록">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
        const on = has(n)
        const title = titleByIdx.get(n)
        return (
          <li key={n}>
            <button
              type="button"
              onClick={() => onToggle(n)}
              aria-pressed={on}
              className={`flex min-h-[40px] w-full items-center gap-2 rounded-[var(--r-sm)] border px-2 py-1 text-left transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                on
                  ? 'border-[var(--p)] bg-[var(--p-light)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--p)]'
              }`}
            >
              <span
                className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-[var(--dur-normal)] ${
                  on ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]' : 'border-[var(--bd)] bg-[var(--bg)]'
                }`}
                aria-hidden
              >
                {on && <Check size={12} strokeWidth={3} />}
              </span>
              <span
                className={`w-7 shrink-0 text-right font-mono text-[12px] font-[700] tabular-nums ${
                  on ? 'text-[var(--p)]' : 'text-[var(--t3)]'
                }`}
              >
                {n}
              </span>
              <span
                className={`min-w-0 flex-1 truncate font-body text-[13px] ${
                  on ? 'text-[var(--t1)]' : 'text-[var(--t2)]'
                }`}
              >
                {title ?? (loaded === null ? '…' : `${n}장`)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
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
      <BookMarked size={16} strokeWidth={1.5} />
    </span>
  )
}

function BookGridItem({
  m,
  picked,
  added,
  editing,
  onPick,
}: {
  m: MaterialOption
  picked: boolean
  /** 이미 계획에 담긴 자료 — 클릭하면 그 항목 편집으로 */
  added?: boolean
  editing?: boolean
  onPick: () => void
}) {
  const active = picked || editing
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      title={added ? `${m.title} — 계획에 담김 (클릭해 챕터·활동 수정)` : m.title}
      className={`group flex flex-col gap-1 rounded-[var(--r-md)] border p-1 text-left transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
        active ? 'border-[var(--p)] bg-[var(--p-light)]' : 'border-transparent hover:border-[var(--bd)]'
      }`}
    >
      <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-[var(--r-sm)] border border-[var(--bd)]">
        <Cover url={m.coverUrl} title={m.title} className="h-full w-full transition-transform duration-[var(--dur-normal)] group-hover:scale-[1.04]" />
        {(picked || added) && (
          <span
            className={`absolute right-1 top-1 inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[var(--ti)] ${
              picked || editing ? 'bg-[var(--p)]' : 'bg-[var(--p)]/85'
            }`}
            aria-hidden
          >
            <Check size={10} strokeWidth={3} />
            {added && !picked && <span className="font-display text-[8px] font-[800] leading-none">담김</span>}
          </span>
        )}
      </span>
      <span className="line-clamp-2 px-0.5 font-display text-[10px] font-[700] leading-tight text-[var(--t1)]">
        {m.title}
      </span>
    </button>
  )
}

function MaterialRow({
  m,
  type,
  picked,
  added,
  editing,
  onPick,
}: {
  m: MaterialOption
  type: MaterialType
  picked: boolean
  /** 이미 계획에 담긴 자료 — 클릭하면 그 항목 편집으로 */
  added?: boolean
  editing?: boolean
  onPick: () => void
}) {
  const active = picked || editing
  return (
    <li
      className={`rounded-[var(--r-md)] border transition-colors duration-[var(--dur-normal)] ${
        active ? 'border-[var(--p)] bg-[var(--p-light)]' : 'border-[var(--bd)] bg-[var(--bg2)]'
      }`}
    >
      <button
        type="button"
        onClick={onPick}
        aria-pressed={active}
        title={added ? `${m.title} — 계획에 담김 (클릭해 구성 수정)` : undefined}
        className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <MaterialBadge type={type} m={m} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-[13px] font-[700] text-[var(--t1)]">{m.title}</span>
          {m.subtitle && <span className="truncate font-body text-[11px] text-[var(--t3)]">{m.subtitle}</span>}
        </span>
        {m.vLevel != null && m.vLevel > 0 && (
          <span className="shrink-0 rounded-[var(--r-sm)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[10px] font-[700] text-[var(--t2)]">
            V{m.vLevel}
          </span>
        )}
        {added ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--p)] px-1.5 py-0.5 font-display text-[9px] font-[800] text-[var(--ti)]">
            <Check size={10} strokeWidth={3} aria-hidden /> 담김
          </span>
        ) : picked ? (
          <Check size={14} strokeWidth={2.5} className="shrink-0 text-[var(--p)]" aria-hidden />
        ) : (
          <Plus size={14} strokeWidth={2} className="shrink-0 text-[var(--p)]" aria-hidden />
        )}
      </button>
    </li>
  )
}

function MaterialBadge({ type, m }: { type: MaterialType; m: MaterialOption }) {
  if (type === 'word_set' && m.coverEmoji) {
    return (
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg)] text-[16px]" aria-hidden>
        {m.coverEmoji}
      </span>
    )
  }
  const Icon = type === 'article' ? Newspaper : type === 'word_set' ? Layers : FileText
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--p)]" aria-hidden>
      <Icon size={15} strokeWidth={1.75} />
    </span>
  )
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
      {/* 활동 아이콘은 선택 여부와 무관하게 항상 표시 — 보드 칩·바로 시작과 동일 연상 유지 */}
      <Icon size={13} strokeWidth={selected ? 2.25 : 1.75} aria-hidden />
      {def.label}
      {selected && <Check size={12} strokeWidth={3} aria-hidden />}
    </button>
  )
}

function WeekdayChips({
  selected,
  weekDates,
  today,
  onToggle,
}: {
  selected: Set<number> | number[]
  weekDates: string[]
  today: number
  onToggle: (d: number) => void
}) {
  const has = (d: number) => (Array.isArray(selected) ? selected.includes(d) : selected.has(d))
  return (
    <div role="group" aria-label="학습 요일 선택" className="grid w-full grid-cols-7 gap-1">
      {WEEKDAYS.map((d) => {
        const on = has(d.value)
        const isToday = d.value === today
        const date = weekDates[d.value - 1]
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => onToggle(d.value)}
            aria-pressed={on}
            aria-label={`${d.label}요일 ${date}${isToday ? ' (오늘)' : ''}`}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-[var(--r-md)] border transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
              on
                ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)] shadow-[var(--sh-sm)]'
                : isToday
                  ? 'border-[var(--p)] bg-[var(--bg)] text-[var(--t1)] hover:bg-[var(--p-light)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
            }`}
          >
            <span className="font-display text-[14px] font-[800] leading-none">{weekdayLabel(d.value)}</span>
            <span className={`font-mono text-[10px] leading-none tabular-nums ${on ? 'opacity-90' : 'text-[var(--t3)]'}`}>
              {date}
            </span>
            {/* 세 번째 슬롯(높이 고정) — 선택=체크(형태), 오늘=라벨. 색상 단독 전달 금지 */}
            <span className="flex h-[12px] items-center" aria-hidden>
              {on ? (
                <Check size={11} strokeWidth={3} />
              ) : isToday ? (
                <span className="font-display text-[8px] font-[800] text-[var(--p)]">오늘</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

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
