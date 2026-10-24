// apps/web/src/lib/csat/listening/fixtures/types.ts
//
// 근거 추적 도구(I5) 전용 어댑터 타입. 계약(`../types.ts`)의 `ListeningItem` 은 선지 5개 · 정답 · 선지 근거를 요구하지만
// 로컬·DB 어디에도 듣기 선지 문구 · 표 행이 없다(docs/csat-listening/readiness.json · choices DATA_GAP).
// 그래서 계약은 고치지 않고, 실재하는 층(발화 · 근거 구간 · 음원 표지 · 출처)은 계약 타입 그대로 쓰고,
// 없는 선지 층은 `choiceLayer: BLOCKED_EVIDENCE` 로 막는다. 학습자가 다루는 후보(이유 카드 · 표 행)는
// 출처를 `candidatesSource` 로 밝힌다 — 대본에서 뽑은 것인지, 테스트용 합성 재구성인지.

import type { ChoiceNo, EvidenceSpan, ListeningAudioSource, ListeningItem, ListeningProvenance, ListeningUtterance } from '../types'

export type TraceMode = 'table-filter' | 'cause-elimination'
export type CandidateVerdict = 'eliminated' | 'remaining'
export type CandidatesSource = 'transcript-derived' | 'synthetic-reconstruction'

export interface TraceCandidate {
  id: string
  /** 화면에 보이는 짧은 이름(행 이름 · 이유 카드) */
  label: string
  /** 표 모드에서 열 값(candidateColumns 순서) */
  cells?: string[]
  /** 분석 기준 판정 — L4 이상에서만 보인다 */
  expected: CandidateVerdict
  /** 이 후보를 지우거나 남기는 결정 발화 — 학습자 연결과 맞대어 본다 */
  keyUtteranceIds: string[]
  evidenceIds: string[]
  /** L4 이상에서 보이는 한 줄 이유 */
  note: string
}

export interface OfficialAnswerRef {
  choice: ChoiceNo
  form: '홀수' | '짝수'
  /** 정답표 형별과 이 대본의 결속이 확인됐는가 */
  formBinding: 'UNVERIFIED' | 'VERIFIED'
  source: string
}

export type ChoiceLayer =
  | { status: 'BLOCKED_EVIDENCE'; reason: string }
  | { status: 'unverified-reconstruction'; label: '테스트용 합성 자료'; choices: string[] }

export interface ListeningTraceFixture {
  key: string
  examId: ListeningItem['examId']
  itemNo: number
  typeId: ListeningItem['typeId']
  stem: string
  speakers: string[]
  speakerLabels: Readonly<Record<string, string>>
  utterances: ListeningUtterance[]
  evidence: EvidenceSpan[]
  audio: ListeningAudioSource
  provenance: ListeningProvenance
  readiness: ListeningItem['readiness']
  /** readiness.json transcript.review */
  transcriptReview: 'NOT_VERIFIED' | 'VERIFIED'
  mode: TraceMode
  /** 학습자가 판단할 질문(유형 교수 설계 pedagogy.ts 의 prompt) */
  prompt: string
  candidatesSource: CandidatesSource
  candidateColumns?: string[]
  candidates: TraceCandidate[]
  choiceLayer: ChoiceLayer
  officialAnswer: OfficialAnswerRef | null
}
