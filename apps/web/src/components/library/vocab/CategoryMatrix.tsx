// apps/web/src/components/library/vocab/CategoryMatrix.tsx
//
// 카테고리 매트릭스 — 유아~테마 학습자 단계 시각 그리드.
// 영감: Apple App Store categories · Duolingo course selector · iOS Settings grid.
// - 5×2 desktop / 2×5 mobile
// - active = dark fill / inactive = outline
// - 각 타일: emoji + 라벨 + 세트 개수 (Information scent, Pirolli)

'use client'

import { VOCAB_CATEGORIES, type VocabCategoryId } from './categories'

interface CategoryMatrixProps {
  active: VocabCategoryId
  onChange: (id: VocabCategoryId) => void
  /** category id → 세트 개수 매핑 (Information scent) */
  counts: Record<string, number>
  /** 전체 세트 수 — 'all' 타일에 표시 */
  totalCount: number
}

export function CategoryMatrix({
  active,
  onChange,
  counts,
  totalCount,
}: CategoryMatrixProps) {
  // ⚠️ **모바일은 가로 스크롤 한 줄이다** — 격자로 두면 첫 화면에서 상품을 밀어낸다.
  // 실측 2026-09-01(390px): 이 블록이 200px 을 먹어 첫 상품이 y=913(1.08화면)이 됐고
  // 첫 화면에 상품이 **0개**였다. 상업 모바일 매대(NE능률)는 같은 자리에서 상품 3개다.
  // sm 위로는 가로가 남으므로 격자를 그대로 둔다 — 데스크톱은 이미 시장을 넘고 있다.
  // ⚠️ `overflow-x-auto` 만으로는 부족하다 — 스크롤러 **자기 폭**이 부모를 넘으면
  //    부모가 안 자르므로 문서가 통째로 넓어진다. 실측 2026-09-01: 이 레일이 390px 뷰포트에서
  //    **877px** 로 앉아 `/library/vocab` 모바일이 가로로 **244px** 밀렸다(WCAG 1.4.10 위반 ·
  //    UX 벤치 U3 가 100 → 98.2 로 잡았다). 같은 폴더의 `VocabSetMatrix` 는 이미 `max-w-full` 을
  //    달고 있었다 — 이 레일과 `VocabSetCarousel` 탭 줄만 빠져 있었다.
  //    `min-w-0` 는 flex/grid 자식일 때 min-content 하한을 푸는 짝이다.
  return (
    <nav
      aria-label="단어장 카테고리"
      className="-mx-1 flex min-w-0 max-w-full snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-5"
    >
      {VOCAB_CATEGORIES.map((cat) => {
        const isActive = active === cat.id
        const count = cat.id === 'all' ? totalCount : (counts[cat.id] ?? 0)
        const isEmpty = count === 0 && cat.id !== 'all'

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            aria-pressed={isActive}
            disabled={isEmpty}
            className={`group relative flex min-h-[44px] shrink-0 snap-start flex-row items-center justify-center gap-1.5 rounded-[var(--r-lg)] border px-3 py-2 text-center sm:aspect-[5/4] sm:min-h-0 sm:flex-col sm:gap-2 sm:p-3 transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t1)]/30 focus-visible:ring-offset-2 ${
              isActive
                ? 'border-[var(--t1)] bg-[var(--t1)] text-[var(--bg)] shadow-[var(--sh-md)]'
                : isEmpty
                  ? 'cursor-not-allowed border-[var(--bd)] bg-[var(--bg2)] opacity-50'
                  : 'border-[var(--bd)] bg-[var(--bg)] hover:-translate-y-0.5 hover:border-[var(--t1)] hover:shadow-[var(--sh-md)]'
            }`}
          >
            {/* Count 배지 — 우상단 */}
            <span
              className={`absolute right-2 top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-2 font-mono text-[10px] font-[700] tabular-nums ${
                isActive
                  ? 'bg-[var(--bg)]/15 text-[var(--bg)]'
                  : isEmpty
                    ? 'text-[var(--t2)]'
                    : 'bg-[var(--bg3)] text-[var(--t2)]'
              }`}
            >
              {count}
            </span>

            {/* Emoji = visual anchor */}
            <span
              aria-hidden="true"
              className="text-[32px] leading-none transition-transform duration-[var(--dur-slow)] group-hover:scale-110"
            >
              {cat.emoji}
            </span>

            {/* 라벨 + 힌트 */}
            <div className="flex flex-col items-center gap-1">
              <span
                className={`font-display text-[13px] font-[700] leading-tight ${
                  isActive ? 'text-[var(--bg)]' : 'text-[var(--t1)]'
                }`}
              >
                {cat.label}
              </span>
              <span
                className={`font-body text-[10px] leading-tight ${
                  isActive
                    ? 'text-[var(--bg)]/70'
                    : isEmpty
                      ? 'text-[var(--t2)]'
                      : 'text-[var(--t2)]'
                }`}
              >
                {cat.hint}
              </span>
            </div>
          </button>
        )
      })}
    </nav>
  )
}
