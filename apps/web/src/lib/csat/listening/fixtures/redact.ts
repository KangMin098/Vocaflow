// apps/web/src/lib/csat/listening/fixtures/redact.ts
//
// 서버 → 클라이언트 경계의 정답 민감 필드 제거(T-0157 P1-b). 순수 함수 — 서버 페이지가 Reveal Gate 판정과 함께 부른다.
// reveal !== 'open'(보류 · 판정 실패 · 판정 전)이면 정답 번호 · 기대 판정 · 핵심 발화 · 근거 연결 · 해설 · 근거 구간(역할 포함)을
// 모두 빼고 보낸다 — 화면에서 숨기는 것만으로는 props 직렬화에 남는다.
// 'open' 이면 정답이 이미 공개된 상태라 그대로 보내고, 제출 전 숨김은 클라이언트의 exposure.ts 가 맡는다(문서화된 경계).

import type { RevealDecision } from '../../embargo-gate'
import type { ClientTraceFixture, ListeningTraceFixture } from './types'

export function redactForClient(fx: ListeningTraceFixture, reveal: RevealDecision | null): ClientTraceFixture {
  if (reveal === 'open') return fx
  return {
    ...fx,
    evidence: [],
    officialAnswer: null,
    candidates: fx.candidates.map(({ id, label, cells }) => (cells ? { id, label, cells } : { id, label })),
    answerRedacted: true,
  }
}
