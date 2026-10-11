// apps/web/src/components/csat/theater/SceneDiagrams.tsx
'use client'
//
// **장면별 중심 도식 — 검수된 출제 설계 주석(`passage_design`)을 장면에 맞게 보인다.** (vNext2 M2 · 2026-10-11)
//
//   지문 구조(S2)    문장 역할 사슬 + 구조 패턴 + 허용 대안 + 단서 — 문장 길이가 아니라 역할로 읽는다
//   발문·정답 설계(S3) 원문 → 정답 표현의 변환 종류와 설명
//   본질(S1)        이 지문을 이 유형에 고른 이유
//
// 모두 **분석자의 설계 가설**이다(실제 출제자의 생각을 확인한 기록이 아니다) — 라벨로 밝힌다.
// 역할 수와 지문 지도 문장 수가 다르면(단위 대응 불확실 · F07) 번호를 붙이지 않고 역할 순서만 보인다.
// 모든 내용은 텍스트 목록이다 — 색만으로 구별하지 않는다.

import { PATTERN_LABEL, ROLE_LABEL, TRANSFORM_LABEL, CUE_LABEL, type PassageDesign } from '@/lib/csat/design'
import { OPERATION_LABEL, TRUTH_LABEL, type InquiryDistractor, type InquiryPrinciple } from '@/lib/csat/inquiry/labels'

import styles from './theater.module.css'

const HYPOTHESIS = '설계 가설 · 검수된 주석'

export function DesignSelection({ design }: { design: PassageDesign }) {
  if (!design.selection.trim()) return null
  return (
    <section className={styles.diagram} aria-label="이 지문을 고른 이유" data-testid="design-selection">
      <p className={styles.diagramHead}>
        <b>이 지문이 이 판단을 요구하는 이유</b>
        <span className={styles.epistemic}>{HYPOTHESIS}</span>
      </p>
      <p className="break-keep">{design.selection}</p>
    </section>
  )
}

export function StructureDiagram({ design, sentenceCount }: { design: PassageDesign; sentenceCount: number | null }) {
  if (!design.roles.length) return null
  // 지도 문장 수와 역할 수가 같을 때만 문장 번호를 붙인다 — 다르면 번호를 지어내지 않는다
  const aligned = sentenceCount != null && sentenceCount === design.roles.length
  const alt = new Map<number, string[]>()
  for (const a of design.alternatives) alt.set(a.index, [...(alt.get(a.index) ?? []), ROLE_LABEL[a.role] ?? a.role])
  return (
    <section className={styles.diagram} aria-label="문장 역할 사슬" data-testid="structure-diagram">
      <p className={styles.diagramHead}>
        <b>구조 · {PATTERN_LABEL[design.pattern] ?? design.pattern}</b>
        <span className={styles.epistemic}>{HYPOTHESIS}</span>
      </p>
      <ol className={styles.roleChain} data-aligned={aligned}>
        {design.roles.map((r, i) => (
          <li key={i} data-role={r}>
            {aligned ? <span className={styles.roleNo}>{i + 1}</span> : null}
            <b>{ROLE_LABEL[r] ?? r}</b>
            {alt.has(i) ? <span className={styles.roleAlt}>또는 {alt.get(i)!.join(' · ')}</span> : null}
          </li>
        ))}
      </ol>
      {!aligned ? (
        <p className={styles.quiet}>문장 단위 대응을 확인하는 중이라 번호 없이 역할 순서만 보여요.</p>
      ) : null}
      {design.cues.length ? (
        <p className="break-keep">
          <span className={styles.diagramLabel}>연결을 드러내는 단서</span> {design.cues.map((c) => CUE_LABEL[c] ?? c).join(' · ')}
        </p>
      ) : null}
    </section>
  )
}

export function TransformDiagram({ design }: { design: PassageDesign }) {
  if (design.transform === 'none' && !design.transform_note.trim()) return null
  return (
    <section className={styles.diagram} aria-label="원문에서 정답 표현으로" data-testid="transform-diagram">
      <p className={styles.diagramHead}>
        <b>원문 → 정답 표현</b>
        <span className={styles.epistemic}>{HYPOTHESIS}</span>
      </p>
      <p className={styles.transformRow}>
        <span>지문의 핵심 명제</span>
        <span aria-hidden>→</span>
        <b>{TRANSFORM_LABEL[design.transform] ?? design.transform}</b>
        <span aria-hidden>→</span>
        <span>정답 선지</span>
      </p>
      {design.transform_note.trim() ? <p className="break-keep">{design.transform_note}</p> : null}
    </section>
  )
}

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

/**
 * 오답 설계(S4) — 선지마다 「유지한 것 / 바뀐 것」을 두 줄로 대조한다. 처음엔 선지 번호와 변환 종류만 보이고,
 * 누르면 펼친다(네 장문 카드를 한꺼번에 펼치지 않는다). 유지/바뀜은 라벨 · 기호 · 텍스트로 구별한다(색만 쓰지 않는다).
 */
export function DistractorDesign({ distractors }: { distractors: InquiryDistractor[] }) {
  if (!distractors.length) return null
  return (
    <section className={styles.diagram} aria-label="오답이 유지한 것과 바꾼 것" data-testid="distractor-design">
      <p className={styles.diagramHead}>
        <b>무엇을 남기고 무엇을 바꿨나</b>
        <span className={styles.epistemic}>{HYPOTHESIS}</span>
      </p>
      {distractors.map((d) => (
        <details key={d.n} className={styles.designRow} data-truth={d.truth}>
          <summary>
            <b>{CIRCLED[d.n] ?? d.n}</b> {OPERATION_LABEL[d.operation] ?? d.operation}
            <span className={styles.roleAlt}> · {TRUTH_LABEL[d.truth]}</span>
          </summary>
          {d.preserved.length ? (
            <p className="break-keep">
              <span className={styles.diagramLabel}>= 유지</span>
              {d.preserved.map((p) => `${p.component}: ${p.text}`).join(' · ')}
            </p>
          ) : null}
          {d.altered.length ? (
            <ul className={styles.alteredList}>
              {d.altered.map((a, i) => (
                <li key={i} className="break-keep">
                  <span className={styles.diagramLabel}>≠ 바뀜 · {a.component}</span>
                  {a.from} <span aria-hidden>→</span>
                  <span className="sr-only">에서</span> {a.to}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="break-keep">{d.note}</p>
        </details>
      ))}
    </section>
  )
}

/** 공통 원리(S5) — 조건부 원리 · 성립 조건 · 적용하면 안 되는 조건을 같은 판에서 대조한다 */
export function PrincipleDesign({ principle }: { principle: InquiryPrinciple }) {
  return (
    <section className={styles.diagram} aria-label="원리와 적용 경계" data-testid="principle-design">
      <p className={styles.diagramHead}>
        <b>이 문항이 지지하는 원리</b>
        <span className={styles.epistemic}>일반화한 원리 · 이 문항 범위</span>
      </p>
      <p className="break-keep">{principle.statement}</p>
      <div className={styles.boundary}>
        <div>
          <span className={styles.diagramLabel}>✓ 통하는 조건</span>
          <ul>
            {principle.when_applies.map((x, i) => (
              <li key={i} className="break-keep">{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <span className={styles.diagramLabel}>✕ 적용하면 안 되는 조건</span>
          <ul>
            {principle.when_not.map((x, i) => (
              <li key={i} className="break-keep">{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
