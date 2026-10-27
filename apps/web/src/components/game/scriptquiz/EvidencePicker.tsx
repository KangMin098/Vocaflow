// apps/web/src/components/game/scriptquiz/EvidencePicker.tsx
// T-0193 — 채점 뒤 「이 답의 근거는 본문 어느 문장인가요?」. 후보 4개 중 하나를 고르면
// 근거 문장과 내가 고른 문장을 같은 자리에서 대조한다. 기록·점수에 넣지 않는다.
// 고른 뒤에도 버튼을 없애지 않는다 — 사라지면 키보드 포커스가 body 로 떨어진다.

'use client'

import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import type { EvidenceChoice } from '@/lib/scriptquiz/evidence'

export type EvidencePick = number | 'skip' | null

export function EvidencePicker({
  choice,
  pick,
  onPick,
}: {
  choice: EvidenceChoice
  pick: EvidencePick
  onPick: (pick: number | 'skip') => void
}) {
  const decided = pick !== null
  const hit = typeof pick === 'number' && pick === choice.evidenceIndex
  // 건너뛰기 버튼은 누르면 사라진다 — 포커스를 등록 근거 문장으로 옮겨 body 로 떨어지지 않게
  const evidenceRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (pick === 'skip') evidenceRef.current?.focus()
  }, [pick])

  return (
    <section aria-labelledby="evidence-q" className="flex flex-col gap-2" data-testid="evidence-picker">
      <p id="evidence-q" className="break-keep font-display text-[13px] font-[700] text-[var(--t1)]">
        이 답의 근거는 본문 어느 문장인가요?
        {!decided && (
          <span className="ml-2 font-body text-[12px] font-[500] text-[var(--t2)]">1~4 키로도 고를 수 있어요</span>
        )}
      </p>
      <ol className="flex flex-col gap-2">
        {choice.sentences.map((s, i) => {
          const isEvidence = decided && i === choice.evidenceIndex
          const isMine = typeof pick === 'number' && pick === i
          return (
            <li key={i}>
              <button
                type="button"
                ref={i === choice.evidenceIndex ? evidenceRef : undefined}
                data-evidence-option={i}
                aria-disabled={decided || undefined}
                onClick={() => {
                  if (!decided) onPick(i)
                }}
                className={[
                  'flex min-h-[44px] w-full items-start gap-3 rounded-[var(--r-md)] border px-3 py-2 text-left',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]',
                  isEvidence
                    ? 'border-[var(--success)] bg-[var(--bg)]'
                    : isMine
                      ? 'border-[var(--error)] bg-[var(--bg)]'
                      : 'border-[var(--bd)] bg-[var(--bg)]',
                  decided ? 'cursor-default' : 'hover:border-[var(--p)]',
                ].join(' ')}
              >
                <span className="mt-[2px] font-mono text-[12px] font-[700] text-[var(--t2)]" aria-hidden>
                  {i + 1}
                </span>
                <span className="flex-1 font-english text-[14px] leading-[1.6] text-[var(--t1)]">{s}</span>
                {(isEvidence || isMine) && (
                  <span className="shrink-0 break-keep font-display text-[11px] font-[700]">
                    {isEvidence && (
                      <span className="inline-flex items-center gap-1 text-[var(--success)]">
                        <Check size={12} strokeWidth={3} aria-hidden />
                        등록된 근거
                      </span>
                    )}
                    {isMine && !isEvidence && <span className="text-[var(--error-ink)]">내가 고른 문장</span>}
                    {isMine && isEvidence && <span className="ml-1 text-[var(--t2)]">· 내가 고른 문장</span>}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
      {!decided ? (
        <button
          type="button"
          onClick={() => onPick('skip')}
          className="min-h-[44px] self-start rounded-[var(--r-md)] px-3 font-display text-[12px] font-[600] text-[var(--t2)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        >
          근거 보기(건너뛰기)
        </button>
      ) : (
        <p role="status" className="break-keep font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
          {pick === 'skip'
            ? '표시된 문장이 등록된 근거예요.'
            : hit
              ? '등록된 근거 문장과 같은 문장을 골랐어요.'
              : '등록된 근거는 표시된 문장이에요. 내가 고른 문장도 답을 뒷받침하는지 두 문장을 비교해 보세요.'}
        </p>
      )}
    </section>
  )
}
