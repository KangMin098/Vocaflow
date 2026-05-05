// apps/web/src/app/(main)/scriptquiz/play/page.tsx
// ScriptQuiz 학습 세션 — hub(/scriptquiz)에서 진입
// query: ?ko=1 → 한국어 번역 보조 표시

import { ScriptQuiz } from '@/components/game/scriptquiz/ScriptQuiz'
import { ResourceContext } from '@/components/layout/ResourceContext'

export const metadata = {
  title: 'ScriptQuiz · Vocaflow',
}

export default function ScriptQuizPlayPage({
  searchParams,
}: {
  searchParams?: { ko?: string }
}) {
  const showKorean = searchParams?.ko === '1'
  return (
    <>
      <ResourceContext
        resource={{
          type: 'script',
          label: 'The Great Gatsby',
          position: 'Chapter 1 · 5문제',
          href: '/text',
        }}
      />
      <ScriptQuiz showKorean={showKorean} />
    </>
  )
}
