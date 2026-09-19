// apps/web/src/components/home/TodayStage.tsx
//
// Today 무대 — **「들어 올리는 곡선」**(2026-09-19 화면 재설계 · 발산 A · docs/design/compare/hub.md).
//
// 골격(G1 망각): 첫 시선이 **7일 기억 곡선**이다. 점선 = 그대로 두면 날마다 버티는 단어 수,
// 실선 = 오늘 N개를 다시 보면. 두 선 사이의 옅은 면이 "오늘 한 일이 일주일 뒤에 남기는 것" 이다.
// 곡선 아래에 그 N개가 **낱말로** 조판된다 — 밑줄 두께 3/2/1px(dotted = 처음)가 지금의 상태,
// 권점(○)이 "오늘 다시 볼 것".
//
// 서명: 「오늘 다시 볼 단어」 슬라이더 → 실선이 새로 서고 권점이 옮겨 찍힌다 · 200ms.
// `/fit` 골든(슬라이더 → 낱말 표면 200ms)과 **같은 몸짓**이다 — 화면마다 새 몸짓을 만들지 않는다.
//
// 왜 "안 하면 내려간다" 가 아니라 "하면 올라간다" 인가 — DB 실측(2026-09-19): 추적 단어가 있는
// 학습자 둘 모두 추적 단어 전부가 이미 흐려져 있었고 7일 안에 새로 흐려질 것은 0 이었다.
// 예보만 그리면 모든 실제 계정에서 수평선이다(`memory-lift.ts` 머리 주석).
//
// 이전 무대(v06.200 — 밀린 단어 1개 표제어 + 흐름)는 감사(2026-09-18)에서 "단어 카드 1장" 으로
// 평균 판정을 받았다. 흐름 목록(오른쪽)과 단일 CTA 규칙은 그대로 이어받는다:
//   · 화면의 1차 행동은 하나 — 미진단이면 진단(D7), 지금 블록이 복습이면 「이 N개부터」, 아니면 그 블록.
//   · `prescription` 이 null(수동 계획이 오늘의 정본)이면 흐름을 그리지 않는다(v06.108 META Opt A).

'use client'

import { useEffect, useRef, useState } from 'react'

import { ArrowRight, Check, Loader2, Lock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { track } from '@/lib/analytics/client'
import { startArticleLearning } from '@/lib/articles/start-learning'
import type { HubLiftResult } from '@/lib/learner/hub-lift-query'
import { baseCurve, planCurve, type MemoryLift } from '@/lib/learner/memory-lift'
import type { TodayPrescription } from '@/lib/learner/prescription-actions'
import type { TasteWord } from '@/lib/learner/taste-word'

import { DecayUnderline } from '@/components/ui/press'

import { ROOM_TONE, type RoomTime, type RoomTone } from './room-tone'
import styles from './today-horizon.module.css'
import {
  blockProgress,
  buildTodayBlocks,
  pickNow,
  type TodayBlock,
} from '@/lib/learner/today-blocks'

const TRACK_DEBOUNCE_MS = 600
/** 처음 세울 N — 한 세션에 부담 없는 크기. 모은 낱말이 더 적으면 그 수 */
const DEFAULT_COUNT = 10
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

export function TodayStage({
  lift,
  tasteWord,
  isDiagnosed,
  prescription,
  time,
  weekday,
  touchedToday,
  dcpDoneToday,
  readDoneToday,
  checkDoneToday,
}: {
  /** null = 비로그인(셸이 막는다) — 무대를 그리지 않는다 */
  lift: HubLiftResult | null
  /** 모은 낱말이 0 인 미진단 학습자에게 세울 낱말 한 개(`fetchTasteWord`) */
  tasteWord: TasteWord | null
  isDiagnosed: boolean
  prescription: TodayPrescription | null
  time: RoomTime
  /** KST 오늘 요일 0=일..6=토 — 곡선 축의 요일 이름. SSR 과 어긋나지 않게 서버가 정한다 */
  weekday: number
  /** 오늘 손댄 모듈 — 서버에서 내려온다(`fetchTouchedModulesToday`, 셸 띠와 같은 값) */
  touchedToday: string[]
  /** 오늘 DCP 문항을 풀었는가 — `csat_item_attempts` */
  dcpDoneToday: boolean
  /** 오늘 읽었는가 — `reading_sessions` */
  readDoneToday?: boolean
  /** 오늘 ScriptQuiz 를 풀었는가 — `scores` */
  checkDoneToday?: boolean
}) {
  const tone = ROOM_TONE[time]

  const blocks = prescription?.isDiagnosed
    ? buildTodayBlocks(prescription, new Set(touchedToday), {
        dcp: dcpDoneToday,
        read: readDoneToday,
        check: checkDoneToday,
      })
    : []
  const now = blocks.length > 0 ? pickNow(blocks) : null
  const progress = blockProgress(blocks)
  const allDone = blocks.length > 0 && progress.done === progress.total

  if (!lift) return null

  return (
    <section
      aria-labelledby="today-h1"
      data-today-stage=""
      className={`relative border-y px-5 py-7 md:px-10 md:py-10 ${
        // 흐름이 없으면(미진단·수동 계획) 곡선이 폭을 다 쓴다 — 빈 오른쪽 열을 두지 않는다(첫 캡처 결함)
        blocks.length > 0 ? 'lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(248px,1fr)] lg:gap-12' : ''
      }`}
      style={{ background: tone.canvas, color: tone.ink, borderColor: tone.rule }}
    >
      <div className="min-w-0">
        <p className="font-display text-[11px] font-[600] tracking-[0.04em]" style={{ color: tone.sub }}>
          {tone.says} · 오늘부터 일주일
        </p>

        {lift.kind === 'ok' && (
          <Horizon
            lift={lift.lift}
            tone={tone}
            weekday={weekday}
            isDiagnosed={isDiagnosed}
            prescribed={prescription !== null}
            now={now}
            allDone={allDone}
          />
        )}

        {lift.kind === 'empty' && (
          <EmptyHorizon tone={tone} tasteWord={tasteWord} isDiagnosed={isDiagnosed} now={now} />
        )}

        {lift.kind === 'error' && (
          <>
            <h1
              id="today-h1"
              className="mt-4 max-w-[22ch] font-ko-display text-[26px] font-[500] leading-[1.3] [word-break:keep-all] md:text-[32px]"
            >
              기억 곡선을 불러오지 못했어요
            </h1>
            <p className="mt-3 max-w-[46ch] font-body text-[14px] leading-[1.7] [word-break:keep-all]" style={{ color: tone.sub }}>
              단어장은 그대로예요. 잠시 뒤 다시 열면 곡선이 다시 서요. 오늘 할 일은 오른쪽에서 바로 시작할 수 있어요.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/hub" className={SECONDARY} style={{ borderColor: tone.rule, color: tone.ink }}>
                다시 불러오기
              </Link>
              {now && <StartNow block={now} tone={tone} label="지금 시작" />}
            </div>
          </>
        )}

        {prescription?.unavailable && (
          <p
            role="status"
            className="mt-6 max-w-[46ch] border-l-2 pl-3 font-body text-[12px] leading-[1.6] [word-break:keep-all]"
            style={{ borderColor: tone.rule, color: tone.sub }}
          >
            지금 오늘 분량을 계산하지 못했어요. 오른쪽 순서는 기본 안내라 내 상태와 다를 수 있어요.
          </p>
        )}
      </div>

      {/* ── 우: 오늘 어디까지 ── */}
      {blocks.length > 0 && (
        <div data-today-flow="" className="mt-9 lg:mt-0 lg:flex lg:flex-col lg:justify-start">
          <div className="mb-3 flex items-baseline gap-2 border-b pb-2" style={{ borderColor: tone.rule }}>
            <h2 className="font-display text-[11px] font-[600] tracking-[0.04em]" style={{ color: tone.sub }}>
              오늘의 흐름
            </h2>
            <span className="ml-auto font-mono text-[11px] font-[700] tabular-nums" style={{ color: tone.sub }}>
              <span className="sr-only">진행 </span>
              {progress.done}/{progress.total}
            </span>
          </div>
          <ol className="flex flex-col">
            {blocks.map((b, i) => (
              <FlowRow key={b.key} block={b} tone={tone} isNow={b === now} isLast={i === blocks.length - 1} />
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

// ────────────────────────────────────────────────────────────
// 곡선 + 슬라이더 + 낱말 — 이 화면의 골격과 서명
// ────────────────────────────────────────────────────────────

const PRIMARY =
  'inline-flex min-h-[48px] items-center gap-2 rounded-[var(--r-md)] px-5 font-display text-[14.5px] font-[600] no-underline motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--dur-fast)] motion-safe:active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-progress disabled:opacity-70'
const SECONDARY =
  'inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border px-4 font-display text-[13.5px] font-[600] no-underline motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]'
const PRIMARY_STYLE = { background: 'var(--ju)', color: 'var(--on-ju)' }

function flashcardHref(count: number): string {
  return `/flashcard/play?limit=${count}&from=${encodeURIComponent('/hub')}`
}

function Horizon({
  lift,
  tone,
  weekday,
  isDiagnosed,
  prescribed,
  now,
  allDone,
}: {
  lift: MemoryLift
  tone: RoomTone
  weekday: number
  isDiagnosed: boolean
  /** false = 수동 계획이 오늘의 정본(`TodayPlanCard`) — 곡선의 행동은 2차로만 둔다(표면 이중화 금지) */
  prescribed: boolean
  now: TodayBlock | null
  allDone: boolean
}) {
  const total = lift.words.length
  const [count, setCount] = useState(Math.min(DEFAULT_COUNT, total))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function change(next: number) {
    setCount(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      track({ name: 'hub_curve_interacted', props: { count: next, words: total } })
    }, TRACK_DEBOUNCE_MS)
  }

  const horizon = lift.horizonDays
  const plan = planCurve(lift, count)
  const base = baseCurve(lift)
  // 기대값이다 — 정수로 반올림하고 「약」 을 붙인다(지어낸 정밀도 금지 · I5)
  const planEnd = Math.round(plan[horizon])
  const baseEnd = Math.round(base[horizon])
  const lastDay = WEEKDAY_KO[(weekday + horizon) % 7]
  const chosen = lift.words.slice(0, count)
  const allNew = chosen.length > 0 && chosen.every((w) => w.state === 'new')
  const verb = allNew ? '익히면' : '다시 보면'

  const headline =
    count === 0
      ? `그대로 두면 다음 주 ${lastDay}요일에 기억에 남을 단어는 약 ${baseEnd}개예요.`
      : `오늘 ${count}개를 ${verb}, 다음 주 ${lastDay}요일에도 약 ${planEnd}개가 기억에 남아요.`

  // 1차 행동은 하나다.
  //   미진단 → 진단(D7). 곡선은 진단과 무관하게 서지만, 처음 온 사람의 다음 한 걸음은 진단이다.
  //   지금 블록이 복습이거나 흐름이 다 끝났으면 → 「이 N개부터」. 아니면 그 블록이 1차, 곡선은 2차.
  //   수동 계획이 정본인 날에는 1차 행동이 `TodayPlanCard` 에 있다 — 여기서는 2차만.
  const reviewIsPrimary = isDiagnosed && prescribed && count > 0 && (!now || now.key === 'review')
  // 「시작」 은 1차 행동에만 쓴다 — 2차 링크까지 「시작」 이면 시작 버튼이 둘이 된다(e2e 23 ② 단일 CTA)
  const liftLabel = allNew
    ? `이 ${count}개 먼저 익히기`
    : reviewIsPrimary
      ? `이 ${count}개부터 시작`
      : `이 ${count}개 먼저 다시 보기`

  return (
    <>
      <h1
        id="today-h1"
        className="mt-4 max-w-[24ch] font-ko-display text-[26px] font-[500] leading-[1.3] tracking-[-0.01em] [word-break:keep-all] md:text-[34px]"
      >
        {allDone ? `오늘 분량은 다 했어요. ${headline}` : headline}
      </h1>
      {count > 0 && (
        <p className="mt-2 font-mono text-[12px] tabular-nums" style={{ color: tone.sub }}>
          그대로 두면 약 {baseEnd}개 · 아래 {total}개 기준
        </p>
      )}

      <Curve plan={plan} base={base} lift={lift} count={count} tone={tone} weekday={weekday} label={headline} />

      <label htmlFor="today-count" className="mt-5 block font-display text-[13px] font-[600]">
        {allNew ? '오늘 익힐 단어' : '오늘 다시 볼 단어'}
      </label>
      <div className="flex items-center gap-4">
        <input
          id="today-count"
          type="range"
          min={0}
          max={total}
          step={1}
          value={count}
          onChange={(e) => change(Number(e.target.value))}
          aria-valuetext={`${count}개`}
          className={`${styles.range} h-11 min-w-0 flex-1 cursor-pointer`}
        />
        <span className="w-[4ch] text-right font-mono text-[14px] font-[700] tabular-nums" aria-hidden>
          {count}
        </span>
      </div>

      {/* 1차 행동은 슬라이더 바로 아래 — 낱말 24개가 네 줄이 되면 1280 에서도 폴드 밖으로 밀렸다(2회차 수정) */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!isDiagnosed ? (
          <>
            <Link href="/diagnostic" className={PRIMARY} style={PRIMARY_STYLE}>
              5분 진단으로 내 수준 찾기
              <ArrowRight size={15} aria-hidden />
            </Link>
            {count > 0 && (
              <Link href={flashcardHref(count)} className={SECONDARY} style={{ borderColor: tone.rule, color: tone.ink }}>
                {liftLabel}
              </Link>
            )}
          </>
        ) : reviewIsPrimary ? (
          <Link href={flashcardHref(count)} className={PRIMARY} style={PRIMARY_STYLE}>
            {liftLabel}
            <ArrowRight size={15} aria-hidden />
          </Link>
        ) : (
          <>
            {now && <StartNow block={now} tone={tone} label="지금 시작" />}
            {count > 0 && (
              <Link href={flashcardHref(count)} className={SECONDARY} style={{ borderColor: tone.rule, color: tone.ink }}>
                {liftLabel}
              </Link>
            )}
          </>
        )}
      </div>
      {/* 낱말 — 세션 큐 순서 그대로. 앞에서 N개가 곧 「이 N개부터」 가 여는 세션이다 */}
      <p
        lang="en"
        aria-label={`오늘 다시 볼 순서의 낱말 ${total}개, 그중 앞 ${count}개에 권점`}
        className="mt-6 font-editorial text-[18px] leading-[2.3] md:text-[19px]"
      >
        {lift.words.map((w, i) => (
          <span key={w.id}>
            <DecayUnderline state={w.state}>
              <span className={styles.word} data-on={i < count ? 'true' : 'false'} data-today-word={w.word}>
                {w.word}
              </span>
            </DecayUnderline>
            {i < lift.words.length - 1 && ' '}
          </span>
        ))}
      </p>
    </>
  )
}

/**
 * 곡선 — 경로는 viewBox 를 늘려 폭을 채우고(`preserveAspectRatio="none"` + 굵기 고정),
 * 글자(축의 요일·수)는 SVG 밖 HTML 로 둔다. 늘어난 SVG 안의 글자는 찌그러진다.
 */
function Curve({
  plan,
  base,
  lift,
  count,
  tone,
  weekday,
  label,
}: {
  plan: number[]
  base: number[]
  lift: MemoryLift
  count: number
  tone: RoomTone
  weekday: number
  label: string
}) {
  const W = 700
  const H = 180
  const PAD = 8
  const days = base.length
  // 축은 슬라이더 끝(전부 다시 볼 때)에 맞춰 고정한다 — 축이 따라 움직이면 들어 올려지는 게 안 보인다.
  const top = Math.max(1, ...planCurve(lift, lift.words.length), ...base)
  const total = lift.words.length
  const x = (d: number) => (d / (days - 1)) * W
  const y = (v: number) => PAD + (H - PAD * 2) * (1 - v / top)
  const path = (vs: number[]) => vs.map((v, d) => `${d === 0 ? 'M' : 'L'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const lifted = `${path(plan)} ${[...base].reverse().map((v, i) => `L${x(days - 1 - i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} Z`

  return (
    <figure className="mt-6">
      <div className="flex items-baseline justify-between font-mono text-[11px] tabular-nums" style={{ color: tone.sub }}>
        <span>기억에 남을 단어 · 아래 {total}개 중</span>
        <span aria-hidden>{Math.round(top)}</span>
      </div>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-1 block h-[150px] w-full md:h-[190px]"
      >
        {/* 바닥 — 0 */}
        <line x1="0" y1={y(0)} x2={W} y2={y(0)} stroke={tone.rule} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {/* 들어 올린 몫 — 오늘 한 일이 일주일 동안 남기는 것 */}
        <path key={`a${count}`} d={lifted} fill="var(--memory-stable)" fillOpacity="0.16" className={styles.lift} />
        {/* 그대로 두면 — 점선 */}
        <path
          d={path(base)}
          fill="none"
          stroke="var(--t3)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
        {/* 오늘 N개를 다시 보면 — 실선 */}
        <path
          key={`p${count}`}
          d={path(plan)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={styles.lift}
        />
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-[11px] tabular-nums" style={{ color: tone.sub }}>
        {base.map((_, d) => (
          <span key={d} aria-hidden={d !== 0 && d !== days - 1}>
            {d === 0 ? '오늘' : WEEKDAY_KO[(weekday + d) % 7]}
          </span>
        ))}
      </figcaption>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-body text-[12px]" style={{ color: tone.sub }}>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden>
            <line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="2.25" style={{ color: tone.ink }} />
          </svg>
          오늘 다시 보면
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden>
            <line x1="0" y1="3" x2="22" y2="3" stroke="var(--t3)" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          그대로 두면
        </span>
      </p>
    </figure>
  )
}

/**
 * 모은 낱말이 0 — 곡선을 지어내지 않는다(I5). 대신 다음 한 걸음(D5)과, 미진단이면 낱말 하나.
 */
function EmptyHorizon({
  tone,
  tasteWord,
  isDiagnosed,
  now,
}: {
  tone: RoomTone
  tasteWord: TasteWord | null
  isDiagnosed: boolean
  now: TodayBlock | null
}) {
  return (
    <>
      <h1
        id="today-h1"
        className="mt-4 max-w-[22ch] font-ko-display text-[26px] font-[500] leading-[1.3] [word-break:keep-all] md:text-[34px]"
      >
        아직 모아 둔 단어가 없어요
      </h1>
      <p className="mt-3 max-w-[48ch] font-body text-[14px] leading-[1.7] [word-break:keep-all]" style={{ color: tone.sub }}>
        글에서 모르는 낱말을 담으면, 이 자리에 그 낱말들이 일주일 동안 흐려지고 다시 서는 선이 그려져요.
      </p>

      {tasteWord && (
        <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-[11px] font-[600] tracking-[0.04em]" style={{ color: tone.sub }}>
            처음 만날 낱말
          </span>
          <span lang="en" className="font-editorial text-[26px] md:text-[30px]">
            <DecayUnderline state="new">{tasteWord.word}</DecayUnderline>
          </span>
          <span className="font-ko-display text-[16px] [word-break:keep-all]">{tasteWord.meaningKo}</span>
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        {!isDiagnosed ? (
          <>
            <Link href="/diagnostic" className={PRIMARY} style={PRIMARY_STYLE}>
              5분 진단으로 내 수준 찾기
              <ArrowRight size={15} aria-hidden />
            </Link>
            <Link href="/library" className={SECONDARY} style={{ borderColor: tone.rule, color: tone.ink }}>
              글 먼저 둘러보기
            </Link>
          </>
        ) : now ? (
          <StartNow block={now} tone={tone} label="지금 시작" />
        ) : (
          <Link href="/library" className={PRIMARY} style={PRIMARY_STYLE}>
            글에서 단어 모으기
            <ArrowRight size={15} aria-hidden />
          </Link>
        )}
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────
// 흐름 한 줄 — 지면 톤에 따라 밝기가 뒤집히므로 색을 tone 에서 받는다.
// (A 의 FlowRow 는 항상 어두운 무대를 전제해 흰색을 하드코딩했다. 여기서는 못 쓴다.)
// ────────────────────────────────────────────────────────────
function FlowRow({
  block: b,
  tone,
  isNow,
  isLast,
}: {
  block: TodayBlock
  tone: RoomTone
  isNow: boolean
  isLast: boolean
}) {
  const StateIcon = b.done ? Check : b.locked ? Lock : b.icon
  const state = b.done ? '완료' : b.locked ? '아직 열리지 않음' : isNow ? '지금' : `${b.minutes}분`

  // 색 짝은 토큰이 보장하는 AA 조합만 쓴다. 흰색·`--p-dark` 를 직접 쓰면 다크 테마에서
  // 뒤집혀 대비가 무너진다(C6 실측 — 밤 무대가 밝은 파랑이 되고 골드 위 글자가 파랑이 됐다).
  const markerBg = b.done ? 'var(--success-light)' : isNow ? 'var(--p)' : 'var(--bg2)'
  const markerInk = b.done ? 'var(--success-ink)' : isNow ? 'var(--on-p)' : 'var(--t3)'

  const marker = (
    <span className="relative flex flex-col items-center self-stretch" aria-hidden>
      <span
        className="mt-[9px] inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
        style={{ background: markerBg, color: markerInk }}
      >
        <StateIcon size={12} strokeWidth={2.2} />
      </span>
      {!isLast && (
        <span
          className="w-px flex-1"
          style={{ background: b.done ? 'var(--active)' : tone.rule }}
        />
      )}
    </span>
  )

  const label = (
    <span className="flex min-w-0 flex-1 items-baseline gap-2 pb-3 pt-2">
      <span
        className={`min-w-0 truncate font-display text-[13px] ${isNow ? 'font-[800]' : 'font-[600]'}`}
        style={{ color: b.done || b.locked ? tone.sub : tone.ink }}
      >
        {b.name}
      </span>
      <span
        className="ml-auto shrink-0 font-mono text-[11px] tabular-nums"
        style={{ color: tone.sub }}
      >
        {state}
      </span>
    </span>
  )

  // `min-h-11` = 44px. 실측 2026-08-25: "먼저 하기" 링크 세 줄이 40px 이었다 —
  // 4px 모자라서 프로젝트 절대 규칙(44×44)을 못 넘겼다. 목록 줄이라 폭은 이미 310px 이다.
  const rowBase = 'flex min-h-11 items-stretch gap-3 rounded-[var(--r-md)] pl-2 pr-3'

  if (isNow || b.done || b.locked) {
    return (
      <li
        className={rowBase}
        style={isNow ? { background: 'var(--bg2)' } : undefined}
        aria-label={`${b.name} — ${state}`}
        aria-current={isNow ? 'step' : undefined}
      >
        {marker}
        {label}
      </li>
    )
  }

  return (
    <li>
      <Link
        href={b.href}
        aria-label={`${b.name} ${b.minutes}분 먼저 하기`}
        className={`${rowBase} no-underline motion-safe:transition-colors motion-safe:duration-[var(--dur-ios-fast)] focus-visible:outline-none focus-visible:ring-2 hover:bg-[var(--bg2)] focus-visible:ring-[var(--p)]`}
      >
        {marker}
        {label}
      </Link>
    </li>
  )
}

// ────────────────────────────────────────────────────────────
function StartNow({ block, tone, label }: { block: TodayBlock; tone: RoomTone; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const Icon = block.icon

  const cls =
    'inline-flex min-h-[48px] items-center gap-2 rounded-[var(--r-md)] px-5 font-display text-[14.5px] font-[600] no-underline motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--dur-fast)] motion-safe:active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-progress disabled:opacity-70'
  // v07 「주묵 판면」 — 화면의 1차 행동은 주묵이 맡는다.
  // `--ju` / `--on-ju` 는 두 테마에서 짝으로 뒤집히도록 토큰이 보장하는 조합이다
  // (라이트 흰 글자 5.13:1 · 다크는 밝은 주묵 + 잉크 글자). 골드 면(`--active`) 위 글자색은
  // 그런 짝 토큰이 없어서 다크에서 대비가 무너졌다(C6) — 같은 실수를 반복하지 않는다.
  const style = { background: 'var(--ju)', color: 'var(--on-ju)' }

  if (!block.articleId) {
    return (
      <Link href={block.href} className={cls} style={style}>
        <Icon size={16} strokeWidth={2} aria-hidden />
        {label}
        <ArrowRight size={15} aria-hidden />
      </Link>
    )
  }

  async function launch() {
    if (busy || !block.articleId) return
    setBusy(true)
    setError(null)
    const res = await startArticleLearning(block.articleId)
    if (res.ok) {
      router.push(`/text/${res.textId}?mode=read`)
      return
    }
    setError(res.error)
    setBusy(false)
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={launch} disabled={busy} className={cls} style={style}>
        {busy ? (
          <Loader2 size={16} strokeWidth={2} className="animate-spin" aria-hidden />
        ) : (
          <Icon size={16} strokeWidth={2} aria-hidden />
        )}
        {label}
        <ArrowRight size={15} aria-hidden />
      </button>
      {error && (
        <span role="alert" className="font-body text-[12px]" style={{ color: tone.sub }}>
          {error}
        </span>
      )}
    </span>
  )
}
