// apps/web/src/lib/csat/k-regression/gaps.ts
//
// 대량작업 K 결함 등록부 — 재현 테스트(k-repro)와 목표 동작 테스트(k-targets)가 같은 id 로 묶인다.
// open  : 재현 테스트가 「결함이 지금 있다」를 단언하고, 목표 동작 테스트는 skip(PASS 아님)으로 남는다.
// fixed : owner 가 고친 뒤 이 값을 바꾼다 — 재현 테스트는 빠지고 목표 동작 테스트가 회귀 검사로 돈다.
// 재현 테스트가 빨개지면 결함이 사라졌거나 재현 조건이 바뀐 것이다 → 목표 동작 테스트를 켜서 확인한 뒤 fixed 로 옮긴다.
// 테스트 통과는 결함 해결이 아니다: open 결함의 재현 PASS 는 「결함 확인」이다.

export type GapStatus = 'open' | 'fixed'

export interface Gap {
  status: GapStatus
  /** 인계 대상 owner(AI-Control owner_id 또는 역할) */
  owner: string
  summary: string
}

export const K_GAPS = {
  'K2-a': { status: 'open', owner: 'csat-lecture-disclosure (정답 공개)', summary: 'leakedAnswerKeys 가 이름 목록에만 의존 — is_correct · answer_no · correctIndex 별칭을 놓친다' },
  'K3-a': { status: 'open', owner: 'G 데이터 정합성', summary: 'RevealData 에 units 해시가 없어 같은 판본 번호 · 다른 본문을 구별하지 못한다' },
  'K4-a': { status: 'open', owner: '문항 데이터 · 판단 도구(csat-judgment-d)', summary: 'checkReveal 이 answer 와 어긋나는 verdict=correct 선지(복수 정답 형태)를 거절하지 않는다' },
  'K6-a': { status: 'open', owner: 'P6 · 학습기록', summary: '독립 판정 DB 함수는 같은 item_ref 만, 앱 노출 원장은 같은 지문 해시까지 노출로 본다 — 기준 불일치' },
  'K6-b': { status: 'open', owner: 'P6 · 학습기록', summary: '앱 평가용 노출 원장(loadExposureLedger)이 P6 learning_exposures(정답 직접 노출)를 읽지 않는다 — 정답을 본 문항이 독립 평가 후보로 남는다' },
} as const satisfies Record<string, Gap>

export type GapId = keyof typeof K_GAPS

/** 넓은 GapStatus 로 읽는다 — as const 라 지금 값(open)으로 좁혀지면 fixed 분기가 타입 오류가 된다 */
export const statusOf = (id: GapId): GapStatus => K_GAPS[id].status
export const isOpen = (id: GapId) => statusOf(id) === 'open'
