// apps/web/src/components/home/TodayStage.tsx
//
// Today 무대 — 좌 = 무엇을 배우나(단어 지면) · 우 = 오늘 어디까지(처방 흐름).
//
// 이전 /hub 이 놓치고 있던 것: **어휘 학습 플랫폼의 진입면에 단어가 한 개도 없었다.**
// 개수만 있었다("242개 복습"). 개수는 할 일을 말하지만 단어는 그 자체가 학습 재료다.
// 그래서 밀린 단어 하나를 지면의 주인공으로 세우고, 그 단어를 만난 문장을 함께 조판한다
// (학습원칙 ④ Dual Coding · ⑤ Context-Dependent 의 실물).
//
// 우측 흐름은 처방 5블록이다. 지나온 것·지금·남은 것이 한 축에 있고, 남은 것은 눌러서
// 건너뛸 수 있다(SDT 자율성 — 순서를 강제하지 않는다).
//
// **단일 CTA 규칙**: 화면의 1차 행동은 언제나 하나다. 처방이 정한 "지금 블록" 이 그것을
// 정하고, 그 블록이 복습일 때만 좌측 단어가 그 행동의 재료가 된다("이 단어부터"). 아니면
// 단어는 맥락으로 남고 CTA 는 그 블록으로 간다 — 시작 버튼을 두 개 두지 않는다.
//
// `prescription` 이 null 이면 우측 흐름을 렌더하지 않는다 — 오늘의 정본이 수동 계획일 때
// (`TodayPlanCard`) 처방 흐름을 같이 띄우면 "오늘 할 일" 표면이 둘이 되기 때문이다
// (v06.108 META 확정 Opt A — 경쟁하는 표면 지양).
//
// 설계 근거와 비교 점수는 재설계 랩(`/hub-lab`)에 남아 있다.

'use client'

import { useState } from 'react'

import { ArrowRight, Check, Loader2, Lock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { startArticleLearning } from '@/lib/articles/start-learning'
import type { ReadingRoom } from '@/lib/learner/reading-room-actions'
import type { TodayPrescription } from '@/lib/learner/prescription-actions'

import { ROOM_TONE, type RoomTime, type RoomTone } from './room-tone'
import {
  blockProgress,
  buildTodayBlocks,
  pickNow,
  type TodayBlock,
} from '@/lib/learner/today-blocks'

export function TodayStage({
  room,
  prescription,
  time,
  touchedToday,
  dcpDoneToday,
  readDoneToday,
  checkDoneToday,
}: {
  room: ReadingRoom | null
  prescription: TodayPrescription | null
  time: RoomTime
  /**
   * 오늘 손댄 모듈 — **서버에서 내려온다**(`fetchTouchedModulesToday`).
   *
   * 예전에는 이 컴포넌트가 `useHubData()` 의 최근 활동 목록에서 직접 추렸다. 그 목록은
   * 최근 N건만 담아서 오늘 여러 모듈을 돌린 날에는 앞쪽이 밀려 사라졌고, 같은 화면의
   * 셸 띠(`daily_activity.by_module` 기반)와 **다른 숫자**를 냈다.
   */
  touchedToday: string[]
  /** 오늘 DCP 문항을 풀었는가 — `csat_item_attempts` 에만 남아 위 집합과 출처가 다르다. */
  dcpDoneToday: boolean
  /** 오늘 읽었는가 — `reading_sessions`. 없으면 읽기 블록이 영원히 미완료다(today-blocks 주석). */
  readDoneToday?: boolean
  /** 오늘 ScriptQuiz 를 풀었는가 — `scores`. 같은 이유로 별도 신호다. */
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
  // 진행의 정의는 앱에 하나다 — 띠도 같은 함수를 쓴다(today-blocks.blockProgress 주석).
  const progress = blockProgress(blocks)

  const lead = room?.lead ?? null
  // 좌측 단어가 CTA 의 재료가 되는 경우는 "지금 블록이 복습" 일 때뿐이다.
  const wordIsTheAction = now?.key === 'review' && lead !== null

  // 보여줄 단어도 없고 처방 흐름도 없으면 무대를 만들지 않는다.
  // (빈 무대가 자리를 먹는 것이 이전 /hub 의 결함 중 하나였다 — "아직 학습한 스크립트가
  //  없어요" 카드가 페이지 중앙을 점거했다.)
  if (!lead && blocks.length === 0) return null

  // 무대는 **섹션 하나**다. 뒤이어 띠는 `NextWordsStrip` 으로 분리했다(순서 때문 — 그 파일 주석).
  return (
    <section
        aria-label="오늘"
        data-today-stage=""
        className="relative overflow-hidden rounded-ios-2xl px-6 py-9 md:px-10 md:py-12 lg:grid lg:grid-cols-[minmax(0,1.62fr)_minmax(248px,1fr)] lg:gap-12"
        style={{ background: tone.canvas, color: tone.ink }}
      >
        {/* ── 좌: 무엇을 배우나 ── */}
        <div className="min-w-0">
          <p
            className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em]"
            style={{ color: tone.sub }}
          >
            {tone.says}
            {room && ` · 되찾을 단어 ${room.overdueTotal}`}
          </p>

          {lead ? (
            <>
              <h1 data-today-word={lead.word} className="mt-5 font-editorial text-[44px] font-[500] leading-[1.02] tracking-[-0.02em] md:text-[60px]">
                {lead.word}
              </h1>
              <p
                className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[11px] tabular-nums"
                style={{ color: tone.sub }}
              >
                {lead.pos && <span>{lead.pos}</span>}
                {lead.cefr && <span>· {lead.cefr}</span>}
                <span>· {lead.overdueDays === 0 ? '오늘이 기한' : `${lead.overdueDays}일 밀림`}</span>
              </p>

              <hr className="my-5 border-0 border-t" style={{ borderColor: tone.rule }} />

              <p className="max-w-[54ch] font-body text-[17px] leading-[1.65] [word-break:keep-all] md:text-[18px]">
                {lead.meaning}
              </p>

              {lead.example && (
                <blockquote
                  className="mt-4 max-w-[58ch] border-l-2 pl-4 font-editorial text-[15px] italic leading-[1.7] md:text-[17px]"
                  style={{ borderColor: tone.rule, color: tone.sub }}
                >
                  {lead.example}
                </blockquote>
              )}
            </>
          ) : (
            // 되찾을 단어가 없다 — 그러면 좌측은 오늘 할 일 문장이 대신 맡는다.
            <h1 className="mt-5 max-w-[17ch] font-editorial text-[32px] font-[500] leading-[1.18] tracking-[-0.016em] [word-break:keep-all] md:text-[40px]">
              {now ? now.headline : '오늘 분량은 다 했어요. 여기서 멈춰도 괜찮아요.'}
            </h1>
          )}

          {/* 단일 CTA */}
          {now && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <StartNow block={now} tone={tone} label={wordIsTheAction ? '이 단어부터 시작' : '지금 시작'} />
              <span className="font-mono text-[12px] tabular-nums" style={{ color: tone.sub }}>
                {now.name} · {now.minutes}분
              </span>
            </div>
          )}

          {prescription?.unavailable && (
            <p
              role="status"
              className="mt-6 max-w-[46ch] rounded-[var(--r-md)] px-3 py-2 font-body text-[12px] leading-[1.6] [word-break:keep-all]"
              style={{ background: 'var(--bg2)' }}
            >
              지금 오늘 분량을 계산하지 못했어요. 오른쪽 순서는 기본 안내라 내 상태와 다를 수 있어요.
            </p>
          )}
        </div>

        {/* ── 우: 오늘 어디까지 ── */}
        {blocks.length > 0 && (
          // 상단 정렬 — 세로 중앙정렬로 두면 흐름 머리글이 좌측 단어 중간 높이에서 시작해
          // 두 열의 축이 어긋나 보인다(C5 실측). 좌측 메타 줄과 같은 높이에서 시작시킨다.
          <div data-today-flow="" className="mt-9 lg:mt-0 lg:flex lg:flex-col lg:justify-start">
            <div
              className="mb-3 flex items-baseline gap-2 border-b pb-2"
              style={{ borderColor: tone.rule }}
            >
              <h2
                className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em]"
                style={{ color: tone.sub }}
              >
                오늘의 흐름
              </h2>
              <span
                className="ml-auto font-mono text-[11px] font-[700] tabular-nums"
                style={{ color: tone.sub }}
              >
                <span className="sr-only">진행 </span>
                {progress.done}/{progress.total}
              </span>
            </div>
            <ol className="flex flex-col">
              {blocks.map((b, i) => (
                <FlowRow
                  key={b.key}
                  block={b}
                  tone={tone}
                  isNow={b === now}
                  isLast={i === blocks.length - 1}
                />
              ))}
            </ol>
          </div>
        )}
      </section>
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
    'inline-flex min-h-[48px] items-center gap-2 rounded-ios-pill px-5 font-display text-[14px] font-[700] no-underline motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 disabled:cursor-progress disabled:opacity-70'
  // `--p` / `--on-p` 는 두 테마에서 짝으로 뒤집히도록 토큰이 보장하는 조합이다.
  // 골드 면(`--active`) 위 글자색은 그런 짝 토큰이 없어서 다크에서 대비가 무너졌다(C6).
  const style = { background: 'var(--p)', color: 'var(--on-p)' }

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
