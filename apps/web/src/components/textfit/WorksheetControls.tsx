// apps/web/src/components/textfit/WorksheetControls.tsx
//
// **수업에 쓰기** — 결과를 종이로 내보내는 자리.
//
// 이 화면의 기존 출구는 셋이었다: 결과 링크 복사 · 단어 탭 복사 · 가입.
// 앞의 둘은 교사가 **다른 도구에 옮겨 붙이는** 형태다("붙여넣어 알아서 만드세요").
// 그 다음 단계 — 인쇄물 — 이 없었다. 교사의 수업 준비는 종이에서 끝난다.
//
// ⚠️ 미리보기를 화면에 그리지 않는다. 결과 화면이 두 배로 길어지고 Calm UI 가 아니다.
//    브라우저의 인쇄 미리보기가 이미 그 일을 한다 — 같은 것을 두 번 만들지 않는다.

'use client'

import { Printer } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import type { WorksheetMode } from '@/components/textfit/Worksheet'

const MODES: ReadonlyArray<{ key: WorksheetMode; label: string; hint: string }> = [
  { key: 'both', label: '둘 다', hint: '목록 1장 + 빈칸 1장' },
  { key: 'list', label: '어휘 목록', hint: '뜻이 적힌 나눠 주는 유인물' },
  { key: 'quiz', label: '빈칸 확인', hint: '뜻을 비운 쪽지시험' },
]

export function WorksheetControls({
  mode,
  onModeChange,
  wordCount,
}: {
  mode: WorksheetMode
  onModeChange: (m: WorksheetMode) => void
  wordCount: number
}) {
  if (wordCount === 0) return null

  function print() {
    track({ name: 'fit_worksheet_printed', props: { mode, words: wordCount } })
    // 이벤트가 나가기 전에 인쇄 대화상자가 스레드를 막을 수 있다 — 다음 틱으로 미룬다.
    window.setTimeout(() => window.print(), 0)
  }

  return (
    <section
      aria-label="수업에 쓰기"
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 font-display text-[15px] font-[750] tracking-[-0.02em] text-[var(--t1)]">
          수업에 쓰기
        </h2>
        <p className="m-0 font-mono text-[10.5px] text-[var(--t3)]">
          낱말 {wordCount}개 · A4
        </p>
      </div>

      <div role="radiogroup" aria-label="학습지 종류" className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const on = m.key === mode
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={on}
              title={m.hint}
              onClick={() => onModeChange(m.key)}
              className={`inline-flex min-h-11 items-center rounded-[var(--r-md)] border px-4 font-display text-[13px] font-[600] transition-colors duration-[var(--dur-normal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none ${
                on
                  ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:bg-[var(--bg2)]'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      <p className="m-0 font-body text-[12.5px] leading-[1.65] text-[var(--t2)]">
        {MODES.find((m) => m.key === mode)?.hint} — <b>지문은 인쇄되지 않아요.</b> 붙여넣은 글은
        저장하지 않고, 낱말과 뜻만 옮깁니다.
      </p>

      <button
        type="button"
        onClick={print}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-5 font-display text-[13.5px] font-[700] text-[var(--on-p)] transition-opacity duration-[var(--dur-normal)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
      >
        <Printer size={15} aria-hidden />
        인쇄 · PDF 저장
      </button>
    </section>
  )
}
