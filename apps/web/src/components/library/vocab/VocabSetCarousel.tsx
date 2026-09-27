// apps/web/src/components/library/vocab/VocabSetCarousel.tsx
//
// v06.33 — 도서관 책장 + iPhone coverflow 단어장 선택 인터페이스.
// - 상단 카테고리 탭 (다차원 레벨 전환)
// - 선택 카테고리의 단어장을 3D coverflow (LibraryGrid 패턴 재사용)
// - 중앙 focus 카드 + 좌우 회전 · 화살표 · 키보드 ←/→ · 터치 swipe · dot
// - 책 cover (3:4) 스타일 + 카테고리 색 gradient
// - iOS easing — 부드러운 전환

'use client'

import dynamic from 'next/dynamic'
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

// 3D 선반 — WebGL 은 브라우저에서만. 불러오는 동안 같은 높이의 빈 자리를 둔다(서가가 튀지 않게).
const VocabShelf3D = dynamic(() => import('./VocabShelf3D'), {
  ssr: false,
  loading: () => <div aria-hidden className="w-full" style={{ height: 420 }} />,
})

/** 선반 한 판에 서는 권 수 */
const SHELF_SIZE = 5
/** 선반 줄마다 권 수 — 참조(Editions)는 위 4 · 아래 5 로 엇갈린다. 짝이 맞지 않으면 벽이 격자로 읽힌다. */
const ROW_PATTERN = [4, SHELF_SIZE] as const

/** 권 번호들을 줄로 나눈다(4 · 5 · 4 · 5 …). */
function shelfRows(n: number): number[][] {
  const rows: number[][] = []
  for (let i = 0, k = 0; i < n; k++) {
    const size = ROW_PATTERN[k % ROW_PATTERN.length] ?? SHELF_SIZE
    rows.push(Array.from({ length: Math.min(size, n - i) }, (_, j) => i + j))
    i += size
  }
  return rows
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
  /** 키보드 포커스가 있는 권 — 3D 책을 당겨 보인다(마우스 가리킴은 3D 가 스스로 안다) */
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null)

  /** 그 권으로 포커스를 옮긴다(캡션·담기 대상도 그 권). */
  function focusCover(i: number) {
    const n = Math.max(0, Math.min(last, i))
    setActive(n)
    coverRefs.current[n]?.focus()
  }

  // 선반 키보드 — 창 전체의 화살표를 가로채지 않는다(본문 스크롤·다른 입력을 빼앗던 종전 전역 리스너를 걷었다).
  function onShelfKey(e: React.KeyboardEvent) {
    // ↑/↓ — 줄 길이가 달라(4·5) 번호 차가 일정하지 않다. 가운데 정렬 기준으로 **보이는 위치가 가장 가까운** 권으로 간다.
    const rows = shelfRows(items.length)
    const ri = rows.findIndex((row) => row.includes(active))
    const vertical = (dir: -1 | 1) => {
      const from = rows[ri]
      const to = rows[ri + dir]
      if (!from || !to) return active
      const col = from.indexOf(active) + (to.length - from.length) / 2
      return to[Math.max(0, Math.min(to.length - 1, Math.round(col)))] ?? active
    }
    const move: Record<string, number> = {
      ArrowLeft: active - 1,
      ArrowRight: active + 1,
      ArrowUp: vertical(-1),
      ArrowDown: vertical(1),
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
        className="relative mx-[calc(50%-50vw)] self-stretch overflow-hidden bg-[var(--bg2)]"
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
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg3)] text-[#2b2b2b] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
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
          className="relative mx-auto max-w-[1400px] px-6 pb-6 pt-10"
        >
          <VocabShelf3D
            rows={shelfRows(items.length).map((row) => row.flatMap((idx) => (items[idx] ? [{ set: items[idx], idx }] : [])))}
            focused={focusedIdx}
            onPoint={setActive}
            onOpen={(set, idx) => {
              setActive(idx)
              void openDetail(set)
            }}
            renderHit={({ set, idx }, style) => (
              // 키보드·스크린리더용 진짜 버튼 — 3D 책과 같은 자리에 겹친다. 마우스는 통과시킨다(3D 가 받는다).
              <button
                key={set.id}
                ref={(el) => {
                  coverRefs.current[idx] = el
                }}
                type="button"
                tabIndex={idx === active ? 0 : -1}
                aria-label={`${set.title} · ${set.wordCount.toLocaleString()} 단어${subscribedIds.has(set.id) ? ' · 추가됨' : ''} — 상세 열기`}
                onClick={() => {
                  setActive(idx)
                  void openDetail(set)
                }}
                onFocus={() => {
                  setActive(idx)
                  setFocusedIdx(idx)
                }}
                onBlur={() => setFocusedIdx((f) => (f === idx ? null : f))}
                className="pointer-events-none rounded-[2px] bg-transparent outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                style={style}
              />
            )}
          />
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
