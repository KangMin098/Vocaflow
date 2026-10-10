// apps/web/src/lib/knowledge/practice-focus.ts
//
// 오류 초점별 학습 개입(2026-10-10 · find-policy.v3) — 학습 지도가 「어디서 막혔나」(주장 · 근거 · 관계)를 연습 화면에 넘기면
// 초점마다 **다른 방법 · 과제 강조 · 피드백**을 준다. 같은 원리(주장과 근거 연결) 안에서 막힌 하위 처리만 바꾼다.
// 문구는 학습자용 — 연구 용어 · 효과 약속 없음. 클라이언트에서도 쓴다(아무 서버 모듈도 import 하지 않는다).
import { RELATION_LABEL, type Relation } from './claim-support-labels'

export const FOCUSES = ['claim', 'support', 'relation'] as const
export type Focus = (typeof FOCUSES)[number]
export const isFocus = (v: unknown): v is Focus => typeof v === 'string' && (FOCUSES as readonly string[]).includes(v)

export interface FocusGuide {
  title: string
  /** 이 초점에서 쓰는 방법(읽는 순서) */
  method: string[]
  /** 과제에서 특히 천천히 할 단계 — 화면이 그 단계를 강조한다 */
  emphasis: 'claim' | 'support' | 'relation'
  emphasisText: string
}

export const FOCUS_GUIDE: Record<Focus, FocusGuide> = {
  claim: {
    title: '주장 문장 찾기 연습',
    method: [
      '첫 문장을 바로 주장으로 정하지 않아요 — 통념 · 질문 · 배경으로 시작하는 글이 많아요.',
      'however · but · rather · instead 뒤, should · must · need to · it is crucial/important 가 있는 문장을 먼저 봐요.',
      '고른 문장을 빼면 글 전체가 무엇을 말하려는지 사라지는지 확인해요.',
    ],
    emphasis: 'claim',
    emphasisText: '1단계(주장 고르기)를 가장 천천히 — 후보 두 문장을 비교한 뒤 골라요.',
  },
  support: {
    title: '근거 문장 모두 고르기 연습',
    method: [
      '주장 문장을 먼저 고정해요.',
      '나머지 문장을 하나씩 「이 문장이 주장이 왜 맞는지 말해 주나?」로 물어 예 · 아니오를 정해요 — 건너뛰지 않아요.',
      '주장을 다른 말로 다시 한 문장, 필자가 반박하는 생각은 근거에서 빼요.',
    ],
    emphasis: 'support',
    emphasisText: '2단계(근거 고르기)에서 모든 문장을 한 번씩 판단해요 — 한두 개만 고르고 넘어가지 않아요.',
  },
  relation: {
    title: '문장과 주장의 관계 가리기 연습',
    method: [
      '표시된 문장이 주장에 대해 하는 일을 한 줄로 말해 봐요: 이유를 대나 · 예를 드나 · 같은 말을 다시 하나 · 반대 생각을 소개하나.',
      'for example · such as 는 예, because · since · so that 은 이유, in other words · that is 는 재진술 신호예요.',
      '신호어가 없으면 그 문장을 주장 바로 뒤에 붙여 「그래서? / 예를 들면?」 중 어느 쪽이 자연스러운지 봐요.',
    ],
    emphasis: 'relation',
    emphasisText: '3단계(관계 정하기)를 고르기 전에 그 문장이 하는 일을 한 줄로 말해 봐요.',
  },
}

export interface FocusFeedbackInput {
  claimHit: boolean | null
  claimSentences: number[]
  mySupport: number[]
  supportSentences: number[]
  supportOk: boolean | null
  relationOk: boolean | null
  relation: Relation | null
  myRelation: Relation | null
}

/** 초점 부분을 먼저 · 구체적으로 — 틀린 곳을 짚고 다음에 볼 질문 하나를 준다 */
export function focusFeedback(focus: Focus, f: FocusFeedbackInput): string[] {
  const n = (xs: number[]) => xs.map((i) => i + 1).join(', ')
  if (focus === 'claim') {
    if (f.claimHit) return ['주장 문장을 찾았어요. 이번에 쓴 단서(전환어 · 당위 표현)를 다음 글에서도 먼저 찾아요.']
    return [
      `주장은 문장 ${n(f.claimSentences)}이에요.`,
      '고른 문장이 도입 · 통념 · 예시는 아니었는지 돌아봐요 — 그 문장을 빼도 글의 결론이 남는다면 주장이 아니에요.',
    ]
  }
  if (focus === 'support') {
    const missed = f.supportSentences.filter((i) => !f.mySupport.includes(i))
    const extra = f.mySupport.filter((i) => !f.supportSentences.includes(i))
    if (f.supportOk) return ['떠받치는 문장을 모두 골랐어요.']
    const out: string[] = []
    if (missed.length) out.push(`빠뜨린 근거: 문장 ${n(missed)} — 이 문장이 주장이 왜 맞는지 어떻게 말해 주는지 한 줄로 적어 봐요.`)
    if (extra.length) out.push(`근거가 아닌 문장: ${n(extra)} — 주장을 다시 말한 문장이거나 필자가 반박하는 생각인지 확인해요.`)
    return out.length ? out : ['근거 판단이 정답과 달라요. 문장마다 예 · 아니오를 다시 정해 봐요.']
  }
  if (f.relationOk) return ['관계를 정확히 가렸어요.']
  if (!f.relation) return ['이 문항에는 관계 질문이 없어요.']
  return [
    `이 문장은 「${RELATION_LABEL[f.relation]}」 문장이에요${f.myRelation ? ` — 「${RELATION_LABEL[f.myRelation]}」으로 골랐어요` : ''}.`,
    '그 문장을 주장 바로 뒤에 붙여 「그래서? / 예를 들면? / 다시 말해?」 중 어떤 말이 자연스러운지 확인해요.',
  ]
}
