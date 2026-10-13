// apps/web/src/components/csat/theater/InquiryV3Panels.tsx
'use client'
//
// **v3 의미 · 판단 · 설계 패널 — 같은 근거 문장으로 원문 의미 → 발문 요구 → 선택지 성립 → 설계 해석을 잇는다.** (v3 M2)
//
// 근거 버튼을 누르면 부모가 왼쪽 지문 지도의 그 문장을 비춘다(onEvidence · 자동 재생 없음). 원문 분할이 작성 때와 다르면
// 부모가 `linkable=false` 를 넘기고, 근거 버튼 대신 「문장 대응 확인 중」을 보인다(잘못된 문장을 비추지 않는다).
// 데이터는 독립 검수(verified)를 지난 문항에만 온다. 정답 선정 · 내용 참거짓 · 발문 충족은 세 칸으로 따로 보인다.
// 설계 칸은 근거 수준(공식 · 원문 관찰 · 설계 가설)을 항목마다 밝힌다 — 실제 출제 과정의 기록이라고 말하지 않는다.

import { useState } from 'react'

import { BASIS_LABEL, CONTENT_TRUTH_LABEL, FIT_LABEL, PRINCIPLE_LEVEL_LABEL, SCOPE_LABEL, type InquiryV3, type V3PairView } from '@/lib/csat/inquiry/labels'

import styles from './theater.module.css'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']
const VERIFIED = '독립 검수'

type Evidence = (sentences: number[], label: string) => void

function EvidenceButton({ sentences, label, onEvidence, linkable, selected }: { sentences: number[]; label: string; onEvidence: Evidence; linkable: boolean; selected: boolean }) {
  if (!sentences.length) return null
  const text = `${sentences.join(' · ')}번 문장`
  if (!linkable) return <span className={styles.quiet}>{text}(문장 대응 확인 중)</span>
  return (
    <button type="button" className={styles.evidenceBtn} aria-pressed={selected} onClick={() => onEvidence(sentences, label)} data-testid="v3-evidence" data-key={label}>
      근거 {text} 보기
    </button>
  )
}

export function V3Task({ v3 }: { v3: InquiryV3 }) {
  const r = v3.requirement
  return (
    <section className={styles.diagram} aria-label="발문이 요구하는 판단" data-testid="v3-task">
      <p className={styles.diagramHead}>
        <b>발문이 요구하는 판단</b>
        <span className={styles.epistemic}>{r.polarity === 'negative' ? '부정형 발문' : '긍정형 발문'}</span>
      </p>
      <p className="break-keep">{r.requested}</p>
      <ul className={styles.plainList}>
        {r.conditions.map((c, i) => (
          <li key={i} className="break-keep">
            {c}
          </li>
        ))}
      </ul>
      {r.reading_scope ? <p className={styles.quiet}>읽을 범위 · {r.reading_scope}</p> : null}
    </section>
  )
}

export function V3Meaning({ v3, onEvidence, linkable, selectedKey }: { v3: InquiryV3; onEvidence: Evidence; linkable: boolean; selectedKey: string | null }) {
  return (
    <section className={styles.diagram} aria-label="원문의 실제 의미와 범위" data-testid="v3-meaning">
      <p className={styles.diagramHead}>
        <b>핵심 표현의 문맥 의미 · 범위</b>
        <span className={styles.epistemic}>원문에서 확인 · {VERIFIED}</span>
      </p>
      {v3.meanings.map((m) => (
        <div key={m.id} className={styles.designRow} data-meaning={m.id}>
          <p className="break-keep">
            <b lang="en">{m.expression}</b> — {m.meaning_ko}
          </p>
          {m.scope.kind !== 'none' ? (
            <p className="break-keep">
              <span className={styles.diagramLabel}>{SCOPE_LABEL[m.scope.kind]}</span>
              {m.scope.note}
            </p>
          ) : null}
          <EvidenceButton sentences={m.sentences} label={m.expression} onEvidence={onEvidence} linkable={linkable} selected={selectedKey === m.expression} />
        </div>
      ))}
    </section>
  )
}

/**
 * v3.1 원문 이해에서 이어 온 맥락 — 그 의미(unit)가 걸린 선택지 · 설계 근거만 표시한다(검수된 bridges).
 * 일반 장면 이동과 구별된다: 해당 선택지를 먼저 열고, 걸린 설계 근거를 표시하고, 원래 의미로 돌아갈 길을 준다.
 */
export interface MeaningBridgeFocus {
  unitLabel: string
  choices: number[]
  claims: number[]
  onReturn: () => void
}

function BridgeBanner({ focus, what }: { focus: MeaningBridgeFocus; what: string }) {
  return (
    <div className={styles.msBridge} role="note" data-testid="ms-bridge">
      <p className="break-keep">
        원문 이해 「{focus.unitLabel}」에서 왔어요 — {what}
      </p>
      <button type="button" className={styles.back} onClick={focus.onReturn} data-testid="ms-bridge-return">
        그 의미로 돌아가기
      </button>
    </div>
  )
}

export function V3Judgment({ v3, onEvidence, linkable, selectedKey, focus = null }: { v3: InquiryV3; onEvidence: Evidence; linkable: boolean; selectedKey: string | null; focus?: MeaningBridgeFocus | null }) {
  const answer = v3.choices.find((c) => c.selected_as_answer)?.n ?? v3.choices[0]?.n ?? 1
  // 원문 이해에서 왔으면 그 의미가 걸린 첫 선택지부터 연다(부모가 focus 마다 key 를 바꿔 다시 연다)
  const restored = selectedKey ? /^choice-(\d)$/.exec(selectedKey) : null
  const restoredPick = restored && v3.choices.some((c) => c.n === Number(restored[1])) ? Number(restored[1]) : null
  const [pick, setPick] = useState<number>(focus?.choices.find((n) => v3.choices.some((c) => c.n === n)) ?? restoredPick ?? answer)
  const c = v3.choices.find((x) => x.n === pick) ?? v3.choices[0]
  if (!c) return null
  const meanings = v3.meanings.filter((m) => (c.meaning_ids ?? []).includes(m.id))
  return (
    <section className={styles.diagram} aria-label="선택지별 성립 조건" data-testid="v3-judgment">
      <p className={styles.diagramHead}>
        <b>선택지 하나씩 — 무엇이 이 판단을 가르나</b>
        <span className={styles.epistemic}>{VERIFIED}</span>
      </p>
      {focus ? (
        <BridgeBanner focus={focus} what={focus.choices.length ? `이 의미가 걸린 선택지 ${focus.choices.map((n) => CIRCLED[n] ?? n).join(' · ')}` : '이 의미가 걸린 선택지는 검수 기록에 없어요'} />
      ) : null}
      <div className={styles.choicePick} role="group" aria-label="선택지 고르기">
        {v3.choices.map((x) => (
          <button key={x.n} type="button" aria-pressed={x.n === pick} onClick={() => setPick(x.n)} data-choice={x.n} data-bridge={focus?.choices.includes(x.n) ? 'true' : undefined}>
            {CIRCLED[x.n] ?? x.n}
            {x.selected_as_answer ? <span className={styles.roleAlt}> 정답</span> : null}
            {focus?.choices.includes(x.n) ? <span className={styles.roleAlt}> · 이 의미</span> : null}
          </button>
        ))}
      </div>
      <dl className={styles.judgeGrid} data-testid="v3-choice">
        <div>
          <dt>정답 선정</dt>
          <dd>{c.selected_as_answer ? '공식 정답' : '정답 아님'}</dd>
        </div>
        <div>
          <dt>내용</dt>
          <dd>{CONTENT_TRUTH_LABEL[c.content_truth]}</dd>
        </div>
        <div>
          <dt>발문 요구</dt>
          <dd>{FIT_LABEL[c.requirement_fit]}</dd>
        </div>
      </dl>
      <p className="break-keep">
        <span className={styles.diagramLabel}>결정 조건</span>
        {c.decisive}
      </p>
      {meanings.length ? (
        <p className={styles.quiet}>
          관련 의미 · {meanings.map((m) => m.expression).join(' · ')}
        </p>
      ) : null}
      <EvidenceButton sentences={c.sentences} label={`choice-${c.n}`} onEvidence={onEvidence} linkable={linkable} selected={selectedKey === `choice-${c.n}`} />
    </section>
  )
}

export function V3Design({ v3, onEvidence, linkable, selectedKey, focus = null }: { v3: InquiryV3; onEvidence: Evidence; linkable: boolean; selectedKey: string | null; focus?: MeaningBridgeFocus | null }) {
  return (
    <section className={styles.diagram} aria-label="관찰에서 설계 해석으로" data-testid="v3-design">
      <p className={styles.diagramHead}>
        <b>관찰한 근거 → 설계 해석</b>
        <span className={styles.epistemic}>항목마다 근거 수준 표시</span>
      </p>
      {focus ? (
        <BridgeBanner focus={focus} what={focus.claims.length ? `이 의미가 받치는 설계 근거 ${focus.claims.length}개를 표시했어요` : '이 의미가 받치는 설계 근거는 검수 기록에 없어요'} />
      ) : null}
      {v3.design.claims.map((cl, i) => (
        <div key={i} className={`${styles.designRow} ${focus?.claims.includes(i) ? styles.msBridged : ''}`} data-basis={cl.basis} data-bridge={focus?.claims.includes(i) ? 'true' : undefined} data-testid="v3-design-claim">
          {focus?.claims.includes(i) ? <span className={styles.diagramLabel}>이 의미가 받치는 근거</span> : null}
          <p className="break-keep">
            <span className={styles.diagramLabel}>{BASIS_LABEL[cl.basis]}</span>
            {cl.text}
          </p>
          {cl.sentences?.length ? (
            <EvidenceButton sentences={cl.sentences} label={`claim-${i}`} onEvidence={onEvidence} linkable={linkable} selected={selectedKey === `claim-${i}`} />
          ) : null}
        </div>
      ))}
      <p className="break-keep">
        <span className={styles.diagramLabel}>확인하지 못한 부분</span>
        {v3.design.limitation}
      </p>
    </section>
  )
}

/** 조건부 원리 수준(M4) — 이 문항 원리는 candidate, 검수된 쌍이 지지하면 bounded. 비교를 눌렀는지와 무관하게 보인다 */
export function V3PrincipleLevels({ hasCandidate, pairs }: { hasCandidate: boolean; pairs: V3PairView[] }) {
  const bounded = pairs.filter((p) => p.principle)
  if (!hasCandidate && !bounded.length) return null
  return (
    <section className={styles.diagram} aria-label="원리의 지지 수준" data-testid="v3-principle-levels">
      {hasCandidate ? (
        <p className="break-keep" data-level="candidate">
          <span className={styles.diagramLabel}>{PRINCIPLE_LEVEL_LABEL.candidate}</span>
          위 원리는 이 문항 하나로 확인한 것이에요. 다른 문항에서는 같은 조건이 있을 때만 통해요.
        </p>
      ) : null}
      {bounded.map((p) => (
        <div key={p.pairId} className={styles.designRow} data-level="bounded" data-testid="v3-principle-bounded">
          <p className="break-keep">
            <span className={styles.diagramLabel}>{PRINCIPLE_LEVEL_LABEL.bounded}</span>
            {p.principle!.statement} <span className={styles.quiet}>(이 문항 · {p.otherLabel})</span>
          </p>
          <p className="break-keep"><span className={styles.diagramLabel}>통하는 조건</span>{p.principle!.when_applies.join(' · ')}</p>
          <p className="break-keep"><span className={styles.diagramLabel}>쓰면 안 되는 조건</span>{p.principle!.when_not.join(' · ')}</p>
        </div>
      ))}
    </section>
  )
}
