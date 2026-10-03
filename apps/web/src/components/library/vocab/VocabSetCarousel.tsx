// apps/web/src/components/library/vocab/VocabSetCarousel.tsx
// Tines Library의 분류 칩 · 틴트 미디어 카드 · 상세 팝업. 실제 교재 표지는 콘텐츠로 유지한다.

'use client'

import Image from 'next/image'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRef, useState } from 'react'
import { Check, Eye, Loader2, Plus } from 'lucide-react'

import {
  NetflixDetailSheet,
  type DetailVariant,
  type SampleWord,
} from '@/components/library/shared/NetflixDetailSheet'
import { categoryIdentity } from '@/lib/library/book-cover'
import { createClient } from '@/lib/supabase/client'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

import { categoryImportance, VOCAB_CATEGORIES, type VocabCategoryId } from './categories'
import { VocabTradeCover } from './VocabTradeCover'
import { VocabCoverArt } from './VocabCoverArt'
import { GradientBookCover } from '@/components/library/shared/GradientBookCover'
import { coverFamilyOf } from '@/lib/vcb/covers/design'
import { BTN, DIALOG } from '@/components/ui/tines-kit'

/** 반응형 격자의 실제 위치를 사용한다. 2열/4열·마지막 짧은 줄에서 같은 열에 가까운 카드로 이동. */
export function nearestCatalogRow(rects: { top: number; left: number }[], active: number, direction: -1 | 1): number {
  const origin = rects[active]
  if (!origin) return active
  const candidates = rects.map((rect, index) => ({ ...rect, index })).filter(rect => direction * (rect.top - origin.top) > 1)
  const nextTop = candidates.sort((a, b) => Math.abs(a.top - origin.top) - Math.abs(b.top - origin.top))[0]?.top
  return candidates.filter(rect => rect.top === nextTop).sort((a, b) => Math.abs(a.left - origin.left) - Math.abs(b.left - origin.left))[0]?.index ?? active
}

/**
 * 유형 색은 `lib/library/book-cover` 의 `categoryIdentity` 한 곳에서 온다.
 *
 * ⚠️ 여기 있던 지역 표(`CATEGORY_COLOR`, 형광 tailwind-400 계열 9종)를 지웠다 —
 *   표지 색표와 **서로 다른 말을 하고 있었다**(수능·내신이 칩에서는 호박, 표지에서는 인디고).
 *   `preschool` 도 빠져 있어 유아 단어장이 조용히 테마 색으로 떨어졌다.
 *   유형을 더할 곳은 이제 `CATEGORY_HUE` 한 곳이다.
 *
 * 모르는 유형은 `null` 이 온다 — 다른 유형의 색을 빌리지 않고 중립으로 그린다.
 */
const NEUTRAL_IDENTITY = {
  accent: 'var(--t2)',
  tint: 'var(--bg3)',
  ink: 'var(--t2)',
  from: 'var(--bg3)',
  to: 'var(--bg3)',
}
const identityOf = (id: string) => categoryIdentity(id) ?? NEUTRAL_IDENTITY

interface Props {
  sets: PublishedVocabSet[]
  subscribedIds: Set<string>
  pendingId: string | null
  isLoggedIn: boolean
  onPreview: (set: PublishedVocabSet) => void
  onToggle: (set: PublishedVocabSet) => void
  onSelectCategory: (id: VocabCategoryId) => void
}

export function VocabSetCarousel({ sets, subscribedIds, pendingId, isLoggedIn, onToggle }: Props) {
  // 데이터 있는 카테고리만 탭으로 — 중요도순(수능·내신→교육과정→공인→테마)
  const categories = VOCAB_CATEGORIES.filter(
    (c) => c.id !== 'all' && sets.some((s) => s.category === c.id)
  ).sort((a, b) => categoryImportance(b.id) - categoryImportance(a.id))
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? 'csat')
  const [active, setActive] = useState(0)
  const [detail, setDetail] = useState<DetailVariant | null>(null)

  async function openDetail(set: PublishedVocabSet) {
    const cat = VOCAB_CATEGORIES.find((c) => c.id === set.category)
    const color = identityOf(set.category)
    // 단어 sample fetch (8개)
    const supabase = createClient()
    const { data } = await supabase
      .from('shared_words')
      .select('word, meaning_ko, part_of_speech, cefr_level')
      .eq('set_id', set.id)
      .order('sort_order', { ascending: true })
      .limit(8)
    const samples: SampleWord[] = (data ?? []).map((r) => ({
      word: (r as { word: string }).word,
      meaningKo: (r as { meaning_ko: string }).meaning_ko,
      partOfSpeech: (r as { part_of_speech: string | null }).part_of_speech,
      cefrLevel: (r as { cefr_level: string | null }).cefr_level,
    }))

    // 세트 내부 챕터 수 — chaptered 세트면 상세에 "챕터" 노출 (chapter 컬럼: loose client)
    const { data: chRow } = await (supabase as unknown as SupabaseClient)
      .from('shared_words')
      .select('chapter')
      .eq('set_id', set.id)
      .not('chapter', 'is', null)
      .order('chapter', { ascending: false })
      .limit(1)
    const chapterCount = (chRow?.[0] as { chapter: number | null } | undefined)?.chapter ?? null

    setDetail({
      type: 'vocab',
      id: set.id,
      title: set.title,
      description: set.description,
      category: set.category,
      categoryLabel: cat?.label ?? set.category,
      categoryColor: color,
      cefrLevel: set.cefrLevel,
      wordCount: set.wordCount,
      chapterCount,
      coverEmoji: set.coverEmoji,
      samples,
      ctaLabel: subscribedIds.has(set.id) ? '추가됨 — 해지' : '내 단어장에 추가',
      onCtaClick: () => {
        onToggle(set)
        setDetail(null)
      },
      ctaPending: pendingId === set.id,
    })
  }

  const items = sets.filter((s) => s.category === activeCat)
  const last = items.length - 1
  const activeSet = items[active]

  const coverRefs = useRef<(HTMLButtonElement | null)[]>([])

  /** 그 권으로 포커스를 옮긴다(캡션·담기 대상도 그 권). */
  function focusCover(i: number) {
    const n = Math.max(0, Math.min(last, i))
    setActive(n)
    coverRefs.current[n]?.focus()
  }

  // 선반 키보드 — 창 전체의 화살표를 가로채지 않는다(본문 스크롤·다른 입력을 빼앗던 종전 전역 리스너를 걷었다).
  function onShelfKey(e: React.KeyboardEvent) {
    const rects = items.map((_, index) => coverRefs.current[index]?.getBoundingClientRect() ?? { top: 0, left: 0 })
    const move: Record<string, number> = {
      ArrowLeft: active - 1,
      ArrowRight: active + 1,
      ArrowUp: nearestCatalogRow(rects, active, -1),
      ArrowDown: nearestCatalogRow(rects, active, 1),
      Home: 0,
      End: last,
    }
    const to = move[e.key]
    if (to === undefined) return
    e.preventDefault()
    focusCover(to)
  }

  // 카테고리 변경 시 인덱스 reset
  function selectCategory(id: string) {
    setActiveCat(id)
    setActive(0)
  }

  if (items.length === 0) return null

  return (
    <div className="flex flex-col items-center gap-5">
      {/* 카테고리 탭 (다차원 레벨 전환) */}
      <div
        role="tablist"
        aria-label="카테고리"
        /*
          ⚠️ 모바일에서 `flex-wrap` 이 여러 줄로 접혀 **200px** 을 먹었다(실측 2026-09-01).
             그만큼 상품이 첫 화면 밖으로 밀려 학습자가 상품을 하나도 못 봤다.

          ⚠️ **데스크톱도 같은 문제였다**(실측 2026-09-07 · 1280×900): `sm:flex-wrap` 이
             칩 여덟 개를 두 줄로 접어 **52px** 을 더 먹었고, 그 탓에 첫 표지의 제목이
             y=959 로 접힘(900) 아래였다 — 첫 화면에 제목이 읽히는 책이 한 권도 없었다.
             그래서 **모든 너비에서 한 줄로 굴린다.** 가로 스크롤 레일은 서가의 표준형이고
             (칩이 늘어도 높이가 안 변한다), 줄바꿈은 칩 수에 따라 높이가 요동친다.
        */
        /*
          오른쪽 끝을 흐려 **더 있다는 것**을 알린다. 한 줄로 굴리면 마지막 칩이 그냥 잘려
          보이는데, 잘림은 "여기서 끝" 과 구별되지 않는다(실측 화면에서 「테마별」이 끊겨 있었다).
          마스크는 스크롤 위치와 무관하게 늘 오른쪽만 흐리므로 끝까지 굴린 뒤에도 남는데,
          그게 화살표 버튼을 더 얹는 것보다 조용하다(Calm UI).
        */
        style={{
          maskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 36px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, #000 0, #000 calc(100% - 36px), transparent 100%)',
        }}
        className="-mx-1 flex min-w-0 max-w-full snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:justify-start sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((c) => {
          const isActive = c.id === activeCat
          const cc = identityOf(c.id)
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => selectCategory(c.id)}
              // 44px 하한 — 실측 32px 였다(카테고리 칩 7종 전부).
              // **비활성 칩도 자기 유형 색을 입는다.** 활성 하나만 칠하면 나머지 일곱은
              //   전부 같은 회색이라, 여덟 유형이 한자리에 보이는 이 유일한 줄이
              //   "고를 것이 하나" 처럼 읽힌다(실측 2026-09-01 — 표지는 한 번에 한 유형만 뜬다).
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-2 pl-2.5 pr-4 font-display text-[13px] font-[700] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] ${
                isActive ? '' : 'hover:brightness-[0.97]'
              }`}
              style={
                // v07 — 활성 칩은 **잉크**로 채우고 유형 색은 밑줄로만 남긴다. 원색 면(수능·내신 =
                //   인디고 한 덩어리)이 첫 화면에서 가장 큰 색 면적이었다 — 판면의 색은 주묵 하나다.
                isActive
                  ? { backgroundColor: 'var(--p)', color: 'var(--on-p)' }
                  : { backgroundColor: cc.tint, color: cc.ink }
              }
            >
              {/* DD-68 · tines-mapping §18 — 분류 소품(참조 칩 앞 아이콘 자리). 소품이 없는 분류는 글자만 */}
              {'spot' in c && (
                <Image src={`/illustrations/tines/${c.spot}.webp`} alt="" width={64} height={64} className="h-6 w-6 shrink-0 select-none" />
              )}
              {c.label}
              <span
                className={`rounded-full px-1.5 font-mono text-[10px] tabular-nums ${
                  // ⚠️ 흰 막은 강조색 바탕을 **밝혀서** 그 위의 흰 글자를 깎는다
                  //    (실측 2026-08-22: 3.34:1). 같은 분리감을 어둡히는 쪽으로 낸다.
                  isActive ? 'bg-black/25' : 'bg-black/[0.07]'
                }`}
              >
                {sets.filter((s) => s.category === c.id).length}
              </span>
            </button>
          )
        })}
      </div>

      <div className="w-full">
        {activeSet && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--bd)] pb-5">
            <div className="min-w-0 flex-1" aria-live="polite">
              <h2 className="break-keep font-display text-[24px] font-[600] leading-tight text-[var(--t1)]">{activeSet.title}</h2>
              <p className="mt-2 break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
                <span className="tabular-nums">{activeSet.wordCount.toLocaleString()}</span> 단어
                {activeSet.description ? ` · ${activeSet.description}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void openDetail(activeSet)} aria-label={`${activeSet.title} 상세`} className={DIALOG.iconBtn}><Eye size={18} aria-hidden /></button>
              <button type="button" onClick={() => onToggle(activeSet)} disabled={pendingId === activeSet.id} className={subscribedIds.has(activeSet.id) ? BTN.secondary : BTN.primary}>
                {pendingId === activeSet.id ? <Loader2 size={16} className="animate-spin" aria-hidden /> : subscribedIds.has(activeSet.id) ? <><Check size={16} aria-hidden /> 추가됨</> : <><Plus size={16} aria-hidden /> {isLoggedIn ? '내 단어장에 추가' : '담기'}</>}
              </button>
            </div>
          </div>
        )}
        <div role="group" aria-label="단어장 목록 — 화살표로 이동, Enter 로 열기" onKeyDown={onShelfKey} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((set, index) => (
            <button key={set.id} type="button" ref={element => { coverRefs.current[index] = element }} tabIndex={index === active ? 0 : -1}
              aria-label={`${set.title} · ${set.wordCount.toLocaleString()} 단어${subscribedIds.has(set.id) ? ' · 추가됨' : ''} — 상세 열기`}
              onClick={() => { setActive(index); void openDetail(set) }} onFocus={() => setActive(index)} onPointerEnter={() => setActive(index)}
              className="group flex min-w-0 flex-col overflow-hidden rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] text-left transition-colors hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--p)]">
              <span className="tone-lavender dots relative flex w-full items-center justify-center p-5 sm:p-7">
                <span className="relative block aspect-[152/225] w-full max-w-[152px] overflow-hidden rounded-[4px] bg-[var(--deep-charcoal)] shadow-[var(--sh-md)]">
                  {set.coverImageMeta?.trade ? <VocabTradeCover set={set} spec={set.coverImageMeta.trade} className="absolute inset-0 block" /> : <>
                    <VocabCoverArt family={coverFamilyOf(set.brandFamily ?? set.coverImageMeta?.family ?? null)} artKey={set.slug ?? set.title} scrim="hero" lockup={set.brandLockup} />
                    <GradientBookCover title={set.title} subtitle={`${set.wordCount.toLocaleString()} 단어`} ornament={null} compact />
                  </>}
                </span>
              </span>
              <span className="flex w-full flex-1 flex-col gap-2 p-4 sm:p-5">
                <span className="font-mono text-[11px] uppercase text-[var(--t2)]">{set.cefrLevel ?? 'Vocabulary'}</span>
                <span className="break-keep font-display text-[16px] font-[600] leading-snug text-[var(--t1)]">{set.title}</span>
                <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 font-body text-[12px] text-[var(--t2)]">
                  <span>{set.wordCount.toLocaleString()} 단어</span>
                  {subscribedIds.has(set.id) ? <span className="inline-flex items-center gap-1"><Check size={14} aria-hidden /> 추가됨</span> : <span className="group-hover:underline">자세히 보기 →</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <NetflixDetailSheet variant={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
