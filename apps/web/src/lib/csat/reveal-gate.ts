// apps/web/src/lib/csat/reveal-gate.ts
//
// **출제 사고 화면의 공개 게이트 — 먼저 예측하고, 확정한 뒤에 대조한다.** (재설계안 v1 원칙 2 · Phase 1 · 2026-09-25)
//
// 전에는 첫 화면에 「정답 ③」 칩 · 「답이 왜 ③인가」 지도 칩 · 정답 근거 박스가 열려 있어서 학습자가
// 가설을 세울 틈이 없었다(재설계안 P1). 이제 학습자가 **근거 문장 · 정답 선지 · 확신도**를 확정해야
// 정답과 근거가 열린다. 「모르겠어요」도 확정으로 인정해 기록한다.
//
// 이 파일은 순수 함수만 둔다 — 무엇이 새는지(가리기) · 맞았는지(채점) · 무엇이 어긋났는지(차이 카드).

import type { DissectionRecord, Prediction } from './dissect'
import { topicSentences, type Pattern, type PassageDesign, type Transform } from './design'

/** 학습자가 확정한 것. null 은 「모르겠어요」. */
export interface GateCommit {
  sentence: number | null
  choice: number | null
  /** 1(찍음) ~ 5(확실) */
  confidence: number
  /** 설계 주석이 있는 문항만 — 주제문 · 구조 패턴 · 정답 표현 변환 예측(고르지 않으면 null) */
  topic?: number | null
  pattern?: Pattern | null
  transform?: Transform | null
}

export interface GateKey {
  /** 정답 선지 번호 — 모르면 null(정답 미확정 문항) */
  answer: number | null
  /** 정답 근거가 걸친 문장 번호들(0-기반) — 골격이 자리를 못 찾았으면 빈 배열 */
  evidence: number[]
  /** 출제 설계 주석(S2 · S3) — 없으면 그 칸을 묻지 않는다 */
  design?: PassageDesign | null
}

export interface GateResult {
  sentenceHit: boolean | null
  choiceHit: boolean | null
  /** 확신 4 이상인데 틀림 — 가장 학습 가치가 큰 지점이라 따로 센다 */
  overconfident: boolean
  topicHit?: boolean | null
  patternHit?: boolean | null
  transformHit?: boolean | null
}

export function grade(commit: GateCommit, key: GateKey): GateResult {
  const sentenceHit = key.evidence.length && commit.sentence != null ? key.evidence.includes(commit.sentence) : null
  const choiceHit = key.answer != null && commit.choice != null ? commit.choice === key.answer : null
  const d = key.design
  // 설계 칸은 고른 것만 채점한다 — 고르지 않은 칸은 null(틀림으로 세지 않는다)
  const topicHit = d && commit.topic != null ? topicSentences(d).includes(commit.topic) : null
  const patternHit = d && commit.pattern ? commit.pattern === d.pattern : null
  const transformHit = d && d.transform !== 'none' && commit.transform ? commit.transform === d.transform : null
  const wrong = sentenceHit === false || choiceHit === false
  return { sentenceHit, choiceHit, overconfident: wrong && commit.confidence >= 4, topicHit, patternHit, transformHit }
}

/** 이 문항에서 게이트를 이미 통과했는가 — 출제 사고 화면이 남긴 예측이 있으면 열린 채로 연다 */
export function committedOf(record: DissectionRecord, itemId: string): Prediction | null {
  const mine = record.predictions.filter((p) => p.item === itemId && p.source === 'theater')
  return mine.length ? mine[mine.length - 1] : null
}

export function toPrediction(itemId: string, typeId: string, commit: GateCommit, result: GateResult, at: number): Prediction {
  return {
    item: itemId,
    type: typeId,
    step: 1,
    // 근거 문장이 채점 가능하면 그것이 적중의 기준이다(해부 세션의 step 1 과 같은 뜻). 아니면 정답 선지.
    hit: Boolean(result.sentenceHit ?? result.choiceHit ?? false),
    at,
    source: 'theater',
    sentence: commit.sentence,
    choice: commit.choice,
    confidence: commit.confidence,
    ...(commit.topic != null ? { topic: commit.topic } : {}),
    ...(commit.pattern ? { pattern: commit.pattern } : {}),
    ...(commit.transform ? { transform: commit.transform } : {}),
  }
}

/**
 * 확정 전에 **이름만으로 답이 새는** 단계 이름을 가린다.
 *   「오답 ② 지우기」 → 어느 선지가 오답인지 · 「4번째 문장」 → 근거 문장이 어디인지 · 「①가 왜 아닌가」
 * 그 밖의 이름(재는 것 · 출제 의도 · 절차 …)은 그대로 둔다.
 */
export function maskName(name: string, kind: string): string {
  return /오답|번째 문장|왜 아닌가|[①②③④⑤]/.test(name) ? `${kind} · 확정 뒤 열림` : name
}

/** 확정 전에 보여도 되는 블록 — 문항 머리(정답 칩은 뺀다)와 「재는 것」뿐 */
export const OPEN_BEFORE_COMMIT = new Set(['head', 'ability'])

export function maskChip(text: string): boolean {
  return /^정답/.test(text)
}
