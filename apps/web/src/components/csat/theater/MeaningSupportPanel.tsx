// apps/web/src/components/csat/theater/MeaningSupportPanel.tsx
'use client'
//
// **원문 이해 교수 판 — scene=meaning 안의 선택적 탐구.** (v3.1 · 설계 §2 · §3)
//
// 여섯 지원(의미 형성 · 쉬운 재구성 · 의미 보존 · 문장 연결 · 전체 통합 · 추론 경계)은 강제 단계 · 별도 메뉴가 아니다.
// 처음에는 전체 이해 1~2문장과 시작 의미 하나의 정확한 뜻 · 쉬운 말 · 핵심 보존 조건만, 「왜 그런가 · 깊이 탐구」로 더 연다.
// 선택 상태(의미 · 관계 · 깊이)는 부모 AnalysisTheater 가 갖는다 — 지도 · 원문 판이 같은 근거를 비춘다. 선택은 강의를 재생 · 이동시키지 않는다.
// 문항 성립 · 설계 재구성으로 이어 가되 자동 채점 · 정답 제출이 없다. 원문 영어는 기존 공개 표현 재사용분만 보인다.

import type { MeaningSupportView, MsDepth } from '@/lib/csat/meaning-support/labels'
import { BASIS_LABEL_MS, DEPTH_LABEL, FACET_LABEL, WHOLE_TITLE } from '@/lib/csat/meaning-support/labels'
import { DEPTHS, relationsOfUnit } from '@/lib/csat/meaning-support/model'

import { MeaningDraft } from './MeaningDraft'
import { MeaningRelationView } from './MeaningRelationView'
import styles from './theater.module.css'

export function MeaningSupportPanel({
  view,
  unitId,
  relationId,
  depth,
  linkable,
  draft,
  onSelectUnit,
  onSelectRelation,
  onDepth,
  onDraft,
  onGo,
}: {
  view: MeaningSupportView
  unitId: string | null
  relationId: string | null
  depth: MsDepth
  /** 원문 문장 분할이 작성 때와 같은가 — 다르면 문장 번호만 글로 보이고 지도 강조는 끈다 */
  linkable: boolean
  draft: string
  onSelectUnit: (id: string | null) => void
  onSelectRelation: (id: string | null) => void
  onDepth: (d: MsDepth) => void
  onDraft: (t: string) => void
  /** 다른 장면으로 이어가기(문항 성립 · 설계 재구성) */
  onGo: (scene: 'judgment' | 'design') => void
}) {
  const unit = view.units.find((u) => u.id === unitId) ?? null
  const relation = view.relations.find((r) => r.id === relationId) ?? null
  const rels = relationsOfUnit(view, unit?.id ?? null)
  // 한 unit 에 bridge 가 여럿일 수 있다(의미별로 나뉜 선지 연결) — 선지 번호를 합쳐 보인다
  const bridgeChoices = [...new Set(view.bridges.filter((b) => b.unitId === unit?.id).flatMap((b) => b.choiceNumbers))].sort((x, y) => x - y)
  const props = (ids: string[]) => view.propositions.filter((p) => ids.includes(p.id))
  const showWhy = depth === 'why' || depth === 'deep'
  const showDeep = depth === 'deep'

  return (
    <section className={styles.diagram} aria-label="원문 이해" data-testid="ms-panel">
      <p className={styles.diagramHead}>
        <b>{WHOLE_TITLE[view.whole.genre]}</b>
        <span className={styles.epistemic}>독립 검수 · 원문 대조</span>
      </p>
      <p className="break-keep" data-testid="ms-whole">{view.whole.summaryKo}</p>
      {view.partial ? <p className={`${styles.quiet} break-keep`} data-testid="ms-partial">{view.partial.withheldKo}</p> : null}

      {/* 탐구할 의미 고르기 — 시작 의미는 추천일 뿐(가장 중요한 문장 · 취약점 판정 아님) */}
      <div className={styles.cmpFilters} role="group" aria-label="탐구할 의미" data-testid="ms-units">
        {view.units.map((u) => (
          <button key={u.id} type="button" aria-pressed={u.id === unit?.id} onClick={() => onSelectUnit(u.id === unit?.id ? null : u.id)} data-testid="ms-unit" data-unit={u.id}>
            {u.labelKo} <span className={styles.quiet}>({u.sentences.join(' · ')}번)</span>
          </button>
        ))}
      </div>

      <div className={styles.cmpFilters} role="group" aria-label="설명 깊이" data-testid="ms-depth">
        {DEPTHS.map((d) => (
          <button key={d} type="button" aria-pressed={depth === d} onClick={() => onDepth(d)} data-depth={d}>{DEPTH_LABEL[d]}</button>
        ))}
      </div>

      {unit ? (
        <article className={styles.designRow} data-testid="ms-explain" data-unit={unit.id}>
          <p className="break-keep">
            <span className={styles.diagramLabel}>{unit.sentences.join(' · ')}번 문장</span>
            {linkable ? null : <span className={styles.quiet}>(원문 문장 대응 확인 중 — 지도 강조 없음)</span>}
          </p>
          <p className="break-keep"><span className={styles.diagramLabel}>정확한 뜻</span>{unit.exactKo}</p>
          <p className="break-keep"><span className={styles.diagramLabel}>쉬운 말</span>{unit.simpleKo}</p>
          {unit.preserves.length ? (
            <div data-testid="ms-preserves">
              <span className={styles.diagramLabel}>쉬운 말에서도 지킬 조건</span>
              <ul className="break-keep">
                {unit.preserves.map((p, i) => (
                  <li key={i}><b>{FACET_LABEL[p.facet]}</b> {p.valueKo}{showWhy ? <> — {p.explanationKo}</> : null}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {showWhy && unit.syntax ? (
            <div data-testid="ms-syntax">
              <span className={styles.diagramLabel}>문장이 어떻게 묶이나</span>
              <ul className="break-keep">
                {unit.syntax.parts.map((p) => (<li key={p.id}>{p.meaningKo}</li>))}
              </ul>
              {unit.syntax.attachments.map((a, i) => (<p key={i} className="break-keep">{a.whyKo}</p>))}
              <p className="break-keep"><span className={styles.diagramLabel}>다시 합친 뜻</span>{unit.syntax.recombinedKo}</p>
              {unit.syntax.originalIssueKo ? <p className="break-keep"><span className={styles.diagramLabel}>원문 표기</span>{unit.syntax.originalIssueKo}</p> : null}
              {unit.syntax.correction ? (
                <p className="break-keep" data-testid="ms-correction">
                  <span className={styles.diagramLabel}>교정 예(원문 아님)</span>{unit.syntax.correction.form} — {unit.syntax.correction.explanationKo}
                </p>
              ) : null}
            </div>
          ) : null}

          {showWhy && unit.propositionIds.length ? (
            <ul className="break-keep" data-testid="ms-propositions">
              {props(unit.propositionIds).map((p) => (
                <li key={p.id}>
                  <span className={styles.epistemic}>{BASIS_LABEL_MS[p.basis]}</span> {p.textKo}
                  {showDeep && p.warrantsKo.length ? <> · 근거: {p.warrantsKo.join(' · ')}</> : null}
                  {showDeep && p.limitKo ? <> · 한계: {p.limitKo}</> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {showDeep && unit.misunderstanding ? (
            <p className="break-keep" data-testid="ms-misunderstanding">
              <span className={styles.diagramLabel}>이렇게 읽으면 달라져요</span>
              「{unit.misunderstanding.alteredKo}」 — {FACET_LABEL[unit.misunderstanding.lostFacet]}이(가) 바뀐다. {unit.misunderstanding.whyWrongKo}
            </p>
          ) : null}

          {rels.length ? (
            <div className={styles.cmpFilters} role="group" aria-label="앞뒤 연결" data-testid="ms-relations">
              {rels.map((r) => (
                <button key={r.id} type="button" aria-pressed={r.id === relation?.id} onClick={() => onSelectRelation(r.id === relation?.id ? null : r.id)} data-testid="ms-relation-pick">
                  {r.from.includes(unit.id) ? '뒤와의 연결' : '앞과의 연결'} · {r.changeKo.slice(0, 18)}…
                </button>
              ))}
            </div>
          ) : null}
          {relation ? <MeaningRelationView view={view} relation={relation} onPickUnit={(id) => onSelectUnit(id)} /> : null}

          <MeaningDraft key={unit.id} unit={unit} text={draft} onChange={onDraft} />

          <p className={styles.cmpActions}>
            <button type="button" className={styles.back} onClick={() => onGo('judgment')} data-testid="ms-go-judgment">
              문항 성립에서 보기{bridgeChoices.length ? ` (선택지 ${bridgeChoices.join(' · ')})` : ''}
            </button>
            <button type="button" className={styles.back} onClick={() => onGo('design')} data-testid="ms-go-design">설계 재구성에서 보기</button>
          </p>
        </article>
      ) : (
        <p className={styles.quiet}>위에서 탐구할 의미를 고르거나, 왼쪽 지문 지도에서 문장을 눌러 보세요.</p>
      )}

      {showDeep && view.whole.limitsKo.length ? (
        <p className="break-keep" data-testid="ms-limits"><span className={styles.diagramLabel}>이 설명이 다루지 않는 것</span>{view.whole.limitsKo.join(' · ')}</p>
      ) : null}
    </section>
  )
}
