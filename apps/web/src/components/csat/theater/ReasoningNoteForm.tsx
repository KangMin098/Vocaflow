// apps/web/src/components/csat/theater/ReasoningNoteForm.tsx
'use client'
//
// **원리 정리 — 제공된 원리 + 과거 원리 노트(읽기 전용).** (v3 M4 원리 노트 작성 칸 → 2026-10-23 T-0091 전환)
//
// 새 노트를 쓰거나 고쳐 쓰고 대조하는 흐름은 없다(학습자 글을 평가 · 자기 대조하지 않는다 — DECISIONS CL-SL-1).
// 보이는 것: 제공된 원리(modelLabel — 기본 「검수된 원리」 · 창작 교수 자료는 「제공된 설명」)와, 예전에 저장한 노트의 읽기 전용 기록.
// 기록 계약(ReasoningNote · revisionOf · FI-015 병합)은 그대로 — 처음 설명과 고친 설명을 모두 남긴 채 보인다.
// 근거 위치는 같은 분석 판이고 지도 결속이 있을 때만 짚는다(번호를 지어내지 않는다).

import type { ReasoningNote } from '@/lib/csat/dissect'
import type { InquiryPrinciple } from '@/lib/csat/inquiry/labels'

import styles from './theater.module.css'

const nums = (xs: readonly number[]) => xs.map((n) => `${n}번`).join(' · ')
/** 받침에 맞는 조사 — 괄호 덧말은 빼고 본말의 끝 글자로 판단(「검수된 원리」와 · 「제공된 설명(사람 검수 전)」과 · 「…」이/가) */
export function josa(word: string, withFinal: string, without: string): string {
  const base = word.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const c = base.charCodeAt(base.length - 1)
  const hasFinal = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false
  return `${word}${hasFinal ? withFinal : without}`
}

export function ReasoningNoteForm({
  analysisVersion,
  principle,
  saved,
  onShowEvidence,
  modelLabel = '검수된 원리',
  authored,
  showModel = true,
}: {
  analysisVersion: number | null
  /** 제공된 원리 — 없으면 준비 중 안내 */
  principle: InquiryPrinciple | null
  /** 이 문항에서 예전에 쓴 노트(읽기 전용) */
  saved: ReasoningNote[]
  /** 노트의 근거를 가운데 판에서 짚는다(지도 결속이 있을 때만 넘긴다) */
  onShowEvidence?: (sentences: number[]) => void
  /** 제공 모델 이름 — 사람 검수 전 창작 설명은 「검수된」 이라 부르지 않는다(FI-011 C) */
  modelLabel?: string
  /** 창작 교수 자료 결속 — 다른 판에서 쓴 노트를 표시한다 */
  authored?: { deliveryId: string; annotationHash: string }
  /** 제공 원리 칸을 보일지(학습 정리 안에서는 정리가 원리를 이미 보인다) */
  showModel?: boolean
}) {
  if (!showModel && !saved.length) return null
  return (
    <section className={styles.explain} aria-labelledby="note-title" data-testid="reasoning-note" data-readonly="true">
      <h2 id="note-title">{showModel ? '원리 정리' : '예전 원리 노트'}</h2>
      {showModel ? (
        principle ? (
          <div data-testid="note-model">
            <b>{modelLabel}</b>
            <p className="break-keep">{principle.statement}</p>
            {principle.when_applies.length ? <p className="break-keep">통하는 조건: {principle.when_applies.join(' · ')}</p> : null}
            {principle.when_not.length ? <p className="break-keep">쓰면 안 되는 조건: {principle.when_not.join(' · ')}</p> : null}
          </div>
        ) : (
          <p className={styles.quiet} data-testid="note-no-model">이 문항에는 보여 줄 {josa(modelLabel, '이', '가')} 아직 준비 중이에요.</p>
        )
      ) : null}
      {saved.length ? (
        <div className={styles.explainCompare} data-testid="note-history" data-count={saved.length}>
          <b>예전에 쓴 노트 {saved.length}개 · 읽기 전용</b>
          {saved.map((n) => (
            <div key={n.id} data-testid={n.revisionOf ? 'note-revised' : 'note-mine'}>
              <span className={styles.quiet}>{n.revisionOf ? '고친 설명' : '처음 설명'}</span>
              <p className="break-keep">{n.statement}</p>
              {n.applicability ? <p className="break-keep">통하는 조건: {n.applicability}</p> : null}
              {n.limit ? <p className="break-keep">쓰면 안 되는 조건: {n.limit}</p> : null}
              {n.evidence.length ? (
                n.binding.analysisVersion === analysisVersion && onShowEvidence ? (
                  <button type="button" className={`${styles.back} min-h-[44px] inline-flex items-center`} onClick={() => onShowEvidence(n.evidence)} data-testid="note-evidence-show">
                    연결한 근거 {nums(n.evidence)} 문장 짚기
                  </button>
                ) : (
                  <p className={styles.quiet} data-testid="note-evidence-stale">연결한 근거 {nums(n.evidence)} 문장 — 예전 분석 기준이거나 지도와 맞춰 볼 수 없어 위치는 짚지 않아요.</p>
                )
              ) : null}
              {authored && n.authored && n.authored.annotationHash !== authored.annotationHash ? (
                <p className={styles.quiet} data-testid="note-other-edition">다른 판 자료로 쓴 노트예요.</p>
              ) : null}
              {n.binding.analysisVersion !== analysisVersion ? <p className={styles.quiet}>예전 분석으로 쓴 노트예요.</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
