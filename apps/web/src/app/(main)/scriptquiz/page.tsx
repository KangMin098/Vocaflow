// apps/web/src/app/(main)/scriptquiz/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function ScriptQuizPage() {
  return (
    <StubPage
      title="ScriptQuiz"
      description="원문 독해 퀴즈 · AI 자동 생성 · Little Fox UI 스타일"
      upcoming={[
        'Start Screen — QUIZ 로고 (#5BC8F5→#1A7AB8)',
        'Question Screen — 5상태 선택지 (idle / selected / correct / wrong / other)',
        'O/X 피드백 오버레이 (feedbackPop 애니메이션)',
        'Result Screen — SVG 점수 링 · 오답 복습',
        'AI 문제 생성 (lib/openai/generateQuiz.ts)',
      ]}
    />
  )
}
