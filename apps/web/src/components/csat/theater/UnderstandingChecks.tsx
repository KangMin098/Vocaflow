// apps/web/src/components/csat/theater/UnderstandingChecks.tsx
'use client'
//
// **이해 확인 — 관계를 다시 짚는다.** (2026-10-11 · M4 · 지시문 §9)
//
// 정답 번호를 다시 고르게 하지 않는다. 검수된 분석에서 판정되는 관계만 묻는다(`lib/csat/understanding-check.ts`):
// 근거 자리(복수 근거 허용) · 오답 하나가 무엇을 바꿨나(닫힌 함정 라벨표). 틀리면 다시 고를 수 있고, 두 번 틀리면
// 답을 열어 볼 수 있다 — 열어 본 것 · 몇 번 만에 맞혔는지를 함께 남긴다. 해설이 이미 열린 화면이라 늘 「설명 후 수행」이다.
// 참여는 선택이다.

import { useState } from 'react'

import type { CheckAttempt } from '@/lib/csat/dissect'
import { judgeCheck, TRAP_GLOSS, type UnderstandingCheck } from '@/lib/csat/understanding-check'

import styles from './theater.module.css'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

function CheckItem({
  check,
  itemId,
  review,
  done,
  onRecord,
}: {
  check: UnderstandingCheck
  itemId: string
  review: boolean
  done: CheckAttempt | null
  onRecord: (x: CheckAttempt) => void
}) {
  const [tries, setTries] = useState(0)
  const [wrong, setWrong] = useState<(number | string)[]>([])
  const [result, setResult] = useState<'correct' | 'revealed' | null>(null)
  const settled = result ?? (done && !review ? (done.revealed ? 'revealed' : 'correct') : null)

  const record = (correct: boolean, n: number, revealed: boolean) =>
    onRecord({
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${check.kind}`,
      item: itemId,
      kind: check.kind,
      correct,
      tries: n,
      revealed,
      at: Date.now(),
      afterExplanation: true,
      ...(review ? { review: true } : {}),
    })

  const pick = (v: number | string) => {
    if (settled) return
    const n = tries + 1
    setTries(n)
    if (judgeCheck(check, v)) {
      setResult('correct')
      record(true, n, false)
    } else setWrong((w) => [...w, v])
  }
  const reveal = () => {
    setResult('revealed')
    record(false, tries, true)
  }

  const answerText =
    check.kind === 'evidence'
      ? check.correct.map((k) => `${k + 1}번 문장`).join(' · ')
      : `${check.correct} — ${TRAP_GLOSS[check.correct] ?? ''}`

  return (
    <div className={styles.explainField} data-testid={`check-${check.kind}`}>
      <span className="break-keep">
        {check.kind === 'evidence'
          ? '정답을 확정하는 근거 문장은 몇 번인가요? (근거가 여럿이면 그중 하나)'
          : `${CIRCLED[check.choice] ?? check.choice} 선지는 지문에서 무엇을 바꿨나요?`}
      </span>
      <div className={styles.explainChoices} role="group" aria-label={check.kind === 'evidence' ? '근거 문장' : '바뀐 성분'}>
        {check.kind === 'evidence'
          ? Array.from({ length: check.sentenceCount }, (_, k) => (
              <button key={k} type="button" onClick={() => pick(k)} disabled={!!settled || wrong.includes(k)} aria-pressed={settled != null && check.correct.includes(k)}>
                {k + 1}
              </button>
            ))
          : check.options.map((o) => (
              <button key={o} type="button" onClick={() => pick(o)} disabled={!!settled || wrong.includes(o)} aria-pressed={settled != null && o === check.correct} title={TRAP_GLOSS[o]}>
                {o}
              </button>
            ))}
      </div>
      {settled === 'correct' ? (
        <p className={styles.quiet}>맞아요 — {answerText}. {tries > 1 ? `${tries}번 만에 찾았어요.` : ''}</p>
      ) : settled === 'revealed' ? (
        <p className={styles.quiet}>답: {answerText}. 해설의 근거 설명과 다시 맞춰 보세요.</p>
      ) : wrong.length ? (
        <p className={styles.quiet}>
          다시 골라 보세요.{' '}
          {wrong.length >= 2 ? (
            <button type="button" className={styles.back} onClick={reveal}>
              답 보기
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

export function UnderstandingChecks({
  itemId,
  checks,
  saved,
  review = false,
  onRecord,
}: {
  itemId: string
  checks: UnderstandingCheck[]
  /** 이 문항의 지난 시도 */
  saved: CheckAttempt[]
  /** 복습으로 연 경우 — 지난 결과를 덮지 않고 다시 풀게 한다 */
  review?: boolean
  onRecord: (x: CheckAttempt) => void
}) {
  if (!checks.length) return null
  const last = (kind: CheckAttempt['kind']) => [...saved].reverse().find((x) => x.kind === kind) ?? null
  return (
    <section className={styles.explain} aria-labelledby="understanding-check-title" data-testid="understanding-checks">
      <h2 id="understanding-check-title">
        {review ? '복습 — 관계 다시 짚기' : '관계 다시 짚기'} <span className={styles.optional}>선택</span>
      </h2>
      <p className="break-keep">정답 번호가 아니라 근거 자리와 오답이 바꾼 성분을 다시 확인해요. 틀려도 다시 고를 수 있어요.</p>
      {checks.map((c) => (
        <CheckItem key={c.kind} check={c} itemId={itemId} review={review} done={last(c.kind)} onRecord={onRecord} />
      ))}
    </section>
  )
}
