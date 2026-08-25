// apps/web/src/app/(main)/hub-lab/_variants/VariantC.tsx
//
// 후보 C — "살아있는 서재" (Ambient Editorial). **철학 재작성판.**
//
// 출발점이 된 관찰: 현행 /hub 도, 후보 A 도, 후보 B 도 **화면에 단어가 한 개도 없다.**
// 어휘 학습 플랫폼의 진입면인데 개수만 있다("242개 복습"). 개수는 할 일을 말하지만
// 단어는 그 자체가 학습 재료다. 여기서는 단어가 지면의 주인공이다.
//
// 재작성하는 철학:
//   · Calm UI(자극 최소화) → **Ambient**(머무르고 싶은 지면). 조용함이 목적이 아니라
//     "여기 좀 더 있고 싶다" 가 목적이다. 학습 시간은 의지가 아니라 체류에서 나온다.
//   · Implicit Progress → 유지하되 강화. 지면의 시각(時刻) 톤이 하루를 따라 움직인다.
//   · Emotional Encoding(학습원칙 ⑦) 을 장식이 아니라 레이아웃의 축으로 승격.
//
// 학습과학 근거: Context-Dependent(맥락에서 인출) + Dual Coding(단어 + 문장).
// 그래서 단어만 크게 띄우지 않고 **그 단어를 만난 문장**을 함께 조판한다.

'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import type { ReadingRoom, ReadingRoomWord } from '@/lib/learner/reading-room-actions'

/** 지면의 시각 — 서버에서 KST 로 계산해 넘긴다(클라이언트 계산은 하이드레이션 불일치를 만든다). */
export type RoomTime = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night'

/**
 * 시각별 지면 톤.
 *
 * ⚠️ **명도는 테마가, 색조는 시각이 소유한다.** 이 분리가 없으면 두 축이 싸운다.
 *
 * C4 의 첫 구현은 밤 지면을 `var(--p-dark)` 로 칠하고 글자를 `var(--ti)` 로 뒀다.
 * 라이트 테마에서는 의도대로 깊은 잉크 지면이 나왔지만, **다크 테마에서 `--p-dark` 는
 * `#4F84BC`(밝은 파랑)로 뒤집힌다.** 그래서 어두운 페이지 한가운데 밝은 파란 패널이
 * 박히고, 그 위 흰 글자는 대비가 AA 미달이었다(C6 캡처로 확인). 골드 CTA 의 글자색도
 * 같은 이유로 파랑이 되어 거의 안 읽혔다.
 *
 * 그래서 시각 톤은 **명도를 건드리지 않는다.** 지면은 언제나 테마의 `--bg` 이고,
 * 시각은 거기에 색조만 10~16% 섞는다. 글자는 언제나 `--t1`/`--t2` 라 테마와 함께 뒤집힌다.
 *
 * 대가: 라이트 테마의 극적인 "깊은 잉크 밤 지면" 은 사라진다. 그것을 되살리려면
 * **테마와 무관하게 어두운 표면 토큰**이 새로 필요하다(design-tokens 패키지 변경 —
 * 별도 절차 + 사용자 판단 사항). 접근성을 깨면서 극적인 지면을 유지하지는 않는다.
 */
export interface RoomTone {
  canvas: string
  ink: string
  sub: string
  rule: string
  says: string
}

export const ROOM_TONE: Record<RoomTime, RoomTone> = {
  dawn: {
    canvas: 'color-mix(in srgb, var(--bg) 88%, var(--p) 12%)',
    ink: 'var(--t1)',
    sub: 'var(--t2)',
    rule: 'color-mix(in srgb, var(--bd) 70%, var(--p) 30%)',
    says: '이른 시간이에요',
  },
  morning: {
    canvas: 'color-mix(in srgb, var(--bg) 88%, var(--active) 12%)',
    ink: 'var(--t1)',
    sub: 'var(--t2)',
    rule: 'color-mix(in srgb, var(--bd) 70%, var(--active) 30%)',
    says: '아침이에요',
  },
  afternoon: {
    canvas: 'var(--bg)',
    ink: 'var(--t1)',
    sub: 'var(--t2)',
    rule: 'var(--bd)',
    says: '한낮이에요',
  },
  evening: {
    canvas: 'color-mix(in srgb, var(--bg) 86%, var(--warning) 14%)',
    ink: 'var(--t1)',
    sub: 'var(--t2)',
    rule: 'color-mix(in srgb, var(--bd) 65%, var(--warning) 35%)',
    says: '저녁이에요',
  },
  night: {
    canvas: 'color-mix(in srgb, var(--bg) 84%, var(--p) 16%)',
    ink: 'var(--t1)',
    sub: 'var(--t2)',
    rule: 'color-mix(in srgb, var(--bd) 60%, var(--p) 40%)',
    says: '밤이에요',
  },
}

export function VariantC({ room, time }: { room: ReadingRoom | null; time: RoomTime }) {
  const tone = ROOM_TONE[time]

  if (!room) return <QuietRoom tone={tone} />

  const { lead, rest, overdueTotal } = room

  return (
    <div className="flex flex-col gap-4">
      {/* ═══════════ 지면 ═══════════
          카드가 아니라 지면이다. 그래서 그림자를 거의 주지 않고, 안쪽 여백을 크게 잡고,
          가로폭을 읽기 좋은 길이로 제한한다. 단어 하나가 이 화면의 사건이다. */}
      <section
        aria-label="오늘의 단어"
        className="relative overflow-hidden rounded-ios-2xl px-6 py-10 md:px-12 md:py-14"
        style={{ background: tone.canvas, color: tone.ink }}
      >
        <div className="mx-auto max-w-[62ch]">
          <p
            className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em]"
            style={{ color: tone.sub }}
          >
            {tone.says} · 되찾을 단어 {overdueTotal}
          </p>

          {/* 주인공 — Lora 가 가장 크게 쓰이는 자리 */}
          <h1 className="mt-5 font-editorial text-[46px] font-[500] leading-[1.02] tracking-[-0.02em] md:text-[68px]">
            {lead.word}
          </h1>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums" style={{ color: tone.sub }}>
            {lead.pos && <span>{lead.pos}</span>}
            {lead.cefr && <span>· {lead.cefr}</span>}
            <span>· {lead.overdueDays === 0 ? '오늘이 기한' : `${lead.overdueDays}일 밀림`}</span>
          </p>

          <hr className="my-6 border-0 border-t" style={{ borderColor: tone.rule }} />

          <p className="font-body text-[17px] leading-[1.65] [word-break:keep-all] md:text-[19px]">
            {lead.meaning}
          </p>

          {/* 맥락 — 이 단어를 만난 문장. Context-Dependent 의 실물. */}
          {lead.example && (
            <blockquote
              className="mt-5 border-l-2 pl-4 font-editorial text-[15.5px] italic leading-[1.7] md:text-[17px]"
              style={{ borderColor: tone.rule, color: tone.sub }}
            >
              {lead.example}
            </blockquote>
          )}

          <Link
            href="/flashcard/play"
            className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-ios-pill px-5 font-display text-[14px] font-[700] no-underline motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2"
            style={{ background: 'var(--p)', color: 'var(--on-p)' }}
          >
            이 단어부터 시작
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>

      {/* ═══════════ 뒤따르는 단어 ═══════════
          카드 격자가 아니라 목차다. 서재의 다음 장(章) 처럼 읽히게 행으로만 둔다. */}
      {rest.length > 0 && (
        <section aria-label="뒤따르는 단어" className="rounded-ios-2xl bg-[var(--bg)] px-5 py-4 shadow-ios-1 md:px-8 md:py-5">
          <h2 className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
            뒤이어
          </h2>
          <ul className="mt-2 divide-y divide-[var(--bd)]">
            {rest.map((w) => (
              <FollowingRow key={w.id} word={w} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
function FollowingRow({ word: w }: { word: ReadingRoomWord }) {
  return (
    <li className="flex items-baseline gap-3 py-3">
      <span className="font-editorial text-[17px] font-[500] text-[var(--t1)]">{w.word}</span>
      <span className="min-w-0 flex-1 truncate font-body text-[12.5px] text-[var(--t2)]">
        {w.meaning}
      </span>
      <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
        {w.overdueDays === 0 ? '오늘' : `${w.overdueDays}일`}
      </span>
    </li>
  )
}

// ────────────────────────────────────────────────────────────
// 되찾을 단어가 없는 서재 — 빈 카드를 만들지 않고 지면 자체가 다른 말을 한다.
// ────────────────────────────────────────────────────────────
function QuietRoom({ tone }: { tone: (typeof ROOM_TONE)[RoomTime] }) {
  return (
    <section
      aria-label="오늘의 서재"
      className="rounded-ios-2xl px-6 py-14 md:px-12 md:py-20"
      style={{ background: tone.canvas, color: tone.ink }}
    >
      <div className="mx-auto max-w-[52ch]">
        <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em]" style={{ color: tone.sub }}>
          {tone.says}
        </p>
        <h1 className="mt-5 font-editorial text-[32px] font-[500] leading-[1.2] tracking-[-0.014em] [word-break:keep-all] md:text-[42px]">
          되찾을 단어가 없어요
        </h1>
        <p className="mt-4 font-body text-[15px] leading-[1.7] [word-break:keep-all]" style={{ color: tone.sub }}>
          지금은 새로 만나는 게 더 값져요. 읽는 동안 모은 단어가 여기 쌓여요.
        </p>
        <Link
          href="/library/books"
          className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-ios-pill px-5 font-display text-[14px] font-[700] no-underline motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2"
          style={{ background: 'var(--p)', color: 'var(--on-p)' }}
        >
          읽을 것 고르기
          <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
