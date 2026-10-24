// apps/web/src/components/csat/theater/inquiry/Interactive34.tsx
'use client'

import { useRef, useState } from 'react'
import { choicesForMeaning, meaningsForChoice, replaceComparison, RESOURCE_STATE_TEXT, storedProposition, type InquiryResourceState } from '@/lib/csat/inquiry/interactive-34'
import { BASIS_LABEL, CONTENT_TRUTH_LABEL, FIT_LABEL, SCOPE_LABEL, type InquiryV3 } from '@/lib/csat/inquiry/labels'
import styles from '../theater.module.css'

const NUMBERS = ['', '①', '②', '③', '④', '⑤']
const QUALIFIERS = [{ id: 'm3', label: 'Ideally' }, { id: 'm2', label: 'If' }, { id: 'm1', label: 'cannot be' }] as const
const buttonClass = `${styles.evidenceBtn} min-h-[44px] min-w-[44px] break-keep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`

/** 서버 공개 판정만 전달한다. 누락·조회 대기·거절은 모두 비공개다. 로컬 탐색으로 변경하지 않는다. */
export type InquiryDisclosure = { answerRevealed?: boolean }
export function InquiryDisclosureNotice() {
  return <p role="status" className="break-keep" data-testid="s2b-undisclosed">정답 공개 후에 판단 도구를 볼 수 있어요.</p>
}

export function InquiryResourceNotice({ state }: { state: InquiryResourceState }) {
  return <p className="break-keep" role="status" data-resource-state={state}>{RESOURCE_STATE_TEXT[state]}</p>
}

/** 발문과 한정의 서로 다른 범위를 선택해 대조한다. 부모의 장면/포커스/스크롤은 움직이지 않는다. */
export function Scope34({ v3, answerRevealed = false }: { v3: InquiryV3 } & InquiryDisclosure) {
  const [scope, setScope] = useState<string>('task')
  const meaning = v3.meanings.find((m) => m.id === scope)
  if (answerRevealed !== true) return <InquiryDisclosureNotice />
  return <section className={`${styles.diagram} break-keep`} aria-label="발문과 한정 범위 대조" data-testid="s2b-scope">
    <p className={styles.diagramHead}><b>무엇이 어디까지 한정하나요?</b><span className={styles.epistemic}>기존 공개 분석 · 선택은 채점하지 않아요</span></p>
    <div className={styles.choicePick} role="group" aria-label="발문 또는 한정 고르기">
      <button type="button" aria-pressed={scope === 'task'} onClick={() => setScope('task')}>발문 범위</button>
      {QUALIFIERS.map((q) => <button type="button" key={q.id} lang="en" aria-pressed={scope === q.id} onClick={() => setScope(q.id)}>{q.label}</button>)}
    </div>
    <div aria-live="polite" aria-atomic="true">
      {scope === 'task' ? <><p>{v3.requirement.requested}</p><p className={styles.quiet}>읽을 범위 · {v3.requirement.reading_scope}</p></> : meaning ? <>
        <p><b>{SCOPE_LABEL[meaning.scope.kind]}</b> · <span lang="en">{meaning.expression}</span></p>
        <p>{meaning.scope.note}</p><p className={styles.quiet}>등록 근거 · {meaning.sentences.join(' · ')}번 문장</p>
      </> : <InquiryResourceNotice state="UNREGISTERED" />}
    </div>
  </section>
}

type Props = { v3: InquiryV3; onEvidence: (sentences: number[], key: string) => void; linkable: boolean; sourceUnitsHash?: string; initialChoices?: number[] } & InquiryDisclosure

/** 공개 후 분석 전용. 공식 영어 선지/원문을 생성하지 않고 저장 한국어 명제 두 개를 비교한다. */
export function Compare34({ v3, onEvidence, linkable, sourceUnitsHash, initialChoices = [], answerRevealed = false }: Props) {
  const [pair, setPair] = useState<[number, number]>(() => {
    const valid = [...new Set([...initialChoices, 1, 3].filter((n) => v3.choices.some((c) => c.n === n)))]
    return [valid[0] ?? 1, valid[1] ?? 3]
  })
  const [condition, setCondition] = useState(0)
  const [meaningId, setMeaningId] = useState<string | null>(null)
  const origin = useRef<HTMLButtonElement | null>(null)
  const conditionText = v3.requirement.conditions[condition]
  const meaning = v3.meanings.find((m) => m.id === meaningId)
  const related = meaning ? choicesForMeaning(v3, meaning.id).map((c) => c.n) : []
  // 문장 수 일치만으로는 결속 증명이 안 된다. 부모가 실제 units_hash를 전달하기 전에는 외부 강조 보류.
  const canLink = linkable && Boolean(sourceUnitsHash) && sourceUnitsHash === v3.units_hash
  if (answerRevealed !== true) return <InquiryDisclosureNotice />
  return <section className={`${styles.diagram} break-keep`} aria-label="완성 명제 두 개 대조" data-testid="s2b-compare">
    <p className={styles.diagramHead}><b>같은 조건으로 두 명제를 대조하세요</b><span className={styles.epistemic}>정답 공개 후 분석</span></p>
    <p className={styles.quiet}>기존 분석에 인용된 한국어 완성 명제입니다. 공식 영어 선지 전문은 문제지에서 확인하세요.</p>
    <section aria-label="조건·한정 관계" data-testid="s2b-qualifiers">
    <div className={styles.choicePick} role="group" aria-label="대조할 조건 고르기">
      {v3.requirement.conditions.map((c, i) => <button type="button" key={c} aria-pressed={condition === i} onClick={(e) => { origin.current = e.currentTarget; setCondition(i); setMeaningId(['m1', 'm2', 'm3'][i] ?? null) }}>조건 {i + 1}</button>)}
    </div>
    <p className={styles.msWholeResult} aria-live="polite" data-testid="s2b-condition">{conditionText ?? RESOURCE_STATE_TEXT.NO_DATA}</p>
    </section>
    <div className="grid grid-cols-2 gap-3" data-testid="s2b-columns">
      {pair.map((n, side) => {
        const c = v3.choices.find((x) => x.n === n)
        if (!c) return <InquiryResourceNotice key={side} state="NO_DATA" />
        const links = meaningsForChoice(v3, n)
        return <section key={side} className={`${styles.designRow} min-w-0`} aria-label={`${side === 0 ? '왼쪽' : '오른쪽'} 비교 명제`}>
          <div className={styles.choicePick} role="group" aria-label={`${side === 0 ? '왼쪽' : '오른쪽'} 선택지 고르기`}>
            {v3.choices.map((x) => <button type="button" key={x.n} aria-pressed={n === x.n} onClick={() => { setPair(replaceComparison(pair, side as 0 | 1, x.n)); setMeaningId(null) }}>{NUMBERS[x.n]}</button>)}
          </div>
          <p><b>{NUMBERS[n]} · {c.selected_as_answer ? '공식 정답' : '정답 아님'}</b></p>
          <p data-testid="s2b-proposition">{storedProposition(c.decisive) ?? '저장된 완성 명제 인용이 없어요.'}</p>
          <p className={styles.quiet}>같이 적용하는 조건 · {conditionText}</p>
          <dl className={styles.judgeGrid}>
            <div><dt>내용 진위</dt><dd>{CONTENT_TRUTH_LABEL[c.content_truth]}</dd></div>
            <div><dt>발문 요구</dt><dd>{FIT_LABEL[c.requirement_fit]}</dd></div>
          </dl>
          {meaning && related.includes(n) ? <p>{c.decisive}</p> : null}
          <div className="flex flex-wrap gap-1" role="group" aria-label={`${NUMBERS[n]} 등록 의미 관계`}>
            {links.map((m) => <button type="button" key={m.id} className={buttonClass} aria-pressed={meaningId === m.id} onClick={(e) => { origin.current = e.currentTarget; setMeaningId(m.id) }}>{m.expression}</button>)}
            {!links.length ? <InquiryResourceNotice state="UNREGISTERED" /> : null}
          </div>
          {canLink ? <button type="button" className={buttonClass} onClick={() => onEvidence(c.sentences, `choice-${n}`)}>근거 {c.sentences.join(' · ')}번 문장 보기</button> : null}
        </section>
      })}
    </div>
    <section className={styles.msRelation} aria-live="polite" aria-label="본문 근거 연결" data-testid="s2b-relation">
      {meaning ? <><p><b>원문 관찰 · {meaning.expression}</b> → 등록 선지 {related.map((n) => NUMBERS[n]).join(' · ')}</p>
        <p>{meaning.meaning_ko}</p><p>{meaning.scope.note}</p>
        <p>등록 근거 · {meaning.sentences.join(' · ')}번 문장</p>
        {canLink ? <button type="button" className={buttonClass} onClick={() => onEvidence(meaning.sentences, meaning.expression)}>이 관계의 본문 근거 보기</button> : null}
        <p>현재 비교 · {pair.map((n) => `${NUMBERS[n]} ${related.includes(n) ? '연결 있음' : '연결 미등록'}`).join(' / ')}</p>
        <button type="button" className={buttonClass} onClick={() => { origin.current?.focus(); setMeaningId(null) }}>선택한 관계로 돌아가기</button>
      </> : <p>명제 아래 표현을 골라, 그 의미가 연결된 선택지를 역으로 확인하세요.</p>}
    </section>
    {!canLink ? <p className={styles.quiet} data-testid="s2b-source-binding">원문 결속 확인 전에는 외부 근거 강조를 보류해요. 등록 문장 위치와 문제지를 직접 대조하세요.</p> : null}
    <p className={styles.quiet}>다른 문항과의 비교 자료가 없어요. 이 탐색으로 전이 완료나 숙달을 판정하지 않아요.</p>
  </section>
}

export function Design34({ v3, initialClaims = [], answerRevealed = false }: { v3: InquiryV3; initialClaims?: number[] } & InquiryDisclosure) {
  const [pick, setPick] = useState<number | null>(() => initialClaims.find((i) => v3.design.claims[i]) ?? null)
  const claim = pick === null ? null : v3.design.claims[pick]
  if (answerRevealed !== true) return <InquiryDisclosureNotice />
  return <section className={`${styles.diagram} break-keep`} aria-label="관찰과 설계 해석 대조">
    <p className={styles.diagramHead}><b>어떤 근거 수준의 설명인가요?</b></p>
    <div className={styles.choicePick} role="group" aria-label="확인할 설계 근거 고르기">
      {v3.design.claims.map((c, i) => <button type="button" key={i} aria-pressed={pick === i} data-bridge={initialClaims.includes(i) ? 'true' : undefined} onClick={() => setPick(i)}>{BASIS_LABEL[c.basis]} {i + 1}{initialClaims.includes(i) ? ' · 이 의미' : ''}</button>)}
    </div>
    {claim ? <div aria-live="polite"><p><b>{BASIS_LABEL[claim.basis]}</b> · {claim.text}</p><p>등록 근거 · {claim.sentences?.length ? `${claim.sentences.join(' · ')}번 문장` : '문장 연결 없음'}</p></div> : <p>관찰과 가설을 골라 아래 적용 한계와 대조하세요.</p>}
    <p><b>확인하지 못한 부분 · 적용 한계</b> {v3.design.limitation}</p>
  </section>
}
