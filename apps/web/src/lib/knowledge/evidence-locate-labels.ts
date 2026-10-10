// apps/web/src/lib/knowledge/evidence-locate-labels.ts
// E축 확인 과제의 학습자 문구(클라이언트에서도 쓴다 — 아무것도 import 하지 않는다 · 2026-10-10)
// 효과를 약속하지 않는다 · 약점 단정 없이 「이 문항에서 확인」 으로만 말한다.

export const OPTION_RESTATE_LEARNER = {
  title: '선지가 다시 말한 본문 문장',
  why: '주제 · 제목 · 요지 정답은 본문의 핵심 문장을 다른 말로 바꿔 쓰는 경우가 많아요. 정답이 다시 말한 본문 문장을 먼저 찾으면, 그 문장과 어긋난 선지를 근거로 지울 수 있어요. 이 문항으로 직접 찾아봐요.',
} as const

export const EVIDENCE_LOCATE_LEARNER = {
  title: '빈칸을 정하는 근거 문장',
  why: '빈칸의 답은 느낌이 아니라 지문 안 다른 문장이 정해요. 빈칸과 같은 내용을 다른 말로 말한 문장을 찾으면 그 말로 선지를 확인할 수 있어요. 이 문항으로 직접 찾아봐요.',
} as const

/** 과제 키 → 패널 문구(질문 · 결과) */
export const EVIDENCE_PANEL_TEXT = {
  'option-restate': {
    question: '정답 선지가 다른 말로 다시 말한 본문 문장은 몇 번째 문장인가?',
    ok: '정답이 다시 말한 문장을 찾았어요.',
    retry: '정답 선지가 다시 말한 문장은 다른 곳이에요. 정답 선지와 같은 내용을 다른 말로 한 문장을 다시 찾아보세요.',
  },
  'evidence-locate': {
    question: '빈칸에 들어갈 말을 정해 주는 근거 문장은 몇 번째 문장인가?',
    ok: '빈칸을 정하는 근거 문장을 찾았어요.',
    retry: '근거 문장은 다른 곳이에요. 빈칸 문장과 같은 내용을 다른 말로 말한 문장을 다시 찾아보세요.',
  },
} as const

export const LURE_NOTE = '고른 문장은 매력적인 오답 선지가 말을 바꿔 쓴 곳일 수 있어요. 그 문장과 선지가 어디서 달라지는지 비교해 보세요.'
