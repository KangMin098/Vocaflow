// apps/web/src/components/pairflip/PairFlipPairsList.tsx
// 매칭한 단어 펼침 가능 리스트
// T-0218: 두 번 이상 걸린 짝(attempts ≥ 2)은 뜻을 가린 채 보여 주고 「뜻 확인」 으로 연다 — 기억에서 먼저 꺼내 보게.
//   SpellForge 완료의 MissedWordRow 와 같은 모양(aria-expanded · aria-controls · 44px · 보이는 초점). 여닫기는 화면 메모리뿐 —
//   기록 · 점수 · SRS · 이벤트 없음. 모두 한 번에 맞혔으면 예전 목록 그대로.

'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

import type { PairFlipPairResult } from './types'

interface PairsListProps {
  pairs: PairFlipPairResult[]
}

function attemptsBadge(attempts: number): { label: string; className: string } {
  if (attempts <= 1) return { label: '한 번에', className: 'bg-[var(--success-light)] text-[#065F46]' }
  if (attempts <= 2) return { label: '두 번 만에', className: 'bg-[var(--warning-light)] text-[#92400E]' }
  return { label: '여러 번 시도', className: 'bg-[var(--bg3)] text-[var(--t2)]' }
}

/** 기억에서 다시 꺼내 볼 짝 — 두 번 이상 시도해 맞힌 것 */
export function needsRecall(attempts: number): boolean {
  return attempts >= 2
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]'

/** 뜻을 가린 행 — 「뜻 확인」 으로 연다(기록하지 않는다) */
export function RecallPairRow({ pair, badge }: { pair: PairFlipPairResult; badge: { label: string; className: string } }) {
  const [shown, setShown] = useState(false)
  const id = useId()
  return (
    <li className="flex items-center gap-3 px-4 py-3" data-testid="pf-recall-pair">
      <Check size={14} className="shrink-0 text-[var(--success)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-english text-[14px] font-[600] text-[var(--t1)]">{pair.word}</p>
        <p id={id} className="truncate font-body text-[12px] text-[var(--t2)]" data-testid="pf-recall-meaning">
          {shown ? pair.meaning : '뜻을 먼저 떠올려 보세요'}
        </p>
      </div>
      <span className={`inline-flex shrink-0 items-center rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[600] ${badge.className}`}>
        {badge.label}
      </span>
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={id}
        onClick={() => setShown((v) => !v)}
        className={`inline-flex min-h-[44px] shrink-0 items-center rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[700] text-[var(--t1)] hover:border-[#F59E0B] ${FOCUS}`}
      >
        {shown ? '뜻 가리기' : '뜻 확인'}
      </button>
    </li>
  )
}

export function PairFlipPairsList({ pairs }: PairsListProps) {
  const [open, setOpen] = useState(true)

  if (pairs.length === 0) return null

  return (
    <section
      aria-labelledby="pf-pairs-heading"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[var(--r-lg)] px-4 py-3 text-left transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
      >
        <div className="flex items-center gap-2">
          <h3
            id="pf-pairs-heading"
            className="font-display text-[14px] font-[700] text-[var(--t1)]"
          >
            학습한 단어
          </h3>
          <span className="font-mono text-[12px] font-[600] text-[var(--t2)]">
            {pairs.length}쌍
          </span>
        </div>
        <ChevronDown
          size={16}
          aria-hidden
          className="text-[var(--t2)] transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <ul className="divide-y divide-[var(--bd)]">
          {pairs.map((p) => {
            const badge = attemptsBadge(p.attempts)
            if (needsRecall(p.attempts)) return <RecallPairRow key={p.pairId} pair={p} badge={badge} />
            return (
              <li key={p.pairId} className="flex items-center gap-3 px-4 py-3">
                <Check
                  size={14}
                  className="shrink-0 text-[var(--success)]"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-english text-[14px] font-[600] text-[var(--t1)]">
                    {p.word}
                  </p>
                  <p className="truncate font-body text-[12px] text-[var(--t2)]">
                    {p.meaning}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[600] ${badge.className}`}
                >
                  {badge.label}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
