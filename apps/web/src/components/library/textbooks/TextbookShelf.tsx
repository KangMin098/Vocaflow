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
// ⚠️ 상태 셋을 **색으로만** 가르지 않는다(색맹 대응). 라벨·위치·문항 수 3중으로 말한다.
// ⚠️ `empty`(재료 없음)를 숨기지 않는다 — 숨기면 사다리가 끊긴 것을 학습자가 모르고,
//    그 학년 학습자는 "내 학년이 없다" 가 아니라 "이 브랜드는 이상하다" 로 읽는다.

'use client'

import { BookOpen, Layers, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { TextbookPickButton } from '@/components/library/textbooks/TextbookPickButton'
import type { Shelf, ShelfVolume } from '@/lib/textbook/shelf'
import {
  AXIS_LABEL,
  EMPTY_SELECTION,
  SHELF_AXES,
  buildFacets,
  filterVolumes,
  selectionCount,
  toggleValue,
  type Facets,
  type Selection,
} from '@/lib/textbook/shelf-filter'
import { groupByStage } from '@/lib/textbook/shelf-stage'
import { TYPE_GUIDE } from '@/lib/textbook/type-guide'


const STATUS_LABEL: Record<ShelfVolume['status'], string> = {
  ready: '지금 펼치기',
  building: '준비 중',
  empty: '근간 예정',
  // '없음' 과 절대 같은 말을 쓰지 않는다 — 못 잰 것을 없다고 적는 것이 이 화면의 첫 결함이었다.
  unmeasured: '재고 확인 중',
}

export function TextbookShelf({
  shelf,
  picked = [],
  canPick = false,
}: {
  shelf: Shelf
  /** 내가 이미 담은 계단 번호들 */
  picked?: readonly number[]
  /**
   * 담기를 걸어도 되는가.
   *
   * ⚠️ 저장소를 못 읽었으면 false 다. 눌러도 반드시 실패할 버튼을 그려 두는 것은
   *    죽은 버튼과 같은 부류의 거짓이라, 그럴 때는 아예 내지 않는다.
   */
  canPick?: boolean
}) {
  const [sel, setSel] = useState<Selection>(EMPTY_SELECTION)
  // 축 값은 **재고에서** 뽑는다 — 손으로 적은 목록은 시리즈가 바뀌면 갈린다.
  const facets = useMemo(() => buildFacets(shelf.volumes), [shelf.volumes])
  const shown = useMemo(() => filterVolumes(shelf.volumes, sel), [shelf.volumes, sel])
  // 1차 진열은 매대다 — 시중 교재 코너가 초등/중등/고등을 먼저 나누고 그 안에 계단을 세운다.
  const groups = useMemo(() => groupByStage(shown), [shown])

  return (
    <section
      aria-label="교재 서가"
      className="flex flex-col gap-4 rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8 md:py-7"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
          {shelf.brand}
        </p>
        <h2 className="font-editorial text-[24px] font-[500] leading-[1.2] tracking-[-0.014em] text-[var(--t1)] md:text-[28px]">
          학년을 잇는 일곱 권
        </h2>
        <p className="ml-auto font-mono text-[11px] tabular-nums text-[var(--t3)]">
          펼칠 수 있는 권 {shelf.readyCount}/{shelf.volumes.length}
        </p>
      </header>

      <p className="max-w-[62ch] font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
        계단마다 <strong className="font-display text-[var(--t1)]">쓰는 유형이 다릅니다</strong> —
        초등은 소리와 낱말, 중등은 문장, 고등부터 글 전체를 봅니다. 지금 학년의 권부터 펼치고,
        다음 계단으로 올라가면 됩니다.
      </p>

      {/* 못 잰 것을 조용히 넘기지 않는다 — 학습자가 빈 칸을 "없음" 으로 오해하는 것을 막는다. */}
      {shelf.hasUnmeasured && (
        <p
          role="status"
          className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-body text-[12.5px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]"
        >
          일부 권은 지금 <strong className="font-display text-[var(--t1)]">재고를 확인하지 못했어요</strong> —
          비어 있다는 뜻이 아닙니다. 잠시 뒤 다시 열어 보세요.
        </p>
      )}

      <FilterBar
        facets={facets}
        sel={sel}
        onChange={setSel}
        shown={shown.length}
        total={shelf.volumes.length}
      />

      {shown.length === 0 ? (
        // 0건을 빈 화면으로 두지 않는다 — 무엇을 풀어야 다시 보이는지 말해 준다.
        <p
          role="status"
          className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-5 font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]"
        >
          고른 조건에 맞는 권이 없어요. 위에서 조건을 하나 풀어 보세요.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.label} aria-label={`${g.label} 매대`} className="flex flex-col gap-2.5">
              <h3 className="flex flex-wrap items-baseline gap-x-2.5 border-b border-[var(--bd)] pb-1.5">
                <span className="font-editorial text-[19px] font-[500] leading-none text-[var(--t1)]">
                  {g.label}
                </span>
                <span className="font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
                  {g.volumes.length}권
                </span>
                {/* 매대 팻말은 라벨이 말하지 않는 것만 말한다 — 이 매대가 무엇을 시키는지. */}
                {g.says && (
                  <span className="min-w-0 flex-1 font-body text-[11.5px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
                    {g.says}
                  </span>
                )}
              </h3>
              <ol className="flex flex-col gap-3">
                {g.volumes.map((v) => (
                  <li key={v.step}>
                    <VolumeRow volume={v} picked={picked.includes(v.step)} canPick={canPick} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}

function VolumeRow({
  volume: v,
  picked,
  canPick,
}: {
  volume: ShelfVolume
  picked: boolean
  canPick: boolean
}) {
  const ready = v.status === 'ready'

  return (
    <article
      className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-[var(--r-lg)] border p-4 md:grid-cols-[auto_1fr_auto] ${
        ready ? 'border-[var(--bd)] bg-[var(--bg)]' : 'border-dashed border-[var(--bd)] bg-[var(--bg2)]'
      }`}
    >
      {/* 계단 번호 = 진열 순서. 책등처럼 세운다. */}
      <span
        aria-hidden
        className={`flex h-[62px] w-[46px] shrink-0 flex-col items-center justify-center rounded-[var(--r-sm)] font-display ${
          ready
            ? 'bg-[var(--p)] text-[var(--on-p)]'
            : 'bg-[var(--bg3)] text-[var(--t3)]'
        }`}
      >
        <span className="font-mono text-[9px] font-[700] uppercase tracking-[0.1em] opacity-80">
          STEP
        </span>
        <span className="text-[22px] font-[800] leading-none tabular-nums">{v.step}</span>
      </span>

      <div className="min-w-0">
        <h3 className="font-editorial text-[19px] font-[500] leading-snug text-[var(--t1)] md:text-[21px]">
          {v.title}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
          <span>{v.schoolBand}</span>
          <span>· V{v.vLevels.join('·V')}</span>
          <span>· 문항 {v.itemCount.toLocaleString()}</span>
        </p>

        {/* 수록 유형 — 서점 교재의 "구성" 란에 해당한다 */}
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {v.types.map((t) => {
            const missing = v.emptyTypes.includes(t)
            return (
              <li
                key={t}
                className={`inline-flex items-center gap-1 rounded-[var(--r-full)] px-2.5 py-1 font-display text-[11px] font-[700] ${
                  missing
                    ? 'bg-[var(--bg3)] text-[var(--t3)] line-through'
                    : 'bg-[var(--p-light)] text-[var(--on-p-tint)]'
                }`}
                title={missing ? '아직 준비되지 않은 유형' : undefined}
              >
                {TYPE_GUIDE[t]?.label ?? t}
                {!missing && (
                  <span className="font-mono text-[10px] tabular-nums opacity-70">
                    {(v.byType[t] ?? 0).toLocaleString()}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        <p className="mt-2.5 max-w-[58ch] font-body text-[12px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          {v.rationale.replace(/\*\*/g, '')}
        </p>
      </div>

      {/* 상태 — 색만으로 가르지 않는다(라벨 + 위치 + 아이콘).
          ⚠️ ready 는 **반드시 링크**여야 한다. 처음 만들었을 때 이 자리가 span 이라
          "지금 펼치기" 가 보이는데 눌리지 않았다 — 이 저장소가 가장 나쁜 결함으로 못 박은 종류다. */}
      <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:justify-end">
        {/* 담기는 **아직 못 펼치는 권에도** 뜬다 — 근간 예정을 찜해 두는 것이 서점의 예약과 같다. */}
        {canPick && <TextbookPickButton step={v.step} title={v.title} picked={picked} size="sm" />}
        {ready ? (
          <Link
            href={`/library/textbooks/${v.step}`}
            aria-label={`${v.title} 펼쳐 보기`}
            className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-ios-pill bg-[var(--p)] px-4 font-display text-[12.5px] font-[700] text-[var(--on-p)] no-underline motion-safe:transition-all motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          >
            <BookOpen size={14} aria-hidden />
            {STATUS_LABEL[v.status]}
          </Link>
        ) : (
          <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-ios-pill border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12.5px] font-[700] text-[var(--t2)]">
            <Layers size={14} aria-hidden />
            {STATUS_LABEL[v.status]}
          </span>
        )}
      </div>
    </article>
  )
}

/**
 * 세 축 필터 — 학령 · 수준 · 유형.
 *
 * ⚠️ 칩을 **끄는 방법**을 화면에 남긴다. 조건을 걸어 0건이 된 학습자가 되돌아갈 길이
 *    없으면 그 화면은 막힌 것과 같다(이 저장소가 죽은 버튼과 같은 부류로 취급하는 결함).
 * ⚠️ 축 이름을 칩 옆에 계속 적어 둔다 — 칩만 있으면 'V3' 이 무엇의 3인지 알 수 없다.
 */
function FilterBar({
  facets,
  sel,
  onChange,
  shown,
  total,
}: {
  facets: Facets
  sel: Selection
  onChange: (next: Selection) => void
  shown: number
  total: number
}) {
  const active = selectionCount(sel)

  return (
    <div className="flex flex-col gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
          <SlidersHorizontal size={12} aria-hidden />
          찾기
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">
          {active > 0 ? `${shown} / ${total}권` : `${total}권 전체`}
        </span>
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_SELECTION)}
            className="ml-auto inline-flex min-h-[44px] items-center gap-1 font-display text-[11.5px] font-[700] text-[var(--p)] transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <X size={12} aria-hidden />
            조건 {active}개 해제
          </button>
        )}
      </div>

      {SHELF_AXES.map((axis) => (
        <div key={axis} className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
          <span className="min-w-[34px] font-display text-[11px] font-[700] text-[var(--t3)]">
            {AXIS_LABEL[axis]}
          </span>
          {facets[axis].map((f) => {
            const on = sel[axis].includes(f.value)
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={on}
                aria-label={`${AXIS_LABEL[axis]} ${f.label} — ${f.count}권`}
                onClick={() => onChange(toggleValue(sel, axis, f.value))}
                className={`inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-full)] border px-3 font-display text-[11.5px] font-[700] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                  on
                    ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                    : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
                }`}
              >
                {f.label}
                <span
                  className={`font-mono text-[10px] tabular-nums ${on ? 'opacity-75' : 'text-[var(--t3)]'}`}
                >
                  {f.count}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
