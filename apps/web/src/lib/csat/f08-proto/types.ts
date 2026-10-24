// apps/web/src/lib/csat/f08-proto/types.ts
//
// F08 화면 후보 비교 프로토타입(대량작업 J)의 데이터 계약. 클라이언트와 서버가 함께 쓴다.
// 공개 전 묶음(ProtoItem)에는 정답·선지 판정·정답을 말하는 강의 큐가 **들어가지 않는다** —
// 그것들은 학습자가 공개를 고른 뒤 ProtoReveal 로만 온다(`leak.ts` 가 검사한다).

export type CandidateId = 'a' | 'b' | 'c'

export const CANDIDATES: readonly { id: CandidateId; name: string; idea: string }[] = [
  { id: 'a', name: '원문 중심 + 판단 도구 선택', idea: '원문을 읽다가 필요한 도구 하나만 펼친다' },
  { id: 'b', name: '원문·선지·근거 병렬 비교', idea: '두 선지의 완성 명제와 근거 문장을 나란히 대 본다' },
  { id: 'c', name: '원문·강의·판단 연동', idea: '강의 큐가 원문을 짚고, 멈춘 자리에서 판단을 기록한다' },
]

export type ScopeKind = 'negation' | 'condition' | 'none'

export interface ProtoMeaning {
  id: string
  sentence: number // 1부터
  expression: string
  meaningKo: string
  scope: ScopeKind
  scopeNote: string
}

export interface ProtoCue {
  id: string
  role: string
  sentence: number | null // 1부터, 원문을 짚지 않으면 null
  lines: { lang: 'ko-KR' | 'en-US'; text: string }[]
}

export interface ProtoItem {
  itemId: string
  stem: string
  sentences: string[] // 1번 문장 = sentences[0]
  blankSentence: number
  choices: string[]
  requirement: { requested: string; conditions: string[]; readingScope: string }
  meanings: ProtoMeaning[]
  lecture: { state: 'ready'; cues: ProtoCue[]; lockedCount: number; review: 'unverified' } | { state: 'missing' }
  provenance: { passageSha256: string; analysisVersion: number; review: string; unitsHash: string }
}

export type Truth = 'true' | 'false' | 'unknown'

export interface ProtoChoiceVerdict {
  n: number
  isAnswer: boolean
  truth: Truth
  decisive: string
  sentences: number[]
}

export interface ProtoReveal {
  answer: number
  verdicts: ProtoChoiceVerdict[]
  claims: { basis: string; text: string }[]
  principle: { statement: string; whenApplies: string[]; whenNot: string[] }
  limitation: string
  cues: ProtoCue[]
}

/** 학습자가 스스로 남기는 판단 — 채점하지 않는다. */
export type OwnMark = 'fits' | 'fails' | 'unsure'

export const MARK_LABEL: Record<OwnMark, string> = { fits: '맞을 것 같다', fails: '아닐 것 같다', unsure: '모르겠다' }
