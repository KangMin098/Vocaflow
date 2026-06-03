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
import { Search } from 'lucide-react'

import { subscribeSet, unsubscribeSet } from '@/app/(main)/library/vocab/actions'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

import { CategoryMatrix } from './CategoryMatrix'
import { VOCAB_CATEGORIES, type VocabCategoryId } from './categories'
import { SubscribeSuccessToast, type SubscribeToastData } from './SubscribeSuccessToast'
import { VocabSetCard } from './VocabSetCard'
import { VocabSetCarousel } from './VocabSetCarousel'
import { VocabSetPreviewModal } from './VocabSetPreviewModal'

type SortKey = 'recommended' | 'most_words' | 'fewest_words' | 'newest'

interface Props {
  sets: PublishedVocabSet[]
  subscribedIds: string[]
  isLoggedIn: boolean
}

export function VocabSetGrid({ sets, subscribedIds, isLoggedIn }: Props) {
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
    setErrors((m) => ({ ...m, [set.id]: null }))
    setPendingId(set.id)
    const wasSubscribed = subscribed.has(set.id)

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
  const isGrouped =
    category === 'all' && query.trim() === '' && !mineOnly && sort === 'recommended'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="단어장 이름·설명 검색"
            aria-label="공용 단어장 검색"
            className="h-11 w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] pl-9 pr-3 font-body text-[14px] text-[var(--t1)] placeholder:text-[var(--t3)] transition-colors focus:border-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--t1)]/10"
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
            className="h-11 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[13px] font-[600] text-[var(--t2)] focus:border-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--t1)]/10"
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
              className={`inline-flex h-11 items-center gap-1.5 rounded-[var(--r-md)] border px-3 font-display text-[13px] font-[600] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t1)]/20 focus-visible:ring-offset-1 ${
                mineOnly
                  ? 'border-[var(--t1)] bg-[var(--t1)] text-[var(--bg)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:bg-[var(--bg2)]'
              }`}
            >
              내 단어장만
              <span
                className={`inline-flex min-w-[18px] justify-center rounded-[var(--r-full)] px-1 text-[11px] tabular-nums ${
                  mineOnly ? 'bg-white/20 text-white' : 'bg-[var(--bg3)] text-[var(--t3)]'
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
        // v06.33 — OTT/Netflix 스타일 카테고리별 가로 carousel
        <VocabSetCarousel
          sets={filtered}
          subscribedIds={subscribed}
          pendingId={pendingId}
          isLoggedIn={isLoggedIn}
          onPreview={setPreviewing}
          onToggle={handleToggle}
          onSelectCategory={(id) => setCategory(id)}
        />
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center">
      <p className="font-display text-[14px] font-[600] text-[var(--t2)]">{title}</p>
      <p className="max-w-[360px] font-body text-[12px] text-[var(--t3)]">{body}</p>
    </div>
  )
}
