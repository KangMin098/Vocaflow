// apps/web/src/components/library/textbooks/TextbookShelf.tsx
//
// 교재 서가 — **대형 서점 교재 코너처럼 진열한다.**
//
// ── 왜 이 형태인가 ──────────────────────────────────────────────────
// 서점 교재 코너의 진열은 세 가지를 동시에 한다:
//   ① **사다리를 보여준다** — 같은 브랜드가 학년을 이어 간다는 것을 한눈에
//   ② **고를 근거를 준다** — 대상 학년·수록 유형·문항 수가 표지에 적혀 있다
//   ③ **없는 것도 말한다** — 근간 예정을 빈칸으로 두지 않고 표시한다
//
// 그래서 이 화면은 카드를 나열하지 않고 **계단 순서대로 한 줄기**로 세운다.
// 계단 번호가 곧 진열 순서이고, 그 순서가 학습자에게는 "다음 권" 이다.
//
// ── 2026-09-01 재설계: 무엇이 틀렸었나 ──────────────────────────────
// 기능은 다 있었다(`catalog-benchmark` 1.283). 그런데 실제 브라우저로 재 보니
// (`scripts/textbook/shelf-ux-probe.mjs`) 상업 기준선 대비 **0.221** 이었다.
//
//   · 첫 화면에 온전히 보이는 권 **0** (NE능률 3)
//   · 첫 권까지 Tab **74번** / 모바일에서 첫 권이 **1.61화면** 아래
//   · 권 밖 조작요소가 권 하나당 **10.6개**
//
// 기능 개수를 세는 자가 통과시킨 것을, 학습자가 치르는 비용을 재는 자가 잡았다.
// 고친 것은 셋이다:
//
//   ① **좁히기 도구를 접었다.** 칩 40개(379px) + 검색줄(102px)이 상품 위에 상시
//      펼쳐져 있었다. 지금은 도구줄 한 줄(48px)이고 칩은 '좁혀 찾기' 로 연다.
//      ⚠️ 접었을 뿐 지우지 않았다 — DOM 에 남아 검색·스크린리더·매대 지수가 다 찾는다.
//   ② **네 축을 접고, 그중 둘은 축이 아니었음을 인정했다.** 학령 7값·수준 7값이
//      **전부 1권씩**이었다(값 하나 = 권 하나) — 좁히기가 아니라 **목차**다. 그리고 그 둘은
//      서로 같은 것을 두 번 적은 것이기도 했다(계단↔학령↔V레벨이 1:1). 그래서 칩 14개를
//      **계단 레일 한 줄(단추 7개)**로 합쳤다(`LadderAxis`) — 모든 칩에 붙어 있던 무의미한
//      `1` 이 사라지고, 왼→오 배열이 곧 난이도 순서가 된다.
//   ③ **카드 앞면을 고르는 데 필요한 것만 남겼다.** 근거 문단·유형별 raw 문항 수·부가자료는
//      '이 권은 무엇을 시키나요' 안으로 들어갔다.
//
// ⚠️ 상태 셋을 **색으로만** 가르지 않는다(색맹 대응). 라벨·위치·문항 수 3중으로 말한다.
// ⚠️ `empty`(재료 없음)를 숨기지 않는다 — 숨기면 사다리가 끊긴 것을 학습자가 모르고,
//    그 학년 학습자는 "내 학년이 없다" 가 아니라 "이 브랜드는 이상하다" 로 읽는다.

// ── 왜 좁히기·검색·정렬·진열이 주소에 실리나 (실측 2026-09-05) ──────────
// 전부 `useState` 였다. 학령·수준·유형·출처 네 축을 좁히고 검색어를 넣고 정렬을 바꾼 뒤
// 한 권을 열어 보고 돌아오면 **전부 초기화**됐다. 이 화면에는 「필터 초기화」 버튼조차
// 없어서, 조건을 잃은 사람이 되돌릴 방법도 다시 다 고르는 것뿐이었다.
// 새로고침·공유·새 탭도 같다 — 조건이 어디에도 안 적혀 있었으니까.
// 규칙(그리고 왜 `router.replace` 가 아니라 `history.replaceState` 인가)은
// `lib/library/shelf-url-state.ts` 머리 주석이 단일 출처다(도서·만화·단어장과 공유).

'use client'

import { useCallback, useId, useMemo, useState } from 'react'

import { TextbookPickButton } from '@/components/library/textbooks/TextbookPickButton'
import {
  RefinePanel,
  ShelfToolbar,
  VolumeAction,
  VolumeCard,
  VolumeCover,
  VolumeGuide,
  VolumeSummary,
} from '@/components/library/textbooks/ShelfControls'
import type { Shelf, ShelfVolume } from '@/lib/textbook/shelf'
import { taglineOf } from '@/lib/textbook/shelf-copy'
import { readEnumParam, useShelfUrlState } from '@/lib/library/shelf-url-state'
import {
  EMPTY_SELECTION,
  SHELF_AXES,
  buildFacets,
  filterVolumes,
  selectionCount,
  type Facets,
  type Selection,
  type ShelfAxis,
} from '@/lib/textbook/shelf-filter'
import {
  DEFAULT_SORT,
  SHELF_SORTS,
  SHELF_VIEWS,
  onlyReady,
  searchVolumes,
  sortVolumes,
  type ShelfView,
} from '@/lib/textbook/shelf-search'
import { groupByStage } from '@/lib/textbook/shelf-stage'

/**
 * 주소 → 축별 선택. 축 하나가 `?type=order,insert` 처럼 쉼표로 붙는다.
 *
 * ⚠️ **재고에 있는 값만 남긴다.** 축 값은 코드가 아니라 재고에서 나오므로(`buildFacets`),
 *    시리즈가 바뀌면 어제의 링크에 오늘 없는 값이 들어 있을 수 있다. 그대로 걸면 결과가
 *    0인데 이 화면에는 「필터 초기화」 버튼이 없어서 되돌릴 길이 없다 — 모르는 값은 버린다.
 */
function readSelection(
  searchParams: ReturnType<typeof useShelfUrlState>['searchParams'],
  facets: Facets,
): Selection {
  const out = { ...EMPTY_SELECTION } as Record<ShelfAxis, readonly string[]>
  for (const axis of SHELF_AXES) {
    const raw = searchParams?.get(axis)
    if (!raw) continue
    const allowed = new Set(facets[axis].map((o) => o.value))
    const picked = raw.split(',').filter((v) => allowed.has(v))
    if (picked.length > 0) out[axis] = picked
  }
  return out as Selection
}

export function TextbookShelf({
  shelf,
  picked = [],
  canPick = false,
  signedIn = true,
}: {
  shelf: Shelf
  /** 내가 이미 담은 계단 번호들 */
  picked?: readonly number[]
  /** 비로그인이면 담기 대신 로그인 길을 낸다(자리를 비우지 않는다) */
  signedIn?: boolean
  /**
   * 담기를 걸어도 되는가.
   *
   * ⚠️ 저장소를 못 읽었으면 false 다. 눌러도 반드시 실패할 버튼을 그려 두는 것은
   *    죽은 버튼과 같은 부류의 거짓이라, 그럴 때는 아예 내지 않는다.
   */
  canPick?: boolean
}) {
  // 축 값은 **재고에서** 뽑는다 — 손으로 적은 목록은 시리즈가 바뀌면 갈린다.
  // ⚠️ 상태보다 **먼저** 만든다. 주소에서 읽은 선택을 재고에 있는 값으로 걸러야 하는데,
  //    그 대조표가 이것이다(없는 값이 남으면 결과 0인 채로 되돌릴 길이 없다).
  const facets = useMemo(() => buildFacets(shelf.volumes), [shelf.volumes])

  // 고르던 자리는 주소가 기억한다 — 한 권을 열어 보고 돌아와도, 새로고침해도 같다.
  const { searchParams, setParams } = useShelfUrlState()

  const [sel, setSelState] = useState<Selection>(() => readSelection(searchParams, facets))
  const [query, setQueryState] = useState(() => searchParams?.get('q') ?? '')
  const [sort, setSortState] = useState<string>(
    () => readEnumParam(searchParams, 'sort', SHELF_SORTS.map((s) => s.id)) ?? DEFAULT_SORT,
  )
  // ⚠️ **기본은 격자다.** 실측 2026-09-01(1280px) — 같은 매대를 두 진열로 재니 격자가
  //    세 축 모두에서 이겼다(절충이 없다):
  //      목록  이미지면적  4.48% · 첫화면상품 2 · 표지 17,584px²
  //      격자  이미지면적 30.53% · 첫화면상품 3 · 표지 100,048px²
  //    다락원 실측이 31.92% 이므로 격자라야 상업 매대와 같은 자리에 선다.
  const [view, setViewState] = useState<ShelfView>(
    () => readEnumParam<ShelfView>(searchParams, 'view', SHELF_VIEWS.map((v) => v.id)) ?? 'grid',
  )
  const [readyOnly, setReadyOnlyState] = useState(() => searchParams?.get('ready') === '1')
  // 좁히기 판이 **열려 있었는지는 주소에 안 적는다** — 그건 고른 조건이 아니라 도구의
  // 여닫힘이다. 다만 조건이 걸린 채로 돌아오면 판을 열어 둔다(아래 초기값).
  const [refineOpen, setRefineOpen] = useState(() => selectionCount(readSelection(searchParams, facets)) > 0)
  const refineId = useId()

  const setSel = useCallback(
    (next: Selection) => {
      setSelState(next)
      // 축 하나가 비면 그 파라미터는 지워진다(`setParams` 는 빈 문자열을 삭제로 읽는다).
      setParams(Object.fromEntries(SHELF_AXES.map((a) => [a, next[a].join(',')])))
    },
    [setParams],
  )
  const setQuery = useCallback(
    (next: string) => {
      setQueryState(next)
      setParams({ q: next })
    },
    [setParams],
  )
  const setSort = useCallback(
    (next: string) => {
      setSortState(next)
      // 기본값은 안 적는다 — 주소는 "기본과 다른 것" 만 말한다.
      setParams({ sort: next === DEFAULT_SORT ? null : next })
    },
    [setParams],
  )
  const setView = useCallback(
    (next: ShelfView) => {
      setViewState(next)
      setParams({ view: next === 'grid' ? null : next })
    },
    [setParams],
  )
  const setReadyOnly = useCallback(
    (next: boolean) => {
      setReadyOnlyState(next)
      setParams({ ready: next })
    },
    [setParams],
  )

  // ⚠️ 순서가 의미를 가진다: **좁히고 → 줄세운다.** 뒤집으면 정렬이 버려진 권까지 훑고,
  //    더 나쁘게는 '문항 많은 순' 이 필터로 사라질 권을 기준으로 잡아 순서가 흔들려 보인다.
  const shown = useMemo(() => {
    const filtered = filterVolumes(shelf.volumes, sel)
    const searched = searchVolumes(filtered, query)
    return onlyReady(searched, readyOnly)
  }, [shelf.volumes, sel, query, readyOnly])

  const ordered = useMemo(() => sortVolumes(shown, sort), [shown, sort])

  // 1차 진열은 매대다 — 시중 교재 코너가 초등/중등/고등을 먼저 나누고 그 안에 계단을 세운다.
  //
  // ⚠️ **정렬을 고르면 매대 묶음을 푼다.** 학령으로 묶은 채 '문항 많은 순' 을 걸면
  //    묶음 안에서만 정렬되어 전체 1등이 가운데 매대에 숨는다 — 학습자는 정렬이
  //    고장 났다고 읽는다. 기본(계단 순)일 때만 묶고, 그 밖에는 한 줄로 편다.
  // ⚠️ **격자도 묶는다.** 전에는 목록일 때만 묶었는데, 그러면 기본값을 격자로 바꾸는 순간
  //    학령 팻말이 통째로 사라진다. 묶음을 푸는 이유는 '정렬을 골랐을 때' 이지
  //    '격자를 골랐을 때' 가 아니다 — 진열 방식과 묶음은 서로 다른 축이다.
  const grouped = sort === DEFAULT_SORT
  const groups = useMemo(() => (grouped ? groupByStage(ordered) : []), [grouped, ordered])

  const activeFilters = selectionCount(sel)

  return (
    <section
      aria-label="교재 서가"
      // 좁은 화면의 안쪽 여백을 줄인다 — 390px 에서는 세로 픽셀이 가장 비싼 자원이고,
      // 20px 짜리 여백 두 겹이 첫 화면에 들어오는 권 수를 실제로 한 권 깎는다.
      className="flex flex-col gap-3 rounded-ios-2xl bg-[var(--bg)] px-4 py-4 shadow-ios-2 md:px-8 md:py-6"
    >
      {/* ⚠️ 제목과 도구줄이 **한 줄**이다. 전에는 제목 34px + 설명 47px + 필터판 379px +
          검색줄 102px 이 전부 상품 위에 있었다(합 562px) — 그래서 첫 화면에 권이 0개였다.
          도구는 제목 오른쪽에 붙이고, 설명은 아래 한 줄로 줄인다. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 shrink-0">
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t2)]">
            {shelf.brand}
          </p>
          <h2 className="font-editorial text-[17px] font-[500] leading-[1.25] tracking-[-0.014em] text-[var(--t1)] md:text-[22px]">
            학년을 잇는 일곱 권
          </h2>
        </div>
        <div className="min-w-[260px] flex-1">
          <ShelfToolbar
            query={query}
            onQuery={setQuery}
            sort={sort}
            onSort={setSort}
            view={view}
            onView={setView}
            refineOpen={refineOpen}
            onRefineOpen={setRefineOpen}
            refinePanelId={refineId}
            activeFilters={activeFilters}
          />
        </div>
      </div>

      {/* 안내 한 줄. 모바일에서는 감춘다 — 세로 픽셀이 가장 비싼 곳이고, 여기서 하는 말은
          바로 아래 매대 팻말(`STAGE_SAYS`)이 매대마다 더 정확하게 되풀이한다.
          ⚠️ 지우지 않고 감춘다(`hidden sm:flex`) — HTML 에는 남아 스크린리더가 읽는다. */}
      <p className="hidden flex-wrap items-baseline gap-x-3 font-body text-[12px] leading-[1.6] text-[var(--t2)] sm:flex [word-break:keep-all]">
        <span className="font-mono tabular-nums">
          펼칠 수 있는 권 {shelf.readyCount}/{shelf.volumes.length}
        </span>
        <span>지금 학년의 권부터 펼치고, 다음 계단으로 올라가면 됩니다.</span>
      </p>

      <RefinePanel
        id={refineId}
        open={refineOpen}
        volumes={shelf.volumes}
        facets={facets}
        sel={sel}
        onChange={setSel}
        shown={shown.length}
        total={shelf.volumes.length}
        readyOnly={readyOnly}
        onReadyOnly={setReadyOnly}
        readyCount={shelf.readyCount}
        sort={sort}
      />

      {/* 못 잰 것을 조용히 넘기지 않는다 — 학습자가 빈 칸을 "없음" 으로 오해하는 것을 막는다. */}
      {shelf.hasUnmeasured && (
        <p
          role="status"
          className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2.5 font-body text-[12px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]"
        >
          일부 권은 지금{' '}
          <strong className="font-display text-[var(--t1)]">재고를 확인하지 못했어요</strong> — 비어
          있다는 뜻이 아닙니다. 잠시 뒤 다시 열어 보세요.
        </p>
      )}

      {shown.length === 0 ? (
        // 0건을 빈 화면으로 두지 않는다 — 무엇을 풀어야 다시 보이는지 말해 준다.
        <p
          role="status"
          className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-5 font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]"
        >
          {query.trim()
            ? `'${query.trim()}' 에 걸리는 권이 없어요. 검색어를 지우거나 조건을 하나 풀어 보세요.`
            : "고른 조건에 맞는 권이 없어요. '좁혀 찾기' 에서 조건을 하나 풀어 보세요."}
        </p>
      ) : (
        // ⚠️ 전에는 여기 앞에 **건너뛰기 링크**가 있었다. 칩 40개 때문에 첫 권까지 Tab 을
        //    24번 눌러야 했기 때문이다. 지금은 도구줄까지 5번이면 닿으므로 그 우회로를 없앴다 —
        //    원인을 고쳤으면 우회로도 걷어야 한다. 남겨 두면 그것도 한 번의 Tab 이다.
        <div id="textbook-list" className="flex flex-col gap-5">
          {grouped ? (
            groups.map((g) => (
              <section key={g.label} aria-label={`${g.label} 매대`} className="flex flex-col gap-2.5">
                <h3 className="flex flex-wrap items-baseline gap-x-2.5 border-b border-[var(--bd)] pb-1.5">
                  <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                    {g.label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {g.volumes.length}권
                  </span>
                  {/* 매대 팻말은 라벨이 말하지 않는 것만 말한다 — 이 매대가 무엇을 시키는지. */}
                  {g.says && (
                    <span className="min-w-0 flex-1 font-body text-[12px] leading-[1.5] text-[var(--t2)] [word-break:keep-all]">
                      {g.says}
                    </span>
                  )}
                </h3>
                <ol
                  className={
                    view === 'grid'
                      ? 'grid grid-cols-2 gap-3 lg:grid-cols-3'
                      : 'flex flex-col gap-2.5'
                  }
                >
                  {g.volumes.map((v) => (
                    <li key={v.step}>
                      {view === 'grid' ? (
                        <VolumeCard
                          volume={v}
                          picked={picked.includes(v.step)}
                          canPick={canPick}
                          signedIn={signedIn}
                        />
                      ) : (
                        <VolumeRow
                          volume={v}
                          picked={picked.includes(v.step)}
                          canPick={canPick}
                          signedIn={signedIn}
                        />
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ))
          ) : (
            // 매대 묶음을 푼 진열 — 정렬을 골랐거나 격자를 골랐을 때.
            <ol
              className={
                view === 'grid'
                  ? 'grid grid-cols-2 gap-3 lg:grid-cols-3'
                  : 'flex flex-col gap-2.5'
              }
            >
              {ordered.map((v) => (
                <li key={v.step}>
                  {view === 'grid' ? (
                    <VolumeCard
                      volume={v}
                      picked={picked.includes(v.step)}
                      canPick={canPick}
                      signedIn={signedIn}
                    />
                  ) : (
                    <VolumeRow
                      volume={v}
                      picked={picked.includes(v.step)}
                      canPick={canPick}
                      signedIn={signedIn}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * 목록 진열의 한 권.
 *
 * ── 앞면에 무엇을 두는가 ────────────────────────────────────────────
 * 표지 · 제목 · 메타 한 줄 · 태그라인 · 단추. 그게 전부다.
 * 근거 문단·유형별 문항 수·부가자료는 '이 권은 무엇을 시키나요' 안에 있다.
 *
 * ⚠️ `data-volume-card` 는 **계측기가 잡는 손잡이**다(`shelf-ux-probe.mjs`).
 *    지우면 사용성 지수가 조용히 못 재는 상태가 된다 — 0 이 아니라 '못 잼' 으로.
 */
function VolumeRow({
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
      // ⚠️ 좁은 화면과 넓은 화면의 **골격이 다르다**(실측 2026-09-01).
      //    한 벌로 3열을 밀었더니 390px 에서 가운데 칸이 150px 로 눌려 제목이 3줄,
      //    메타가 3줄로 접혔다 — 카드 하나가 230px 이 되어 첫 화면에 두 권밖에 안 들어왔다.
      //    좁은 화면은 **2행**(표지+글 / 단추), 넓은 화면은 **3열**(표지 | 글 | 단추)이다.
      className={`grid grid-cols-[46px_1fr] items-start gap-x-3 gap-y-2 rounded-[var(--r-lg)] border p-3 md:p-3.5 motion-safe:transition-colors md:grid-cols-[46px_1fr_auto] md:gap-x-5 ${
        ready
          ? 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--p)]'
          : 'border-dashed border-[var(--bd)] bg-[var(--bg2)]'
      }`}
    >
      {/* 계단 번호 = 진열 순서. 책등처럼 세운다.
          표지는 `ShelfControls` 가 소유한다 — 목록과 격자가 **같은 표지**를 써야
          같은 책으로 읽힌다(진열을 바꿨더니 다른 책처럼 보이면 토글이 해가 된다). */}
      <VolumeCover volume={v} />

      <div className="min-w-0">
        <h3 className="font-editorial text-[17px] font-[500] leading-snug text-[var(--t1)]">
          {v.title}
        </h3>
        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--t2)]">
          {v.schoolBand}
          {` · V${v.vLevels.join('·V')}`}
          {` · 문항 ${v.itemCount.toLocaleString()}`}
        </p>
        {/* 태그라인 — 이 권이 무엇을 시키는지 한 줄. 전문은 아래 '무엇을 시키나요' 안에 있다.
            넓은 화면에서는 같은 줄 오른쪽에 구성 요약을 붙인다 — 남는 가로를 쓰고 높이는 안 쓴다. */}
        <div className="mt-1 flex items-baseline justify-between gap-x-4">
          <p className="min-w-0 font-body text-[12px] leading-[1.6] text-[var(--t1)] [word-break:keep-all]">
            {taglineOf(v.rationale)}
          </p>
          <VolumeSummary volume={v} />
        </div>
      </div>

      {/*
        ⚠️ 이 껍데기는 **좁은 화면에서만 존재한다**(`md:contents` — 넓은 화면에서는 상자가
           사라지고 안의 둘이 바로 격자 칸에 앉는다).
           왜 이렇게까지 하나: 좁은 화면에서 '무엇을 시키나요' 줄(44px)과 단추 줄(44px)을
           **따로** 쌓았더니 카드가 253px 이 되어 첫 화면에 두 권밖에 안 들어왔다(실측 2026-09-01).
           둘 다 44px 짜리 한 줄짜리 물건이라 **같은 줄에 나란히** 두면 44px 이 통째로 빈다.
           넓은 화면에서는 그럴 이유가 없으므로(가로가 남는다) 원래 자리로 되돌린다.
      */}
      <div className="col-start-2 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 md:contents">
        {/* ⚠️ 좁은 화면에서는 이 줄을 **통째로** 차지하게 둔다(`w-full`). 단추와 한 줄에 욱여넣으면
            390px 에서 반드시 접히는데, 접힌 줄을 `justify-between` 이 좌우로 벌려 놓아
            단추가 허공에 뜬 것처럼 보였다 — 접힐 것을 미리 두 줄로 두는 편이 정직하고 단정하다. */}
        <div className="w-full min-w-0 md:col-start-2 md:row-start-2 md:w-auto">
          <VolumeGuide volume={v} />
        </div>

        {/* 담기는 **아직 못 펼치는 권에도** 뜬다 — 근간 예정을 찜해 두는 것이 서점의 예약과 같다. */}
        <div className="flex flex-wrap items-center gap-2 md:col-start-3 md:row-start-1 md:flex-col md:items-end">
          <VolumeAction volume={v} />
          {canPick && (
            <TextbookPickButton
              step={v.step}
              title={v.title}
              picked={picked}
              signedIn={signedIn}
              size="sm"
            />
          )}
        </div>
      </div>
    </article>
  )
}
