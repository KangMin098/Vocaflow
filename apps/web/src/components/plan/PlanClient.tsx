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
import { useEffect, useRef, useState, useTransition } from 'react'

import { ActivityGlyph } from '@/components/plan/ActivityGlyph'
import { MATERIAL_ICON } from '@/lib/learner/activity-icons'

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
import { V_BANDS, vBandOf } from '@/lib/library/genres'
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
  /** 구성 패널 — 보드/목록에서 선택하면 화면 밖일 때 스크롤로 데려온다 */
  const composerRef = useRef<HTMLElement | null>(null)
  function revealComposer() {
    // 이미 보이면 nearest 가 이동을 생략 — 화면 밖일 때만 부드럽게 이동
    setTimeout(() => composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30)
  }

  // picker — 분류 레일(좌) 선택 상태. 'all' = 전체(섹션 헤더로 그룹 표시)
  const [activeTab, setActiveTab] = useState<MaterialType>('book')
  const [rail, setRail] = useState<string>('all')
  // 스크립트 3단 드릴 선택 — 좌측 2열(소스·분류) 네비 + 우측 선택 영역(컨텐츠)이 공유
  const [artSrc, setArtSrc] = useState<string>('')
  const [artProg, setArtProg] = useState<string>('')
  // 스크립트 다건 선택 — 선택 id 집합 + 공유 활동·요일(일괄 담기). 도서/단어장은 단건 draft 유지.
  const [artSel, setArtSel] = useState<Set<string>>(() => new Set())
  const [artActs, setArtActs] = useState<Set<PlanActivity>>(() => defaultActivities('article'))
  const [artDays, setArtDays] = useState<Set<number>>(() => new Set([todayWeekday]))

  const editItem = items.find((i) => i.id === editId) ?? null
  /** 자료별 담긴 배치 수 — picker '계획 N' 배지 (다중 엔트리: 같은 자료 여러 배치 가능) */
  const countByKey = new Map<string, number>()
  for (const i of items) {
    const k = `${i.materialType}:${i.materialId}`
    countByKey.set(k, (countByKey.get(k) ?? 0) + 1)
  }

  const tabMaterials: Record<MaterialType, MaterialOption[]> = {
    book: materials.books,
    article: materials.articles,
    word_set: materials.wordSets,
    script: materials.scripts,
  }

  const candidates = tabMaterials[activeTab]
  // 소스 탭(스크립트·내 스크립트·공용단어장) — 소스별 분류 네비 + 우측 다건 선택 공유
  const isSourceTab = activeTab === 'article' || activeTab === 'script' || activeTab === 'word_set'
  const navSourceLabel = activeTab === 'word_set' ? wordsetCategoryLabel : articleSourceLabel
  const navOrder =
    activeTab === 'word_set'
      ? ['csat', 'eng_test', 'elementary', 'middle', 'high', 'themed', 'library_article', 'library_book']
      : activeTab === 'script'
        ? ['library', 'direct-script', 'direct-file', 'shared-set']
        : // 재저작(original)이 앞에 선다 — 학습자 레벨에 맞춰 쓴 유일한 소스이고 가장 최근이다.
        ['original', 'voa', 'nasa', 'nih', 'simple_wikipedia', 'wikinews', 'the_conversation']
  const articleNav = buildArticleNav(
    isSourceTab ? candidates : materials.articles,
    artSrc,
    artProg,
    navSourceLabel,
    navOrder,
  )

  // 탭별 분류 — 도서/내 스크립트=V밴드, 스크립트=소스별, 공용단어장=카테고리+도서(챕터별).
  // 분류는 좌측 레일, 세부 리스트는 우측 — 모든 자료 유형에 동일한 master-detail 패턴.
  interface PickerGroup {
    key: string
    label: string
    short?: string
    items: MaterialOption[]
  }
  // 소스탭(스크립트·내 스크립트·공용단어장)은 buildArticleNav 로 렌더 → groups 불필요.
  // 그 외(도서)만 표준 master-detail 용 V밴드 그룹을 만든다.
  let groups: PickerGroup[] = []
  if (!isSourceTab) {
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
  const nonEmptyGroups = groups.filter((g) => g.items.length > 0)
  const visibleGroups = rail === 'all' ? nonEmptyGroups : nonEmptyGroups.filter((g) => g.key === rail)

  // ── 선택/구성 ──
  /** picker 클릭 — 이미 담은 자료면 그 항목 편집으로, 아니면 신규 draft */
  /** picker 클릭 — 다중 엔트리: 항상 새 배치(draft). 담은 배치 편집/삭제는 주간 보드 카드에서. */
  function pickMaterial(m: MaterialOption) {
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
    revealComposer()
  }
  function editExisting(item: PlanItem) {
    setDraft(null)
    setError(null)
    setEditId((cur) => (cur === item.id ? null : item.id))
    revealComposer()
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
      if (!res.ok || !res.id) {
        setError(res.error ?? '추가에 실패했어요.')
        return
      }
      const newItem: PlanItem = {
        id: res.id, // 실 DB id — 낙관적 갱신이 삭제/편집에 그대로 사용
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
      setEditId(res.id) // 담은 뒤 바로 그 배치 편집 상태
    })
  }

  // ── 스크립트 다건 선택 — 토글 + 공유 구성 + 일괄 커밋 ──
  const toggleArtSel = (id: string) =>
    setArtSel((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleArtAct = (a: PlanActivity) =>
    setArtActs((prev) => {
      const n = new Set(prev)
      if (n.has(a)) n.delete(a)
      else n.add(a)
      return n
    })
  const toggleArtDay = (d: number) =>
    setArtDays((prev) => {
      const n = new Set(prev)
      if (n.has(d)) n.delete(d)
      else n.add(d)
      return n
    })

  // 소스 탭(스크립트·내 스크립트·공용단어장) 다건 일괄 커밋 — 현재 탭 type + 해당 pool 사용.
  function commitSourceBatch() {
    if (!isSourceTab) return
    const type = activeTab
    const modules = Array.from(artActs)
    if (artSel.size === 0) return
    if (modules.length === 0) {
      setError('활동을 하나 이상 골라 주세요.')
      return
    }
    const weekdays = Array.from(artDays).sort((a, b) => a - b)
    const pool =
      type === 'script' ? materials.scripts : type === 'word_set' ? materials.wordSets : materials.articles
    const picks = pool.filter((a) => artSel.has(a.id))
    setError(null)
    setAdding(true)
    startTransition(async () => {
      const added: PlanItem[] = []
      for (const m of picks) {
        const res = await savePlanItem({
          materialType: type,
          materialId: m.id,
          modules,
          chapters: [],
          weekdays,
        })
        if (res.ok && res.id) {
          added.push({
            id: res.id,
            materialType: type,
            materialId: m.id,
            modules,
            title: m.title,
            subtitle: m.subtitle,
            href: materialHref({ type, id: m.id, slug: m.slug }),
            slug: m.slug,
            vLevel: m.vLevel,
            chapters: [],
            weekdays,
            chapterCount: m.chapterCount,
            coverUrl: m.coverUrl,
            coverEmoji: m.coverEmoji,
            source: m.source,
          })
        }
      }
      setAdding(false)
      if (added.length === 0) {
        setError('추가에 실패했어요.')
        return
      }
      setItems((prev) => [...prev, ...added])
      setArtSel(new Set())
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
        id: item.id,
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
    // 폭/가로 패딩은 페이지의 <Screen width="wide" padX> 가 담당 — 내부 이중 제약(max-w-3xl·px) 금지
    <div className="flex w-full flex-col gap-5 py-6 md:py-8">
      {/* Hero */}
      <header>
        <h1 className="flex items-center gap-2 font-display text-[22px] font-[800] text-[var(--t1)]">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
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
        <p role="alert" className="font-body text-[13px] text-[var(--error-ink)]">
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
        ref={composerRef}
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
                    setRail('all')
                    // 탭 전환 시 우측 컴포저 초기화 — 다른 탭의 draft/편집·다건 선택이 새 탭을 가리지 않게
                    setDraft(null)
                    setEditId(null)
                    setError(null)
                    setArtSel(new Set())
                    setArtActs(defaultActivities(t))
                    setArtSrc('')
                    setArtProg('')
                  }}
                  className={`inline-flex min-h-11 items-center gap-1 rounded-[var(--r-md)] border px-2.5 font-display text-[12px] font-[700] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                    active
                      ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                      : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
                  }`}
                >
                  <Icon size={13} strokeWidth={1.75} aria-hidden />
                  {MATERIAL_LABEL[t]}
                  {/* opacity 로 덧대어 흐리게 하면 색 토큰이 확보한 대비가 다시 깎인다(2026-08-09 axe) */}
                  <span className="font-mono text-[10px]">{tabMaterials[t].length}</span>
                </button>
              )
            })}
          </div>

          {/* 소스 탭(스크립트·내 스크립트)=좌 2열 네비(소스·분류), 컨텐츠는 우측 선택 영역. 그 외=표준 master-detail */}
          {isSourceTab ? (
            <ArticleNav
              nav={articleNav}
              col1Label={activeTab === 'word_set' ? '카테고리' : '소스'}
              col2Label={activeTab === 'word_set' ? '책' : '분류'}
              onSource={(k) => {
                setArtSrc(k)
                setArtProg('')
              }}
              onProgram={(k) => setArtProg(k)}
            />
          ) : (
          <div className="flex gap-2">
              <nav
                aria-label="분류"
                className="flex max-h-[420px] w-[110px] shrink-0 flex-col gap-1 overflow-y-auto"
              >
                <RailButton
                  label="전체"
                  count={candidates.length}
                  active={rail === 'all'}
                  onClick={() => setRail('all')}
                />
                {nonEmptyGroups.map((g) => (
                  <RailButton
                    key={g.key}
                    label={g.label}
                    short={g.short}
                    count={g.items.length}
                    active={rail === g.key}
                    onClick={() => setRail(g.key)}
                  />
                ))}
              </nav>

              <div className="max-h-[420px] min-w-0 flex-1 overflow-y-auto pr-1">
                {visibleGroups.length === 0 ? (
                  <p className="px-1 py-3 font-body text-[13px] text-[var(--t2)]">
                    {tabMaterials[activeTab].length === 0 ? '표시할 자료가 없어요.' : '이 분류에 자료가 없어요.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {visibleGroups.map((g) => (
                      <div key={g.key} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-[11px] font-[800] text-[var(--t2)]">{g.label}</h3>
                          {g.short && <span className="font-mono text-[10px] text-[var(--t2)]">{g.short}</span>}
                          <span className="font-mono text-[10px] text-[var(--t2)]">{g.items.length}</span>
                          <span className="h-px flex-1 bg-[var(--bd)]" aria-hidden />
                        </div>
                        <ul className="flex flex-col gap-1.5">
                          {g.items.map((m) => (
                            <MaterialRow
                              key={m.id}
                              m={m}
                              type={activeTab}
                              picked={draft?.option.id === m.id}
                              count={countByKey.get(`${activeTab}:${m.id}`) ?? 0}
                              onPick={() => pickMaterial(m)}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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
          ) : isSourceTab && articleNav.activeProgram && articleNav.activeProgram.items.length > 0 ? (
            <ArticleSelectPane
              type={activeTab}
              program={articleNav.activeProgram}
              sourceLabel={
                articleNav.sources.find((s) => s.key === articleNav.activeSourceKey)?.label ?? ''
              }
              countByKey={countByKey}
              selected={artSel}
              onToggle={toggleArtSel}
              onClear={() => setArtSel(new Set())}
              activities={artActs}
              onToggleActivity={toggleArtAct}
              weekdays={artDays}
              onToggleWeekday={toggleArtDay}
              weekDates={weekDates}
              today={todayWeekday}
              adding={adding}
              onCommit={commitSourceBatch}
            />
          ) : (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg2)] text-[var(--t2)]" aria-hidden>
                <Pencil size={18} strokeWidth={1.5} />
              </span>
              <p className="font-body text-[13px] text-[var(--t2)]">
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
        <p className="font-body text-[13px] text-[var(--t2)]">
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
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5">
        <MiniMaterialGlyph item={item} />
        <span className="truncate font-display text-[13px] font-[800] text-[var(--t1)]">{item.title}</span>
        {item.materialType === 'book' && item.chapterCount > 1 && (
          <span className="font-mono text-[11px] text-[var(--t2)]">
            {item.chapters.length === 0 ? '전체' : `Ch ${item.chapters.join('·')}`}
          </span>
        )}
      </span>
      {/* 바로 시작 — 공용단어장이면 챕터 스코프 선택 포함(LaunchRow) */}
      <LaunchRow item={item} />
    </div>
  )
}

// ── 주간 보드 (가로 7열 캘린더) ──
//   요일=열. 데스크톱은 grid-cols-7 한 화면, 모바일은 가로 스크롤(열 min-width + snap).
//   계획 있는 날=흰 종이 카드로 도드라지고, 빈 날은 캔버스에 잠겨 물러난다. 오늘=테두리+틴트+'오늘' 3중.
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
  const plannedDays = WEEKDAYS.filter((d) => items.some((i) => i.weekdays.includes(d.value))).length
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const todayColRef = useRef<HTMLDivElement | null>(null)
  // 모바일(가로 스크롤 시) 오늘 열을 보이게 — 넘치지 않는 데스크톱에선 무해(스킵)
  useEffect(() => {
    const sc = scrollerRef.current
    const col = todayColRef.current
    if (!sc || !col || sc.scrollWidth <= sc.clientWidth) return
    sc.scrollLeft = Math.max(0, col.offsetLeft - sc.offsetLeft - 8)
  }, [])
  return (
    <section
      aria-label="주간 보드"
      className="flex flex-col gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-3"
    >
      {/* 헤더 — 오늘의 학습·컴포저와 동일한 섹션 리듬 */}
      <div className="flex items-center gap-1.5 px-0.5">
        <CalendarDays size={14} strokeWidth={1.75} className="text-[var(--p)]" aria-hidden />
        <h2 className="font-display text-[13px] font-[800] text-[var(--t1)]">주간 보드</h2>
        <span className="font-mono text-[11px] text-[var(--t2)]">
          {plannedDays > 0 ? `이번 주 ${plannedDays}일 계획` : '요일에 자료를 배치해요'}
        </span>
      </div>

      {/* 7열 — 데스크톱=한 화면 grid, 모바일=가로 스크롤(min-w + snap). items-start 로 열마다 자연 높이 */}
      <div ref={scrollerRef} className="snap-x overflow-x-auto pb-2 pt-0.5 [scrollbar-width:thin]">
        <div className="grid min-w-[820px] grid-cols-7 items-start gap-2">
          {WEEKDAYS.map((d) => {
            const dayItems = items.filter((i) => i.weekdays.includes(d.value))
            const isToday = d.value === today
            const empty = dayItems.length === 0
            return (
              <div
                key={d.value}
                ref={isToday ? todayColRef : undefined}
                className={`flex snap-start flex-col overflow-hidden rounded-[var(--r-md)] border transition-colors duration-[var(--dur-normal)] ${
                  isToday
                    ? 'border-[var(--p)] bg-[var(--bg)] shadow-[var(--sh-xs)]'
                    : empty
                      ? 'border-[var(--bd)] bg-[var(--bg2)]'
                      : 'border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-xs)]'
                }`}
              >
                {/* 요일 헤더 (요일·날짜·오늘) — 색+형태 이중, 오늘은 틴트+배지 */}
                <div
                  className={`flex flex-col items-center gap-0.5 border-b px-1 py-1.5 ${
                    isToday ? 'border-[var(--p)] bg-[var(--p-light)]' : 'border-[var(--bd)]'
                  }`}
                >
                  <span
                    className={`font-display text-[13px] font-[800] leading-none ${
                      isToday ? 'text-[var(--p)]' : 'text-[var(--t1)]'
                    }`}
                  >
                    {d.label}
                  </span>
                  <span
                    className={`font-mono text-[9.5px] leading-none tabular-nums ${
                      // 오늘 칸은 --p 틴트 배경 위 글자라 --on-p-tint (다크에서 --p 는 4.32:1)
                      isToday ? 'text-[var(--on-p-tint)]' : 'text-[var(--t2)]'
                    }`}
                  >
                    {weekDates[d.value - 1] ?? ''}
                  </span>
                  {isToday && (
                    <span className="mt-0.5 rounded-full bg-[var(--p)] px-1.5 py-[1.5px] font-display text-[8px] font-[800] leading-none text-[var(--on-p)]">
                      오늘
                    </span>
                  )}
                </div>

                {/* 본문 — 계획 카드 스택 or 빈 상태 */}
                <div className="flex min-h-[72px] flex-1 flex-col gap-1.5 p-1.5">
                  {empty ? (
                    <span className="flex flex-1 items-center justify-center py-2 font-body text-[10px] italic text-[var(--t2)]">
                      비어 있음
                    </span>
                  ) : (
                    dayItems.map((it) => (
                      <DayCard key={it.id} item={it} active={editId === it.id} onClick={() => onSelect(it)} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-[var(--bd)] pt-2">
          <p className="font-body text-[11px] text-[var(--t2)]">
            <span className="font-display font-[700] text-[var(--t2)]">요일 미정</span> — 아직 요일을 안 정한
            계획이에요. 눌러서 요일을 고르면 위 보드에 배치돼요.
          </p>
          <div className="flex flex-col gap-1">
            {unscheduled.map((it) => (
              <BoardChip key={it.id} item={it} active={editId === it.id} onClick={() => onSelect(it)} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** 보드 칩·카드의 챕터 배지 — 소수(≤3)는 번호로(같은 도서의 여러 배치 구분), 다수는 개수. */
function chapterBadge(item: PlanItem): string | null {
  if (!(item.materialType === 'book' && item.chapterCount > 1)) return null
  if (item.chapters.length === 0) return '전체'
  if (item.chapters.length <= 3) return `${item.chapters.join('·')}장`
  return `${item.chapters.length}장`
}

// 주간 보드 열 카드 — 좁은 요일 열(≈120px) 안에서 표지·제목(2줄)·챕터·활동을 세로로 압축.
//   보드 행(BoardChip)의 열-지향 형제. active=편집 중(잉크 채움). 색+형태+텍스트 3중 유지.
function DayCard({ item, active, onClick }: { item: PlanItem; active: boolean; onClick: () => void }) {
  const acts = PLAN_ACTIVITIES.filter((a) => item.modules.includes(a.id))
  const shown = acts.slice(0, 4)
  const overflow = acts.length - shown.length
  const chapterLabel = chapterBadge(item)
  const actLabels = acts.map((a) => a.label).join('·')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${item.title}${chapterLabel ? ` — 챕터 ${chapterLabel}` : ''}${actLabels ? ` — ${actLabels}` : ''}`}
      // `relative` 는 장식이 아니다 — 이 카드 안의 `sr-only`(= position:absolute)가
      // 위치 기준을 못 찾으면 **문서 전체**를 기준으로 잡아, 가로 스크롤러(min-w-[820px]) 안의
      // 정적 위치만큼 문서가 넓어진다. 실측: `/plan` 모바일 가로 넘침 126px 의 원인이 이것이었다.
      className={`relative flex w-full flex-col gap-1.5 rounded-[var(--r-sm)] border p-1.5 text-left transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
        active
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)] shadow-[var(--sh-sm)]'
          : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t1)] hover:-translate-y-px hover:border-[var(--p)] hover:shadow-[var(--sh-xs)]'
      }`}
    >
      <span className="flex items-start justify-between gap-1">
        <MiniMaterialGlyph item={item} />
        {chapterLabel && (
          <span
            className={`inline-flex h-4 shrink-0 items-center gap-0.5 rounded-[4px] px-1 font-mono text-[9px] tabular-nums ${
              active ? 'bg-white/15 text-[var(--ti)]' : 'bg-[var(--bg3)] text-[var(--t2)]'
            }`}
            aria-hidden
          >
            <ListChecks size={9} strokeWidth={2} />
            {chapterLabel}
          </span>
        )}
      </span>
      <span className="line-clamp-2 font-display text-[11.5px] font-[700] leading-snug">{item.title}</span>
      {shown.length > 0 && (
        <span className="flex flex-wrap items-center gap-0.5">
          {shown.map((a) => (
            <ActivityGlyph key={a.id} activity={a.id} size="sm" tone={active ? 'onDark' : 'default'} />
          ))}
          {overflow > 0 && (
            <span
              className={`font-mono text-[9px] ${active ? 'text-[var(--ti)] opacity-90' : 'text-[var(--t2)]'}`}
              aria-hidden
            >
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

/** 보드 행에 보여줄 활동 아이콘 최대 수 — 초과분은 +n 으로 접기 */
const CHIP_MAX_ICONS = 6

/** 주간 보드 계획 행 — 표지·제목·챕터 배지·활동 아이콘을 한 줄 카드로 */
function BoardChip({ item, active, onClick }: { item: PlanItem; active: boolean; onClick: () => void }) {
  const acts = PLAN_ACTIVITIES.filter((a) => item.modules.includes(a.id))
  const shown = acts.slice(0, CHIP_MAX_ICONS)
  const overflow = acts.length - shown.length
  const chapterLabel = chapterBadge(item)
  const actLabels = acts.map((a) => a.label).join('·')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${item.title}${chapterLabel ? ` — 챕터 ${chapterLabel}` : ''}${actLabels ? ` — ${actLabels}` : ''}`}
      // 같은 이유로 `relative` — 이 행도 `sr-only` 를 품는다(위 카드 주석 참조).
      className={`relative flex w-full items-center gap-2 rounded-[var(--r-sm)] border px-2 py-1.5 text-left transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
        active
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
          : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t1)] hover:border-[var(--p)]'
      }`}
    >
      <MiniMaterialGlyph item={item} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-display text-[12px] font-[700] leading-tight">{item.title}</span>
        {(shown.length > 0 || chapterLabel) && (
          <span
            className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${
              active ? 'text-[var(--ti)] opacity-90' : 'text-[var(--t2)]'
            }`}
          >
            {chapterLabel && (
              <span
                className={`inline-flex h-5 items-center gap-0.5 rounded-[5px] px-1 font-mono text-[10px] tabular-nums ${
                  active ? 'bg-white/15' : 'bg-[var(--bg3)]'
                }`}
                aria-hidden
              >
                <ListChecks size={11} strokeWidth={2} />
                {chapterLabel}
              </span>
            )}
            {shown.map((a) => (
              <ActivityGlyph key={a.id} activity={a.id} size="sm" tone={active ? 'onDark' : 'default'} />
            ))}
            {overflow > 0 && (
              <span className="font-mono text-[10px]" aria-hidden>
                +{overflow}
              </span>
            )}
            <span className="sr-only">
              {chapterLabel ? `챕터 ${chapterLabel}, ` : ''}활동: {actLabels || '없음'}
            </span>
          </span>
        )}
      </span>
    </button>
  )
}

function MiniMaterialGlyph({ item }: { item: PlanItem }) {
  if (item.materialType === 'word_set' && item.coverEmoji) {
    return (
      <span
        className="inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-[3px] bg-[var(--bg)] text-[16px] leading-none"
        aria-hidden
      >
        {item.coverEmoji}
      </span>
    )
  }
  if (item.materialType === 'book' && item.coverUrl) {
    return <Cover url={item.coverUrl} title={item.title} className="h-9 w-7 shrink-0 rounded-[3px]" />
  }
  const Icon = MATERIAL_ICON[item.materialType]
  return (
    <span
      className="inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-[3px] bg-[var(--p-light)] text-[var(--on-p-tint)]"
      aria-hidden
    >
      <Icon size={15} strokeWidth={1.75} />
    </span>
  )
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
        <div className="grid grid-cols-2 gap-1.5">
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
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--on-p)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="grid grid-cols-2 gap-1.5">
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
          {/* 공용단어장이면 챕터 스코프 선택 포함 — 게임을 특정 챕터 단어로 시작 */}
          <LaunchRow item={item} />
        </ConfigBlock>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--error)] hover:text-[var(--error-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
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
        <span className="font-display text-[11px] font-[700] text-[var(--t2)]">{subtitle}</span>
      </div>
      {right}
      <button
        type="button"
        onClick={onClose}
        aria-label="구성 닫기"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <X size={15} strokeWidth={2} aria-hidden />
      </button>
    </header>
  )
}

function ConfigBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-body text-[12px] text-[var(--t2)]">{label}</p>
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
  const vLevelByIdx = new Map((loaded ?? []).map((c) => [c.idx, c.vLevel]))
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
              className={`flex min-h-11 w-full items-center gap-2 rounded-[var(--r-sm)] border px-2 py-1 text-left transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                on
                  ? 'border-[var(--p)] bg-[var(--p-light)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--p)]'
              }`}
            >
              <span
                className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-[var(--dur-normal)] ${
                  on ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]' : 'border-[var(--bd)] bg-[var(--bg)]'
                }`}
                aria-hidden
              >
                {on && <Check size={12} strokeWidth={3} />}
              </span>
              <span
                className={`w-7 shrink-0 text-right font-mono text-[12px] font-[700] tabular-nums ${
                  on ? 'text-[var(--p)]' : 'text-[var(--t2)]'
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
              {/* 챕터별 어휘 V-level — 단일 book_v_level 이 뭉개는 편차 노출 (색상만 의존 X, 숫자 텍스트) */}
              {vLevelByIdx.get(n) != null && (
                <span
                  className={`inline-flex shrink-0 items-center rounded-[var(--r-full)] border px-1.5 py-0.5 font-mono text-[9px] font-[700] leading-none tabular-nums ${
                    on ? 'border-[var(--p)] text-[var(--p)]' : 'border-[var(--bd)] text-[var(--t2)]'
                  }`}
                  title={`이 장의 어휘 난이도 V${vLevelByIdx.get(n)} — 책 전체 라벨과 다를 수 있어요`}
                >
                  V{vLevelByIdx.get(n)}
                </span>
              )}
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

// 분류(프로그램) 라벨 — 부모(소스) 이름 중복 제거 (계층에선 소스가 이미 헤더로 노출).
//   예: "The Conversation — Health + Medicine" → "Health + Medicine" · "NASA News Releases" → "News Releases".
//   원문은 tooltip(title)로 보존.
function shortProgramLabel(sourceLabel: string, label: string): string {
  let out = label.trim()
  for (const sep of [' — ', ' - ', ': ', ' ']) {
    const p = sourceLabel + sep
    if (out.startsWith(p) && out.length > p.length) {
      out = out.slice(p.length).trim()
      break
    }
  }
  const suffix = `(${sourceLabel})`
  if (out.endsWith(suffix)) out = out.slice(0, -suffix.length).trim()
  return out || label
}

// 스크립트(article) 네비 데이터 — 소스별 → 활성 소스의 프로그램별. buildArticleNav 순수 계산(상태는 PlanClient).
interface ArticleNavData {
  sources: { key: string; label: string; items: MaterialOption[] }[]
  activeSourceKey: string
  programs: { key: string; label: string; full: string | null; items: MaterialOption[] }[]
  activeProgramKey: string
  activeProgram: { key: string; label: string; full: string | null; items: MaterialOption[] } | null
}

function buildArticleNav(
  articles: MaterialOption[],
  srcKey: string,
  progKey: string,
  sourceLabel: (k: string) => string,
  order: string[],
): ArticleNavData {
  const SOURCE_ORDER = order
  const NONE = '__none__'
  const bySource = new Map<string, MaterialOption[]>()
  for (const m of articles) {
    const k = m.source ?? 'etc'
    if (!bySource.has(k)) bySource.set(k, [])
    bySource.get(k)!.push(m)
  }
  const sources = Array.from(bySource.keys())
    .sort((a, b) => (SOURCE_ORDER.indexOf(a) + 1 || 99) - (SOURCE_ORDER.indexOf(b) + 1 || 99))
    .map((k) => ({ key: k, label: sourceLabel(k), items: bySource.get(k)! }))
  const activeSource = sources.find((s) => s.key === srcKey) ?? sources[0]

  const byFeed = new Map<string, MaterialOption[]>()
  for (const m of activeSource?.items ?? []) {
    const k = m.feedLabel ?? NONE
    if (!byFeed.has(k)) byFeed.set(k, [])
    byFeed.get(k)!.push(m)
  }
  const programs = Array.from(byFeed.keys())
    .sort((a, b) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b)))
    .map((k) => ({
      key: k,
      label: k === NONE ? '전체' : shortProgramLabel(activeSource?.label ?? '', k),
      full: k === NONE ? null : k,
      items: byFeed.get(k)!,
    }))
  const activeProgram = programs.find((p) => p.key === progKey) ?? programs[0] ?? null

  return {
    sources,
    activeSourceKey: activeSource?.key ?? '',
    programs,
    activeProgramKey: activeProgram?.key ?? '',
    activeProgram,
  }
}

// 좌측 2열 네비 — ① 소스 · ② 소스별 분류(프로그램). 컨텐츠는 우측 선택 영역이 담당.
function ArticleNav({
  nav,
  onSource,
  onProgram,
  col1Label = '소스',
  col2Label = '분류',
}: {
  nav: ArticleNavData
  onSource: (key: string) => void
  onProgram: (key: string) => void
  col1Label?: string
  col2Label?: string
}) {
  return (
    <div className="flex gap-2.5">
      {/* ① 1단 분류(소스/카테고리) */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <span className="px-1 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
          {col1Label}
        </span>
        <nav aria-label={col1Label} className="flex max-h-[400px] w-[96px] flex-col gap-1 overflow-y-auto">
          {nav.sources.map((s) => (
            <RailButton
              key={s.key}
              label={s.label}
              count={s.items.length}
              active={s.key === nav.activeSourceKey}
              onClick={() => onSource(s.key)}
            />
          ))}
        </nav>
      </div>
      {/* ② 2단 분류(프로그램/책) */}
      <div className="flex shrink-0 flex-col gap-1.5 border-l border-[var(--bd)] pl-2.5">
        <span className="px-1 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
          {col2Label}
        </span>
        <nav aria-label={col2Label} className="flex max-h-[400px] w-[134px] flex-col gap-1 overflow-y-auto">
          {nav.programs.map((p) => {
          const on = p.key === nav.activeProgramKey
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onProgram(p.key)}
              aria-pressed={on}
              title={p.full ?? p.label}
              className={`flex min-h-11 w-full items-start gap-1.5 rounded-[var(--r-sm)] border px-2 py-1 text-left transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                on
                  ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                  : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
              }`}
            >
              <span className="min-w-0 flex-1 line-clamp-2 font-display text-[11px] font-[700] leading-tight">
                {p.label}
              </span>
              <span className={`shrink-0 font-mono text-[9.5px] tabular-nums ${on ? 'opacity-90' : 'text-[var(--t2)]'}`}>
                {p.items.length}
              </span>
            </button>
          )
          })}
        </nav>
      </div>
    </div>
  )
}

// 우측 선택 영역 — 스크립트 다건 선택(체크박스) + 선택분 공유 구성(활동·요일) → 일괄 담기.
function ArticleSelectPane({
  type,
  program,
  sourceLabel,
  countByKey,
  selected,
  onToggle,
  onClear,
  activities,
  onToggleActivity,
  weekdays,
  onToggleWeekday,
  weekDates,
  today,
  adding,
  onCommit,
}: {
  type: MaterialType
  program: { label: string; full: string | null; items: MaterialOption[] }
  sourceLabel: string
  countByKey: Map<string, number>
  selected: Set<string>
  onToggle: (id: string) => void
  onClear: () => void
  activities: Set<PlanActivity>
  onToggleActivity: (a: PlanActivity) => void
  weekdays: Set<number>
  onToggleWeekday: (d: number) => void
  weekDates: string[]
  today: number
  adding: boolean
  onCommit: () => void
}) {
  const n = selected.size
  const Icon = type === 'word_set' ? Layers : Newspaper
  return (
    <div className="flex flex-col gap-3">
      {/* 헤더 */}
      <div className="flex items-center gap-1.5 border-b border-[var(--bd)] pb-2.5">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]" aria-hidden>
          <Icon size={13} strokeWidth={1.75} />
        </span>
        <h2 className="min-w-0 truncate font-display text-[14px] font-[800] text-[var(--t1)]">
          {sourceLabel}
          {program.full ? <span className="font-[700] text-[var(--t2)]"> · {program.label}</span> : null}
        </h2>
        <span className="shrink-0 rounded-[var(--r-full)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[10px] font-[700] text-[var(--t2)]">
          {program.items.length}
        </span>
        {n > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[var(--r-sm)] px-2 font-display text-[12px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--error-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            {n}개 선택 · 해제
          </button>
        )}
      </div>

      {/* ① 컨텐츠 다건 선택 */}
      <p className="font-body text-[12px] italic text-[var(--t2)]">
        담을 자료를 여러 개 고르세요 — 아래에서 활동·요일을 정해 한 번에 담아요.
      </p>
      <ul className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto pr-1">
        {program.items.map((m) => (
          <ArticlePickRow
            key={m.id}
            m={m}
            type={type}
            selected={selected.has(m.id)}
            inPlan={(countByKey.get(`${type}:${m.id}`) ?? 0) > 0}
            onToggle={() => onToggle(m.id)}
          />
        ))}
      </ul>

      {/* ② 선택분 공유 구성 + ③ 일괄 담기 */}
      {n > 0 ? (
        <div className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
          <ConfigBlock label={`활동 — 선택한 ${n}개 공통`}>
            <div className="grid grid-cols-2 gap-1.5">
              {activitiesForType(type).map((a) => (
                <ActivityChip
                  key={a}
                  activity={a}
                  selected={activities.has(a)}
                  onClick={() => onToggleActivity(a)}
                  small
                />
              ))}
            </div>
          </ConfigBlock>
          <ConfigBlock label="학습 요일 — 안 고르면 '요일 미정'에 담겨요">
            <WeekdayChips selected={weekdays} weekDates={weekDates} today={today} onToggle={onToggleWeekday} />
          </ConfigBlock>
          <button
            type="button"
            onClick={onCommit}
            disabled={adding || activities.size === 0}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--on-p)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding
              ? '담는 중…'
              : `계획에 담기 (${n}개 자료 · ${activities.size}활동${
                  weekdays.size > 0 ? ` · 주 ${weekdays.size}일` : ' · 요일 미정'
                })`}
          </button>
        </div>
      ) : (
        <p className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] p-3 text-center font-body text-[12px] text-[var(--t2)]">
          자료를 선택하면 활동·요일 구성이 열려요.
        </p>
      )}
    </div>
  )
}

// 다건 선택 행 — 체크박스 + 배지 + 제목 + V레벨(+담김 표시).
function ArticlePickRow({
  m,
  type,
  selected,
  inPlan,
  onToggle,
}: {
  m: MaterialOption
  type: MaterialType
  selected: boolean
  inPlan: boolean
  onToggle: () => void
}) {
  return (
    <li
      className={`group rounded-[var(--r-md)] border transition-all duration-[var(--dur-normal)] ${
        selected
          ? 'border-[var(--p)] bg-[var(--p-light)] shadow-[var(--sh-xs)]'
          : 'border-[var(--bd)] bg-[var(--bg2)] hover:-translate-y-px hover:border-[var(--p)] hover:bg-[var(--bg)] hover:shadow-[var(--sh-sm)]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        title={m.title}
        className="flex w-full items-center gap-2.5 rounded-[var(--r-md)] px-2.5 py-2 text-left transition-transform duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-[0.99]"
      >
        <span
          className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-[var(--dur-normal)] ${
            selected
              ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
              : 'border-[var(--bd)] bg-[var(--bg)] group-hover:border-[var(--p)]'
          }`}
          aria-hidden
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </span>
        <MaterialBadge type={type} m={m} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-display text-[13px] font-[700] leading-tight text-[var(--t1)]">{m.title}</span>
          {m.subtitle && (
            <span className="truncate font-body text-[11px] leading-tight text-[var(--t2)]">{m.subtitle}</span>
          )}
        </span>
        {m.vLevel != null && m.vLevel > 0 && (
          <span className="shrink-0 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[10px] font-[700] text-[var(--t2)]">
            V{m.vLevel}
          </span>
        )}
        {inPlan && (
          <span
            className="inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full bg-[var(--bg3)] px-1.5 font-display text-[9px] font-[800] text-[var(--t2)]"
            title="이미 계획에 담긴 자료 (또 담을 수 있어요)"
          >
            <Check size={9} strokeWidth={3} aria-hidden /> 담김
          </span>
        )}
      </button>
    </li>
  )
}

function MaterialRow({
  m,
  type,
  displayTitle,
  picked,
  count,
  onPick,
}: {
  m: MaterialOption
  type: MaterialType
  /** 그룹 문맥상 짧은 표기 (예: 책 그룹 안 챕터 세트 → 'n장 단어'). 저장/보드엔 원제 사용 */
  displayTitle?: string
  picked: boolean
  /** 이미 계획에 담긴 배치 수 (0=미담김) — 다중 엔트리라 클릭은 항상 새 배치 추가 */
  count?: number
  onPick: () => void
}) {
  const inPlan = (count ?? 0) > 0
  return (
    <li
      className={`group rounded-[var(--r-md)] border transition-all duration-[var(--dur-normal)] ${
        picked
          ? 'border-[var(--p)] bg-[var(--p-light)] shadow-[var(--sh-xs)]'
          : 'border-[var(--bd)] bg-[var(--bg2)] hover:-translate-y-px hover:border-[var(--p)] hover:bg-[var(--bg)] hover:shadow-[var(--sh-sm)]'
      }`}
    >
      <button
        type="button"
        onClick={onPick}
        aria-pressed={picked}
        title={inPlan ? `${m.title} — 계획에 ${count}개 담김 (클릭해 배치 추가)` : m.title}
        className="flex w-full items-center gap-2.5 rounded-[var(--r-md)] px-2.5 py-2 text-left transition-transform duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-[0.99]"
      >
        <MaterialBadge type={type} m={m} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-display text-[13px] font-[700] leading-tight text-[var(--t1)]">
            {displayTitle ?? m.title}
          </span>
          {m.subtitle && (
            <span className="truncate font-body text-[11px] leading-tight text-[var(--t2)]">{m.subtitle}</span>
          )}
        </span>
        {m.vLevel != null && m.vLevel > 0 && (
          <span className="shrink-0 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[10px] font-[700] text-[var(--t2)]">
            V{m.vLevel}
          </span>
        )}
        {inPlan ? (
          <span
            className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full bg-[var(--p)] px-1.5 font-display text-[9px] font-[800] text-[var(--on-p)]"
            title={`계획에 ${count}개 담김`}
          >
            <Check size={10} strokeWidth={3} aria-hidden /> {count}
          </span>
        ) : picked ? (
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--p)] text-[var(--on-p)]" aria-hidden>
            <Check size={13} strokeWidth={3} />
          </span>
        ) : (
          <span
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--p)] transition-colors duration-[var(--dur-normal)] group-hover:bg-[var(--p)] group-hover:text-[var(--on-p)]"
            aria-hidden
          >
            <Plus size={13} strokeWidth={2.5} />
          </span>
        )}
      </button>
    </li>
  )
}

function MaterialBadge({ type, m }: { type: MaterialType; m: MaterialOption }) {
  // 도서는 작은 표지 썸네일 — 리스트형 통일 시에도 표지 시각 단서 유지(2:3 비율).
  if (type === 'book') {
    return (
      <Cover
        url={m.coverUrl}
        title={m.title}
        className="h-10 w-7 shrink-0 rounded-[var(--r-sm)] border border-[var(--bd)]"
      />
    )
  }
  if (type === 'word_set' && m.coverEmoji) {
    return (
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg)] text-[16px]" aria-hidden>
        {m.coverEmoji}
      </span>
    )
  }
  const Icon = type === 'article' ? Newspaper : type === 'word_set' ? Layers : FileText
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]" aria-hidden>
      <Icon size={15} strokeWidth={1.75} />
    </span>
  )
}

// ── 칩들 ──
/** 좌측 분류 레일 버튼 — 라벨(줄임) + 개수 */
function RailButton({
  label,
  short,
  count,
  active,
  onClick,
}: {
  label: string
  short?: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={short ? `${label} (${short})` : label}
      className={`flex min-h-11 w-full flex-col items-start justify-center rounded-[var(--r-md)] border px-2 py-1 text-left transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
        active
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
          : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
      }`}
    >
      <span className="w-full truncate font-display text-[11px] font-[800] leading-tight">{label}</span>
      <span className={`font-mono text-[10px] tabular-nums ${active ? 'opacity-90' : 'text-[var(--t2)]'}`}>
        {count}
      </span>
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={def.layer}
      className={`inline-flex min-h-11 w-full items-center gap-2 rounded-[var(--r-md)] border px-2.5 font-display font-[700] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
        small ? 'text-[12px]' : 'text-[13px]'
      } ${
        selected
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
          : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
      }`}
    >
      {/* 활동 아이콘은 선택 여부와 무관하게 항상 표시 — 보드 행·바로 시작과 동일 타일 */}
      <ActivityGlyph activity={activity} size="md" tone={selected ? 'onDark' : 'default'} />
      <span className="min-w-0 flex-1 truncate text-left">{def.label}</span>
      {selected && <Check size={13} strokeWidth={3} className="shrink-0" aria-hidden />}
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
                ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)] shadow-[var(--sh-sm)]'
                : isToday
                  ? 'border-[var(--p)] bg-[var(--bg)] text-[var(--t1)] hover:bg-[var(--p-light)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--on-p-tint)]'
            }`}
          >
            <span className="font-display text-[14px] font-[800] leading-none">{weekdayLabel(d.value)}</span>
            <span className={`font-mono text-[10px] leading-none tabular-nums ${on ? 'opacity-90' : 'text-[var(--t2)]'}`}>
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

// ── 바로 시작 (런처) — 활동 칩 + 공용단어장 챕터 스코프 선택 ──
//   공용단어장이 내부 챕터(shared_words.chapter)로 나뉘면 "챕터: 전체/1/2…" 선택을 노출하고,
//   게임(카드/블리츠/스펠포지/페어플립) launch 에 ?chapter=N 를 부착한다. 본문·세트 페이지엔 무영향.
//   오늘의 학습·구성 패널 '바로 시작'이 공유 — 한 자료의 챕터 단위 학습(최하위 단위)을 런처에서 고른다.
function LaunchRow({ item }: { item: PlanItem }) {
  const ref = { type: item.materialType, id: item.materialId, slug: item.slug }
  const acts = PLAN_ACTIVITIES.filter((a) => item.modules.includes(a.id))
  const hasSetChapters = item.materialType === 'word_set' && item.chapterCount > 1
  const [chapter, setChapter] = useState<number | null>(null)
  if (acts.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      {hasSetChapters && (
        <ChapterScopePicker count={item.chapterCount} value={chapter} onChange={setChapter} />
      )}
      <div className="flex flex-wrap gap-1.5">
        {acts.map((a) => (
          <LaunchChip
            key={a.id}
            activity={a.id}
            // chapter 는 word_set 게임 라우트에만 부착됨(builder 가 set= 여부로 판단) — vocab/본문엔 무영향
            href={activityLaunchHref(ref, a.id, '/plan', chapter)}
            scoped={isActivityScoped(item.materialType, a.id)}
          />
        ))}
      </div>
    </div>
  )
}

// 공용단어장 내부 챕터 스코프 선택 — 전체 or 특정 챕터. 챕터 수(최대 30)를 컴팩트한 select 로 수용(Calm UI).
//   게임 launch 에 ?chapter=N 부착. 선택 값은 아이콘+텍스트로 노출 → 색상 단독 전달 금지.
function ChapterScopePicker({
  count,
  value,
  onChange,
}: {
  count: number
  value: number | null
  onChange: (n: number | null) => void
}) {
  return (
    <label className="inline-flex w-fit items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] py-1 pl-2 pr-1 text-[var(--t2)]">
      <ListChecks size={13} strokeWidth={1.75} className="text-[var(--p)]" aria-hidden />
      <span className="font-display text-[11px] font-[700]">챕터</span>
      <select
        aria-label="게임을 시작할 챕터 범위"
        value={value ?? 'all'}
        onChange={(e) => onChange(e.target.value === 'all' ? null : Number(e.target.value))}
        className="h-7 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-1.5 font-mono text-[11px] font-[700] text-[var(--t1)] tabular-nums transition-colors duration-[var(--dur-normal)] focus:border-[var(--p)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <option value="all">전체 ({count})</option>
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}장
          </option>
        ))}
      </select>
    </label>
  )
}

function LaunchChip({ activity, href, scoped }: { activity: PlanActivity; href: string; scoped: boolean }) {
  const def = ACTIVITY_BY_ID[activity]
  return (
    <Link
      href={href}
      title={scoped ? `${def.label} — 이 자료로 바로 시작` : `${def.label} — 모듈에서 시작`}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-2 pr-2.5 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <ActivityGlyph activity={activity} size="sm" />
      {def.label}
      {scoped ? (
        <Play size={11} strokeWidth={2} className="text-[var(--p)] opacity-80" aria-hidden />
      ) : (
        <ExternalLink size={11} strokeWidth={2} className="opacity-50" aria-hidden />
      )}
    </Link>
  )
}
