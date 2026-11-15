// apps/web/src/app/dev/wordvault-membership/page.tsx
// 기사 단어장 정본 membership PC 실측 하네스 — 실제 WordVaultBrowseClient 에 합성 단어·합성 응답만 준다(DB·Auth·기록 없음). 프로덕션 404.
import { notFound } from 'next/navigation'
import { WordVaultMembershipHarness } from './harness'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { slow?: string; fail?: string; initial?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <WordVaultMembershipHarness slow={searchParams.slow ?? ''} fail={searchParams.fail ?? ''} initial={searchParams.initial ?? ''} />
}
