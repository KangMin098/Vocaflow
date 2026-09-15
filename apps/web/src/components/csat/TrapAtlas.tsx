// apps/web/src/components/csat/TrapAtlas.tsx
//
// **오답 지도 — 「평가원은 오답을 아홉 가지 방법으로 만든다」를 세어서 보여 주는 조작면.**
//
// ── 이 화면이 대체하는 것 ─────────────────────────────────────────────
// 전에는 `/csat` 첫 화면이 유형 카드 26장이었고, 카드마다 분석 산문 두 줄이 잘려 들어 있었다.
// 학습자가 도착해서 얻는 것은 **읽을거리 26개**였다 — 무엇부터 할지는 말해 주지 않는 목록.
//
// 여기서는 도착하자마자 **센 것**이 칠해져 있다. 3,208개 오답을 전부 뜯어 세면 아홉 가지가
// 60%이고, 그 아홉은 유형 26개 중 13~17개에 걸쳐 나온다. 그러니까 유형을 26벌 외우는 것보다
// **오답 만드는 법 아홉 가지를 아는 것**이 먼저다. 그 주장을 산문으로 쓰지 않고 막대로 낸다.
//
// ── 조작 (I3) ─────────────────────────────────────────────────────────
// 유형 칩을 누르면 그 유형 안의 분포로 **다시 세어** 막대가 재배열된다. 네트워크 왕복 0 —
// `rankFor` 가 순수 함수이고 수치는 정적 import 다. 「최근 4개년만」도 같다.
//
// ── 색만으로 말하지 않는다 ────────────────────────────────────────────
// 범용/유형특화 구분은 **기호(◆/◇) + 「17유형」 글자 + 막대 톤** 셋으로 낸다. 색약 학습자에게
// 색은 없는 것과 같고, 이 화면은 그 구분이 이야기의 전부다.
//
// ── 모션 ──────────────────────────────────────────────────────────────
// 막대 폭 전환 하나(`--dur-normal`)와 펼침뿐이다. 장식 모션 없음(CLAUDE.md 모션 예산).
// `motion-reduce` 에서는 전환을 끄되 상태는 그대로 보인다.

'use client'

import { useMemo, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { MIN_SEEN, MIN_TOTAL, myMissCounts, type MyTrapSummary } from '@/lib/csat/my-traps'
import {
  CORPUS,
  baselineShare,
  rankFor,
  rankFromCounts,
  universalCoverage,
  type AtlasType,
  type RankRow,
} from '@/lib/csat/trap-atlas'

// 부제가 쓰는 두 수치.
const ATLAS_ITEMS = CORPUS.analyzed
const ATLAS_DISTRACTORS = CORPUS.distractors

export interface TrapAtlasProps {
  /** 칩에 올릴 유형 — 부르는 쪽이 정렬·개수를 정한다(허브는 최근 출제 많은 순 8개). */
  chips: AtlasType[]
  /** 처음 고를 유형. 유형 화면에서는 자기 자신으로 들어온다. */
  initialTypeId?: string | null
  /** 칩 줄을 그릴까 — 유형 화면에서는 범위가 고정이라 숨긴다. */
  showChips?: boolean
  /** 처음에 몇 줄을 펼쳐 둘까. 나머지는 「더 보기」 뒤에 있다. */
  visibleRows?: number
  /** 제목을 갈아 끼운다(유형 화면). 비우면 허브 문구. */
  title?: string
  /**
   * 제목의 단계. 허브에서는 이 지도가 **화면의 주제**이므로 `h1` 이다.
   *
   * ⚠️ 기본값을 `h2` 로 두고 허브에서 안 넘기면 **화면에 h1 이 하나도 없게 된다.**
   *    실측 2026-09-15 에 실제로 그랬고, `axe` 의 wcag2a/aa 로는 안 잡힌다(빈 h1 은
   *    best-practice 규칙이다 — 중복 landmark 와 같은 사각지대). 기존 스펙 41 이 잡았다.
   */
  as?: 'h1' | 'h2'
  /** 부제를 갈아 끼운다. 비우면 허브 문구(I4 — 90자 안). */
  subtitle?: React.ReactNode
  /**
   * 전체 분포 대비 **배수**를 함께 낸다 — 유형 화면에서만 의미가 있다.
   *
   * 유형 안의 순위만 보여 주면 어느 유형을 열어도 「어휘 함정 · 부분 사실」이 위에 온다
   * (그게 전체 1~2위니까). 학습자에게 그것은 정보가 아니다. **여기서 유난히 잦은가**가
   * 이 화면이 답해야 할 질문이다.
   */
  showLift?: boolean
  /**
   * 내 훈련 기록 — 있으면 「내 기록」 칩이 생기고, 그 칩은 **같은 막대를 내 오답으로 다시 센다.**
   * 화면이 유형에 대해 이미 하는 말(「여기서 유난하다」)을 학습자 자신에 대해 하게 되는 지점이다.
   * 비어 있으면 칩을 그리지 않는다 — 기록이 없는 사람에게 빈 칩을 내밀지 않는다.
   */
  mine?: MyTrapSummary | null
}

/** 막대 한 칸의 최소 폭 — 1%짜리도 「있다」가 보여야 한다(0px 막대는 없는 것과 같다). */
const MIN_BAR_PCT = 1.5

export function TrapAtlas({
  chips,
  initialTypeId = null,
  showChips = true,
  visibleRows = 9,
  title,
  subtitle,
  showLift = false,
  as: Heading = 'h2',
  mine = null,
}: TrapAtlasProps) {
  const [typeId, setTypeId] = useState<string | null>(initialTypeId)
  const [recentOnly, setRecentOnly] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  // 「내 기록」으로 보고 있나. 기록이 있을 때만 켤 수 있다.
  const [mineOn, setMineOn] = useState(false)
  const opened = useRef(0)

  // 기록이 하나도 없으면 칩 자체를 안 그린다 — 빈 막대를 내미는 것은 정보가 아니다.
  const hasMine = Boolean(mine && mine.missedTotal > 0)
  const atlasRank = useMemo(() => rankFor(typeId, recentOnly), [typeId, recentOnly])
  const mineRank = useMemo(() => (mine ? rankFromCounts(myMissCounts(mine)) : null), [mine])
  const rank = mineOn && mineRank ? mineRank : atlasRank
  const cover = useMemo(() => universalCoverage(), [])
  // 배수의 분모 — 같은 era 의 **전체** 분포에서 「이름 붙은 오답」이 차지하는 몫.
  // era 를 안 맞추면 「최근만」에서 배수가 엉키고, 「이름 붙은 것끼리」로 안 맞추면
  // 「그 밖」이 0인 유형에서 전부 ×1.3 이상으로 뜬다(`trap-atlas.ts` 의 `namedShare` 주석).
  //
  // 「내 기록」에서는 배수가 **이 화면의 전부**다: 내 오답에서 이 수법이 차지하는 몫이
  // 전체 기출에서의 몫보다 큰가. 그래서 `showLift` 를 안 켜도 저절로 켜진다.
  const liftOn = showLift || mineOn
  const base = useMemo(() => (liftOn ? baselineShare(recentOnly) : null), [liftOn, recentOnly])
  const scopeShare = useMemo(() => {
    if (!base) return null
    const named = rank.rows.reduce((a, r) => a + r.n, 0)
    return new Map(rank.rows.map((r) => [r.key, named > 0 ? r.n / named : 0]))
  }, [base, rank])
  /**
   * 배수를 말해도 되는 함정 — **표본이 얇으면 말하지 않는다.**
   * 세 번 만나 두 번 틀린 것과 스무 번 만나 열네 번 틀린 것은 같은 66%가 아닌데,
   * 막대는 둘을 똑같이 그린다. 문턱은 `my-traps.ts` 가 정하고 여기서는 따르기만 한다.
   */
  const liftAllowed = useMemo(() => {
    if (!mineOn || !mine) return null
    if (!mine.enough) return new Set<string>()
    return new Set(mine.rows.filter((r) => r.seen >= MIN_SEEN).map((r) => r.trap))
  }, [mineOn, mine])
  // ⚠️ **「그 밖」도 같은 자로 잰다.** 1위 막대만 기준으로 삼았더니 그 밖(24.4%)이 1위(12.1%)의
  //    두 배라 컨테이너를 넘어 **꽉 찬 막대**로 그려졌다 — 「드문 것들의 합」이 가장 큰 함정처럼
  //    보였다(실측 2026-09-15 캡처). 막대는 눈으로 견주라고 있는 것이라, 자가 다르면 거짓말이다.
  const max = Math.max(rank.rows[0]?.pct ?? 0, rank.other.pct, 1)

  const shown = expanded ? rank.rows : rank.rows.slice(0, visibleRows)
  const hidden = rank.rows.length - shown.length

  function scope(next: string | null, nextRecent = recentOnly) {
    // 「내 기록」을 켠 채 전체·유형 칩을 누르면 **끄고** 그쪽으로 간다 — 두 칩이 동시에
    // 눌린 것처럼 보이면 학습자는 지금 무엇을 보고 있는지 모른다(실측 캡처).
    if (mineOn) setMineOn(false)
    else if (next === typeId && nextRecent === recentOnly) return
    setTypeId(next)
    setRecentOnly(nextRecent)
    setOpenKey(null)
    setExpanded(false)
    track({
      name: 'csat_atlas_scoped',
      props: { scoped: next !== null, recentOnly: nextRecent, kinds: rankFor(next, nextRecent).rows.length },
    })
  }

  function toggleRow(row: RankRow, idx: number) {
    const next = openKey === row.key ? null : row.key
    setOpenKey(next)
    if (!next) return
    opened.current += 1
    track({
      name: 'csat_trap_opened',
      props: { rank: idx + 1, universal: row.universal, scoped: typeId !== null, seq: opened.current },
    })
  }

  return (
    <section aria-labelledby="trap-atlas-h">
      {/* ⚠️ `break-keep` 이 없으면 390px 에서 「만듭니 / 다」로 쪼개진다 (CLAUDE.md I7 · 실측). */}
      <Heading
        id="trap-atlas-h"
        className={[
          'break-keep font-display font-bold text-[var(--t1)]',
          title ? 'text-sm' : 'text-xl sm:text-2xl',
        ].join(' ')}
      >
        {title ?? `평가원은 오답을 ${cover.kinds}가지 방법으로 만듭니다`}
      </Heading>
      {/* I4 — 부제는 90자 안. 근거 수치만 말하고 해석은 막대가 한다. */}
      <p className="mt-1.5 break-keep text-sm leading-relaxed text-[var(--t2)]">
        {subtitle ?? (
          <>
            기출 {ATLAS_ITEMS.toLocaleString()}문항의 오답 선지 {ATLAS_DISTRACTORS.toLocaleString()}개를 하나씩 뜯어
            세었습니다. 그 {cover.kinds}가지가 {cover.pct.toFixed(0)}%입니다.
          </>
        )}
      </p>

      {showChips ? (
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="분포를 볼 범위">
          {/* ⚠️ 여기는 **`atlasRank`** 를 읽는다. `rank` 를 쓰면 「내 기록」을 켠 순간
              전체 칩이 내 오답 수(18)를 적는다 — 실측 캡처에서 「전체 18」로 나왔다.
              칩의 수는 **그 칩을 누르면 보게 될 것**이어야 한다. */}
          <Chip on={!mineOn && typeId === null} onClick={() => scope(null)}>
            전체 <Num>{atlasRank.total.toLocaleString()}</Num>
          </Chip>
          {/* 390px 에서 칩이 다섯 줄을 먹어 **막대가 접힌 아래로 밀려났다**(실측 캡처).
              증명이 접힌 위에서 끝나야 하므로(I8) 좁은 화면에서는 앞의 넷만 남긴다 —
              지우는 것이 아니라 CSS 로 감춘다(서버 HTML 에는 그대로 있다 · I6). */}
          {chips.map((t, i) => (
            <Chip
              key={t.id}
              on={!mineOn && typeId === t.id}
              onClick={() => scope(t.id)}
              className={i >= 4 && typeId !== t.id ? 'hidden sm:inline-flex' : undefined}
            >
              {t.name} <Num>{recentOnly ? t.recent : t.distractors}</Num>
            </Chip>
          ))}
          <Chip on={recentOnly} onClick={() => scope(typeId, !recentOnly)} pressedLabel="최근 4개년만">
            최근 4개년만
          </Chip>
          {/* **같은 막대를 내 오답으로 다시 센다.** 기록이 없으면 칩이 아예 없다. */}
          {hasMine ? (
            <Chip
              on={mineOn}
              onClick={() => {
                setMineOn((v) => !v)
                setOpenKey(null)
                setExpanded(false)
              }}
            >
              내 기록 <Num>{mine!.missedTotal}</Num>
            </Chip>
          ) : null}
        </div>
      ) : null}

      {/* 막대 — **이것이 증명이다**(I1). `data-proof` 는 표면 계측기(`csat-surface-measure`)가
          「접힌 위에 작동하는 결과가 있는가」를 셀 때 보는 표식이다. */}
      <ol className="mt-4 space-y-1" data-proof="trap-distribution">
        {shown.map((row, i) => {
          const open = openKey === row.key
          return (
            // `data-pct` 는 계측기·회귀가 「막대 폭이 이 비율과 맞는가」를 볼 때 쓰는 표식이다.
            // 글자에서 읽으면 「389」와 「12.1%」가 붙어 `38912.1` 로 읽힌다(실측 — 회귀가 이걸로 한 번 헛돌았다).
            <li key={row.key} data-pct={row.pct.toFixed(2)}>
              <button
                type="button"
                onClick={() => toggleRow(row, i)}
                aria-expanded={open}
                className={[
                  'flex w-full min-h-[44px] items-center gap-3 rounded-[var(--r-md)] border px-3 py-2 text-left',
                  'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]',
                  open
                    ? 'border-[var(--p)] bg-[var(--sf-2)]'
                    : 'border-transparent hover:border-[var(--bd)] hover:bg-[var(--sf)] active:bg-[var(--sf-2)]',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className="w-3 shrink-0 text-center text-[11px] leading-none text-[var(--t3)]"
                  title={row.universal ? '유형을 가로지르는 함정' : '몇몇 유형에만 나오는 함정'}
                >
                  {row.universal ? '◆' : '◇'}
                </span>

                <span className="w-[6.5rem] shrink-0 break-keep text-sm text-[var(--t1)] sm:w-32">{row.key}</span>

                <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bd)]">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none"
                    style={{
                      width: `${Math.max(MIN_BAR_PCT, (100 * row.pct) / max)}%`,
                      background: row.universal ? 'var(--p)' : 'var(--t4)',
                    }}
                  />
                </span>

                <span className="shrink-0 tabular-nums text-xs text-[var(--t2)]">{row.n}</span>
                <span className="w-11 shrink-0 text-right tabular-nums text-xs text-[var(--t3)]">
                  {row.pct.toFixed(1)}%
                </span>
                {base && scopeShare && (!liftAllowed || liftAllowed.has(row.key)) ? (
                  <Lift share={scopeShare.get(row.key) ?? 0} base={base.get(row.key) ?? 0} />
                ) : liftOn ? (
                  // 문턱을 못 넘었다 — **짐작을 숫자로 적지 않는다.** 몇 번 봤는지만 말한다.
                  <span className="w-14 shrink-0 text-right tabular-nums text-xs text-[var(--t3)]">
                    {mine?.rows.find((r) => r.trap === row.key)?.seen ?? 0}번 봄
                  </span>
                ) : (
                  <span className="hidden w-14 shrink-0 text-right text-xs text-[var(--t3)] sm:inline">
                    {row.types}유형
                  </span>
                )}
              </button>

              {open ? <TrapDetail row={row} /> : null}
            </li>
          )
        })}

        {/* **그 밖을 지우지 않는다.** 60%라고 말하려면 나머지 40%가 화면에 있어야 한다. */}
        {rank.other.n > 0 ? (
          <li className="flex min-h-[36px] items-center gap-3 px-3 py-2" data-pct={rank.other.pct.toFixed(2)}>
            <span aria-hidden className="w-3 shrink-0 text-center text-[11px] leading-none text-[var(--t3)]">
              ·
            </span>
            <span className="w-[6.5rem] shrink-0 break-keep text-sm text-[var(--t3)] sm:w-32">그 밖</span>
            <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bd)]">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--t4)] opacity-50"
                style={{ width: `${Math.max(MIN_BAR_PCT, (100 * rank.other.pct) / max)}%` }}
              />
            </span>
            <span className="shrink-0 tabular-nums text-xs text-[var(--t3)]">{rank.other.n}</span>
            <span className="w-11 shrink-0 text-right tabular-nums text-xs text-[var(--t3)]">
              {rank.other.pct.toFixed(1)}%
            </span>
            <span className="hidden w-14 shrink-0 text-right text-xs text-[var(--t3)] sm:inline">드묾</span>
          </li>
        ) : null}
      </ol>

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] px-3 text-sm text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--sf)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
        >
          이름 붙은 함정 {hidden}가지 더 보기 →
        </button>
      ) : null}

      {/* ⚠️ **표본이 얇으면 「분포」라고 부르지 않는다.** 여기 적는 문장이 곧 약속이다 —
          다섯 번 훈련하고 「당신의 약점」을 말하면 학습자가 없는 결함을 고치러 간다. */}
      {mineOn && mine ? (
        <p className="mt-3 break-keep text-xs leading-relaxed text-[var(--t3)]">
          {mine.enough ? (
            <>
              훈련 <span className="tabular-nums">{mine.total}</span>문항 중 놓친{' '}
              <span className="tabular-nums">{mine.missedTotal}</span>개를 수법별로 센 것입니다. 배수는 전체 기출의
              오답 분포와 견준 값이고, <span className="tabular-nums">{MIN_SEEN}</span>번 이상 만난 수법에만
              적습니다.
              {mine.repeated.length ? (
                <>
                  {/* 조사를 붙이지 않는다 — 함정 이름의 끝 글자에 따라 「이에요/예요」가 갈리는데
                      이름은 데이터에서 온다. 실측 캡처에 「범위 과대 이에요」가 찍혔다.
                      ⚠️ **셋까지만 부른다.** 여섯이 다 걸리면 문장이 목록이 되고, 그건
                         「전부 유난하면 아무것도 유난하지 않다」의 다른 얼굴이다(실측 캡처). */}{' '}
                  지금 가장 자주 놓치는 것:{' '}
                  <strong className="text-[var(--t1)]">{mine.repeated.slice(0, 3).join(' · ')}</strong>
                  {mine.repeated.length > 3 ? ` 외 ${mine.repeated.length - 3}가지` : ''}.
                </>
              ) : null}
            </>
          ) : (
            <>
              아직 <span className="tabular-nums">{mine.total}</span>문항이라 분포라고 부르기엔 일러요 — 센 것만
              보여 드립니다. <span className="tabular-nums">{MIN_TOTAL}</span>문항쯤 쌓이면 전체 기출과 견준 배수를
              함께 적을게요.
            </>
          )}
        </p>
      ) : (
        <p className="mt-3 break-keep text-xs leading-relaxed text-[var(--t3)]">
          <span aria-hidden>◆</span> 는 {cover.minTypes}개 이상의 유형에 걸쳐 나오는 함정입니다 — 유형을 바꿔도
          같은 수법이 옵니다. <span aria-hidden>◇</span> 는 몇몇 유형에만 나옵니다.
          {base
            ? ' 오른쪽 배수는 전체 기출의 오답 분포와 견준 값입니다 — ×가 클수록 이 유형에서 유난한 함정입니다.'
            : ''}
        </p>
      )}
    </section>
  )
}

/**
 * 전체 대비 배수 — 「여기서 유난히 잦은가」.
 *
 * 색으로만 말하지 않는다: 잦으면 `×2.1`, 드물면 `÷1.8`, 비슷하면 「비슷」 이라고 **글자로** 적는다.
 * 1.3배 미만은 표본 흔들림과 구별이 안 되므로 굳이 방향을 말하지 않는다.
 */
function Lift({ share, base }: { share: number; base: number }) {
  if (base <= 0) {
    return <span className="w-14 shrink-0 text-right text-xs text-[var(--t3)]">이 유형만</span>
  }
  const x = share / base
  const label = x >= 1.3 ? `×${x.toFixed(1)}` : x <= 1 / 1.3 ? `÷${(1 / x).toFixed(1)}` : '비슷'
  return (
    <span
      className={[
        'w-14 shrink-0 text-right tabular-nums text-xs',
        x >= 1.3 ? 'font-bold text-[var(--t1)]' : 'text-[var(--t3)]',
      ].join(' ')}
      title="전체 기출의 오답 분포와 견준 값"
    >
      {label}
    </span>
  )
}

/** 펼친 줄 — 「어떻게 잡는가」 한 줄과 **실제 기출 예시**. 예시가 없으면 장담도 안 한다. */
function TrapDetail({ row }: { row: RankRow }) {
  return (
    <div className="mb-2 ml-6 mt-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4">
      {row.detector ? (
        <p className="break-keep text-sm leading-relaxed text-[var(--t1)]">
          <span className="font-display font-bold">잡는 법 </span>
          {row.detector}
        </p>
      ) : null}

      {row.examples.length ? (
        <ul className="mt-3 space-y-3">
          {row.examples.map((ex) => (
            <li key={`${ex.item_id}-${ex.choice}`} className="border-l-2 border-[var(--bd)] pl-3">
              <a
                href={`/csat/item/${ex.slug}`}
                className="inline-flex min-h-[44px] items-center text-xs text-[var(--t3)] underline decoration-[var(--bd)] underline-offset-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] hover:decoration-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
              >
                {ex.exam_label} <span className="tabular-nums">{ex.no}번</span> · {ex.choice}번 선지 →
              </a>
              {ex.tempting ? (
                <p className="break-keep text-sm leading-relaxed text-[var(--t2)]">끌리는 이유 — {ex.tempting}</p>
              ) : null}
              {ex.reject ? (
                <p className="mt-1 break-keep text-sm leading-relaxed text-[var(--t1)]">버리는 법 — {ex.reject}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
  pressedLabel,
  className,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  pressedLabel?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={pressedLabel}
      className={[
        className ?? 'inline-flex',
        'min-h-[44px] items-center gap-1.5 rounded-[var(--r-full)] border px-3.5 text-sm break-keep',
        'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]',
        on
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
          : 'border-[var(--bd)] bg-[var(--sf)] text-[var(--t2)] hover:border-[var(--p)] hover:bg-[var(--sf-2)] active:bg-[var(--bd)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/**
 * 칩 안의 개수.
 *
 * ⚠️ **투명도를 쓰지 않는다.** `opacity-70` 을 걸었더니 다크의 고른 칩에서 글자
 *    `--on-p`(#231D17)가 `--p`(#6B9BD1) 위에 합성돼 **#39434F · 3.46:1** 이 됐다(axe 실측).
 *    토큰은 5.74:1 로 안전한데 투명도가 그 계산을 무효로 만든 것이다 — 크기 차이로만 낮춘다.
 */
function Num({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums text-xs">{children}</span>
}
