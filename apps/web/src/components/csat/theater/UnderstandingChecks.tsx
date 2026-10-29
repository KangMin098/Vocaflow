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

// ── 고른 근거 번호를 지도 위치로 확인(U02-MAP-01) ─────────────────────────────
// 학습자가 「선택한 N번 문장 지도에서 보기」를 **눌렀을 때만** 지도에 비춘다 — 번호를 고르는 것만으로는 지도를 움직이지 않는다.
// 근거 선택 상태(`evidence`)를 같이 쓰되 키에 과제 문장 수와 **결속값**(문항 id · 분석 판본 · 단위 해시 · 지도 분할 지문)을 싣는다:
// 문장 수가 같아도 판본이나 분할이 바뀌면 같은 번호가 다른 문장을 가리키므로, 결속값이 다르면 지난 강조를 무효로 한다.
// v3 근거 연결(v3Linkable)과 무관하다 — v3 가 없는 정상 과제도 지도와 맞으면 비춘다.
const LOCATE_PREFIX = 'check-locate:'

/**
 * 위치 강조 결속값 — 문항 id · 분석 판본 · 단위 해시 · 지도 분할(문장별 길이)을 한 문자열로 줄인다(FNV-1a 32bit).
 * 판본 문자열을 키에 그대로 싣지 않는다(탭 메모리에 남는 값이라 짧게).
 */
export function checkLocateBinding(parts: {
  itemId: string
  analysisVersion: number | string | null
  unitsHash: string | null
  sentences: { chars: number }[]
}): string {
  const src = [parts.itemId, parts.analysisVersion ?? 'na', parts.unitsHash ?? 'na', parts.sentences.map((s) => s.chars).join('.')].join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/** 이해 확인 위치 강조의 근거 키 — 과제의 문장 수와 결속값을 함께 싣는다 */
export function checkLocateKey(sentenceCount: number, binding: string): string {
  return `${LOCATE_PREFIX}${sentenceCount}:${binding}`
}

export function isCheckLocateKey(key: string): boolean {
  return key.startsWith(LOCATE_PREFIX)
}

/** 지도에 비출 문장(0-기반)을 고른다. 지도가 없거나 문장 수가 다르거나 범위 밖이면 null. */
export function resolveCheckLocate(mapSentenceCount: number | null, sentenceCount: number, sentence: number): number | null {
  if (mapSentenceCount == null || !Number.isInteger(sentenceCount) || mapSentenceCount !== sentenceCount) return null
  if (!Number.isInteger(sentence) || sentence < 0 || sentence >= sentenceCount) return null
  return sentence
}

/**
 * 근거 상태가 이해 확인 위치 강조면 지도 문장(0-기반)을, 아니면 null. 지금 지도 · 결속값과 다시 대조한다(기억에서 되살아난 값도) —
 * 문장 수가 같아도 결속값(문항 · 판본 · 분할)이 다르면 비추지 않는다.
 */
export function checkLocateFocus(
  evidence: { sentences: number[]; key: string } | null,
  mapSentenceCount: number | null,
  binding: string | null,
): number[] | null {
  if (!evidence || !isCheckLocateKey(evidence.key) || evidence.sentences.length !== 1 || binding == null) return null
  const [countStr, keyBinding, ...rest] = evidence.key.slice(LOCATE_PREFIX.length).split(':')
  if (rest.length || keyBinding !== binding) return null
  const count = Number(countStr)
  const k = resolveCheckLocate(mapSentenceCount, count, evidence.sentences[0] - 1)
  return k == null ? null : [k]
}

function CheckItem({
  check,
  itemId,
  review,
  done,
  onRecord,
  onLocate,
}: {
  check: UnderstandingCheck
  itemId: string
  review: boolean
  done: CheckAttempt | null
  onRecord: (x: CheckAttempt) => void
  onLocate?: (sentence: number, sentenceCount: number) => boolean
}) {
  const [tries, setTries] = useState(0)
  const [wrong, setWrong] = useState<(number | string)[]>([])
  const [result, setResult] = useState<'correct' | 'revealed' | null>(null)
  // 마지막으로 고른 근거 번호(0-기반) · 지도 확인 결과 — 기록(onRecord)과 무관한 화면 상태
  const [lastPick, setLastPick] = useState<number | null>(null)
  const [located, setLocated] = useState<'shown' | 'unavailable' | null>(null)
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
    if (typeof v === 'number') {
      setLastPick(v)
      setLocated(null)
    }
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
      {check.kind === 'evidence' && onLocate && lastPick != null ? (
        <p className={styles.quiet}>
          <button
            type="button"
            className={styles.back}
            data-testid="check-locate"
            onClick={() => setLocated(onLocate(lastPick, check.sentenceCount) ? 'shown' : 'unavailable')}
          >
            선택한 {lastPick + 1}번 문장 지도에서 보기
          </button>
          <span role="status" className="break-keep" data-testid="check-locate-status">
            {located === 'shown'
              ? ` 지도에 ${lastPick + 1}번 문장을 표시했어요 — 위치만 보여 줄 뿐 정답 여부와는 무관해요.`
              : located === 'unavailable'
                ? ' 이 문항은 지도 문장 번호가 맞지 않아 위치를 표시할 수 없어요.'
                : ''}
          </span>
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
  onLocate,
}: {
  itemId: string
  checks: UnderstandingCheck[]
  /** 이 문항의 지난 시도 */
  saved: CheckAttempt[]
  /** 복습으로 연 경우 — 지난 결과를 덮지 않고 다시 풀게 한다 */
  review?: boolean
  onRecord: (x: CheckAttempt) => void
  /** 고른 근거 번호(0-기반)를 지도에 비춘다 — 비췄으면 true. 지도가 없으면 넘기지 않는다(버튼이 없다) */
  onLocate?: (sentence: number, sentenceCount: number) => boolean
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
        <CheckItem key={c.kind} check={c} itemId={itemId} review={review} done={last(c.kind)} onRecord={onRecord} onLocate={onLocate} />
      ))}
    </section>
  )
}
