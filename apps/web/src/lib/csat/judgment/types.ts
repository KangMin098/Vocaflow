// apps/web/src/lib/csat/judgment/types.ts
// 유형 전용 판단 도구(대량작업 D)의 공통 데이터 계약.
//
// 공개 전 계약: 도구의 초기 props 는 JudgmentItem 뿐이다. 정답 번호·선지 판정(verdict)·정답 위치는
// RevealData 에만 있고, RevealData 는 학습자가 「해설 보기」를 누른 뒤 RevealProvider 로만 받는다.
// 격리 화면에서 이 계약을 지켰다고 실제 제품 서버의 공개 제어(T-0140·T-0147 owner)가 검증되는 것은 아니다.

/** 원문 한 단위 — csat_item_units.units[*] 에서 위치(start/end)만 뺀 것 */
export type EvidenceUnit = {
  /** 'u1' … — 분석 문장의 [u3] 참조와 같은 키 */
  id: string
  /** 1부터. 분석의 sentence_index 와 같은 번호 */
  n: number
  kind: string
  text: string
}

export type ItemVersion = { unitsVersion: number; unitsHash: string; analysisVersion: number }

/** 공개 전에 화면에 넘겨도 되는 것만 담는다 — answer · verdict · answerLocus 없음 */
export type JudgmentItem = {
  id: string
  examId: string
  no: number
  typeId: string
  stem: string
  choices: string[]
  units: EvidenceUnit[]
  version: ItemVersion
}

export type ChoiceAnalysis =
  | { n: number; verdict: 'correct'; why_correct: string; confirmed_at?: { note?: string; sentence_index?: number[] } }
  | { n: number; verdict: 'distractor'; trap?: string; why_tempting?: string; how_to_reject?: string }

/** 학습자 요청 뒤에만 받는 자료 */
export type RevealData = {
  id: string
  analysisVersion: number
  unitsVersion: number
  answer: number
  designIntent?: string
  answerLocus?: { quote?: string; reasoning?: string; sentence_index?: number[] }
  choices: ChoiceAnalysis[]
}

/** 제품 연결 지점 — 공유 화면 owner 가 정답 지연 조회 API 로 구현한다 */
export type RevealProvider = (item: Pick<JudgmentItem, 'id' | 'version'>) => Promise<RevealData>

export type RevealState =
  | { status: 'hidden' }
  | { status: 'loading' }
  | { status: 'shown'; data: RevealData }
  | { status: 'error'; reason: 'fetch' | 'version' | 'shape' }

/** 판단 도구 공통 props */
export type JudgmentToolProps = {
  item: JudgmentItem
  reveal: RevealProvider
}
