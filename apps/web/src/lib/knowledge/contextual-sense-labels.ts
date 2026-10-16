// apps/web/src/lib/knowledge/contextual-sense-labels.ts
// V2 문맥 의미 선택 확인 과제의 학습자 문구(클라이언트에서도 쓴다 — 아무것도 import 하지 않는다 · LM-G1.5a)
// 효과를 약속하지 않는다 · 낱말 뜻 암기와 구분해 「이 문맥에서」 로만 말한다.

export const CONTEXTUAL_SENSE_LEARNER = {
  title: '이 문맥에 맞는 낱말의 뜻',
  why: '같은 낱말도 문장마다 뜻이 달라져요. 사전 뜻이 아니라 앞뒤 문장이 요구하는 뜻을 따져야 어색한 낱말을 근거로 고를 수 있어요. 이 문항으로 직접 확인해 봐요.',
} as const

export const CONTEXTUAL_SENSE_TEXT = {
  misfit: '밑줄 친 낱말 가운데 이 문맥에 맞지 않는 것은?',
  sense: '그 자리에는 어떤 뜻이 와야 문맥이 이어지나요?',
  cue: '그렇게 판단한 근거 문장을 고르세요(여러 개 가능).',
  cueUngraded: '근거 문장은 아직 채점 기준이 검수되지 않아 기록만 남고 정답 여부를 말하지 않아요.',
  ok: '맞지 않는 낱말과 이 문맥의 뜻을 맞혔어요.',
  misfitWrong: '맞지 않는 낱말은 다른 곳이에요. 각 밑줄 낱말을 앞뒤 문장의 흐름에 넣어 다시 읽어 보세요.',
  senseWrong: '맞지 않는 낱말은 찾았어요. 그 자리에 와야 할 뜻을 앞뒤 문장으로 다시 따져 보세요.',
  cueOk: '정해진 근거 문장을 골랐어요. 문장 안의 어떤 표현이 뜻을 정하는지는 별도로 살펴보세요.',
  cueNo: '근거 문장 선택은 확인 기준을 충족하지 않았어요. 뜻을 정해 주는 문장을 다시 찾아보세요.',
} as const

export const CIRCLED = ['①', '②', '③', '④', '⑤'] as const
