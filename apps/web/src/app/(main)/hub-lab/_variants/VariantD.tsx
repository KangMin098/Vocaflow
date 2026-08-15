// apps/web/src/app/(main)/hub-lab/_variants/VariantD.tsx
//
// 합성 D — "서재 + 오늘" (C 지면 + A 흐름).
//
// 왜 합성인가: A(85)·B(80)·C(90) 는 취향이 아니라 **답하는 질문**이 달랐고, 강점이 상보적이었다.
//   A 는 위계가 최고(19) — "지금 뭘 하지" 가 3초에 읽힌다
//   C 는 충실도가 최고(18) — 화면에 실제 학습 재료(단어·뜻·원문 예문)가 있다
//   B 는 "나는 어디 있나" — 이건 Today 의 질문이 아니라 Vault 의 질문이라 여기 오지 않는다
//
// D 의 가설: 한 화면에서 좌측이 **무엇을 배우나**(C), 우측이 **오늘 어디까지**(A) 를 맡으면
// 둘 다 가져갈 수 있다. 반증되면(어느 쪽도 주인공이 못 되면) 합성을 반려하고 C 단독으로 간다.
//
// 단일 CTA 규칙: 화면의 1차 행동은 언제나 하나다. 처방이 정한 "지금 블록" 이 그것을 정하고,
// 그 블록이 복습일 때만 좌측 단어가 그 행동의 재료가 된다("이 단어부터"). 아니면 단어는
// 맥락으로 남고 CTA 는 그 블록으로 간다 — 두 개의 시작 버튼을 두지 않는다.

'use client'

import { useState } from 'react'

import { ArrowRight, Check, Loader2, Lock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useHubData } from '@/hooks/useHubData'
import { startArticleLearning } from '@/lib/articles/start-learning'
import type { ReadingRoom } from '@/lib/learner/reading-room-actions'
import type { TodayPrescription } from '@/lib/learner/prescription-actions'

import { ROOM_TONE, type RoomTime, type RoomTone } from '@/components/home/room-tone'
import {
  buildTodayBlocks,
  pickNow,
  touchedModulesToday,
  type TodayBlock,
} from '@/lib/learner/today-blocks'

export function VariantD({
  room,
  prescription,
  time,
}: {
  room: ReadingRoom | null
  prescription: TodayPrescription | null
  time: RoomTime
}) {
  const tone = ROOM_TONE[time]
  const { data } = useHubData()

  const blocks =
    prescription?.isDiagnosed
      ? buildTodayBlocks(prescription, touchedModulesToday(data?.recentActivities ?? []))
      : []
  const now = blocks.length > 0 ? pickNow(blocks) : null
  const doneCount = blocks.filter((b) => b.done).length

  const lead = room?.lead ?? null
  // 좌측 단어가 CTA 의 재료가 되는 경우는 "지금 블록이 복습" 일 때뿐이다.
  const wordIsTheAction = now?.key === 'review' && lead !== null

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="오늘"
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
              <h1 className="mt-5 font-editorial text-[44px] font-[500] leading-[1.02] tracking-[-0.02em] md:text-[60px]">
                {lead.word}
              </h1>
              <p
                className="mt-2 flex flex-wrap items-center gap-x-2.5 font-mono text-[11px] tabular-nums"
                style={{ color: tone.sub }}
              >
                {lead.pos && <span>{lead.pos}</span>}
                {lead.cefr && <span>· {lead.cefr}</span>}
                <span>· {lead.overdueDays === 0 ? '오늘이 기한' : `${lead.overdueDays}일 밀림`}</span>
              </p>

              <hr className="my-5 border-0 border-t" style={{ borderColor: tone.rule }} />

              <p className="max-w-[54ch] font-body text-[16.5px] leading-[1.65] [word-break:keep-all] md:text-[18px]">
                {lead.meaning}
              </p>

              {lead.example && (
                <blockquote
                  className="mt-4 max-w-[58ch] border-l-2 pl-4 font-editorial text-[15px] italic leading-[1.7] md:text-[16.5px]"
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
              <span className="font-mono text-[11.5px] tabular-nums" style={{ color: tone.sub }}>
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
          <div className="mt-9 lg:mt-0 lg:flex lg:flex-col lg:justify-start">
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
                {doneCount}/{blocks.length}
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

      {/* 뒤이어 — 서재의 목차 */}
      {room && room.rest.length > 0 && (
        <section
          aria-label="뒤따르는 단어"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-4 shadow-ios-1 md:px-8 md:py-5"
        >
          <h2 className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
            뒤이어
          </h2>
          <ul className="mt-2 divide-y divide-[var(--bd)]">
            {room.rest.map((w) => (
              <li key={w.id} className="flex items-baseline gap-3 py-2.5">
                <span className="font-editorial text-[17px] font-[500] text-[var(--t1)]">
                  {w.word}
                </span>
                <span className="min-w-0 flex-1 truncate font-body text-[12.5px] text-[var(--t2)]">
                  {w.meaning}
                </span>
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
                  {w.overdueDays === 0 ? '오늘' : `${w.overdueDays}일`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
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
        className="ml-auto shrink-0 font-mono text-[10.5px] tabular-nums"
        style={{ color: tone.sub }}
      >
        {state}
      </span>
    </span>
  )

  const rowBase = 'flex items-stretch gap-3 rounded-[var(--r-md)] pl-2 pr-2.5'

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
        <span role="alert" className="font-body text-[11.5px]" style={{ color: tone.sub }}>
          {error}
        </span>
      )}
    </span>
  )
}
