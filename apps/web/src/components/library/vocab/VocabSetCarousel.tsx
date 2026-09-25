// apps/web/src/components/library/vocab/VocabSetCarousel.tsx
//
// v06.33 — 도서관 책장 + iPhone coverflow 단어장 선택 인터페이스.
// - 상단 카테고리 탭 (다차원 레벨 전환)
// - 선택 카테고리의 단어장을 3D coverflow (LibraryGrid 패턴 재사용)
// - 중앙 focus 카드 + 좌우 회전 · 화살표 · 키보드 ←/→ · 터치 swipe · dot
// - 책 cover (3:4) 스타일 + 카테고리 색 gradient
// - iOS easing — 부드러운 전환

'use client'

import Image from 'next/image'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { Check, Eye, Loader2, Plus } from 'lucide-react'

import { GradientBookCover } from '@/components/library/shared/GradientBookCover'
import { coverFamilyOf } from '@/lib/vcb/covers/design'
import { VocabCoverArt } from './VocabCoverArt'
import { rungForSet } from '@/lib/library/vocab/rung'
import { VOCAB_SERIES_BRAND } from '@vocaflow/library-pipeline/vocab-brand'
// 카드와 **같은 함수**로 권 표시를 뽑는다 — 두 벌을 두면 매대와 캐러셀이 다른 수를 말한다.
import { volumeMark } from '@vocaflow/library-pipeline/textbook-cover'
import {
  NetflixDetailSheet,
  type DetailVariant,
  type SampleWord,
} from '@/components/library/shared/NetflixDetailSheet'
import { bookCover, categoryIdentity, cefrToVLevel } from '@/lib/library/book-cover'
import { createClient } from '@/lib/supabase/client'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

import { categoryImportance, VOCAB_CATEGORIES, type VocabCategoryId } from './categories'

const IOS_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** 선반 한 판에 서는 권 수 */
const SHELF_SIZE = 5

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

  const prev = useCallback(() => setActive((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setActive((i) => Math.min(last, i + 1)), [last])

  // 카테고리 변경 시 인덱스 reset
  function selectCategory(id: string) {
    setActiveCat(id)
    setActive(0)
  }

  // 키보드 ←/→
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

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
                  ? { backgroundColor: 'var(--t1)', color: 'var(--bg)', boxShadow: `inset 0 -3px 0 ${cc.tint}` }
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

      {/*
        벽 선반 — 참조 shopify.com/editions(WebGL 서가) 렌더 실측 2026-09-25 @1440:
          · 벽 #cdcdcd 단색, 선반 **뒤에만** 흰 조명이 타원으로 번진다(선반 위 벽이 가장 밝다).
          · 선반 판은 표지 줄보다 양쪽으로 길다(뷰포트 ~82%) — 흰 윗면 + 얇은 앞면 + 아래로 긴 그림자.
          · 표지는 정면이 아니라 **아래를 축으로 살짝 뒤로 기댄다**(윗변이 약간 좁다). 권 사이 ~28px.
          · 화면 글자는 작고 회색(13–14px · Inter) — 무게는 표지가 진다. 주 행동만 검정 알약.
        고른 권은 들림 + 검정 테두리로 말한다(색 하나로만 가르지 않는다).
      */}
      <div className="relative w-full overflow-hidden bg-[#cdcdcd]"
        style={{ fontFamily: 'var(--font-admin-sans), "Pretendard Variable", Pretendard, system-ui, sans-serif' }}>
        {/* 좌상단 — 고른 권의 이름과 한 줄(참조 「Everything new across Shopify.」 자리) · 우상단 — 행동 */}
        {activeSet && (
          <div className="relative z-20 flex items-start justify-between gap-6 px-5 pt-4">
            <div key={activeSet.id} className="min-w-0" style={{ animation: `fadeInUp 0.5s ${IOS_EASING}` }}>
              <h2 className="break-keep text-[15px] font-[500] leading-snug text-black [font-family:inherit]">{activeSet.title}</h2>
              <p className="break-keep text-[14px] leading-snug text-[#5c5c5c]">
                <span className="tabular-nums">{activeSet.wordCount.toLocaleString()}</span> 단어
                {activeSet.description ? ` · ${activeSet.description}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void openDetail(activeSet)}
                aria-label={`${activeSet.title} 상세`}
                // 참조 음소거 버튼 — 옅은 원(44px)
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/60 text-black transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                <Eye size={16} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onToggle(activeSet)}
                disabled={pendingId === activeSet.id}
                // 참조 「Start for free」 — 검정 알약 · 흰 글자 · 15px/600. 이 화면의 주 행동.
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[15px] font-[600] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-60 ${
                  subscribedIds.has(activeSet.id)
                    ? 'bg-white text-black hover:bg-[#f4f4f5]'
                    : 'bg-black text-white hover:bg-[#3f3f46]'
                }`}
              >
                {pendingId === activeSet.id ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                ) : subscribedIds.has(activeSet.id) ? (
                  <>
                    <Check size={15} aria-hidden /> 추가됨
                  </>
                ) : (
                  <>
                    <Plus size={15} aria-hidden /> {isLoggedIn ? '내 단어장에 추가' : '담기'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="relative mx-auto flex max-w-[1180px] flex-col gap-[64px] px-16 pb-14 pt-14">
          {Array.from({ length: Math.ceil(items.length / SHELF_SIZE) }, (_, row) => (
            <div key={row} className="relative">
              {/* 선반 뒤 조명 — 흰 타원이 벽에 번진다 */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-8 -top-20 bottom-[-8px] bg-[radial-gradient(55%_65%_at_50%_72%,#ffffff_0%,rgba(255,255,255,0.96)_40%,rgba(255,255,255,0.4)_70%,rgba(255,255,255,0)_100%)]"
              />
              <div className="relative z-10 flex items-end justify-center gap-6">
                {items.slice(row * SHELF_SIZE, row * SHELF_SIZE + SHELF_SIZE).map((set, i) => {
                  const idx = row * SHELF_SIZE + i
                  const isCenter = idx === active
                  return (
                    <div
                      key={set.id}
                      className="w-[160px] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)]"
                      style={{
                        // 아래를 축으로 뒤로 기댄다 — 권마다 기울기가 조금씩 다르다(참조 표지들도 같지 않다).
                        transform: `perspective(900px) rotateX(${4 + (idx % 3)}deg)${isCenter ? ' translateY(-8px)' : ''}`,
                        transformOrigin: '50% 100%',
                      }}
                    >
                      <CoverCard
                        set={set}
                        isCenter={isCenter}
                        isSubscribed={subscribedIds.has(set.id)}
                        isPending={pendingId === set.id}
                        onActivate={() => (isCenter ? void openDetail(set) : setActive(idx))}
                      />
                    </div>
                  )
                })}
              </div>
              {/* 선반 판 — 흰 윗면(4px) + 앞면(8px) + 벽으로 길게 떨어지는 그림자 */}
              <div aria-hidden className="relative -mx-8">
                <div className="h-[4px] bg-[#fbfbfb]" />
                <div className="h-[8px] bg-gradient-to-b from-[#f2f2f2] to-[#e2e2e2] shadow-[0_28px_44px_-6px_rgba(0,0,0,0.32),0_6px_10px_rgba(0,0,0,0.12)]" />
              </div>
            </div>
          ))}
        </div>

        {/*
          하단 목차 — 참조 「2026 / Spring / Everywhere」 세 줄 열. 여기서는 급 · 단어 수 · 이름.
          권 선택 탭을 겸한다(점 인디케이터를 대신한다). 44px 히트영역 유지.
        */}
        {items.length > 1 && (
          <div className="relative z-10 mx-4 border-t border-black/15">
            <div
              role="tablist"
              aria-label="단어장 선택"
              className="flex items-start gap-8 overflow-x-auto px-6 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {items.map((s, idx) => {
                const on = idx === active
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setActive(idx)}
                    className="flex min-h-[44px] shrink-0 flex-col items-start text-left text-[12px] leading-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                  >
                    <span className="text-[#6b6b6b]">{s.cefrLevel ?? '—'}</span>
                    <span className="tabular-nums text-[#6b6b6b]">{s.wordCount.toLocaleString()} 단어</span>
                    <span className={`whitespace-nowrap ${on ? 'font-[600] text-black' : 'text-[#2b2b2b]'}`}>{s.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <NetflixDetailSheet variant={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

// ─── 책 cover 스타일 카드 ─────────────────────────────
function CoverCard({
  set,
  isCenter,
  isSubscribed,
  isPending,
  onActivate,
}: {
  set: PublishedVocabSet
  isCenter: boolean
  isSubscribed: boolean
  isPending: boolean
  onActivate: () => void
}) {
  // 도서와 동일한 무채도 높은(형광 아닌) 톤. **색상은 유형이 정한다** — 같은 갈래가
  // 매대에서 묶여 읽혀야 하므로 카드(`VocabSetCard`)와 같은 색이 나와야 한다.
  const cover = bookCover({
    title: set.title,
    bookVLevel: cefrToVLevel(set.cefrLevel),
    coverFrom: null,
    coverTo: null,
    category: set.category,
  })

  // 표지 규격 — 매대 카드와 같은 각인을 읽는다(`brandLockup`). 없으면 종전 표지.
  const lockup = set.brandLockup
  const { rung } = rungForSet(set)
  const mark = rung ? volumeMark(rung.volumeTitle, VOCAB_SERIES_BRAND) : null

  return (
    <button
      type="button"
      onClick={onActivate}
      // ⚠️ **가운데가 아닌 카드는 탭 순서에서 뺀다** (ARIA APG Carousel).
      //    원근 축소 때문에 옆 카드는 실측 8~38px 이라, 탭으로 거기 멈추면 학습자는
      //    "보이지도 않는 8px 짜리" 에 포커스를 받는다. APG 는 회전 목록에서
      //    **보이지 않는 슬라이드를 접근성 트리와 탭 순서에서 빼고**, 이동은 좌우 화살표와
      //    점 인디케이터(둘 다 44px)가 맡게 하라고 정한다 — 여기 이미 둘 다 있다.
      //    마우스 클릭은 그대로 된다(회전 편의). 실측 2026-08-25.
      tabIndex={isCenter ? undefined : -1}
      aria-hidden={isCenter ? undefined : true}
      aria-label={isCenter ? `${set.title} 미리보기` : `${set.title} 선택`}
      className="focus-visible:ring-[var(--p)]/40 block w-full rounded-[3px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-4"
    >
      <div
        className={`relative w-full overflow-hidden rounded-[3px] transition-shadow ${
          isCenter ? 'shadow-[0_12px_24px_rgba(0,0,0,0.28)] ring-2 ring-black' : 'shadow-[0_8px_16px_rgba(0,0,0,0.20)]'
        }`}
        style={{
          // 판형은 규격이 정한다 — 카드와 같은 이유로 `aspect-[3/4]` 를 뺐다.
          aspectRatio: lockup?.aspectRatio ?? '3 / 4',
          background: `
            radial-gradient(120% 80% at 25% 12%, rgba(255,255,255,0.22) 0%, transparent 45%),
            linear-gradient(155deg, ${cover.from} 0%, ${cover.to} 78%, rgba(0,0,0,0.18) 100%)
          `,
        }}
      >
        {/*
          표지 도판 — **카드와 같은 것을 그린다**(`VocabCoverArt`). 수집이 아니라 그린다.
          한동안 여기만 도판을 빼고 있어서, DB 에 표지가 55/55 인데 서가에서 가장 큰 이
          요소는 그라디언트 상자였다(실측 2026-09-01).
        */}
        <VocabCoverArt
          family={coverFamilyOf(set.brandFamily ?? set.coverImageMeta?.family)}
          artKey={set.slug ?? set.title}
          scrim="hero"
          lockup={lockup}
          volumeMark={mark}
        />
        {/* 클로스바운드 표지 — 중앙 serif 제목 + 단어수. 도판이 있으면 이모지는 뺀다(카드와 같은 규칙). */}
        <GradientBookCover
          title={set.title}
          subtitle={`${set.wordCount.toLocaleString()} 단어`}
          ornament={set.coverImageUrl ? null : set.coverEmoji}
          titleMaxLines={lockup?.titleMaxLines}
          // 규격이 있으면 시리즈는 표지 위쪽 lockup 이 말한다 — 카드와 같은 규칙.
          series={lockup ? null : (rung?.volumeTitle ?? VOCAB_SERIES_BRAND)}
        />

        {/*
          구독 배지 — **아래로 내렸다.** 규격의 권 번호가 오른쪽 위에 앉기 때문이다
          (`VocabCoverArt` 의 lockup 띠). 겹치면 구독 상태가 권 번호를 가린다.
          아래 오른쪽은 비어 있고, 가운데 아래 계열 줄과도 좌표가 겹치지 않는다
          (270px 표지 기준 계열 줄 x 70~200 · 배지 x 236~258).
        */}
        {isSubscribed && (
          <span
            aria-hidden
            className="absolute bottom-3 right-3 inline-flex items-center justify-center rounded-full bg-white/95 p-1 text-[var(--success)] shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
          >
            <Check size={12} strokeWidth={2.5} />
          </span>
        )}
        {isPending && (
          <span aria-hidden className="absolute bottom-3 right-3 text-white">
            <Loader2 size={14} className="animate-spin" />
          </span>
        )}
      </div>
    </button>
  )
}
