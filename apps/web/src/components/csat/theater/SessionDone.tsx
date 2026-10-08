// apps/web/src/components/csat/theater/SessionDone.tsx
'use client'
//
// **문항을 마친 뒤 — 한 일(사실)과 다음 행동.** 계약: `docs/csat-learner/G0_LEARNING_CONTRACT.md` §2.
//
// 문구는 실제 기록과 같아야 한다 — 해설만 본 학습자에게 「스스로 판단했어요」라고 쓰지 않는다.
// 이해나 실력이 늘었다는 말은 하지 않는다(검증되지 않았다). 다음에 확인할 길만 보인다.

import Link from 'next/link'

import { completionOf, type LearningSession } from '@/lib/csat/learning-session'
import type { GateResult } from '@/lib/csat/reveal-gate'

import styles from './theater.module.css'

const HEAD: Record<'guided' | 'independent', string> = {
  independent: '스스로 판단하고 마쳤어요',
  guided: '도움을 받아 마쳤어요',
}

const dayLabel = (t: number, now: number) => {
  const d = Math.max(0, Math.round((t - now) / 86_400_000))
  return d === 0 ? '오늘' : d === 1 ? '내일' : `${d}일 뒤`
}

export function SessionDone({
  session,
  result,
  next,
  typeHref,
  now,
  onReview,
  onRestart,
}: {
  session: LearningSession
  /** 확정한 예측의 채점 — 「모르겠어요」면 null */
  result: GateResult | null
  next: { href: string; label: string } | null
  typeHref: string | null
  now: number
  onReview: () => void
  onRestart: () => void
}) {
  const completion = completionOf(session)
  if (completion !== 'guided' && completion !== 'independent') return null
  const facts: string[] = []
  if (session.help === 'viewed_first') facts.push('예측 없이 해설을 먼저 봤어요')
  if (result?.sentenceHit != null) facts.push(`근거 문장 예측 ${result.sentenceHit ? '맞음' : '어긋남'}`)
  if (result?.choiceHit != null) facts.push(`정답 예측 ${result.choiceHit ? '맞음' : '어긋남'}`)
  facts.push('정답 근거와 오답 설계를 끝까지 봤어요')
  const check = completion === 'independent' ? '같은 유형의 새 문항에서 다시 확인해 보세요.' : '근거를 이해했는지 다음 문항에서 확인해 보세요.'

  return (
    <section className={styles.done} aria-labelledby="session-done-title" data-testid="session-done" data-completion={completion}>
      <p className={styles.doneEyebrow}>이 문항을 마쳤어요</p>
      <h2 id="session-done-title">{HEAD[completion]}</h2>
      <ul>
        {facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p className={styles.quiet}>{check}</p>
      <div className={styles.doneActions}>
        {next ? (
          <Link className={styles.gatePrimary} href={next.href} data-testid="done-next">
            같은 유형 다음 문항 · {next.label}
          </Link>
        ) : typeHref ? (
          <Link className={styles.gatePrimary} href={typeHref} data-testid="done-next">
            이 유형 목록
          </Link>
        ) : null}
        {session.reviewAt != null ? (
          <span className={styles.doneNote} data-testid="done-review-set">
            다시 보기 {dayLabel(session.reviewAt, now)}
          </span>
        ) : (
          <button type="button" className={styles.doneQuiet} onClick={onReview} data-testid="done-review">
            3일 뒤 다시 보기
          </button>
        )}
        <Link className={styles.doneQuiet} href="/csat?view=continue">
          내 학습
        </Link>
        <button type="button" className={styles.doneQuiet} onClick={onRestart} data-testid="done-restart">
          처음부터 다시
        </button>
      </div>
    </section>
  )
}
