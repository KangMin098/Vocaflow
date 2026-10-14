// apps/web/src/components/csat/theater/MeaningSupportPanel.tsx
'use client'
//
// **원문 이해 교수 판 — scene=meaning 안의 선택적 탐구.** (v3.1 · 설계 §2 · §3 · PR #238 보강)
//
// 여섯 지원(의미 형성 · 쉬운 재구성 · 의미 보존 · 문장 연결 · 전체 통합 · 추론 경계)은 강제 단계 · 별도 메뉴가 아니다.
// 처음에는 전체 이해와 시작 의미 하나의 **구절 대응(영어 구절 → 문장 속 역할 → 뜻) → 정확한 뜻 → 쉬운 말** 과 지킬 조건만,
// 「왜 그런가 · 깊이 탐구」로 더 연다. 선택 상태(의미 · 관계 · 깊이 · 구절)는 부모 AnalysisTheater 가 갖는다.
// 영어 구절은 두 길로만 보인다: 기존 공개 표현(quote · 8단어 이하) 또는 **학습자 기기 문제지에서 대조로 찾은 글자**.
// 기기 원문이 설명을 쓸 때의 원문과 다르면 구절 표시 · 지도 강조를 끄고 그 이유를 말한다(잘못된 자리를 비추지 않는다).

import { useEffect } from 'react'

import type { TextAlign } from '@/lib/csat/meaning-support/align'
import type { MeaningSupportView, MsDepth } from '@/lib/csat/meaning-support/labels'
import { BASIS_LABEL_MS, DEPTH_LABEL, FACET_LABEL, WHOLE_TITLE } from '@/lib/csat/meaning-support/labels'
import { bridgeOf, DEPTHS, phraseRowsOf, relationsOfUnit } from '@/lib/csat/meaning-support/model'
import { unitNarration } from '@/lib/csat/meaning-support/narration'

import { MeaningDraft } from './MeaningDraft'
import { MeaningRelationView } from './MeaningRelationView'
import { MeaningBoundaryView, MeaningWholeView } from './MeaningWholeView'
import { useMeaningNarration } from './useMeaningNarration'
import styles from './theater.module.css'

const ROLE_LABEL: Record<string, string> = { main: '핵심 줄기', modifier: '꾸밈', clause: '절', connector: '연결어' }

/** 대조 상태 문구 — 무엇을 확인했고 무엇을 못 했는지(색만으로 알리지 않는다) */
function alignMessage(text: TextAlign, splitOk: boolean): string {
  if (text.state === 'mismatch') {
    return `이 기기의 문제지 글자가 설명을 쓸 때의 원문과 달라요${text.sentence ? `(${text.sentence}번 문장)` : ''}. 잘못된 자리를 비추지 않도록 구절 표시와 지도 강조를 껐어요. 같은 회차 문제지를 다시 놓으면 다시 대조해요.`
  }
  if (!splitOk) return '지문 지도의 문장 나눔이 설명을 쓸 때와 달라 지도 강조와 문장 고르기를 껐어요. 설명은 문장 번호로만 읽어 주세요.'
  if (text.state === 'ok') return '기기의 문제지와 문장 · 구절을 대조했어요. 구절을 누르면 문제지와 지도에 그 자리가 표시돼요.'
  if (text.state === 'pending') return '문제지를 여는 중이에요 — 열리면 구절을 원문과 대조해요.'
  return text.why === 'unreadable'
    ? '이 문항은 문제지에서 글자를 뽑지 못해 원문 대조를 못 했어요. 지도는 문장 수 · 길이 대조로만 비춰요.'
    : '이 기기에 문제지 원문이 없어 글자 대조를 못 했어요. 영어는 기존 공개 표현만 보이고, 지도는 문장 수 · 길이 대조로만 비춰요.'
}

export function MeaningSupportPanel({
  view,
  unitId,
  relationId,
  depth,
  draft,
  pick,
  phraseId,
  textAlign,
  passage,
  splitOk,
  onSelectUnit,
  onSelectRelation,
  onPhrase,
  onDepth,
  onDraft,
  onGo,
  onTrace,
  onSpeaking,
}: {
  view: MeaningSupportView
  unitId: string | null
  relationId: string | null
  depth: MsDepth
  draft: string
  /** 지도에서 고른 문장이 검수 unit 0 개 · 여러 개에 걸렸을 때 — 이전 설명을 접고 이것만 보인다 */
  pick: { n: number; unitIds: string[] } | null
  /** 고른 구절(앵커 id) */
  phraseId: string | null
  textAlign: TextAlign
  /** 대조가 ok 일 때만 넘어오는 기기 원문(구절 글자를 잘라 보이는 데만 쓴다) */
  passage: string | null
  /** 지도 골격 분할이 작성 원문과 같은가(서버 판정) */
  splitOk: boolean
  onSelectUnit: (id: string | null) => void
  onSelectRelation: (id: string | null) => void
  onPhrase: (anchorId: string | null) => void
  onDepth: (d: MsDepth) => void
  onDraft: (t: string) => void
  /** 다른 장면으로 이어가기 — 이 의미가 걸린 선택지 · 설계 근거를 들고 간다 */
  onGo: (scene: 'judgment' | 'design') => void
  /** 전체 통합 · 경계에서 거슬러 오르기 — 의미(와 관계)를 한 번에 고른다 */
  onTrace: (unitId: string, relationId: string | null, target?: 'step' | 'link' | 'boundary') => void
  /** 읽어 주는 동안 그 설명이 걸린 원문 문장(1부터) — 지도 강조가 말을 따라간다. 끝나면 빈 배열 */
  onSpeaking?: (sentences: number[]) => void
}) {
  const narration = useMeaningNarration(view.itemId)
  const speakKey = narration.currentSentences.join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onSpeaking?.(narration.currentSentences) }, [speakKey])
  // 학습자가 다른 의미를 직접 고르면 그 의미 읽기를 멈춘다(말과 화면이 어긋나지 않게)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (narration.group?.startsWith('unit:')) narration.stop() }, [unitId])
  const unit = pick ? null : view.units.find((u) => u.id === unitId) ?? null
  const relation = view.relations.find((r) => r.id === relationId) ?? null
  const rels = relationsOfUnit(view, unit?.id ?? null)
  const bridge = bridgeOf(view, unit?.id ?? null)
  const props = (ids: string[]) => view.propositions.filter((p) => ids.includes(p.id))
  const anchor = (id: string) => view.anchors.find((a) => a.id === id)
  const showWhy = depth === 'why' || depth === 'deep'
  const showDeep = depth === 'deep'
  const aligned = textAlign.state === 'ok' ? textAlign : null
  const rows = unit ? phraseRowsOf(unit) : []
  const english = (id: string): { text: string; from: 'public' | 'paper' } | null => {
    const a = anchor(id)
    if (!a) return null
    if (a.quote) return { text: a.quote, from: 'public' }
    const sp = aligned?.spans[id]
    return sp && passage ? { text: passage.slice(sp.start, sp.end), from: 'paper' } : null
  }

  return (
    <section className={styles.msPanel} aria-label="원문 이해" data-testid="ms-panel" data-align={textAlign.state} data-split={splitOk ? 'ok' : 'mismatch'}>
      {/* 3B 카드 1 — 전체 이해 · 대조 상태 · 의미/깊이 고르기(참조 Skill 모달의 첫 카드 대응) */}
      <div className={styles.msCard} data-testid="ms-head-card">
      <p className={styles.diagramHead}>
        <b>{WHOLE_TITLE[view.whole.genre]}</b>
        <span className={styles.epistemic}>독립 검수 · 원문 대조</span>
      </p>
      <p className="break-keep" data-testid="ms-whole">{view.whole.summaryKo}</p>
      <MeaningWholeView view={view} depth={depth} activeUnitId={unit?.id ?? null} activeRelationId={relationId} onTrace={onTrace} narration={narration} />
      {view.partial ? <p className={`${styles.quiet} break-keep`} data-testid="ms-partial">{view.partial.withheldKo}</p> : null}
      <p className={`${styles.quiet} break-keep`} role="status" data-testid="ms-align-status">{alignMessage(textAlign, splitOk)}</p>

      {/* 탐구할 의미 고르기 — 시작 의미는 추천일 뿐(가장 중요한 문장 · 취약점 판정 아님) */}
      <div className={styles.cmpFilters} role="group" aria-label="탐구할 의미" data-testid="ms-units">
        {view.units.map((u) => (
          <button key={u.id} type="button" aria-pressed={u.id === unit?.id} onClick={() => onSelectUnit(u.id)} data-testid="ms-unit" data-unit={u.id}>
            {u.labelKo} <span className={styles.quiet}>({u.sentences.join(' · ')}번)</span>
          </button>
        ))}
      </div>

      <div className={styles.cmpFilters} role="group" aria-label="설명 깊이" data-testid="ms-depth">
        {DEPTHS.map((d) => (
          <button key={d} type="button" aria-pressed={depth === d} onClick={() => onDepth(d)} data-depth={d}>{DEPTH_LABEL[d]}</button>
        ))}
      </div>
      </div>

      {pick ? (
        // 지도 문장 선택 — 이전 의미 · 관계 설명을 접고, 그 문장에 대해 검수된 것만 말한다(설명을 지어내지 않는다)
        <div className={styles.msCard} role="status" data-testid="ms-pick" data-count={pick.unitIds.length} data-sentence={pick.n}>
          {pick.unitIds.length === 0 ? (
            <p className="break-keep">{pick.n}번 문장에는 아직 검수된 탐구 설명이 없어요. 지도에는 이 문장 위치만 비춰 둘게요.</p>
          ) : (
            <>
              <p className="break-keep">{pick.n}번 문장은 여러 의미에 걸쳐 있어요 — 어느 의미로 볼지 고르세요.</p>
              <div className={styles.cmpFilters} role="group" aria-label={`${pick.n}번 문장이 걸린 의미`}>
                {pick.unitIds.map((id) => (
                  <button key={id} type="button" onClick={() => onSelectUnit(id)} data-testid="ms-pick-unit" data-unit={id}>
                    {view.units.find((u) => u.id === id)?.labelKo ?? id}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : unit ? (
        <article className={styles.msCard} data-testid="ms-explain" data-unit={unit.id}>
          <p className={`${styles.msSpeakRow} break-keep`}>
            <span className={styles.diagramLabel}>{unit.sentences.join(' · ')}번 문장</span>
            <button
              type="button"
              className={styles.back}
              aria-pressed={narration.group === `unit:${unit.id}` && narration.status === 'playing'}
              onClick={() => void narration.play(`unit:${unit.id}`, unitNarration(view, unit))}
              data-testid="ms-unit-speak"
            >
              {narration.group === `unit:${unit.id}` ? (narration.status === 'loading' ? '음성 준비 중…' : narration.status === 'playing' ? '멈춤' : '이어서 듣기') : '이 의미 읽어 주기'}
            </button>
            {narration.group === `unit:${unit.id}` ? <button type="button" className={styles.back} onClick={narration.stop}>그만 듣기</button> : null}
          </p>

          {/* 구절 대응 — 영어 구절 → 문장 속 역할 → 뜻. 고르면 문제지 · 지도에 그 자리가 표시된다(대조된 경우만) */}
          {rows.length ? (
            <div data-testid="ms-phrases">
              <span className={styles.diagramLabel}>구절 대응 — 영어 구절 → 문장 속 역할 → 뜻</span>
              <ol className={styles.msPhrases}>
                {rows.map((r) => {
                  const first = r.anchorIds[0]
                  const on = r.anchorIds.includes(phraseId ?? '')
                  return (
                    <li key={r.key}>
                      <button type="button" aria-pressed={on} onClick={() => onPhrase(on ? null : first)} data-testid="ms-phrase" data-anchor={first} className={styles.msPhrase}>
                        <span className={styles.msPhraseEn}>
                          {r.anchorIds.map((id) => {
                            const e = english(id)
                            const a = anchor(id)
                            return e ? (
                              <q key={id} lang="en" data-from={e.from} data-testid="ms-phrase-en">{e.text}</q>
                            ) : (
                              <span key={id} className={styles.quiet} data-testid="ms-phrase-noen">
                                ({a?.sentence ?? '?'}번 문장 일부{textAlign.state === 'mismatch' ? ' — 원문이 달라 표시 안 함' : ' — 문제지를 놓으면 보여요'})
                              </span>
                            )
                          })}
                        </span>
                        <span aria-hidden className={styles.msArrow}>→</span>
                        {/* 역할 칸은 늘 둔다(없으면 빈 칸) — 열이 밀려 영어가 한 단어씩 꺾이지 않게 */}
                        <span>{r.role ? <span className={styles.epistemic}>{ROLE_LABEL[r.role] ?? r.role}</span> : null}</span>
                        <span className="break-keep">{r.meaningKo}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
              {unit.syntax ? <p className="break-keep"><span className={styles.diagramLabel}>구절을 다시 합친 뜻</span>{unit.syntax.recombinedKo}</p> : null}
            </div>
          ) : null}
          <p className="break-keep" data-speaking={narration.currentKey === `unit:${unit.id}:exact` ? 'true' : undefined}><span className={styles.diagramLabel}>정확한 뜻</span>{unit.exactKo}</p>
          <p className="break-keep" data-speaking={narration.currentKey === `unit:${unit.id}:simple` ? 'true' : undefined}><span className={styles.diagramLabel}>쉬운 말</span>{unit.simpleKo}</p>
          {unit.preserves.length ? (
            <div data-testid="ms-preserves" data-speaking={narration.currentKey === `unit:${unit.id}:preserve` ? 'true' : undefined}>
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
              <span className={styles.diagramLabel}>구절이 어떻게 묶이나</span>
              {unit.syntax.attachments.map((a, i) => (<p key={i} className="break-keep">{a.whyKo}</p>))}
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
                <button key={r.id} type="button" aria-pressed={r.id === relation?.id} onClick={() => onSelectRelation(r.id === relation?.id ? null : r.id)} data-testid="ms-relation-pick" data-relation={r.id}>
                  {r.from.includes(unit.id) ? '뒤와의 연결' : '앞과의 연결'} · {r.changeKo.slice(0, 18)}…
                </button>
              ))}
            </div>
          ) : null}
          {relation ? <MeaningRelationView view={view} relation={relation} onPickUnit={(id) => onSelectUnit(id)} /> : null}

          <MeaningDraft key={unit.id} unit={unit} text={draft} onChange={onDraft} />

          <p className={styles.cmpActions}>
            <button type="button" className={styles.back} onClick={() => onGo('judgment')} data-testid="ms-go-judgment" data-choices={bridge.choices.join(',')}>
              문항 성립에서 보기{bridge.choices.length ? ` (선택지 ${bridge.choices.join(' · ')})` : ''}
            </button>
            <button type="button" className={styles.back} onClick={() => onGo('design')} data-testid="ms-go-design" data-claims={bridge.claims.join(',')}>
              설계 재구성에서 보기{bridge.claims.length ? ` (근거 ${bridge.claims.length}개)` : ''}
            </button>
          </p>
        </article>
      ) : (
        <p className={`${styles.msCard} ${styles.quiet}`}>위에서 탐구할 의미를 고르거나, 왼쪽 지문 지도에서 문장 번호를 눌러 보세요.</p>
      )}

      {/* 깊이 탐구 — 원문 · 가능한 해석 · 지원되지 않는 확대를 나눠 본다(다루지 않는 범위는 확대 칸에 함께) */}
      {showDeep ? <MeaningBoundaryView view={view} onTrace={onTrace} /> : null}
    </section>
  )
}
