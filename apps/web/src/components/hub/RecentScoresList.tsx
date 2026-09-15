// apps/web/src/components/hub/RecentScoresList.tsx
//
// 모듈 허브 "최근 기록" — /wordblitz · /spellforge 공용.
//
// 두 허브가 각자 상수 배열을 갖고 각자 그리고 있었고, 둘 다 콤보 열을 갖고 있었다.
// 콤보는 scores 어디에도 저장되지 않는다(metadata 실측 키: demo·scope·wrong·captured) —
// 그래서 열이 사라졌다. 남은 것(점수·정확도·언제)은 전부 실제 컬럼이다.
//
// 빈 상태를 컴포넌트가 직접 말한다. 호출부가 "0회" 나 "0점" 으로 채우면
// 아직 안 해본 학습자와 0점을 받은 학습자를 구별할 수 없다.

import { Trophy } from 'lucide-react'

import type { RecentScore } from '@/lib/scores/recent'

export interface RecentScoresListProps {
  scores: RecentScore[]
  /** 이 모듈 최고 점수 — 기록 없으면 null (0 으로 바꾸지 말 것) */
  best: number | null
  /** 숫자·아이콘 강조색 (모듈 색) */
  accent: string
  /** 기록이 없을 때 안내 — 모듈마다 다음 행동이 달라서 호출부가 정한다 */
  emptyHint: string
}

export function RecentScoresList({ scores, best, accent, emptyHint }: RecentScoresListProps) {
  return (
    <section
      aria-label="최근 기록"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
    >
      <header className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)]"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}
          aria-hidden
        >
          <Trophy size={13} strokeWidth={2} />
        </span>
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">최근 기록</h2>
        {best != null && (
          <span className="ml-auto font-mono text-[11px] tabular-nums text-[var(--t2)]">
            최고 {best.toLocaleString()}점
          </span>
        )}
      </header>

      {scores.length === 0 ? (
        <p className="py-2 font-body text-[12px] italic leading-relaxed text-[var(--t2)]">{emptyHint}</p>
      ) : (
        <ul className="divide-y divide-[var(--bd)]">
          {scores.map((s, i) => (
            <li key={`${s.date}-${i}`} className="flex items-center gap-3 py-3">
              <span className="w-16 shrink-0 font-mono text-[11px] text-[var(--t2)]">{s.date}</span>
              <span className="flex-1 font-display text-[14px] font-[700] tabular-nums text-[var(--t1)]">
                {s.score.toLocaleString()}
                <span className="ml-1 font-mono text-[10px] text-[var(--t2)]">점</span>
              </span>
              {/* accuracy 는 nullable — 없으면 '—' 로 두고 0% 로 표시하지 않는다 */}
              <span className="w-12 shrink-0 text-right font-mono text-[12px] tabular-nums text-[var(--t2)]">
                {s.accuracy == null ? '—' : `${s.accuracy}%`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
