// apps/web/src/lib/csat/listening/types.ts
//
// CSAT 듣기 분석 데이터 계약(I3). 회차 id 문법은 `../exam-id.ts` 가 정본이다 — 여기서 다시 풀지 않는다.
// 유형 id 는 `scripts/csat/data/listening/*.json` 의 `typeGuess` 값과 같은 문자열을 쓴다(17종 실측 + L-EMOTION).

export const LISTENING_TYPE_IDS = [
  'L-PURPOSE',
  'L-OPINION',
  'L-MAIN',
  'L-RELATION',
  'L-PICTURE',
  'L-TODO',
  'L-FAVOR',
  'L-REASON',
  'L-MONEY',
  'L-NOTMENTION',
  'L-ANNOUNCE',
  'L-TABLE',
  'L-RESPONSE',
  'L-SITUATION',
  'L-TOPIC',
  'L-EMOTION',
  'L-SET-TOPIC',
  'L-SET-NOT',
] as const

export type ListeningTypeId = (typeof LISTENING_TYPE_IDS)[number]

/** 유형별 한국어 라벨. L-EMOTION(심정)은 현재 데이터 파일에 없는 예전 회차 유형이다 */
export const LISTENING_TYPE_LABELS: Readonly<Record<ListeningTypeId, string>> = {
  'L-PURPOSE': '말의 목적',
  'L-OPINION': '의견',
  'L-MAIN': '말의 요지',
  'L-RELATION': '두 사람의 관계',
  'L-PICTURE': '그림 불일치',
  'L-TODO': '할 일',
  'L-FAVOR': '부탁한 일',
  'L-REASON': '이유',
  'L-MONEY': '지불 금액',
  'L-NOTMENTION': '언급되지 않은 것',
  'L-ANNOUNCE': '담화 내용 불일치',
  'L-TABLE': '도표 선택',
  'L-RESPONSE': '마지막 말에 대한 응답',
  'L-SITUATION': '상황에 맞는 말',
  'L-TOPIC': '대화의 주제',
  'L-EMOTION': '심정',
  'L-SET-TOPIC': '세트 — 담화 주제',
  'L-SET-NOT': '세트 — 언급되지 않은 것',
}

export function isListeningTypeId(x: unknown): x is ListeningTypeId {
  return typeof x === 'string' && (LISTENING_TYPE_IDS as readonly string[]).includes(x)
}

export type ChoiceNo = 1 | 2 | 3 | 4 | 5

export interface ListeningUtterance {
  id: string
  /** speakers 중 하나 */
  speaker: string
  text: string
  startMs?: number
  endMs?: number
}

export type EvidenceRole = 'decisive' | 'supporting' | 'contrast'

export interface EvidenceSpan {
  id: string
  utteranceId: string
  /** utterance.text 안의 [charStart, charEnd) */
  charStart: number
  charEnd: number
  role: EvidenceRole
  supportsChoice?: ChoiceNo
  refutesChoices?: ChoiceNo[]
}

export type ChoiceVerdict = 'correct' | 'partial-match' | 'contradicted' | 'not-mentioned' | 'reversed-role' | 'wrong-speaker' | 'over-generalized'

export interface ChoiceRationale {
  choice: ChoiceNo
  verdict: ChoiceVerdict
  evidenceIds: string[]
  note?: string
}

export type AudioKind = 'official' | 'none' | 'synthetic-test-fixture'
export type AudioRights = 'verified' | 'unverified' | 'not-redistributable'

export interface ListeningAudioSource {
  kind: AudioKind
  url?: string
  sha256?: string
  rights: AudioRights
}

export type ReviewStatus = 'draft' | 'machine-checked' | 'human-reviewed'

export interface ListeningProvenance {
  /** 전사 출처(예: 'kice-official-script', 'asr', 'manual') */
  transcriptSource: string
  sha256: string
  reviewStatus: ReviewStatus
}

/** 서버·DB 결속이 확인되지 않은 상태를 UI 가 그대로 보여 주기 위한 표지 */
export type ListeningReadiness = 'server-db-unverified' | 'local-fixture'

export interface ListeningItem {
  /** `../exam-id.ts` 문법의 회차 id(`2023` · `M2109` · `H2503G1`) */
  examId: string
  itemNo: number
  typeId: ListeningTypeId
  stem: string
  /** 정확히 5개 — 인덱스 i 가 선지 i+1 */
  choices: string[]
  answer: ChoiceNo
  speakers: string[]
  utterances: ListeningUtterance[]
  evidence: EvidenceSpan[]
  rationales: ChoiceRationale[]
  audio: ListeningAudioSource
  provenance: ListeningProvenance
  readiness: ListeningReadiness
}
