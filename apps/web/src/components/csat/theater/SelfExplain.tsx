// apps/web/src/components/csat/theater/SelfExplain.tsx
'use client'
//
// **과거 자기 설명 — 읽기 전용 기록.** (2026-10-11 M4 작성 칸 → 2026-10-23 T-0091 읽기 전용 전환)
//
// 새 자기 설명은 쓰지 않는다(학습자 글을 평가 · 대조하는 흐름을 두지 않는다 — DECISIONS CL-SL-1). 예전에 저장한 설명은
// 지우거나 고치지 않고 그대로 보인다. 기록 계약(SelfExplanation · explain-draft)은 병합 · 동기화를 위해 그대로 남는다.

import type { SelfExplanation } from '@/lib/csat/dissect'

import styles from './theater.module.css'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

export function SelfExplain({ saved }: { saved: SelfExplanation[] }) {
  if (!saved.length) return null
  return (
    <div className={styles.explainCompare} data-testid="self-explain-history" data-count={saved.length}>
      <b>예전에 쓴 오답 설명 {saved.length}개</b>
      {saved.map((x) => (
        <div key={x.id} data-testid="self-explain-history-item">
          <span className={styles.quiet}>{CIRCLED[x.choice] ?? x.choice}</span>
          {x.tempting ? <p className="break-keep">{x.tempting}</p> : null}
          {x.reject ? <p className="break-keep">{x.reject}</p> : null}
        </div>
      ))}
    </div>
  )
}
