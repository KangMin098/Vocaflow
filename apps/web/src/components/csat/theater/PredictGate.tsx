'use client'

// apps/web/src/components/csat/theater/PredictGate.tsx
//
// **공개 게이트 — 먼저 예측한다.** (재설계안 v1 원칙 2 · Phase 1 · 2026-09-25)
//
// 근거 문장 · 정답 선지 · 확신도를 확정해야 정답과 근거가 열린다. 입력은 빈 칸이 아니라 고르기다
// (보조형 자기설명 프롬프트가 개방형보다 낫다 — Berthold 외 2009). 「모르겠어요」도 확정이다.
// 채점·기록 규칙은 `lib/csat/reveal-gate.ts`.

import { useState } from 'react'

import { CUE_LABEL, PATTERN_LABEL, TRANSFORM_LABEL, topicQuestion, topicSentences, type PassageDesign, type Pattern, type Transform } from '@/lib/csat/design'
import type { GateCommit, GateKey, GateResult } from '@/lib/csat/reveal-gate'
import { CIRCLED } from '@/lib/csat/theater'

import styles from './theater.module.css'

const CONFIDENCE = ['찍음', '약간', '반반', '꽤', '확실'] as const

export function PredictGate({
  sentences,
  design,
  onCommit,
}: {
  /** 문장 길이들(골격) — 막대 폭만 쓴다. 비어 있으면 근거 문장 칸을 건너뛴다 */
  sentences: number[]
  /** 출제 설계 주석 — 있으면 주제문 · 구조 패턴 · 정답 표현 변환도 묻는다(S2 · S3) */
  design?: PassageDesign | null
  onCommit: (commit: GateCommit) => void
}) {
  const [topic, setTopic] = useState<number | null>(null)
  const [pattern, setPattern] = useState<Pattern | null>(null)
  const [transform, setTransform] = useState<Transform | null>(null)
  const askDesign = Boolean(design && sentences.length && design.roles.length === sentences.length)
  const [sentence, setSentence] = useState<number | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const max = Math.max(1, ...sentences)
  const ready = confidence != null && (sentence != null || choice != null)

  return (
    <section className={styles.gate} aria-labelledby="gate-title" data-testid="predict-gate">
      <p className={styles.gateEyebrow}>먼저 예측 · 확정하면 정답과 근거가 열려요</p>
      <h2 id="gate-title">출제자는 어느 문장에 정답을 걸었을까요?</h2>

      {sentences.length ? (
        <fieldset className={styles.gateField}>
          <legend>정답이 기대는 문장</legend>
          <div className={styles.gateSentences}>
            {sentences.map((chars, i) => (
              <button key={i} type="button" aria-pressed={sentence === i} onClick={() => setSentence(sentence === i ? null : i)} aria-label={`근거 후보 ${i + 1}번째 문장`}>
                <span className={styles.gateNo}>{i + 1}</span>
                <span className={styles.gateBar} style={{ width: `${Math.max(12, Math.round((100 * chars) / max))}%` }} aria-hidden />
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {askDesign && design ? (
        <>
          <fieldset className={styles.gateField}>
            <legend>{topicQuestion(design)}</legend>
            <div className={styles.gateRow}>
              {sentences.map((_, i) => (
                <button key={i} type="button" aria-pressed={topic === i} onClick={() => setTopic(topic === i ? null : i)} aria-label={`주제문 후보 ${i + 1}번째 문장`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.gateField}>
            <legend>출제자가 고른 지문의 뼈대는?</legend>
            <div className={styles.gateRow}>
              {(Object.keys(PATTERN_LABEL) as Pattern[]).map((p) => (
                <button key={p} type="button" aria-pressed={pattern === p} onClick={() => setPattern(pattern === p ? null : p)}>
                  {PATTERN_LABEL[p]}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      <fieldset className={styles.gateField}>
        <legend>정답 선지</legend>
        <div className={styles.gateRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-pressed={choice === n} onClick={() => setChoice(choice === n ? null : n)} aria-label={`${n}번 선지`}>
              {CIRCLED[n]}
            </button>
          ))}
        </div>
      </fieldset>

      {askDesign && design && design.transform !== 'none' ? (
        <fieldset className={styles.gateField}>
          <legend>정답 선지는 지문 표현을 어떻게 바꿨을까요?</legend>
          <div className={styles.gateRow}>
            {(Object.keys(TRANSFORM_LABEL) as Transform[])
              .filter((t) => t !== 'none')
              .map((t) => (
                <button key={t} type="button" aria-pressed={transform === t} onClick={() => setTransform(transform === t ? null : t)}>
                  {TRANSFORM_LABEL[t]}
                </button>
              ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className={styles.gateField}>
        <legend>확신도</legend>
        <div className={styles.gateRow}>
          {CONFIDENCE.map((label, i) => (
            <button key={label} type="button" aria-pressed={confidence === i + 1} onClick={() => setConfidence(i + 1)}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className={styles.gateActions}>
        <button type="button" className={styles.gatePrimary} disabled={!ready} onClick={() => ready && onCommit({ sentence, choice, confidence, topic, pattern, transform })}>
          확정하고 대조하기
        </button>
        <button type="button" className={styles.gateQuiet} onClick={() => onCommit({ sentence: null, choice: null, confidence: 1 })}>
          모르겠어요 — 바로 보기
        </button>
      </div>
    </section>
  )
}

/** 확정 뒤 — 맞은 것보다 **어긋난 곳**을 먼저 보인다 */
export function GateDiff({ commit, result, gateKey }: { commit: GateCommit; result: GateResult; gateKey: GateKey }) {
  const rows: { label: string; mine: string; theirs: string; hit: boolean | null }[] = []
  if (gateKey.evidence.length)
    rows.push({
      label: '근거 문장',
      mine: commit.sentence == null ? '모르겠어요' : `${commit.sentence + 1}번째`,
      theirs: gateKey.evidence.map((i) => `${i + 1}번째`).join(' · '),
      hit: result.sentenceHit,
    })
  if (gateKey.answer != null)
    rows.push({
      label: '정답 선지',
      mine: commit.choice == null ? '모르겠어요' : CIRCLED[commit.choice],
      theirs: CIRCLED[gateKey.answer],
      hit: result.choiceHit,
    })
  const d = gateKey.design
  if (d && commit.topic !== undefined) {
    const t = topicSentences(d)
    rows.push({
      label: d.roles.includes('topic') ? '주제문' : '화행 문장',
      mine: commit.topic == null ? '고르지 않음' : `${commit.topic + 1}번째`,
      theirs: t.map((i) => `${i + 1}번째`).join(' · ') || '—',
      hit: result.topicHit ?? null,
    })
  }
  if (d && commit.pattern !== undefined)
    rows.push({ label: '지문 뼈대', mine: commit.pattern ? PATTERN_LABEL[commit.pattern] : '고르지 않음', theirs: PATTERN_LABEL[d.pattern], hit: result.patternHit ?? null })
  if (d && d.transform !== 'none' && commit.transform !== undefined)
    rows.push({ label: '표현 변환', mine: commit.transform ? TRANSFORM_LABEL[commit.transform] : '고르지 않음', theirs: TRANSFORM_LABEL[d.transform], hit: result.transformHit ?? null })
  rows.sort((a, b) => Number(a.hit === true) - Number(b.hit === true))
  return (
    <section className={styles.diff} aria-label="내 예측과 출제자 설계의 차이" data-testid="gate-diff">
      {result.overconfident ? <p className={styles.diffAlert}>확신이 높았는데 어긋났어요 — 이 문항에서 가장 배울 게 많은 자리예요.</p> : null}
      <dl>
        {rows.map((r) => (
          <div key={r.label} data-hit={r.hit === null ? 'na' : r.hit}>
            <dt>{r.label}</dt>
            <dd>
              <span>내 예측 {r.mine}</span>
              <span>출제자 {r.theirs}</span>
              <b>{r.hit === null ? '—' : r.hit ? '맞음' : '어긋남'}</b>
            </dd>
          </div>
        ))}
      </dl>
      {d ? (
        <div className={styles.diffWhy}>
          {d.selection ? (
            <p>
              <b>왜 이 지문인가</b> {d.selection}
            </p>
          ) : null}
          {d.transform !== 'none' && d.transform_note ? (
            <p>
              <b>정답은 이렇게 바뀌었다</b> {d.transform_note}
            </p>
          ) : null}
          {d.cues.length ? (
            <p>
              <b>순서를 정하는 단서</b> {d.cues.map((c) => CUE_LABEL[c]).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
