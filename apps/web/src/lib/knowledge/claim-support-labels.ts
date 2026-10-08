// apps/web/src/lib/knowledge/claim-support-labels.ts
// 「주장과 근거 연결」 과제의 관계 유형 · 학습자 문구(클라이언트에서도 쓴다 — 아무것도 import 하지 않는다)
export const RELATIONS = ['reason', 'example', 'restatement', 'opposed'] as const
export type Relation = (typeof RELATIONS)[number]
/** 학습자에게 보이는 말 — 연구 용어를 쓰지 않는다 */
export const RELATION_LABEL: Record<Relation, string> = {
  reason: '이유 · 조건을 대며 주장을 떠받친다',
  example: '예를 들어 주장을 보여 준다',
  restatement: '주장을 다른 말로 다시 한다',
  opposed: '필자가 반박하는 생각이다',
}

/** 학습자에게 보이는 「무엇을 · 왜」 — 관리자 항목 문장(연구 단서 · 효과 미확인 표기)을 그대로 보이지 않는다. 효과를 약속하지 않는다 */
export const CLAIM_SUPPORT_LEARNER = {
  title: '주장과 근거 연결',
  why: '필자의 주장을 고르는 문제는 글 속 문장들이 주장과 어떤 관계인지 — 이유를 대며 떠받치는지, 같은 말을 다시 하는지, 필자가 반박하는 생각인지 — 가려 보면 주장이 어디 있는지 분명해져요. 이 문항으로 직접 가려 봐요.',
} as const
