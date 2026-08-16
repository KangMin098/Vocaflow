// apps/web/src/components/home/NextWordsStrip.tsx
//
// 뒤이어 — 밀린 단어를 **한 줄로** 알리는 띠.
//
// ─────────────────────────────────────────────────────────────
// 왜 목록에서 띠가 됐나 (2026-08-16 지면 계측)
//
// 캡처 하네스에 지면 배분 계측을 붙이고 재 보니 이 블록이 데스크톱 관문의 **51%**(388px)를
// 쓰고 있었다. 그런데 행의 내용은 `<li>` 안의 단어·뜻·"1일" 뿐이고 **링크도 버튼도 없었다** —
// 관문의 절반을 누를 수도 없는 목록이 차지하고 있었던 것이다.
//
// 목록이 하던 일("무엇이 밀렸나")은 이름 셋과 개수로 충분히 전달된다. 자리는 1/5(72px, 10%)로
// 줄고, 대신 **행동**(단어장으로 이동)이 생긴다. 남은 자리는 `TodayReading` 이 가져간다 —
// 오늘 읽을 실제 글이 그동안 제목조차 보이지 않았기 때문이다.
//
// 왜 `TodayStage` 에서 분리했나: 순서 때문이다. 무대 안에 있으면 항상 무대 바로 뒤에 붙어
// **밀린 단어가 오늘 읽을 것보다 위**에 오게 된다. 오늘의 논리 순서는
// `무대(지금 할 일) → 오늘 읽을 것 → 뒤이어(남은 단어)` 다.
// ─────────────────────────────────────────────────────────────

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import type { ReadingRoom } from '@/lib/learner/reading-room-actions'

/** 맛보기로 이름을 보여줄 개수 — 나머지는 `+N` 으로 접는다. */
const NAMED = 3

export function NextWordsStrip({ room }: { room: ReadingRoom | null }) {
  if (!room || room.rest.length === 0) return null

  const named = room.rest.slice(0, NAMED)
  const more = room.rest.length - named.length

  return (
    <section
      aria-label="뒤따르는 단어"
      className="rounded-ios-2xl bg-[var(--bg)] px-5 py-3.5 shadow-ios-1 md:px-8"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
          뒤이어
        </h2>
        <p className="min-w-0 flex-1 font-editorial text-[15px] font-[500] text-[var(--t2)]">
          {named.map((w) => w.word).join(' · ')}
          {more > 0 && (
            <span className="font-mono text-[11px] text-[var(--t3)]">{` +${more}`}</span>
          )}
        </p>
        <Link
          href="/wordvault"
          className="group inline-flex min-h-[44px] shrink-0 items-center gap-1 font-display text-[12px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          단어장에서 보기
          <ArrowRight
            size={12}
            aria-hidden
            className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </section>
  )
}
