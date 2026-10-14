// apps/web/src/components/csat/theater/MeaningWholeView.tsx
'use client'
//
// **글 전체 통합 · 읽기의 경계 — 검수된 명제 · 관계만으로 펼친다.** (v3.1 보완안 C5 · C6 · 2026-10-14)
//
// ① 통합 과정: 전체 설명(summaryKo) 하나만 보이던 자리를, 그 설명이 묶은 명제(whole.propositionIds)를 순서대로 펼치고
//    명제 사이를 잇는 검수된 관계(whole.relationIds)를 끼워 「어떤 생각들이 어떻게 이어져 이 결론이 되나」를 보인다.
//    단계를 누르면 그 명제가 걸린 의미 · 관계로 거슬러 올라가 원문 문장 · 지도를 함께 비춘다(역추적).
// ② 읽기의 경계: 원문에 쓰인 것 / 가능한 해석(연결 추론 · 근거 · 한계) / 지원되지 않는 확대(대표 오독 · 다루지 않는 범위)를 나눠 보인다.
// 새 설명을 지어내지 않는다 — sidecar 에 이미 있고 독립 검수된 본문(propositions · relations · units.misunderstanding · whole.limitsKo)만 다시 배치한다.

import { useState } from 'react'

import type { MeaningSupportView, MsProposition, MsRelation } from '@/lib/csat/meaning-support/labels'
import { BASIS_LABEL_MS, FACET_LABEL, RELATION_KIND_LABEL, WHOLE_TITLE } from '@/lib/csat/meaning-support/labels'

import styles from './theater.module.css'

/** 명제가 가리키는 원문 문장 번호(앵커 → 문장) */
function sentencesOfProp(view: MeaningSupportView, p: MsProposition): number[] {
  const ns = p.anchorIds.map((id) => view.anchors.find((a) => a.id === id)?.sentence).filter((n): n is number => typeof n === 'number')
  return [...new Set(ns)].sort((a, b) => a - b)
}
/** 명제를 품은 첫 의미 단위 — 역추적 대상 */
const unitOfProp = (view: MeaningSupportView, pid: string) => view.units.find((u) => u.propositionIds.includes(pid)) ?? null

/**
 * 통합 순서 — 명제 i 와 i+1 사이에 놓을 관계. 두 명제를 함께 품은 관계를 먼저, 없으면 뒤 명제를 품은 관계.
 * 한 관계는 한 번만 쓴다. 어디에도 못 끼운 관계는 끝에 「그 밖의 연결」로 남긴다(버리지 않는다).
 */
export function integrationSteps(view: MeaningSupportView): { props: MsProposition[]; links: (MsRelation | null)[]; rest: MsRelation[] } {
  const props = view.whole.propositionIds.map((id) => view.propositions.find((p) => p.id === id)).filter((p): p is MsProposition => Boolean(p))
  const pool = view.whole.relationIds.map((id) => view.relations.find((r) => r.id === id)).filter((r): r is MsRelation => Boolean(r))
  const used = new Set<string>()
  const links = props.slice(1).map((next, i) => {
    const prev = props[i]
    const both = pool.find((r) => !used.has(r.id) && r.propositionIds.includes(prev.id) && r.propositionIds.includes(next.id))
    const hit = both ?? pool.find((r) => !used.has(r.id) && r.propositionIds.includes(next.id))
    if (hit) used.add(hit.id)
    return hit ?? null
  })
  return { props, links, rest: pool.filter((r) => !used.has(r.id)) }
}

export function MeaningWholeView({
  view,
  depth,
  activeUnitId,
  activeRelationId,
  onTrace,
}: {
  view: MeaningSupportView
  depth: 'brief' | 'why' | 'deep'
  activeUnitId: string | null
  activeRelationId: string | null
  /** 역추적 — 그 의미(와 관계)를 고르면 원문 판 · 지도가 같은 문장을 비춘다 */
  onTrace: (unitId: string, relationId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const shown = open || depth === 'deep'
  const { props, links, rest } = integrationSteps(view)
  if (!props.length) return null

  const relButton = (r: MsRelation, key: string) => {
    const from = r.from[0]
    return (
      <button
        key={key}
        type="button"
        className={styles.msWholeLink}
        aria-pressed={r.id === activeRelationId}
        onClick={() => from && onTrace(from, r.id)}
        data-testid="ms-whole-link"
        data-relation={r.id}
      >
        <span className={styles.epistemic}>{RELATION_KIND_LABEL[r.kind]}</span>
        <span className="break-keep">{r.changeKo}</span>
      </button>
    )
  }

  return (
    <div className={styles.msWhole} data-testid="ms-whole-steps-wrap">
      <button type="button" className={styles.back} aria-expanded={shown} onClick={() => setOpen((v) => !v)} disabled={depth === 'deep'} data-testid="ms-whole-toggle">
        {shown ? `${WHOLE_TITLE[view.whole.genre]}이 만들어지는 과정` : `이 ${WHOLE_TITLE[view.whole.genre]}은 어떻게 나오나 — 단계로 펼치기`}
      </button>
      {shown ? (
        <ol className={styles.msWholeSteps} data-testid="ms-whole-steps">
          {props.map((p, i) => {
            const u = unitOfProp(view, p.id)
            const ns = sentencesOfProp(view, p)
            return (
              <li key={p.id}>
                {i > 0 && links[i - 1] ? relButton(links[i - 1]!, `l${i}`) : null}
                <button
                  type="button"
                  className={styles.msWholeStep}
                  aria-pressed={u?.id === activeUnitId && !activeRelationId}
                  disabled={!u}
                  onClick={() => u && onTrace(u.id, null)}
                  data-testid="ms-whole-step"
                  data-prop={p.id}
                >
                  <span className={styles.msWholeNo} aria-hidden>{i + 1}</span>
                  <span className="break-keep">{p.textKo}</span>
                  <span className={styles.quiet}>
                    <span className={styles.epistemic}>{BASIS_LABEL_MS[p.basis]}</span>
                    {ns.length ? ` ${ns.join(' · ')}번 문장` : ''}
                    {u ? ` · ${u.labelKo}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
          <li>
            <p className={`${styles.msWholeResult} break-keep`} data-testid="ms-whole-result">
              <span className={styles.diagramLabel}>그래서 → {WHOLE_TITLE[view.whole.genre]}</span>
              {view.whole.summaryKo}
            </p>
          </li>
          {rest.length ? (
            <li>
              <span className={styles.diagramLabel}>그 밖의 연결</span>
              {rest.map((r) => relButton(r, r.id))}
            </li>
          ) : null}
        </ol>
      ) : null}
    </div>
  )
}

export function MeaningBoundaryView({ view, onTrace }: { view: MeaningSupportView; onTrace: (unitId: string, relationId: string | null) => void }) {
  const observed = view.propositions.filter((p) => p.basis === 'source_observation')
  const inferred = view.propositions.filter((p) => p.basis !== 'source_observation')
  const stretched = view.units.filter((u) => u.misunderstanding)
  const limits = view.whole.limitsKo ?? []
  const traceProp = (pid: string) => {
    const u = unitOfProp(view, pid)
    if (u) onTrace(u.id, null)
  }
  return (
    <section className={styles.msCard} aria-label="읽기의 경계" data-testid="ms-boundary">
      <p className={styles.diagramHead}>
        <b>읽기의 경계 — 어디까지가 원문이고 어디부터 해석인가</b>
      </p>
      <div className={styles.msBoundaryGrid}>
        <div data-testid="ms-boundary-observed">
          <b>원문에 쓰인 것</b>
          <ul className="break-keep">
            {observed.map((p) => (
              <li key={p.id}><button type="button" className={styles.msInline} onClick={() => traceProp(p.id)}>{p.textKo}</button> <span className={styles.quiet}>({sentencesOfProp(view, p).join(' · ')}번)</span></li>
            ))}
          </ul>
        </div>
        <div data-testid="ms-boundary-possible">
          <b>가능한 해석</b>
          {inferred.length ? (
            <ul className="break-keep">
              {inferred.map((p) => (
                <li key={p.id}>
                  <button type="button" className={styles.msInline} onClick={() => traceProp(p.id)}>{p.textKo}</button>
                  {p.warrantsKo.length ? <span className={styles.quiet}> · 근거: {p.warrantsKo.join(' · ')}</span> : null}
                  {p.limitKo ? <span className={styles.quiet}> · 여기까지만: {p.limitKo}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.quiet}>이 문항의 설명은 원문에 쓰인 것만으로 이어져요 — 따로 추론한 단계가 없어요.</p>
          )}
        </div>
        <div data-testid="ms-boundary-unsupported">
          <b>지원되지 않는 확대</b>
          <ul className="break-keep">
            {stretched.map((u) => (
              <li key={u.id}>
                <button type="button" className={styles.msInline} onClick={() => onTrace(u.id, null)}>「{u.misunderstanding!.alteredKo}」</button>
                <span className={styles.quiet}> — {FACET_LABEL[u.misunderstanding!.lostFacet]}이(가) 바뀐다. {u.misunderstanding!.whyWrongKo}</span>
              </li>
            ))}
            {limits.map((l, i) => (<li key={`l${i}`} className={styles.quiet}>이 설명이 다루지 않는 것 · {l}</li>))}
          </ul>
        </div>
      </div>
    </section>
  )
}
