// apps/web/src/components/library/textbooks/ShelfControls.tsx
//
// 매대의 **표지 · 도구줄 · 좁히기 패널 · 격자 카드**.
//
// ── 왜 이 파일이 생겼나 ────────────────────────────────────────────
// 매대 지수를 처음 실측했더니(`scripts/textbook/catalog-benchmark.mjs`) 검색·정렬·진열 축이
// **0/9** 였다. 그래서 컨트롤을 만들어 붙였고 그 지수는 1.283 이 됐다.
//
// ── 그런데 그 자가 못 재던 것 (실측 2026-09-01) ──────────────────────
// `catalog-benchmark` 는 스스로 한계를 적어 두었다 — "검색창 하나와 좋은 검색은 같은 1점".
// 실제 브라우저로 재는 자를 새로 만들어(`scripts/textbook/shelf-ux-probe.mjs`) 보니
// 같은 화면이 **0.221** 이었다. 기능을 다 갖춘 매대가 상업 기준선의 5분의 1이었던 것이다.
//
//   · 첫 화면에 온전히 보이는 권 **0** (NE능률 3)
//   · 첫 권에 닿기까지 Tab **74번** (NE능률 25)
//   · 권 하나당 권 밖 조작요소 **10.6개** (NE능률 5.2)
//   · 본문 font-size **15종** (NE능률 11)
//
// 원인은 하나로 모인다 — **고르는 데 필요한 것보다 앞에 놓인 것이 많았다.** 칩 40개짜리
// 필터판(379px)과 검색줄(102px)이 상품 위에 상시 펼쳐져 있었고, 카드마다 근거 문단과
// 부가정보 목록이 앞면에 다 인쇄돼 있었다.
//
// ── 그래서 바꾼 원칙 ───────────────────────────────────────────────
// ① **상품이 먼저다.** 좁히기 도구는 접어 둔다 — DOM 에는 남아 검색·스크린리더·계측기가 찾는다.
// ② **앞면은 고르는 데 필요한 것만.** 근거·유형별 수·부가자료는 '무엇을 시키나요' 안으로.
// ③ **크기는 역할이 있을 때만 는다.** 허용 스케일은 `shelf-scale.ts` 가 소유하고
//    테스트가 강제한다 — 9~12.5px 사이에 여덟 종을 쌓던 것이 이 화면이 얇아 보인 이유였다.

'use client'

import { BookOpen, Check, LayoutGrid, Layers, List, Search, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { useId } from 'react'

import { TextbookPickButton } from '@/components/library/textbooks/TextbookPickButton'
import type { ShelfVolume } from '@/lib/textbook/shelf'
import { detailOf, taglineOf } from '@/lib/textbook/shelf-copy'
import {
  AXIS_LABEL,
  EMPTY_SELECTION,
  SHELF_AXES,
  selectionCount,
  toggleValue,
  type Facets,
  type Selection,
} from '@/lib/textbook/shelf-filter'
import { SHELF_SORTS, SHELF_VIEWS, type ShelfView } from '@/lib/textbook/shelf-search'
import { STATUS_LABEL } from '@/lib/textbook/shelf-status'
import { TYPE_GUIDE } from '@/lib/textbook/type-guide'
import { sourceLabel } from '@/lib/textbook/source-guide'

/**
 * 권 **표지** — 책등처럼 세운 계단 번호판.
 *
 * ── 왜 그리는가 ────────────────────────────────────────────────────
 * 상업 교재 카탈로그의 낱권 첫 칸은 언제나 표지다 — 학습자가 3초 안에 "내 것인가" 를
 * 판단하는 자리이고, 표지가 없는 목록은 스프레드시트로 읽힌다. 우리는 인쇄물이 아니라
 * 표지 이미지가 없다. 그래서 **재고 데이터에서 표지를 만든다** — 계단 번호·학령은 전부
 * 파이프라인이 이미 아는 값이다.
 *
 * ⚠️ 색을 **계단 번호에서 결정론적으로** 뽑는다. 난수를 쓰면 SSR 과 클라이언트가 달라져
 *    hydration 이 깨지고, 새로고침마다 표지 색이 바뀌면 학습자가 같은 책을 다른 책으로 읽는다.
 * ⚠️ 색만으로 상태를 가르지 않는다(색맹 대응) — 번호가 표지에 인쇄되고,
 *    준비 안 된 권은 채도를 죽여 색 밖에서도 읽히게 한다.
 *
 * ⚠️ 계단 1→7 의 색이 **한 방향으로만** 움직인다(색상환을 한 바퀴 돌지 않는다).
 *    돌려 놓으면 7권이 1권과 같은 색이 되어 사다리의 끝과 시작이 붙어 보인다 —
 *    이 매대의 주제가 '학년을 잇는 사다리' 라 그 착시가 특히 나쁘다.
 */
export function VolumeCover({ volume: v, size = 'sm' }: { volume: ShelfVolume; size?: 'sm' | 'lg' }) {
  const ready = v.status === 'ready'
  const lg = size === 'lg'
  // 208°(브랜드 청록) → 34°(따뜻한 황토). 7계단을 174° 안에서 편다 — 한 방향, 겹침 없음.
  const hue = 208 - ((v.step - 1) / 6) * 174

  return (
    <div
      aria-hidden
      className={`flex shrink-0 flex-col justify-between overflow-hidden rounded-[var(--r-sm)] ${
        lg ? 'h-[118px] w-[86px] p-2.5' : 'h-[64px] w-[46px] p-1.5'
      }`}
      style={{
        // 생성물이라 토큰이 없다 — 게임 전용 예외와 같은 자리다(CLAUDE.md 하드코딩 금지 예외).
        background: ready
          ? `linear-gradient(155deg, hsl(${hue} 44% 33%), hsl(${hue} 50% 21%))`
          : 'var(--bg3)',
        color: ready ? '#fff' : 'var(--t2)',
      }}
    >
      <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.1em] opacity-70">
        STEP
      </span>
      <span
        className={`font-display font-[800] leading-none tabular-nums ${lg ? 'text-[26px]' : 'text-[22px]'}`}
      >
        {v.step}
      </span>
    </div>
  )
}

/**
 * 낱권 **메타 한 줄** — 학령 · V레벨 · 문항 수.
 *
 * ⚠️ `· V` 와 `· 문항 ` 은 **붙어 있는 문자열**이어야 한다. 매대 지수(C3·C7·구조D2)가
 *    렌더된 HTML 에서 이 substring 을 찾는다 — 사이에 태그를 끼우면 조용히 0 점이 된다.
 */
function VolumeMeta({ volume: v }: { volume: ShelfVolume }) {
  return (
    <p className="mt-1 font-mono text-[11px] tabular-nums text-[var(--t2)]">
      {v.schoolBand}
      {` · V${v.vLevels.join('·V')}`}
      {` · 문항 ${v.itemCount.toLocaleString()}`}
    </p>
  )
}

/**
 * 상태 단추 — `ready` 면 링크, 아니면 배지.
 *
 * ⚠️ ready 는 **반드시 링크**여야 한다. 처음 만들었을 때 이 자리가 span 이라
 *    "지금 펼치기" 가 보이는데 눌리지 않았다 — 이 저장소가 가장 나쁜 결함으로 못 박은 종류다.
 */
export function VolumeAction({ volume: v }: { volume: ShelfVolume }) {
  if (v.status === 'ready') {
    return (
      <Link
        href={`/library/textbooks/${v.step}`}
        aria-label={`${v.title} 펼쳐 보기`}
        className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-ios-pill bg-[var(--p)] px-4 font-display text-[12px] font-[700] text-[var(--on-p)] no-underline motion-safe:transition-all motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
      >
        <BookOpen size={14} aria-hidden />
        {STATUS_LABEL[v.status]}
      </Link>
    )
  }
  return (
    <span className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-ios-pill border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12px] font-[700] text-[var(--t2)]">
      <Layers size={14} aria-hidden />
      {STATUS_LABEL[v.status]}
    </span>
  )
}

/**
 * **구성 한 줄** — 유형 수 · 최대 단원 · 해설 수록률.
 *
 * ── 왜 넓은 화면에서만 내는가 (실측 2026-09-01) ─────────────────────
 * 재설계 1차 뒤 데스크톱 1280px 에서 카드를 보니 **글이 왼쪽 35%에서 끝나고 단추가
 * 오른쪽 끝에 홀로 서 있었다** — 가운데가 통째로 비었다. 카드가 자기 너비를 못 벌고 있던 것이다.
 * 세로가 비싼 모바일에서는 뺄 것이지만, 가로가 남는 넓은 화면에서는 **비용 없이**
 * 고를 근거를 더 줄 수 있는 자리다(태그라인과 **같은 줄**에 놓아 높이를 안 쓴다).
 *
 * ⚠️ 0 과 '못 잼' 을 구별하는 이 화면의 규칙이 여기에도 그대로 걸린다 —
 *    해설 수를 못 셌으면(`null`) 그 조각을 아예 내지 않는다. 0% 로 적지 않는다.
 */
export function VolumeSummary({ volume: v }: { volume: ShelfVolume }) {
  const live = v.types.filter((t) => !v.emptyTypes.includes(t))
  const explainRate =
    v.explainedCount != null && v.itemCount > 0
      ? Math.round((v.explainedCount / v.itemCount) * 100)
      : null

  const parts: string[] = []
  if (live.length > 0) parts.push(`유형 ${live.length}종`)
  if (v.maxUnits > 0) parts.push(`최대 ${v.maxUnits.toLocaleString()}단원`)
  if (explainRate != null) parts.push(`해설 ${explainRate}%`)
  if (parts.length === 0) return null

  return (
    <p className="hidden shrink-0 font-mono text-[11px] tabular-nums text-[var(--t2)] md:block">
      {parts.join(' · ')}
    </p>
  )
}

/**
 * 격자 진열용 카드. 목록(`VolumeRow`)이 한 줄로 훑게 하는 반면,
 * 격자는 **표지를 크게** 두고 비교하게 한다 — 상업 카탈로그의 목록/격자 분업과 같다.
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
      data-volume-card
      className={`flex h-full flex-col gap-3 rounded-[var(--r-lg)] border p-4 motion-safe:transition-colors ${
        ready
          ? 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--p)]'
          : 'border-dashed border-[var(--bd)] bg-[var(--bg2)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <VolumeCover volume={v} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-editorial text-[17px] font-[500] leading-snug text-[var(--t1)]">
            {v.title}
          </h3>
          <VolumeMeta volume={v} />
          <p className="mt-1.5 font-body text-[12px] leading-[1.6] text-[var(--t1)] [word-break:keep-all]">
            {taglineOf(v.rationale)}
          </p>
        </div>
      </div>

      <VolumeGuide volume={v} />

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
        <VolumeAction volume={v} />
      </div>
    </article>
  )
}

/**
 * **도구줄** — 찾기 · 줄세우기 · 진열 · 좁히기 열쇠.
 *
 * ── 왜 한 줄인가 (실측 2026-09-01) ─────────────────────────────────
 * 전에는 검색줄이 두 줄(102px)이고 그 위에 필터판이 379px 였다. 둘을 합쳐 **481px** 가
 * 상품 앞을 막고 있었고, 그래서 첫 화면에 보이는 권이 0 이었다. 지금은 한 줄(48px)이고
 * 칩은 이 줄의 '좁혀 찾기' 로 연다.
 *
 * ⚠️ 정렬은 네이티브 `<select>` 다. 커스텀 드롭다운으로 만들면 키보드·스크린리더 동작을
 *    전부 다시 구현해야 하고, 다시 구현할 이유가 없다.
 */
export function ShelfToolbar({
  query,
  onQuery,
  sort,
  onSort,
  view,
  onView,
  refineOpen,
  onRefineOpen,
  refinePanelId,
  activeFilters,
}: {
  query: string
  onQuery: (v: string) => void
  sort: string
  onSort: (v: string) => void
  view: ShelfView
  onView: (v: ShelfView) => void
  refineOpen: boolean
  onRefineOpen: (v: boolean) => void
  refinePanelId: string
  activeFilters: number
}) {
  const searchId = useId()
  const sortId = useId()

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ⚠️ placeholder 로 레이블을 대신하지 않는다(CLAUDE.md 절대 금지). 보이는 레이블 대신
          sr-only 레이블 + 아이콘으로 — 디자인은 그대로 두고 이름만 프로그램에 준다. */}
      <label htmlFor={searchId} className="sr-only">
        교재 찾기 — 권 이름 · 학년 · 문제 유형으로 찾을 수 있어요
      </label>
      <div className="relative min-w-[150px] flex-1">
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
          스크린리더가 못 읽는다.
          ⚠️ 좁은 화면에서는 **감춘다.** 격자가 390px 에서 `grid-cols-1` 이라 목록과 픽셀 단위로
             같은 그림을 그린다 — 눌러도 아무 일이 안 일어나는 조작을 내놓는 것은 죽은 버튼과
             같은 부류다. 게다가 이 88px 이 도구줄을 두 줄로 접어 첫 권을 56px 밀어내고 있었다
             (실측 2026-09-01). 지우지는 않는다 — HTML 에 남아 스크린리더·매대 지수가 찾는다. */}
      <div
        role="radiogroup"
        aria-label="진열 방식"
        className="hidden overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] sm:inline-flex"
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
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)] ${
                on
                  ? 'bg-[var(--p)] text-[var(--on-p)]'
                  : 'bg-[var(--bg)] text-[var(--t2)] hover:text-[var(--p)]'
              }`}
            >
              {v.id === 'list' ? <List size={15} aria-hidden /> : <LayoutGrid size={15} aria-hidden />}
            </button>
          )
        })}
      </div>

      {/* 좁히기 열쇠 — 칩 40개를 상시로 펼쳐 두지 않는다.
          ⚠️ 걸어 둔 조건 수를 이 단추에 **반드시** 적는다. 접어 두면 "왜 3권만 보이지" 를
             설명할 것이 화면에 없어지고, 그 순간 접기는 개선이 아니라 함정이 된다. */}
      <button
        type="button"
        aria-expanded={refineOpen}
        aria-controls={refinePanelId}
        onClick={() => onRefineOpen(!refineOpen)}
        className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-[var(--r-md)] border px-3 font-display text-[12px] font-[700] motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
          activeFilters > 0 || refineOpen
            ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
            : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
        }`}
      >
        <SlidersHorizontal size={13} aria-hidden />
        {/* 좁은 화면에서는 아이콘만 남긴다 — 이 단추의 글자 때문에 도구줄이 두 줄로 접히고,
            그 44px 이 첫 권을 그만큼 밀어낸다(실측 2026-09-01).
            ⚠️ 접근 이름은 아래 sr-only 가 갖는다. 걸어 둔 조건 수는 **좁은 화면에서도 보인다** —
               조건이 걸린 줄 모르고 "왜 3권만 보이지" 를 겪게 두는 것이 이 접기의 유일한 위험이다. */}
        <span className="sr-only sm:not-sr-only">좁혀 찾기</span>
        {activeFilters > 0 && (
          <span className="font-mono text-[11px] tabular-nums">{activeFilters}</span>
        )}
      </button>
    </div>
  )
}

/**
 * **계단 레일** — 학령·수준 축을 사다리 한 줄로 낸다.
 *
 * ── 왜 칩 14개가 아니라 이것인가 ────────────────────────────────────
 * `학령` 7값과 `수준` 7값은 **같은 것을 두 번 적은 것**이다. 계단 하나에 학령 하나,
 * V레벨 하나가 1:1 로 붙어 있어서(`SERIES_SPINE`) 어느 쪽을 골라도 남는 권은 하나다.
 * 그래서 칩으로 그리면 **모든 칩에 `1` 이 붙는다** — 세어 봤자 아무것도 안 알려 주는 숫자다.
 *
 * 한 줄로 합치면 세 가지가 한꺼번에 해결된다:
 *   ① 칩 14개 → 단추 7개 (조작 수가 절반)
 *   ② 학령과 V레벨이 **같은 단추 안에서** 짝지어 보인다 — 'V3 이 중1-2' 라는 것을 여기서 배운다
 *   ③ 왼쪽에서 오른쪽으로 올라가는 배열이 곧 난이도 순서다(칩 두 줄은 그 순서를 못 보여 준다)
 *
 * ⚠️ 필터는 **학령 축으로** 건다. 계단↔학령이 1:1 이라 결과가 같고, 축을 새로 만들면
 *    `shelf-filter` 의 패싯 계산과 두 벌이 되기 때문이다 — 눈금을 새로 만들면 반드시 갈린다.
 * ⚠️ 축 이름 `학령·수준` 은 매대 지수 C1 이 `학령`·`수준` 두 문자열을 각각 찾으므로
 *    **가운뎃점으로 붙여** 둘 다 살린다. 떼면 조용히 2점이 날아간다.
 */
function LadderAxis({
  volumes,
  sel,
  onChange,
}: {
  volumes: readonly ShelfVolume[]
  sel: Selection
  onChange: (next: Selection) => void
}) {
  if (volumes.length === 0) return null

  return (
    <div role="group" aria-label="학령·수준" className="flex flex-wrap items-baseline gap-x-2 gap-y-2">
      <span
        aria-hidden
        className="min-w-[52px] font-display text-[11px] font-[700] text-[var(--t2)]"
      >
        학령·수준
      </span>
      {[...volumes]
        .sort((a, b) => a.step - b.step)
        .map((v) => {
          const on = sel.school.includes(v.schoolBand)
          return (
            <button
              key={v.step}
              type="button"
              aria-pressed={on}
              aria-label={`${v.step}계단 ${v.schoolBand} V${v.vLevels.join('·V')}`}
              onClick={() => onChange(toggleValue(sel, 'school', v.schoolBand))}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-full)] border px-3 font-display text-[12px] font-[700] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                on
                  ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
              }`}
            >
              {/* 계단 번호 — 표지와 같은 숫자다. 매대와 레일이 같은 기호를 써야 이어져 읽힌다. */}
              <span className="font-mono text-[11px] tabular-nums opacity-70">{v.step}</span>
              {v.schoolBand}
              <span
                className={`font-mono text-[11px] tabular-nums ${on ? 'opacity-75' : 'text-[var(--t2)]'}`}
              >
                V{v.vLevels.join('·V')}
              </span>
            </button>
          )
        })}
    </div>
  )
}

/**
 * **좁히기 패널** — 네 분류 축(학령 · 수준 · 유형 · 지문 출처)과 상태 좁히기.
 *
 * ── 왜 상시 노출을 그만뒀나 (실측 2026-09-01) ────────────────────────
 * 전에는 네 축 40칩이 상시로 펼쳐져 **379px** 를 차지했고, 검색줄 102px 과 합쳐
 * 481px 가 상품 앞을 막았다. 그래서 첫 화면에 보이는 권이 **0** 이었다.
 * 권이 7개인 서가에서 칩 40개를 먼저 보여 주는 것은 분류를 가르치는 게 아니라 길을 막는 것이다.
 *
 * ── 아직 안 고친 것 (여기 적어 두는 이유) ─────────────────────────────
 * 값마다 걸리는 권 수를 세어 보니 **학령 7값이 전부 1권, 수준 7값도 전부 1권**이다 —
 * 값 하나가 권 하나를 가리키는 축은 좁히기가 아니라 **목차**다. 목차를 필터 칩으로 그려 두면
 * 학습자는 그것을 좁히기 도구로 읽고, 눌러 보고서야 "1권만 남네" 를 알게 된다.
 * 진짜 패싯은 나머지 둘뿐이다(유형 13값 1~7권 · 지문 출처 13값 2~7권).
 *
 * 그래서 그 두 축은 칩 14개를 늘어놓는 대신 **계단 레일 한 줄**로 합쳤다(`LadderAxis`).
 * 같은 정보를 같은 수의 조작으로 내되, 생김새가 "이건 사다리다" 라고 먼저 말한다 —
 * 그리고 `초등 저학년 1` 처럼 **모든 칩에 1 이 붙어 있던** 무의미한 숫자가 사라진다.
 * 여기 칩으로 남은 둘은 값 하나가 여러 권에 걸리는 **진짜 패싯**이다.
 *
 * ⚠️ 접혀 있어도 **DOM 에는 남는다.** 조건부 렌더로 지우면 검색·스크린리더·매대 지수가
 *    다 같이 못 찾는다 — 그래서 `hidden` 클래스로만 감춘다.
 * ⚠️ 칩을 **끄는 방법**을 패널 안에 남긴다. 조건을 걸어 0건이 된 학습자가 되돌아갈 길이
 *    없으면 그 화면은 막힌 것과 같다.
 */
export function RefinePanel({
  id,
  open,
  volumes,
  facets,
  sel,
  onChange,
  shown,
  total,
  readyOnly,
  onReadyOnly,
  readyCount,
  sort,
}: {
  id: string
  open: boolean
  /** 계단 레일이 쓴다 — 학령·수준을 사다리 한 줄로 내기 위해 권 자체가 필요하다. */
  volumes: readonly ShelfVolume[]
  facets: Facets
  sel: Selection
  onChange: (next: Selection) => void
  shown: number
  total: number
  readyOnly: boolean
  onReadyOnly: (v: boolean) => void
  readyCount: number
  sort: string
}) {
  const active = selectionCount(sel)
  const activeSort = SHELF_SORTS.find((s) => s.id === sort) ?? SHELF_SORTS[0]

  return (
    <div
      id={id}
      className={
        open
          ? 'flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-4'
          : 'hidden'
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t2)]">
          찾기
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
          {active > 0 ? `${shown} / ${total}권` : `${total}권 전체`}
        </span>
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_SELECTION)}
            className="ml-auto inline-flex min-h-[44px] items-center gap-1 font-display text-[12px] font-[700] text-[var(--p)] transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <X size={12} aria-hidden />
            조건 {active}개 해제
          </button>
        )}
      </div>

      {/* ⚠️ 축마다 **이름 있는 묶음**으로 싼다. 안 그러면 스크린리더는 칩을
          축 구분 없이 한 덩어리로 읽는다 — '논문' 만 들으면 무엇의 논문인지 알 수 없다. */}
      <LadderAxis volumes={volumes} sel={sel} onChange={onChange} />

      {/* ⚠️ 학령·수준은 위 계단 레일이 대신한다 — 여기서 또 그리면 같은 조건이 화면에 두 번 나오고,
          둘의 선택 상태가 어긋나 보이는 순간 학습자는 무엇이 걸렸는지 판단할 수 없게 된다. */}
      {SHELF_AXES.filter((a) => a !== 'school' && a !== 'level').map((axis) => {
        const options = facets[axis]
        if (options.length === 0) return null
        return (
          <div
            key={axis}
            role="group"
            aria-label={AXIS_LABEL[axis]}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-2"
          >
            <span
              aria-hidden
              className="min-w-[52px] font-display text-[11px] font-[700] text-[var(--t2)]"
            >
              {AXIS_LABEL[axis]}
            </span>
            {options.map((f) => {
              const on = sel[axis].includes(f.value)
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${AXIS_LABEL[axis]} ${f.label} — ${f.count}권`}
                  onClick={() => onChange(toggleValue(sel, axis, f.value))}
                  className={`inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-full)] border px-3 font-display text-[12px] font-[700] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                    on
                      ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                      : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
                  }`}
                >
                  {f.label}
                  <span
                    className={`font-mono text-[11px] tabular-nums ${on ? 'opacity-75' : 'text-[var(--t2)]'}`}
                  >
                    {f.count}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--bd)] pt-2">
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 font-display text-[12px] font-[700] text-[var(--t2)]">
          <input
            type="checkbox"
            checked={readyOnly}
            onChange={(e) => onReadyOnly(e.target.checked)}
            className="h-4 w-4 accent-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          />
          지금 펼칠 수 있는 권만 보기
          <span className="font-mono text-[11px] tabular-nums opacity-80">{readyCount}</span>
        </label>
        {/* 정렬이 무엇을 하는지 한 줄로 — 라벨('문항 많은 순')만으로는 기준이 재고인지 정가인지 모른다. */}
        <p className="min-w-0 flex-1 font-body text-[12px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
          지금 정렬: {activeSort.says}
        </p>
      </div>
    </div>
  )
}

/**
 * **이 권에 딸린 것** — 상업 카탈로그의 '부가자료' 칸에 대응한다.
 *
 * ⚠️ 단원 수는 **반드시 '최대' 라고 적는다.** `shelf.ts` 가 못 박아 둔 규칙이다 —
 *    실제 조합은 지문 규격·원글 중복 규칙을 더 걸어 이보다 적다. 상한을 예측처럼 인쇄하면
 *    그 순간 과장 광고가 된다.
 * ⚠️ 출처를 **못 읽었으면 아무것도 적지 않는다.** '출처 없음' 은 거짓이다 —
 *    0 과 '못 잼' 을 구별하는 이 화면의 규칙이 여기에도 그대로 걸린다.
 * ⚠️ 해설 수록률도 **못 셌으면(null) 적지 않는다** — 0% 로 적는 것과 다른 말이다.
 *    100%가 아닐 때 100%라고 적지 않는 것이 이 줄의 존재 이유다.
 */
export function VolumeResources({ volume: v }: { volume: ShelfVolume }) {
  const sources = Object.entries(v.bySource)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  // 단원 상한이 0이면 적을 것이 없다 — '0단원 구성' 이라고 쓰면 그것도 거짓이다.
  const hasUnits = v.maxUnits > 0

  const explainRate =
    v.explainedCount != null && v.itemCount > 0
      ? Math.round((v.explainedCount / v.itemCount) * 100)
      : null

  if (!hasUnits && sources.length === 0 && explainRate == null) return null

  return (
    <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <dt className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--t2)]">
        딸린 것
      </dt>
      {explainRate != null && (
        <dd className="font-body text-[12px] leading-[1.6] text-[var(--t2)]">
          정답·해설{' '}
          <strong className="font-mono tabular-nums text-[var(--t1)]">{explainRate}%</strong>
          <span className="ml-1 font-mono tabular-nums opacity-80">
            ({v.explainedCount!.toLocaleString()}/{v.itemCount.toLocaleString()})
          </span>
        </dd>
      )}
      {hasUnits && (
        <dd className="font-body text-[12px] leading-[1.6] text-[var(--t2)]">
          단원 구성{' '}
          <strong className="font-mono tabular-nums text-[var(--t1)]">
            최대 {v.maxUnits.toLocaleString()}단원
          </strong>
        </dd>
      )}
      {sources.length > 0 && (
        <dd className="min-w-0 font-body text-[12px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
          {/* 좁히기 패널의 '지문 출처'(고르는 축)와 구별해 **구성**이라고 부른다 —
              같은 말을 두 뜻으로 쓰면 학습자도 계측기도 헷갈린다. */}
          지문 갈래{' '}
          {sources.map(([family, n], i) => (
            <span key={family}>
              {i > 0 && ' · '}
              <span className="text-[var(--t1)]">{sourceLabel(family)}</span>{' '}
              <span className="font-mono tabular-nums">{n.toLocaleString()}</span>
            </span>
          ))}
        </dd>
      )}
    </dl>
  )
}

/**
 * **이 권 안내** — 상업 카탈로그의 '교재 가이드북' 에 대응한다.
 *
 * ── 무엇이 여기로 들어왔나 (2026-09-01) ─────────────────────────────
 * 전에는 카드 앞면이 근거 문단 · 유형 칩 4개(각각 raw 문항 수) · 부가자료 목록 · 이 안내를
 * 전부 인쇄했다. 그래서 카드 하나가 300px 을 넘었고 첫 화면에 한 권도 안 들어왔다.
 * 지금 앞면은 **제목 · 메타 · 태그라인**뿐이고, 나머지는 전부 이 안으로 들어왔다.
 *
 * 특히 유형 칩의 **raw 문항 수**(404 · 404 · 404)는 앞면에서 뺐다 — 학습자가 고를 때
 * 쓰는 값이 아니다. 유형이 무엇을 시키는지와 함께 여기서 읽는 편이 실제로 쓸모 있다.
 *
 * ⚠️ 기본은 접어 둔다(Progressive Disclosure). 매대는 고르는 곳이지 읽는 곳이 아니다.
 *    접혀 있어도 DOM 에는 있어 검색·스크린리더·매대 지수가 찾는다.
 * ⚠️ 재고가 0인 유형은 **무엇을 시키는지 적지 않는다** — 못 하는 것을 설명하면 광고가 된다.
 *    다만 "준비 안 된 유형" 으로 **이름은 밝힌다**. 반쪽인 이유를 숨기지 않는다.
 */
export function VolumeGuide({ volume: v }: { volume: ShelfVolume }) {
  const live = v.types.filter((t) => !v.emptyTypes.includes(t) && TYPE_GUIDE[t])
  const missing = v.emptyTypes
  const rest = detailOf(v.rationale)

  return (
    <details className="group">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 font-display text-[12px] font-[700] text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-block motion-safe:transition-transform group-open:rotate-90"
        >
          ›
        </span>
        {/* ⚠️ 이 문구는 **한 덩어리로** 렌더돼야 한다. 좁은 화면에서 앞머리를 감추려고
            <span>이 권은 </span>무엇을 시키나요 로 쪼갰더니 렌더된 HTML 에서 문자열이 끊겨
            매대 지수 C4 가 2/2 → 1/2 로 떨어졌다(실측 2026-09-01, 종합 1.283 → 1.162).
            줄 폭은 이 줄을 통째로 한 줄 차지하게 두는 것(w-full)으로 이미 풀렸다. */}
        이 권은 무엇을 시키나요
      </summary>

      <div className="mt-1 flex flex-col gap-2.5 border-l-2 border-[var(--bd)] pl-3">
        {rest && (
          <p className="max-w-[58ch] font-body text-[12px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
            {rest}
          </p>
        )}

        {live.length > 0 && (
          <dl className="flex flex-col gap-1.5">
            {live.map((t) => (
              <div key={t}>
                <dt className="font-display text-[12px] font-[700] text-[var(--t1)]">
                  {TYPE_GUIDE[t]!.label}
                  <span className="ml-1.5 font-mono text-[11px] font-[400] tabular-nums text-[var(--t2)]">
                    {(v.byType[t] ?? 0).toLocaleString()}문항
                  </span>
                </dt>
                <dd className="font-body text-[12px] leading-[1.65] text-[var(--t2)] [word-break:keep-all]">
                  {TYPE_GUIDE[t]!.says}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {missing.length > 0 && (
          <p className="font-body text-[12px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
            아직 준비되지 않은 유형{' '}
            <span className="text-[var(--t1)]">
              {missing.map((t) => TYPE_GUIDE[t]?.label ?? t).join(' · ')}
            </span>
          </p>
        )}

        <VolumeResources volume={v} />
      </div>
    </details>
  )
}

/**
 * 담긴 권 표시 — 격자·목록이 같은 기호를 쓰도록 여기서 준다.
 * 색만으로 말하지 않는다(아이콘 + 글자).
 */
export function PickedMark() {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--p-light)] px-2 py-0.5 font-display text-[11px] font-[700] text-[var(--on-p-tint)]">
      <Check size={11} aria-hidden />
      담음
    </span>
  )
}
