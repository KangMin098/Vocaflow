// apps/web/src/lib/learner/next-reading-choice.ts
//
// R0 — 연습 · 어휘 복습을 마친 뒤 다음에 읽을 글을 스스로 고르는 보조 선택 하나(기존 내부 서가).
// 처방 · 추천 · 평가가 아니다 — 서가의 모든 글에 연습이 있다고 말하지 않는다. 기록 · 이벤트 없음.
// 쓰는 곳: 기사 연습 완료(ArticlePracticeBridge) · Flashcard 완료(CompletionState) · WordVault 학습 완료(StudyDoneScreen).

export const NEXT_READING_CHOICE = { href: '/library/scripts', label: '다른 글 살펴보기' } as const
