// apps/web/src/components/plan/PlanClient.tsx
// 학습 계획 구성 — 자료(도서/스크립트/공용단어장)별 활동 선택 (리틀팍스형, P1 재설계).
// Calm UI · Progressive Disclosure(담은 자료 위, 추가는 아래) · 활동 토글은 카드에서 즉시 저장.
// 압박/게이지 금지 — "무엇을 할지" 고르는 차분한 구성 화면.

'use client'

import {
  BookMarked,
  BookOpen,
  Check,
  ExternalLink,
  FileText,
  Headphones,
  Layers,
  Mic2,
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
import { useMemo, useState, useTransition } from 'react'

import {
  ACTIVITY_BY_ID,
  activitiesForType,
  activityLaunchHref,
  isActivityScoped,
  materialHref,
  MATERIAL_LABEL,
  PLAN_ACTIVITIES,
  type MaterialType,
  type PlanActivity,
} from '@/lib/learner/plan-activities'
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
  script: FileText,
  word_set: Layers,
}

const TYPE_TABS: MaterialType[] = ['book', 'script', 'word_set']

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

  // 추가 picker 상태
  const [activeTab, setActiveTab] = useState<MaterialType>('book')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [pickedActivities, setPickedActivities] = useState<Set<PlanActivity>>(new Set())
  const [adding, setAdding] = useState(false)

  const addedKeys = useMemo(
    () => new Set(items.map((i) => keyOf(i.materialType, i.materialId))),
    [items],
  )

  const tabMaterials: Record<MaterialType, MaterialOption[]> = {
    book: materials.books,
    script: materials.scripts,
    word_set: materials.wordSets,
  }

  /** 담은 자료 제외한 추가 후보 */
  const candidates = tabMaterials[activeTab].filter(
    (m) => !addedKeys.has(keyOf(activeTab, m.id)),
  )

  // ── 카드에서 활동 토글 → 즉시 저장 (optimistic) ──
  function toggleItemActivity(item: PlanItem, activity: PlanActivity) {
    const has = item.modules.includes(activity)
    const next = has
      ? item.modules.filter((m) => m !== activity)
      : [...item.modules, activity]
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, modules: next } : it)),
    )
    setError(null)
    startTransition(async () => {
      const res = await savePlanItem({
        materialType: item.materialType,
        materialId: item.materialId,
        modules: next,
      })
      if (!res.ok) {
        // 실패 시 되돌림
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, modules: item.modules } : it)),
        )
        setError(res.error ?? '저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
      }
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

  function pickMaterial(m: MaterialOption) {
    if (pickedId === m.id) {
      setPickedId(null)
      setPickedActivities(new Set())
      return
    }
    setPickedId(m.id)
    // 기본 추천 활동: 본문 자료 = 읽기·단어·Flashcard / 단어장 = 단어·Flashcard
    const defaults: PlanActivity[] =
      activeTab === 'word_set' ? ['vocab', 'flashcard'] : ['read', 'vocab', 'flashcard']
    setPickedActivities(new Set(defaults))
  }

  function togglePicked(activity: PlanActivity) {
    setPickedActivities((prev) => {
      const next = new Set(prev)
      if (next.has(activity)) next.delete(activity)
      else next.add(activity)
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
    setError(null)
    setAdding(true)
    const type = activeTab
    startTransition(async () => {
      const res = await savePlanItem({ materialType: type, materialId: m.id, modules })
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
      }
      setItems((prev) => [...prev, newItem])
      setPickedId(null)
      setPickedActivities(new Set())
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
          도서·스크립트·단어장을 고르고, 무엇을 할지 정해요. 마음 가는 만큼만, 차분히.
        </p>
      </header>

      {error && (
        <p role="alert" className="font-body text-[13px] text-[var(--error)]">
          {error}
        </p>
      )}

      {/* 담은 계획 */}
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
          items.map((item) => (
            <PlanItemCard
              key={item.id}
              item={item}
              onToggle={(a) => toggleItemActivity(item, a)}
              onRemove={() => handleRemove(item)}
            />
          ))
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
                  setPickedId(null)
                  setPickedActivities(new Set())
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

        {/* 자료 목록 */}
        {candidates.length === 0 ? (
          <p className="px-1 py-3 font-body text-[13px] text-[var(--t3)]">
            {tabMaterials[activeTab].length === 0
              ? activeTab === 'script'
                ? '내 스크립트가 아직 없어요. 스크립트를 등록하면 여기 나타나요.'
                : '표시할 자료가 없어요.'
              : '이 유형의 자료는 모두 계획에 담았어요.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {candidates.map((m) => {
              const picked = pickedId === m.id
              return (
                <li
                  key={m.id}
                  className={`rounded-[var(--r-md)] border transition-colors duration-[var(--dur-normal)] ${
                    picked ? 'border-[var(--p)] bg-[var(--p-light)]' : 'border-[var(--bd)] bg-[var(--bg2)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => pickMaterial(m)}
                    aria-expanded={picked}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-display text-[14px] font-[700] text-[var(--t1)]">
                        {m.title}
                      </span>
                      {m.subtitle && (
                        <span className="truncate font-body text-[12px] text-[var(--t3)]">
                          {m.subtitle}
                        </span>
                      )}
                    </span>
                    {m.vLevel != null && m.vLevel > 0 && (
                      <span className="shrink-0 rounded-[var(--r-sm)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[11px] font-[700] text-[var(--t2)]">
                        V{m.vLevel}
                      </span>
                    )}
                    <span
                      className={`shrink-0 transition-transform duration-[var(--dur-normal)] ${picked ? 'rotate-45' : ''}`}
                      aria-hidden
                    >
                      <Plus size={16} strokeWidth={2} className="text-[var(--p)]" />
                    </span>
                  </button>

                  {/* 활동 선택 (펼침) */}
                  {picked && (
                    <div className="flex flex-col gap-3 border-t border-[var(--bd)] px-3.5 py-3">
                      <p className="font-body text-[12px] text-[var(--t3)]">이 자료로 할 활동을 골라요</p>
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
                      <button
                        type="button"
                        onClick={handleAdd}
                        disabled={adding || pickedActivities.size === 0}
                        className="inline-flex h-11 items-center justify-center gap-1.5 self-start rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--ti)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {adding ? '담는 중…' : `계획에 추가 (${pickedActivities.size})`}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

/** 담은 자료 카드 — 기본: 선택 활동 실행(launch) 링크 / 편집: 활동 토글(즉시 저장). */
function PlanItemCard({
  item,
  onToggle,
  onRemove,
}: {
  item: PlanItem
  onToggle: (a: PlanActivity) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const TypeIcon = MATERIAL_ICON[item.materialType]
  const allowed = activitiesForType(item.materialType)
  const ref = { type: item.materialType, id: item.materialId, slug: item.slug }
  // 선택 활동을 표준(인지 깊이) 순서로 정렬
  const selected = PLAN_ACTIVITIES.filter((a) => item.modules.includes(a.id))

  return (
    <article className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)]">
      <header className="flex items-center gap-2.5">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--p)]"
          aria-hidden
        >
          <TypeIcon size={16} strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-display text-[15px] font-[800] text-[var(--t1)]">
              {item.title}
            </span>
            <span className="shrink-0 rounded-[var(--r-sm)] bg-[var(--bg3)] px-1.5 py-0.5 font-display text-[10px] font-[700] text-[var(--t3)]">
              {MATERIAL_LABEL[item.materialType]}
            </span>
          </span>
          {item.subtitle && (
            <span className="truncate font-body text-[12px] text-[var(--t3)]">{item.subtitle}</span>
          )}
        </div>
        <Link
          href={item.href}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          열기 <ExternalLink size={12} strokeWidth={2} aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
          aria-label="활동 편집"
          title="활동 편집"
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] transition-colors duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
            editing
              ? 'bg-[var(--p)] text-[var(--ti)]'
              : 'text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--p)]'
          }`}
        >
          <Pencil size={15} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${item.title} 계획에서 빼기`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <Trash2 size={15} strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      {editing ? (
        <div className="flex flex-col gap-2 border-t border-[var(--bd)] pt-3">
          <p className="font-body text-[12px] text-[var(--t3)]">할 활동을 켜고 끄면 바로 저장돼요</p>
          <div className="flex flex-wrap gap-1.5">
            {allowed.map((a) => (
              <ActivityChip
                key={a}
                activity={a}
                selected={item.modules.includes(a)}
                onClick={() => onToggle(a)}
                small
              />
            ))}
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
    </article>
  )
}

/** 선택 활동 실행 링크 — scoped(이 자료 단어로 바로)=Play / hub(모듈에서)=↗. 아이콘으로 구분(색맹 대응). */
function LaunchChip({
  activity,
  href,
  scoped,
}: {
  activity: PlanActivity
  href: string
  scoped: boolean
}) {
  const def = ACTIVITY_BY_ID[activity]
  const Icon = ACTIVITY_ICON[def.icon] ?? Layers
  return (
    <Link
      href={href}
      title={scoped ? `${def.label} — 이 자료로 바로 시작` : `${def.label} — 모듈에서 시작`}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
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

/** 활동 토글 칩 — 선택 시 채움 + 체크. 색상 외 아이콘으로도 상태 구분(색맹 대응). */
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
      {selected ? (
        <Check size={13} strokeWidth={2.5} aria-hidden />
      ) : (
        <Icon size={13} strokeWidth={1.75} aria-hidden />
      )}
      {def.label}
    </button>
  )
}
