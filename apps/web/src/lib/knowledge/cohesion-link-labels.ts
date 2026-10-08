// apps/web/src/lib/knowledge/cohesion-link-labels.ts
// 「앞 문장과 이어 주는 단서」 과제의 학습자 문구(클라이언트에서도 쓴다 — 아무것도 import 하지 않는다 · 2026-10-08 두 번째 수직 경로)

/** 학습자에게 보이는 「무엇을 · 왜」 — 관리자 항목 문장(연구 단서 · 효과 미확인 표기)을 그대로 보이지 않는다. 효과를 약속하지 않는다 */
export const COHESION_LINK_LEARNER = {
  title: '앞 문장과 이어 주는 단서',
  why: 'such · the · this 같은 말이나 연결어는 앞에 나온 무엇을 가리켜요. 그 단서가 가리키는 문장을 찾아 이으면 단락이 놓일 자리가 보여요. 이 문항으로 직접 따라가 봐요.',
} as const

/** 화면이 받는 과제 모양 — 정답은 없다(채점은 서버) */
export interface CohesionPanelProps {
  sentenceCount: number
  probes: { id: string; cueSentence: number; cueLabel: string }[]
  orderOptions: string[]
}
