// apps/web/src/components/library/vocab/VocabSetGrid.tsx
//
// 실 데이터 기반 공용 단어장 그리드.
// - 검색 / 카테고리 / 정렬 / "내 단어장만" 토글 (클라이언트 인메모리)
// - 카드 미리보기 모달
// - 구독/해지 액션 중앙 관리 — 성공 시 토스트 + /wordvault 진입 유도
// - Optimistic UI: 액션 성공 직후 subscribed 집합 즉시 갱신 (revalidate 와이어링 대기 X)

'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Search, Sparkles } from 'lucide-react'

import { subscribeSet, unsubscribeSet } from '@/app/(main)/library/vocab/actions'
import type { PublishedVocabSet, RecommendedSet } from '@/lib/library/vocab/queries'

import { CategoryMatrix } from './CategoryMatrix'
import { categoryImportance, type VocabCategoryId } from './categories'
import { SubscribeSuccessToast, type SubscribeToastData } from './SubscribeSuccessToast'
import { VocabSetCard } from './VocabSetCard'
import { VocabSetCarousel } from './VocabSetCarousel'
import { VocabSetPreviewModal } from './VocabSetPreviewModal'

// 추천 티어 배지 (recommend_word_sets_for_user recommendation_type) — RecommendedSetsSection 정합.
const TIER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  // bg 는 면 · text 는 그 위 글자 — 채움/틴트별로 잉크를 맞춘다(2026-08-09 axe).
  primary: { label: '메인', bg: 'var(--p)', text: 'var(--on-p)' },
  stretch: { label: '도전', bg: 'var(--active)', text: '#231a09' },
  review: { label: '보강', bg: 'var(--bg3)', text: 'var(--t2)' },
  specialty: { label: '관심', bg: 'var(--info-light)', text: 'var(--info-ink)' },
  etymology: { label: '어원', bg: 'var(--warning-light)', text: 'var(--warning-ink)' },
  topic: { label: '주제', bg: 'var(--bg3)', text: 'var(--t2)' },
  fallback: { label: '추천', bg: 'var(--bg3)', text: 'var(--t2)' },
}

type SortKey = 'recommended' | 'most_words' | 'fewest_words' | 'newest'

interface Props {
  sets: PublishedVocabSet[]
  subscribedIds: string[]
  isLoggedIn: boolean
  /** 학습자 현재 V-level (진단값). 0=미진단 → 추천 대신 진단 유도. */
  userVLevel: number
  /** recommend_word_sets_for_user RPC 결과 (진단 엔진 · 티어·사유). 미진단 시 빈 배열. */
  recommended: RecommendedSet[]
}

export function VocabSetGrid({ sets, subscribedIds, isLoggedIn, userVLevel, recommended }: Props) {
  const router = useRouter()

  // Optimistic subscribed set — 서버 액션 성공 시 즉시 반영
  const [subscribed, setSubscribed] = useState<Set<string>>(() => new Set(subscribedIds))

  const [category, setCategory] = useState<VocabCategoryId>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recommended')
  const [mineOnly, setMineOnly] = useState(false)
  const [previewing, setPreviewing] = useState<PublishedVocabSet | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [toast, setToast] = useState<SubscribeToastData | null>(null)

  const [, startTransition] = useTransition()

  function handleToggle(set: PublishedVocabSet) {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent('/library/vocab')}`)
      return
    }
    const wasSubscribed = subscribed.has(set.id)
    // v06.34 — 제외 시 confirm (실수 방지)
    if (wasSubscribed) {
      const ok = window.confirm(
        `"${set.title}" 을(를) 내 학습에서 제외할까요?\n` +
          '· 단어장 구독이 해제됩니다.\n' +
          '· 이미 학습한 단어와 학습 기록은 보존됩니다.\n' +
          '· 언제든 다시 추가할 수 있어요.'
      )
      if (!ok) return
    }
    setErrors((m) => ({ ...m, [set.id]: null }))
    setPendingId(set.id)

    startTransition(async () => {
      try {
        if (wasSubscribed) {
          const res = await unsubscribeSet(set.id)
          if (!res.ok) {
            setErrors((m) => ({
              ...m,
              [set.id]:
                res.reason === 'unauthenticated' ? '로그인이 필요해요' : (res.message ?? '실패'),
            }))
            return
          }
          setSubscribed((s) => {
            const n = new Set(s)
            n.delete(set.id)
            return n
          })
        } else {
          const res = await subscribeSet(set.id)
          if (!res.ok) {
            setErrors((m) => ({
              ...m,
              [set.id]:
                res.reason === 'unauthenticated'
                  ? '로그인이 필요해요'
                  : res.reason === 'not_published'
                    ? '게시되지 않은 세트예요'
                    : (res.message ?? '잠시 후 다시 시도해 주세요'),
            }))
            return
          }
          setSubscribed((s) => new Set(s).add(set.id))
          setToast({
            setTitle: set.title,
            importedCount: res.importedCount,
            alreadyOwnedCount: res.alreadyOwnedCount,
            totalWords: res.totalWords,
          })
        }
      } finally {
        setPendingId(null)
      }
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = sets.filter((s) => {
      if (category !== 'all' && s.category !== category) return false
      if (mineOnly && !subscribed.has(s.id)) return false
      if (q) {
        const hay = `${s.title} ${s.description ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const sorted = [...list]
    switch (sort) {
      case 'most_words':
        sorted.sort((a, b) => b.wordCount - a.wordCount)
        break
      case 'fewest_words':
        sorted.sort((a, b) => a.wordCount - b.wordCount)
        break
      case 'newest':
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        break
      default:
        // 추천순 — 중요도(카테고리: 수능·내신→교육과정→공인→테마) → 사용빈도(구독수) → 큐레이션 순서 → 단어수.
        sorted.sort(
          (a, b) =>
            categoryImportance(b.category) - categoryImportance(a.category) ||
            b.subscriberCount - a.subscriberCount ||
            a.sortOrder - b.sortOrder ||
            b.wordCount - a.wordCount
        )
        break
    }
    return sorted
  }, [sets, category, query, sort, mineOnly, subscribed])

  const isEmptyAll = sets.length === 0
  const isEmptyFiltered = !isEmptyAll && filtered.length === 0
  const mineCount = sets.filter((s) => subscribed.has(s.id)).length

  // 카테고리별 세트 개수 (Information scent · CategoryMatrix 표시용)
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of sets) {
      map[s.category] = (map[s.category] ?? 0) + 1
    }
    return map
  }, [sets])

  // '전체' + 검색·필터 미사용 시에만 카테고리별 섹션 그룹핑 (chunking — Miller 7±2).
  // 검색/구독필터/특정 카테고리 선택 시에는 평탄 그리드 (사용자 의도 명확).
  const isGrouped = category === 'all' && query.trim() === '' && !mineOnly && sort === 'recommended'

  // 개인 맞춤 추천 — recommend_word_sets_for_user RPC 결과를 라이브러리 세트에 매핑(티어·사유 유지).
  const diagnosed = userVLevel >= 1
  const recFeatured = useMemo(() => {
    if (recommended.length === 0) return []
    const byId = new Map(sets.map((s) => [s.id, s]))
    return recommended
      .map((r) => {
        const set = byId.get(r.set_id)
        return set ? { set, type: r.recommendation_type, reason: r.reason } : null
      })
      .filter((x): x is { set: PublishedVocabSet; type: string; reason: string } => x != null)
      .slice(0, 8)
  }, [sets, recommended])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t2)]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="단어장 이름·설명 검색"
            aria-label="공용 단어장 검색"
            className="focus:ring-[var(--t1)]/10 h-11 w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] pl-9 pr-3 font-body text-[14px] text-[var(--t1)] transition-colors placeholder:text-[var(--t2)] focus:border-[var(--t1)] focus:outline-none focus:ring-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="vocab-sort">
            정렬
          </label>
          <select
            id="vocab-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="focus:ring-[var(--t1)]/10 h-11 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[13px] font-[600] text-[var(--t2)] focus:border-[var(--t1)] focus:outline-none focus:ring-2"
          >
            <option value="recommended">추천순</option>
            <option value="most_words">단어 많은 순</option>
            <option value="fewest_words">단어 적은 순</option>
            <option value="newest">최신 등록순</option>
          </select>

          {isLoggedIn && (
            <button
              type="button"
              onClick={() => setMineOnly((v) => !v)}
              aria-pressed={mineOnly}
              className={`focus-visible:ring-[var(--t1)]/20 inline-flex h-11 items-center gap-1.5 rounded-[var(--r-md)] border px-3 font-display text-[13px] font-[600] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                mineOnly
                  ? 'border-[var(--t1)] bg-[var(--t1)] text-[var(--bg)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:bg-[var(--bg2)]'
              }`}
            >
              내 단어장만
              <span
                className={`inline-flex min-w-[18px] justify-center rounded-[var(--r-full)] px-1 text-[11px] tabular-nums ${
                  mineOnly ? 'bg-white/20 text-white' : 'bg-[var(--bg3)] text-[var(--t2)]'
                }`}
              >
                {mineCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 카테고리 선택 시에만 빠른 클리어를 위해 CategoryMatrix 유지 (필터 active 표시). 기본 matrix view 일 때는 hide. */}
      {category !== 'all' && (
        <CategoryMatrix
          active={category}
          onChange={setCategory}
          counts={categoryCounts}
          totalCount={sets.length}
        />
      )}

      {isEmptyAll ? (
        <EmptyState
          title="아직 공개된 단어장이 없어요"
          body="새 컬렉션이 곧 추가될 예정이에요. 그동안 내 스크립트에서 단어를 직접 추출해 보세요."
        />
      ) : isEmptyFiltered ? (
        <EmptyState
          title="조건에 맞는 단어장이 없어요"
          body={
            mineOnly
              ? '아직 구독한 단어장이 없어요. 마음에 드는 세트를 추가해 보세요.'
              : '검색어나 카테고리를 바꿔보세요.'
          }
        />
      ) : isGrouped ? (
        <div className="flex flex-col gap-6">
          {/* 개인 맞춤 추천 — 진단 엔진(recommend_word_sets_for_user) 결과·티어·사유. 미진단/추천없음이면 진단 유도 */}
          {recFeatured.length >= 1 ? (
            <FeaturedRow
              title={`내 수준 추천 · V${userVLevel} 맞춤`}
              subtitle="진단 기반 — 왜 추천인지 함께 표시"
              items={recFeatured}
              subscribed={subscribed}
              pendingId={pendingId}
              errors={errors}
              onToggle={handleToggle}
              onPreview={setPreviewing}
            />
          ) : !diagnosed ? (
            <DiagnosePrompt />
          ) : null}
          {/* v06.33 — OTT/Netflix 스타일 카테고리별 가로 carousel */}
          <VocabSetCarousel
            sets={filtered}
            subscribedIds={subscribed}
            pendingId={pendingId}
            isLoggedIn={isLoggedIn}
            onPreview={setPreviewing}
            onToggle={handleToggle}
            onSelectCategory={(id) => setCategory(id)}
          />
        </div>
      ) : (
        // Dense matrix grid — Are.na / Linear board 영감
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((set) => (
            <VocabSetCard
              key={set.id}
              set={set}
              isSubscribed={subscribed.has(set.id)}
              isPending={pendingId === set.id}
              errorMessage={errors[set.id] ?? null}
              onToggle={handleToggle}
              onPreview={setPreviewing}
            />
          ))}
        </div>
      )}

      <VocabSetPreviewModal
        set={previewing}
        isSubscribed={previewing ? subscribed.has(previewing.id) : false}
        isPending={previewing ? pendingId === previewing.id : false}
        onToggle={(s) => handleToggle(s)}
        onClose={() => setPreviewing(null)}
      />

      <SubscribeSuccessToast data={toast} onClose={() => setToast(null)} />
    </div>
  )
}

// 미진단 학습자 — 개인 맞춤 추천 대신 진단 유도 배너.
function DiagnosePrompt() {
  return (
    <a
      href="/diagnostic"
      className="border-ios-purple/40 bg-ios-purple/[0.06] hover:bg-ios-purple/[0.1] focus-visible:ring-ios-purple/40 flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-dashed px-4 py-3 no-underline transition-colors focus-visible:outline-none focus-visible:ring-2"
    >
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 items-center justify-center rounded-ios-sm bg-ios-purple text-white"
        >
          <Sparkles size={15} />
        </span>
        <span className="flex flex-col">
          <span className="font-display text-[13.5px] font-[800] text-[var(--t1)]">
            내 수준 맞춤 추천 받기
          </span>
          <span className="font-body text-[12px] text-[var(--t2)]">
            1분 진단하면 지금 딱 맞는 단어장을 추천해드려요
          </span>
        </span>
      </span>
      <span className="shrink-0 rounded-[var(--r-md)] bg-ios-purple px-3 py-1.5 font-display text-[12px] font-[700] text-white">
        진단하기
      </span>
    </a>
  )
}

// 상단 추천 — 진단 엔진 결과(티어·사유)를 라이브러리 네이티브 카드로 가로 스크롤 노출.
function FeaturedRow({
  title,
  subtitle,
  items,
  subscribed,
  pendingId,
  errors,
  onToggle,
  onPreview,
}: {
  title: string
  subtitle: string
  items: { set: PublishedVocabSet; type: string; reason: string }[]
  subscribed: Set<string>
  pendingId: string | null
  errors: Record<string, string | null>
  onToggle: (set: PublishedVocabSet) => void
  onPreview: (set: PublishedVocabSet) => void
}) {
  return (
    <section aria-label="맞춤 추천 단어장" className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <span
          aria-hidden
          className="bg-ios-purple/12 inline-flex h-6 w-6 items-center justify-center rounded-ios-sm text-ios-purple"
        >
          <Sparkles size={14} />
        </span>
        <h2 className="font-display text-[15px] font-[800] text-[var(--t1)]">{title}</h2>
        <span className="font-body text-[12px] text-[var(--t2)]">{subtitle}</span>
      </div>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {items.map(({ set, type, reason }) => {
          const badge = TIER_BADGE[type] ?? TIER_BADGE.fallback!
          return (
            <div
              key={set.id}
              className="flex w-[128px] shrink-0 snap-start flex-col gap-1.5 sm:w-[144px]"
            >
              <VocabSetCard
                set={set}
                isSubscribed={subscribed.has(set.id)}
                isPending={pendingId === set.id}
                errorMessage={errors[set.id] ?? null}
                onToggle={onToggle}
                onPreview={onPreview}
                hideKind
              />
              {/*
                왜 추천? — 티어 배지 + 사유.

                **한 줄로 고정한다.** `line-clamp-2` 였을 때 사유가 문장 중간에서 잘렸고
                ("남들이 비워 둔 자리를 메…"), 카드마다 1~2줄로 갈려 배지 아래 블록 높이가
                제각각이었다(실측 2026-08-16). 사유는 추천의 **근거**라 반쯤 잘리면 설득이
                안 되느니만 못하다 — 그럴 바엔 한 줄만 단정하게 보이고, 전문은 카드를 열어
                보게 한다. 높이를 예약해(`min-h`) 사유가 짧은 카드도 줄이 안 밀리게 한다.
                전체 문장은 `title` 로 남겨 마우스·스크린리더가 닿게 둔다.
              */}
              <div className="flex flex-col gap-0.5 px-0.5">
                <span
                  className="inline-flex w-fit items-center rounded-[var(--r-full)] px-1.5 py-0.5 font-display text-[9px] font-[800] uppercase tracking-wider"
                  style={{ backgroundColor: badge.bg, color: badge.text }}
                >
                  {badge.label}
                </span>
                <span
                  title={reason}
                  className="line-clamp-1 min-h-[14px] font-body text-[10.5px] leading-snug text-[var(--t2)]"
                >
                  {reason}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center">
      <p className="font-display text-[14px] font-[600] text-[var(--t2)]">{title}</p>
      <p className="max-w-[360px] font-body text-[12px] text-[var(--t2)]">{body}</p>
    </div>
  )
}
