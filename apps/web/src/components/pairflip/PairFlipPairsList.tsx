// apps/web/src/components/pairflip/PairFlipPairsList.tsx
// 매칭한 단어 펼침 가능 리스트
// T-0218: 다시 시도해서 맞힌 짝은 뜻을 가린 채 보여 주고 「뜻 확인」 으로 연다 — 기억에서 먼저 꺼내 보게.
//   SpellForge 완료의 MissedWordRow 와 같은 모양(aria-expanded · aria-controls · 44px · 보이는 초점). 여닫기는 화면 메모리뿐 —
//   기록 · 점수 · SRS · 이벤트 없음. 모두 한 번에 맞혔으면 예전 목록 그대로.

'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

import type { PairFlipPairResult } from './types'

interface PairsListProps {
  pairs: PairFlipPairResult[]
}

// T-0266 — 확인 가능한 사실만 표지로: attempts 1 · 2 는 「맞힌 짝」(한 번에 맞혀도 2 라 횟수를 단정하지 않는다) · 3 이상은 「다시 시도한 짝」(확실한 재시도).
//   정확한 시도 횟수는 추정하지 않는다(아래 RECALL_MIN_ATTEMPTS 설명 참고).
export function attemptsBadge(attempts: number): { label: string; className: string } {
  if (attempts < RECALL_MIN_ATTEMPTS) return { label: '맞힌 짝', className: 'bg-[var(--success-light)] text-[#065F46]' }
  return { label: '다시 시도한 짝', className: 'bg-[var(--bg3)] text-[var(--t2)]' }
}

/**
 * 기억에서 다시 꺼내 볼 짝 — **실제로 다시 시도해 맞힌 것**.
 * ⚠️ attempts 는 시도 횟수가 아니다(hooks/usePairFlipSession.ts 매칭 분기): 카드는 뒤집힐 때마다 +1 되고, 매칭 때
 *   max(첫 카드 뒤집힌 수 + 1, 둘째 카드 이전 뒤집힌 수 + 1) 로 다시 센다. 그래서 **한 번에 맞혀도 2** 다.
 *   3 이상이면 어느 한 카드가 이미 한 번 이상 틀린 짝으로 뒤집혔던 것 — 확실한 재시도다.
 *   2 에는 「첫 시도」 와 「이전에 본 카드를 둘째로 눌러 맞힘」 이 섞여 있어 구별할 수 없다 — 한 번에 맞힌 짝을 가리지 않도록 가리지 않는다.
 * 실제 훅 산출로 확인: runtime/team-pilot-20261028/pa-t218r-result.json(한 번에 2 · 한 번 틀리고 3 · 두 번 틀리고 4).
 */
export const RECALL_MIN_ATTEMPTS = 3
export function needsRecall(attempts: number): boolean {
  return attempts >= RECALL_MIN_ATTEMPTS
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
        {/* T-0256 — 긴 단어도 자르지 않는다(줄바꿈) */}
        <p className="font-english text-[14px] font-[600] text-[var(--t1)] [overflow-wrap:anywhere]">{pair.word}</p>
        {/* 연 뜻은 자르지 않는다 — 떠올린 것과 끝까지 견줄 수 있게(가린 안내는 한 줄) */}
        <p id={id} className={`font-body text-[12px] text-[var(--t2)] ${shown ? 'break-keep [overflow-wrap:anywhere]' : 'truncate'}`} data-testid="pf-recall-meaning">
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
                  {/* T-0256 — 일반 행의 단어 · 뜻은 끝까지(줄바꿈 · 한글 break-keep · 긴 토큰은 어디서든 끊김) */}
                  <p className="font-english text-[14px] font-[600] text-[var(--t1)] [overflow-wrap:anywhere]" data-testid="pf-pair-word">
                    {p.word}
                  </p>
                  <p className="break-keep font-body text-[12px] text-[var(--t2)] [overflow-wrap:anywhere]" data-testid="pf-pair-meaning">
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
