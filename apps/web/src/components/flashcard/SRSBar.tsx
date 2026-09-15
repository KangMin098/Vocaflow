// apps/web/src/components/flashcard/SRSBar.tsx

'use client'

import { formatNextReview } from '@/lib/srs/sm2'
import type { SRSRating, SRSState } from '@/types/flashcard'

interface SRSBarProps {
  visible: boolean
  srs: SRSState
  onJudge: (rating: SRSRating) => void
}

const SRS_OPTIONS: Array<{
  rating: SRSRating
  /** 채움 눈금 수(1~4) — 이모지를 대신해 강도를 말한다. */
  bars: number
  label: string
  variant: 'again' | 'hard' | 'good' | 'easy'
  keyHint: string
}> = [
  // v07 「주묵 판면」 — 이모지를 뺐다.
  //   ① 기기마다 다른 그림이 나온다 — **우리가 고른 얼굴이 아니다**(브랜드 자산 0개 상태의 기본값).
  //   ② 😅 은 학습자의 인출 실패에 **표정을 붙인다.** 모른다는 것은 상태이지 창피한 일이 아니다
  //      (철학 3 Empathetic Feedback · 학습원칙 3 Desirable Difficulty).
  // 대신 **채움 눈금**으로 강도를 말한다 — 1칸/2칸/3칸/4칸. 칸 수가 정보를 나르므로 색맹 대응도 된다.
  { rating: 'again', bars: 1, label: '몰라요', variant: 'again', keyHint: '1' },
  { rating: 'hard', bars: 2, label: '어려워요', variant: 'hard', keyHint: '2' },
  { rating: 'good', bars: 3, label: '기억나요', variant: 'good', keyHint: '3' },
  { rating: 'easy', bars: 4, label: '너무 쉬워요', variant: 'easy', keyHint: '4' },
]

// ⚠️ 테두리가 **하드코딩 rgba** 였다 — `--srs-*` 를 고쳐도 따라오지 않는 값이었고,
//    again 쪽은 원색 빨강 `rgba(239,68,68,.2)` 이라 v07 의 "오답을 빨강에서 뺀다" 와 어긋났다.
//    전부 토큰 경유로 돌린다(색 하나를 고치면 네 칸이 같이 움직인다).
const VARIANT_STYLES = {
  again: {
    border: 'border-[var(--bd)]',
    hover: 'hover:border-[var(--srs-1)] hover:bg-[var(--bg2)]',
    label: 'text-[var(--srs-1-ink)]',
    fill: 'bg-[var(--srs-1)]',
  },
  hard: {
    border: 'border-[var(--bd)]',
    hover: 'hover:border-[var(--srs-2)] hover:bg-[var(--active-light)]',
    label: 'text-[var(--srs-2-ink)]',
    fill: 'bg-[var(--srs-2)]',
  },
  good: {
    border: 'border-[var(--bd)]',
    hover: 'hover:border-[var(--srs-3)] hover:bg-[var(--success-light)]',
    label: 'text-[var(--srs-3-ink)]',
    fill: 'bg-[var(--srs-3)]',
  },
  easy: {
    border: 'border-[var(--bd)]',
    hover: 'hover:border-[var(--srs-4)] hover:bg-[var(--info-light)]',
    label: 'text-[var(--srs-4-ink)]',
    fill: 'bg-[var(--srs-4)]',
  },
}

export function SRSBar({ visible, srs, onJudge }: SRSBarProps) {
  return (
    <div
      className={`mt-6 grid w-full max-w-[540px] grid-cols-4 gap-2 transition-all duration-[var(--dur-slow)] ease-[var(--ease)] ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2.5 opacity-0'
      } `}
      aria-hidden={!visible}
      role="group"
      aria-label="SRS 평가"
    >
      {SRS_OPTIONS.map(({ rating, bars, label, variant, keyHint }) => {
        const styles = VARIANT_STYLES[variant]
        return (
          <button
            key={rating}
            onClick={() => onJudge(rating)}
            className={`group/srs relative flex min-h-[88px] flex-col items-center gap-2 rounded-[var(--r-md)] border bg-[var(--bg)] px-2 py-4 pb-3 text-center transition-[background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease)] active:translate-y-[1px] ${styles.border} ${styles.hover} `}
            aria-label={`${label}, ${formatNextReview(rating, srs)}`}
          >
            <span
              className="absolute right-1.5 top-1 rounded border border-[var(--bd)] bg-[var(--bg2)] px-[4px] py-[4px] font-mono text-[9px] font-[700] text-[var(--t2)] opacity-50 transition-opacity group-hover/srs:opacity-100"
              aria-hidden="true"
            >
              {keyHint}
            </span>
            {/* 채움 눈금 — 색에만 기대지 않는다(색맹 대응). 칸 수가 곧 강도다. */}
            <span aria-hidden className="flex items-end gap-[3px] py-[3px]">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`block w-[4px] rounded-[1px] ${i <= bars ? styles.fill : 'bg-[var(--t4)]'}`}
                  style={{ height: 6 + i * 3 }}
                />
              ))}
            </span>
            <span className={`font-display text-[13px] font-[700] ${styles.label}`}>{label}</span>
            <span className="font-mono text-[10px] font-[500] text-[var(--t2)]">
              {formatNextReview(rating, srs)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
