// apps/web/src/app/dev/wordvault-source-recall/page.tsx
// 출처 목록 → 뜻 떠올리기 PC 실측 하네스 — 실제 WordVaultBrowseClient · WordVaultStudyClient 에 합성 단어만 준다(DB · Auth · 기록 없음). 프로덕션 404.
// 실측 스크립트는 /wordvault/study · /wordvault/browse 요청을 이 화면(view=study|browse)으로 돌려 실제 경로를 열지 않는다.
import { notFound } from 'next/navigation'
import { WordVaultSourceRecallHarness } from './harness'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <WordVaultSourceRecallHarness searchParams={searchParams} />
}
