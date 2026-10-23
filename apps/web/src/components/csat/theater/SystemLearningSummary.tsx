// apps/web/src/components/csat/theater/SystemLearningSummary.tsx
'use client'
//
// **학습 정리 — scene=explain 의 새 내용.** (T-0091 · 2026-10-23 사용자 승인 설계)
//
// 쓰는 칸이 없다. 시스템이 미리 갖춘 핵심 관계 · 근거 단위 · 오답 설명(제공 근거) · 원리(통하는 조건 · 쓰면 안 되는 조건)를
// 보이고, 실제로 갈 수 있는 다음 활동만 내민다. 확인 과제는 사전에 정답 · 피드백이 구축된 것이 있을 때만 「풀기」, 없으면
// 「확인 과제 준비 중」 — 작성 · 자기 평가 · 지어낸 과제로 대신하지 않는다. 정리를 열람 · 보관해도 숙달로 세지 않는다.
// 과거에 쓴 설명 · 노트는 아래 「과거 작성 기록」에서 읽기 전용으로만 연다(지우거나 고치지 않는다).

import type { ReactNode } from 'react'

import type { LearningSummary } from '@/lib/csat/system-learning'
import type { SceneId } from '@/lib/csat/inquiry/scenes'

import styles from './theater.module.css'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']
/** 정리의 조작은 모두 44px 이상(접근성) */
const BTN = `${styles.back} min-h-[44px] inline-flex items-center`

export function SystemLearningSummary({
  summary,
  canKeep,
  kept,
  onKeep,
  onGo,
  onLecture,
  history,
  historyState,
}: {
  summary: LearningSummary
  /** 보관할 유형 원리가 있는가 */
  canKeep: boolean
  kept: boolean
  onKeep: () => void
  onGo: (scene: SceneId) => void
  onLecture?: () => void
  /** 과거 작성 기록(읽기 전용) — 없으면 null */
  history: ReactNode | null
  /** 기기 기록 읽기 상태 — 읽는 중과 기록 없음을 섞지 않는다 */
  historyState: 'loading' | 'ready'
}) {
  const { relation, units, principle, evidence, checks, next } = summary
  return (
    <section className={styles.explain} aria-labelledby="summary-title" data-testid="learning-summary" data-checks={checks.readiness}>
      <h2 id="summary-title">학습 정리</h2>
      <p className="break-keep">이 문항에서 준비된 관계 · 근거 · 원리를 한곳에 모았어요. 쓰거나 스스로 채점할 칸은 없어요.</p>

      <div data-testid="summary-relation">
        <b>핵심 관계</b>
        {relation ? <p className="break-keep">{relation}</p> : <p className={styles.quiet}>이 유형의 핵심 관계 정리를 준비 중이에요.</p>}
        {units.length ? <p className={`${styles.quiet} break-keep`}>근거 단위: {units.join(' · ')}</p> : null}
      </div>

      <div data-testid="summary-evidence">
        <b>제공 근거 — 오답이 배제되는 이유</b>
        {evidence.length ? (
          <ul className="break-keep">
            {evidence.map((e) => (
              <li key={e.key} data-testid="summary-evidence-item">
                {e.choice != null ? <b>{CIRCLED[e.choice] ?? e.choice} </b> : null}
                {e.body}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>이 문항의 검수된 오답 설명을 준비 중이에요.</p>
        )}
      </div>

      <div data-testid="summary-principle">
        <b>보관할 원리</b>
        {principle ? (
          <>
            <p className="break-keep">{principle.statement}</p>
            {principle.when_applies.length ? <p className="break-keep">통하는 조건: {principle.when_applies.join(' · ')}</p> : null}
            {principle.when_not.length ? <p className="break-keep">쓰면 안 되는 조건(반례): {principle.when_not.join(' · ')}</p> : null}
          </>
        ) : (
          <p className={styles.quiet}>이 문항의 검수된 원리는 준비 중이에요.</p>
        )}
        {canKeep ? (
          <button type="button" className={BTN} onClick={onKeep} disabled={kept} data-testid="summary-keep">
            {kept ? '내 원리에 보관됨' : '이 원리 보관'}
          </button>
        ) : null}
      </div>

      <div data-testid="summary-checks" data-readiness={checks.readiness}>
        <b>확인 과제</b>
        {checks.readiness === 'prepared' ? (
          <p className="break-keep">정답 · 근거 · 피드백이 준비된 확인 과제가 {checks.count}개 있어요. 해설을 본 뒤 푸는 연습이라 숙달 · 목표 달성으로 세지 않아요.</p>
        ) : (
          <p className={styles.quiet} role="status" data-testid="summary-checks-preparing">확인 과제 준비 중 — 이 문항에는 아직 정답과 피드백이 갖춰진 확인 과제가 없어요.</p>
        )}
      </div>

      <div data-testid="summary-next">
        <b>다음 활동</b>
        {next.length ? (
          <p className={styles.explainActions}>
            {next.map((a) =>
              a.scene ? (
                <button key={a.id} type="button" className={BTN} onClick={() => onGo(a.scene as SceneId)} data-testid={`summary-next-${a.id}`}>
                  {a.label}
                </button>
              ) : onLecture ? (
                <button key={a.id} type="button" className={BTN} onClick={onLecture} data-testid={`summary-next-${a.id}`}>
                  {a.label}
                </button>
              ) : null,
            )}
          </p>
        ) : (
          <p className={styles.quiet}>이 문항에서 이어 갈 준비된 활동이 아직 없어요.</p>
        )}
      </div>

      {historyState === 'loading' ? (
        <p className={styles.quiet} role="status" data-testid="summary-history-loading">이 기기의 과거 기록을 읽는 중이에요…</p>
      ) : history ? (
        <details data-testid="summary-history">
          <summary>과거 작성 기록 · 읽기 전용</summary>
          <p className={`${styles.quiet} break-keep`}>예전에 직접 쓴 설명 · 노트예요. 지우거나 고치지 않고 그대로 보관해요. 새로 쓰거나 채점하지 않아요.</p>
          {history}
        </details>
      ) : null}
    </section>
  )
}
