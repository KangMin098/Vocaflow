// apps/web/src/components/library/textbooks/ShelfControls.tsx
//
// 매대의 **찾기·줄세우기·진열** 컨트롤과 **표지·격자 카드**.
//
// ── 왜 이 파일이 생겼나 ────────────────────────────────────────────
// 매대 지수를 처음 실측했더니(`scripts/textbook/catalog-benchmark.mjs`) 검색·정렬·진열 축이
// **0/9** 였다. 경쟁 상업 카탈로그(NE_Books 관측 2026-08-30)는 89종을 놓고 검색창·정렬 4종·
// 목록/격자·판매중만 보기를 함께 낸다. 우리는 7권이라 "적으니 필요 없다" 고 넘겨 왔는데,
// **권 수가 적은 것과 찾을 방법이 없는 것은 다른 문제**였다.
//
// `TextbookShelf.tsx` 에 그대로 넣지 않은 이유는 그 파일이 이미 380줄이고,
// 진열 로직과 컨트롤이 한 파일에서 섞이면 둘 다 읽기 어려워지기 때문이다.

'use client'

import { BookOpen, LayoutGrid, Layers, List, Search } from 'lucide-react'
import Link from 'next/link'
import { useId } from 'react'

import { TextbookPickButton } from '@/components/library/textbooks/TextbookPickButton'
import type { ShelfVolume } from '@/lib/textbook/shelf'
import { SHELF_SORTS, SHELF_VIEWS, type ShelfView } from '@/lib/textbook/shelf-search'
import { STATUS_LABEL } from '@/lib/textbook/shelf-status'

/**
 * 권 **표지**.
 *
 * ── 왜 그리는가 ────────────────────────────────────────────────────
 * 상업 교재 카탈로그의 낱권 첫 칸은 언제나 표지다 — 학습자가 3초 안에 "내 것인가" 를
 * 판단하는 자리이고, 표지가 없는 목록은 스프레드시트로 읽힌다. 우리는 인쇄물이 아니라
 * 표지 이미지가 없다. 그래서 **재고 데이터에서 표지를 만든다** — 계단 번호·제목·학령·
 * V레벨은 전부 파이프라인이 이미 아는 값이다. 디자이너 원본이 필요 없다.
 *
 * ⚠️ 색을 **계단 번호에서 결정론적으로** 뽑는다. 난수를 쓰면 SSR 과 클라이언트가 달라져
 *    hydration 이 깨지고, 새로고침마다 표지 색이 바뀌면 학습자가 같은 책을 다른 책으로 읽는다.
 * ⚠️ 색만으로 상태를 가르지 않는다(색맹 대응) — 번호·학령이 표지에 함께 인쇄되고,
 *    준비 안 된 권은 채도를 죽여 색 밖에서도 읽히게 한다.
 */
export function VolumeCover({ volume: v, size = 'sm' }: { volume: ShelfVolume; size?: 'sm' | 'lg' }) {
  const ready = v.status === 'ready'
  // 계단 7개를 색상환에 고르게 편다. 브랜드 액센트에서 출발해 한 바퀴 안에서만 움직인다.
  const hue = (208 + (v.step - 1) * 26) % 360
  const lg = size === 'lg'

  return (
    <div
      aria-hidden
      className={`flex shrink-0 flex-col justify-between overflow-hidden rounded-[var(--r-sm)] ${
        lg ? 'h-[128px] w-[92px] p-2.5' : 'h-[62px] w-[46px] p-1.5'
      }`}
      style={{
        // 생성물이라 토큰이 없다 — 게임 전용 예외와 같은 자리다(CLAUDE.md 하드코딩 금지 예외).
        background: ready
          ? `linear-gradient(160deg, hsl(${hue} 46% 34%), hsl(${hue} 52% 22%))`
          : 'var(--bg3)',
        color: ready ? '#fff' : 'var(--t2)',
      }}
    >
      <span
        className={`font-mono font-[700] uppercase tracking-[0.1em] opacity-80 ${lg ? 'text-[8px]' : 'text-[9px]'}`}
      >
        STEP
      </span>
      <span
        className={`font-display font-[800] leading-none tabular-nums ${lg ? 'text-[34px]' : 'text-[22px]'}`}
      >
        {v.step}
      </span>
      {lg && (
        <span className="font-display text-[9px] font-[700] leading-[1.3] opacity-90 [word-break:keep-all]">
          {v.schoolBand}
        </span>
      )}
    </div>
  )
}

/**
 * 격자 진열용 카드. 목록(`VolumeRow`)이 유형 칩까지 펼쳐 보이는 반면,
 * 격자는 **표지를 크게** 두고 한눈에 훑게 한다 — 상업 카탈로그의 목록/격자 토글과 같은 분업이다.
 */
export function VolumeCard({
  volume: v,
  picked,
  canPick,
  signedIn,
}: {
  volume: ShelfVolume
  picked: boolean
  canPick: boolean
  signedIn: boolean
}) {
  const ready = v.status === 'ready'

  return (
    <article
      className={`flex h-full flex-col gap-3 rounded-[var(--r-lg)] border p-4 ${
        ready ? 'border-[var(--bd)] bg-[var(--bg)]' : 'border-dashed border-[var(--bd)] bg-[var(--bg2)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <VolumeCover volume={v} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-editorial text-[17px] font-[500] leading-snug text-[var(--t1)]">
            {v.title}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10px] tabular-nums text-[var(--t2)]">
            <span>{v.schoolBand}</span>
            <span>· V{v.vLevels.join('·V')}</span>
          </p>
          <p className="mt-1.5 font-mono text-[11px] tabular-nums text-[var(--t2)]">
            문항 {v.itemCount.toLocaleString()} · 유형 {v.types.length}종
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {canPick && (
          <TextbookPickButton
            step={v.step}
            title={v.title}
            picked={picked}
            signedIn={signedIn}
            size="sm"
          />
        )}
        {ready ? (
          <Link
            href={`/library/textbooks/${v.step}`}
            aria-label={`${v.title} 펼쳐 보기`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-ios-pill bg-[var(--p)] px-4 font-display text-[12.5px] font-[700] text-[var(--on-p)] no-underline motion-safe:transition-all motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          >
            <BookOpen size={14} aria-hidden />
            {STATUS_LABEL[v.status]}
          </Link>
        ) : (
          <span className="inline-flex min-h-[44px] items-center gap-2 rounded-ios-pill border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12.5px] font-[700] text-[var(--t2)]">
            <Layers size={14} aria-hidden />
            {STATUS_LABEL[v.status]}
          </span>
        )}
      </div>
    </article>
  )
}

/**
 * 찾기(검색) · 줄세우기(정렬) · 진열(목록/격자) · 좁히기(준비된 권만).
 *
 * ── 왜 필터와 따로 두는가 ──────────────────────────────────────────
 * `FilterBar` 는 **분류 체계**(학령·수준·유형·출처)를 보여 준다 — 무엇이 있는지 가르치는 자리다.
 * 여기는 **이미 아는 것을 빨리 꺼내는** 자리다. 둘을 한 상자에 넣으면 칩 21개 사이에
 * 검색창이 파묻힌다(칩 때문에 이미 "첫 권까지 Tab 24번" 문제를 겪은 화면이다).
 *
 * ⚠️ 정렬은 네이티브 `<select>` 다. 커스텀 드롭다운으로 만들면 키보드·스크린리더 동작을
 *    전부 다시 구현해야 하고, 다시 구현할 이유가 없다.
 */
export function SearchSortBar({
  query,
  onQuery,
  sort,
  onSort,
  view,
  onView,
  readyOnly,
  onReadyOnly,
  readyCount,
}: {
  query: string
  onQuery: (v: string) => void
  sort: string
  onSort: (v: string) => void
  view: ShelfView
  onView: (v: ShelfView) => void
  readyOnly: boolean
  onReadyOnly: (v: boolean) => void
  readyCount: number
}) {
  const searchId = useId()
  const sortId = useId()
  const active = SHELF_SORTS.find((s) => s.id === sort) ?? SHELF_SORTS[0]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* ⚠️ placeholder 로 레이블을 대신하지 않는다(CLAUDE.md 절대 금지). 보이는 레이블 대신
            sr-only 레이블 + 아이콘으로 — 디자인은 그대로 두고 이름만 프로그램에 준다. */}
        <label htmlFor={searchId} className="sr-only">
          교재 찾기 — 권 이름 · 학년 · 문제 유형으로 찾을 수 있어요
        </label>
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t2)]"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="권 이름 · 학년 · 유형으로 찾기"
            className="min-h-[44px] w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] pl-9 pr-3 font-body text-[13px] text-[var(--t1)] placeholder:text-[var(--t2)] motion-safe:transition-colors hover:border-[var(--p)] focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          />
        </div>

        <label htmlFor={sortId} className="sr-only">
          정렬 기준
        </label>
        <select
          id={sortId}
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[12px] font-[700] text-[var(--t1)] motion-safe:transition-colors hover:border-[var(--p)] focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {SHELF_SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        {/* 진열 토글 — 라디오 그룹으로 낸다. 버튼 둘을 따로 두면 "지금 어느 쪽인지" 를
            스크린리더가 못 읽는다. */}
        <div
          role="radiogroup"
          aria-label="진열 방식"
          className="inline-flex overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)]"
        >
          {SHELF_VIEWS.map((v) => {
            const on = view === v.id
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={v.label}
                title={v.label}
                onClick={() => onView(v.id)}
                className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-3 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)] ${
                  on
                    ? 'bg-[var(--p)] text-[var(--on-p)]'
                    : 'bg-[var(--bg)] text-[var(--t2)] hover:text-[var(--p)]'
                }`}
              >
                {v.id === 'list' ? (
                  <List size={15} aria-hidden />
                ) : (
                  <LayoutGrid size={15} aria-hidden />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 font-display text-[11.5px] font-[700] text-[var(--t2)]">
          <input
            type="checkbox"
            checked={readyOnly}
            onChange={(e) => onReadyOnly(e.target.checked)}
            className="h-4 w-4 accent-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          />
          지금 펼칠 수 있는 권만 보기
          <span className="font-mono text-[10.5px] tabular-nums opacity-80">{readyCount}</span>
        </label>
        {/* 정렬이 무엇을 하는지 한 줄로 — 라벨('문항 많은 순')만으로는 기준이 재고인지 정가인지 모른다. */}
        <p className="min-w-0 flex-1 font-body text-[11.5px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
          {active.says}
        </p>
      </div>
    </div>
  )
}
