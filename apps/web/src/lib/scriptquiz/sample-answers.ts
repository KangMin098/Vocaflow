// apps/web/src/lib/scriptquiz/sample-answers.ts
//
// 데모 세션(`MOCK_SESSION`)의 정답표 — **서버에만 둔다.**
//
// 데모라고 클라이언트에 정답을 실어 두면 `QuizQuestion` 에서 정답을 뺀 의미가 없어진다:
// 같은 컴포넌트가 실 세션과 데모를 함께 그리므로, 한쪽에 정답 필드가 남는 순간
// 타입이 다시 열리고 실 세션 경로에도 되돌아온다. 그래서 모양은 실 세션과 똑같이
// **문항 id → 정답 인덱스 + 근거**만 서버에 두고, 채점은 같은 server action 이 한다.

import 'server-only'

export interface SampleAnswer {
  correctIndex: number
  sourceSnippet: string
}

/** `components/game/scriptquiz/mock-data.ts` 의 문항 id 와 1:1. 한쪽만 고치면 채점이 빈다. */
export const SAMPLE_ANSWERS: Readonly<Record<string, SampleAnswer>> = {
  q1: {
    correctIndex: 0,
    sourceSnippet:
      '“Whenever you feel like criticizing any one,” he told me, “just remember that all the people in this world haven’t had the advantages that you’ve had.”',
  },
  q2: {
    correctIndex: 0,
    sourceSnippet:
      'In consequence, I’m inclined to reserve all judgments, a habit that has opened up many curious natures to me...',
  },
  q3: {
    correctIndex: 1,
    sourceSnippet: '“...all the people in this world haven’t had the advantages that you’ve had.”',
  },
  q4: {
    correctIndex: 0,
    sourceSnippet:
      '...we’ve always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that.',
  },
  q5: {
    correctIndex: 0,
    sourceSnippet: 'There was something unmistakable about the way he held himself...',
  },
}
