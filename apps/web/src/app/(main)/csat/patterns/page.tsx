// apps/web/src/app/(main)/csat/patterns/page.tsx
//
// **③ 패턴 종합 — 묶는다. 그리고 ⑤ 단권화가 여기 산다.**
//
// ── 왜 ⑤ 를 따로 안 두나 ────────────────────────────────────────────
// 모으는 행위는 **고르는 화면 안에서** 일어나야 한다. 따로 떼면 "저장한 것을 보러 가는 곳"
// 이 하나 더 생기고, 학습자는 고르는 곳과 보는 곳을 오가게 된다. 드롭존을 옆에 둔다.
//
// ⚠️ **생성 효과(generation effect)를 지킨다.** 시스템이 자동으로 묶어 주지 않는다 —
//   자기가 고른 묶음이라야 오래 남는다. 그래서 추천 묶음을 미리 채워 두지 않는다.
//
// ⚠️ 함정 수치는 전부 `trap-atlas.json`(오답 선지 3,208개 실측)에서 온다. 지어낸 수 없음.

import type { Metadata } from 'next'

import { TRAPS, CORPUS, UNIVERSAL_MIN_TYPES } from '@/lib/csat/trap-atlas'

import { PatternBoard } from './PatternBoard'

export const metadata: Metadata = {
  title: '함정 패턴 묶기',
  description:
    '평가원 기출 오답 선지 3,208개를 만드는 방법을 세어 두었습니다. 자주 걸리는 것끼리 묶어 내 목록을 만듭니다.',
}

export default function CsatPatternsPage() {
  // 화면에 올릴 것만 — 이름 없는 라벨(`''` · `'-'`)은 분석이 비운 자리라 뺀다.
  const traps = TRAPS.filter((t) => t.key.trim().length > 1).slice(0, 24)

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-[var(--t1)]">패턴</h1>
        <p className="tabular-nums text-xs text-[var(--t3)]">
          오답 선지 {CORPUS.distractors.toLocaleString()}개 · 함정 {traps.length}종
        </p>
      </header>

      <p className="mt-2 break-keep text-[13px] leading-relaxed text-[var(--t2)]">
        유형을 26벌 외우기 전에, <strong className="text-[var(--t1)]">오답이 만들어지는 방법</strong>이
        먼저예요. 여러 유형에 걸쳐 나오는 함정에는 <span aria-hidden>◆</span> 를 붙였어요
        ({UNIVERSAL_MIN_TYPES}개 유형 이상).
      </p>

      <div className="mt-5">
        <PatternBoard traps={traps} />
      </div>
    </div>
  )
}
