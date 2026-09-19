// apps/web/src/app/(main)/csat/layout.tsx
//
// **기출 학습 껍데기 — 여백과 읽기 폭뿐이다.**
//
// 2026-09-17 까지 여기에는 7단계 레일(`CsatSteps`)이 있었다. 학습자가 「뭘 하러 왔는지」를 고르게 하는
// 줄이었는데, 학습자 쪽이 「오늘의 세션」 루프 하나로 바뀌면서(docs/csat-learner-brief.md) 고를 것이
// 없어졌다 — 라우트는 홈 · 세션 · 기록 셋이고, 셋 사이의 길은 각 화면의 버튼 하나가 낸다.
//
// 폭은 모바일 기준(375px)에서 넓혀 간다. 본문 줄 길이(≤ 65자)는 각 화면이 `max-w-[65ch]` 로 지킨다.

export default function CsatLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4 sm:px-6 sm:pt-6">{children}</div>
}
