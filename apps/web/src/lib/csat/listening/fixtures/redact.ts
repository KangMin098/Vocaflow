// apps/web/src/lib/csat/listening/fixtures/redact.ts
//
// 서버 → 클라이언트 경계의 정답 민감 필드 제거(T-0157 P1-b · R2). 순수 함수.
// **첫 렌더 props 는 Reveal Gate 판정과 무관하게 항상 이 함수를 거친다** — 'open' 이어도 제출 전 props 에 정답이 실리면
// 화면에서 숨겨도 직렬화에 남는다. 정답 번호 · 기대 판정 · 핵심 발화 · 근거 연결 · 해설 · 근거 구간(역할 포함)을 뺀다.
// 전체 분석은 학습자가 제출한 뒤 서버 액션(`app/(app)/csat/listening/actions.ts`)이 판정을 다시 해 'open' 일 때만 준다.

import type { ClientTraceFixture, ListeningTraceFixture } from './types'

export function redactForClient(fx: ListeningTraceFixture): ClientTraceFixture {
  return {
    ...fx,
    evidence: [],
    officialAnswer: null,
    candidates: fx.candidates.map(({ id, label, cells }) => (cells ? { id, label, cells } : { id, label })),
    answerRedacted: true,
  }
}
