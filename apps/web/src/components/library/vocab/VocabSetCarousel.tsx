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
import { forwardRef, useRef, useState } from 'react'
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

  const coverRefs = useRef<(HTMLButtonElement | null)[]>([])

  /** 그 권으로 포커스를 옮긴다(캡션·담기 대상도 그 권). */
  function focusCover(i: number) {
    const n = Math.max(0, Math.min(last, i))
    setActive(n)
    coverRefs.current[n]?.focus()
  }

  // 선반 키보드 — 창 전체의 화살표를 가로채지 않는다(본문 스크롤·다른 입력을 빼앗던 종전 전역 리스너를 걷었다).
  function onShelfKey(e: React.KeyboardEvent) {
    const move: Record<string, number> = {
      ArrowLeft: active - 1,
      ArrowRight: active + 1,
      ArrowUp: active - SHELF_SIZE,
      ArrowDown: active + SHELF_SIZE,
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
          · 벽은 **화면 전폭** #cdcdcd, 선반 뒤에만 흰 조명이 타원으로 번진다. 벽이 선반 위아래로 넉넉히 비어 있다.
          · 표지는 **정사각** ~196px, 권 사이 ~30px, 아래를 축으로 살짝 뒤로 기댄다. 선반 판은 표지 줄보다 양쪽 ~110px 길다.
          · 좌상단 작은 회색 두 줄(지금 가리킨 권) · 우상단 옅은 원 + 검정 알약 · 하단 괘선 위 3줄 목차.
        인터랙션(참조와 같은 문법): 가리키면(hover·focus) 그 권이 **앞으로 당겨지고 포인터 쪽으로 기울며**
        좌상단 캡션이 그 권으로 바뀐다. 누르면(click·Enter·Space) 상세가 열린다.
        키보드: 표지 묶음은 탭 정지 하나(roving tabindex) — ←/→ 한 권, ↑/↓ 한 선반, Home/End 처음·끝.
      */}
      <div
        className="relative mx-[calc(50%-50vw)] self-stretch overflow-hidden bg-[#cdcdcd]"
        style={{ fontFamily: 'var(--font-admin-sans), "Pretendard Variable", Pretendard, system-ui, sans-serif' }}
      >
        {activeSet && (
          <div className="relative z-20 flex items-start justify-between gap-6 px-4 pt-4">
            <div key={activeSet.id} className="min-w-0" aria-live="polite">
              <h2 className="break-keep text-[14px] font-[400] leading-[18px] text-[#3c3c3c] [font-family:inherit]">{activeSet.title}</h2>
              <p className="break-keep text-[14px] leading-[18px] text-[#6a6a6a]">
                <span className="tabular-nums">{activeSet.wordCount.toLocaleString()}</span> 단어
                {activeSet.description ? ` · ${activeSet.description}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void openDetail(activeSet)}
                aria-label={`${activeSet.title} 상세`}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#dedede] text-[#2b2b2b] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                <Eye size={16} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onToggle(activeSet)}
                disabled={pendingId === activeSet.id}
                // 참조 「Start for free」 — 검정 알약 · 흰 글자 · 15px/600
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[15px] font-[600] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-60 ${
                  subscribedIds.has(activeSet.id) ? 'bg-white text-black hover:bg-[#f4f4f5]' : 'bg-black text-white hover:bg-[#3f3f46]'
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

        <div
          role="group"
          aria-label="단어장 선반 — 화살표로 이동, Enter 로 열기"
          onKeyDown={onShelfKey}
          className="relative mx-auto flex max-w-[1240px] flex-col gap-[60px] px-[120px] pb-[120px] pt-[110px]"
        >
          {Array.from({ length: Math.ceil(items.length / SHELF_SIZE) }, (_, row) => (
            <div key={row} className="relative">
              {/* 선반 뒤 조명 — 흰 타원이 벽에 번진다(참조: 선반 위 벽이 화면에서 가장 밝다) */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-[140px] -top-[90px] bottom-[-30px] bg-[radial-gradient(52%_62%_at_50%_70%,#ffffff_0%,rgba(255,255,255,0.97)_38%,rgba(255,255,255,0.45)_68%,rgba(255,255,255,0)_100%)]"
              />
              <div className="relative z-10 flex items-end justify-center gap-[30px]">
                {items.slice(row * SHELF_SIZE, row * SHELF_SIZE + SHELF_SIZE).map((set, i) => {
                  const idx = row * SHELF_SIZE + i
                  return (
                    <EditionCover
                      key={set.id}
                      ref={(el) => { coverRefs.current[idx] = el }}
                      set={set}
                      lean={4 + ((idx * 7) % 3)}
                      isActive={idx === active}
                      isSubscribed={subscribedIds.has(set.id)}
                      isPending={pendingId === set.id}
                      onPoint={() => setActive(idx)}
                      onOpen={() => { setActive(idx); void openDetail(set) }}
                    />
                  )
                })}
              </div>
              {/* 선반 판 — 흰 윗면 + 앞면 + 벽으로 길게 떨어지는 그림자. 표지 줄보다 양쪽이 길다. */}
              <div aria-hidden className="relative -mx-[110px]">
                <div className="h-[5px] bg-[#fdfdfd]" />
                <div className="h-[9px] bg-gradient-to-b from-[#f3f3f3] to-[#e0e0e0] shadow-[0_34px_50px_-8px_rgba(0,0,0,0.30),0_6px_10px_rgba(0,0,0,0.12)]" />
              </div>
            </div>
          ))}
        </div>

        {/* 하단 목차 — 참조 「2026 / Spring / Everywhere」. 급 · 단어 수 · 이름. 누르면 그 권으로 포커스가 간다. */}
        {items.length > 1 && (
          <div className="relative z-10 mx-4 border-t border-black/15">
            <div className="mx-auto flex max-w-[1240px] items-start justify-center gap-10 overflow-x-auto px-6 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {items.map((s, idx) => {
                const on = idx === active
                return (
                  <button
                    key={s.id}
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => focusCover(idx)}
                    onPointerEnter={() => setActive(idx)}
                    className="flex min-h-[44px] shrink-0 flex-col items-start text-left text-[12px] leading-[16px]"
                  >
                    <span className="text-[#6b6b6b]">{s.cefrLevel ?? '—'}</span>
                    <span className="tabular-nums text-[#6b6b6b]">{s.wordCount.toLocaleString()} 단어</span>
                    <span className={`whitespace-nowrap transition-colors ${on ? 'text-black' : 'text-[#3a3a3a]'}`}>{s.title}</span>
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

// ─── 에디션 표지 — 선반에 서는 정사각 한 권 ─────────────────────────────
//
// 참조 서가의 손맛을 옮긴다: 가리키면 표지가 **앞으로 당겨지고(들림 + 확대) 포인터 쪽으로 기울며**,
// 표면에 빛이 포인터를 따라 번진다. 손을 떼면 제자리(뒤로 살짝 기댄 자세)로 돌아간다.
// 표지 그림은 `cover_image_meta.edition`(scripts/vcb/editions 생성) — 없으면 종전 표지 도판으로 그린다.
// prefers-reduced-motion: 이동·회전·확대를 빼고 빛(페이드)만 남긴다.
const EditionCover = forwardRef<
  HTMLButtonElement,
  {
    set: PublishedVocabSet
    /** 뒤로 기댄 각도(도) — 권마다 조금씩 다르다 */
    lean: number
    isActive: boolean
    isSubscribed: boolean
    isPending: boolean
    /** 가리킴(hover·focus) — 캡션을 이 권으로 */
    onPoint: () => void
    onOpen: () => void
  }
>(function EditionCover({ set, lean, isActive, isSubscribed, isPending, onPoint, onOpen }, ref) {
  const [hot, setHot] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [moving, setMoving] = useState(false)
  const ed = set.coverImageMeta?.edition

  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setTilt({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
    setMoving(true)
  }

  const transform = hot
    ? `perspective(1000px) translate3d(0,-10px,40px) rotateX(${(lean * 0.3 - tilt.y * 10).toFixed(2)}deg) rotateY(${(tilt.x * 14).toFixed(2)}deg) scale(1.06)`
    : `perspective(1000px) rotateX(${lean}deg)`

  return (
    <button
      ref={ref}
      type="button"
      // roving tabindex — 선반 전체가 탭 정지 하나다. 이동은 화살표(부모 onShelfKey).
      tabIndex={isActive ? 0 : -1}
      aria-label={`${set.title} · ${set.wordCount.toLocaleString()} 단어${isSubscribed ? ' · 추가됨' : ''} — 상세 열기`}
      onClick={onOpen}
      onPointerEnter={() => { setHot(true); onPoint() }}
      onPointerLeave={() => { setHot(false); setMoving(false); setTilt({ x: 0, y: 0 }) }}
      onPointerMove={onMove}
      onFocus={() => { setHot(true); onPoint() }}
      onBlur={() => { setHot(false); setTilt({ x: 0, y: 0 }) }}
      className="group relative block aspect-square w-[196px] shrink-0 rounded-[2px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-black motion-reduce:![transform:none]"
      style={{
        transform,
        transformOrigin: '50% 100%',
        transition: `transform ${moving ? 140 : 520}ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 520ms cubic-bezier(0.22, 1, 0.36, 1)`,
        boxShadow: hot
          ? '0 34px 44px -10px rgba(0,0,0,0.38), 0 8px 14px rgba(0,0,0,0.16)'
          : '0 12px 16px -6px rgba(0,0,0,0.30), 0 2px 4px rgba(0,0,0,0.10)',
        zIndex: hot ? 5 : 1,
      }}
    >
      <span className="absolute inset-0 overflow-hidden rounded-[2px] bg-[#1d1d1f]">
        {ed ? (
          <>
            <Image src={`${ed.src}?v=${ed.v}`} alt="" fill sizes="220px" className="object-cover" draggable={false} />
            {/* 제목 — 표지 위쪽 30% 의 조용한 면에 앉는다(생성 프롬프트가 비워 둔 자리). 굵고 촘촘하게. */}
            <span
              className={`absolute inset-x-0 top-0 px-3 pt-3 text-left text-[21px] font-[800] leading-[1.02] tracking-[-0.03em] break-keep ${
                ed.title_ink === 'dark' ? 'text-black' : 'text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.35)]'
              }`}
            >
              {set.title}
            </span>
          </>
        ) : (
          <FallbackArt set={set} />
        )}
        {/* 빛 — 포인터를 따라 표면에 번진다(참조 표지의 광택). 모션 감소에서도 남는다(페이드). */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            opacity: hot ? 1 : 0,
            background: `radial-gradient(60% 60% at ${50 + tilt.x * 100}% ${50 + tilt.y * 100}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 60%)`,
            mixBlendMode: 'soft-light',
          }}
        />
        {isSubscribed && (
          <span
            aria-hidden
            className="absolute bottom-2 right-2 inline-flex items-center justify-center rounded-full bg-white p-1 text-black shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
          >
            <Check size={12} strokeWidth={2.5} />
          </span>
        )}
        {isPending && (
          <span aria-hidden className="absolute bottom-2 right-2 text-white">
            <Loader2 size={14} className="animate-spin" />
          </span>
        )}
      </span>
    </button>
  )
})

/** 에디션 그림이 아직 없는 권 — 종전 표지 도판을 정사각 면에 그린다. */
function FallbackArt({ set }: { set: PublishedVocabSet }) {
  const cover = bookCover({
    title: set.title,
    bookVLevel: cefrToVLevel(set.cefrLevel),
    coverFrom: null,
    coverTo: null,
    category: set.category,
  })
  const lockup = set.brandLockup
  const { rung } = rungForSet(set)
  const mark = rung ? volumeMark(rung.volumeTitle, VOCAB_SERIES_BRAND) : null
  return (
    <span
      className="absolute inset-0"
      style={{ background: `linear-gradient(155deg, ${cover.from} 0%, ${cover.to} 78%, rgba(0,0,0,0.18) 100%)` }}
    >
      <VocabCoverArt
        family={coverFamilyOf(set.brandFamily ?? set.coverImageMeta?.family)}
        artKey={set.slug ?? set.title}
        scrim="hero"
        lockup={lockup}
        volumeMark={mark}
      />
      <GradientBookCover
        title={set.title}
        subtitle={`${set.wordCount.toLocaleString()} 단어`}
        ornament={set.coverImageUrl ? null : set.coverEmoji}
        titleMaxLines={lockup?.titleMaxLines}
        series={lockup ? null : (rung?.volumeTitle ?? VOCAB_SERIES_BRAND)}
      />
    </span>
  )
}
