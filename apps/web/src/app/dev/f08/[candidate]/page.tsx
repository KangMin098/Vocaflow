// apps/web/src/app/dev/f08/[candidate]/page.tsx
// 후보 하나. 서버에서 공개 전 묶음만 만들어 넘긴다 — 정답·판정은 이 응답에 없다(공개 요청 때 /api/dev/f08-reveal).

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Workbench } from '@/components/csat/f08-proto/Workbench'
import { buildItem } from '@/lib/csat/f08-proto/data'
import { parseFault } from '@/lib/csat/f08-proto/gate'
import { CANDIDATES, type CandidateId } from '@/lib/csat/f08-proto/types'

export const dynamic = 'force-dynamic'

const MESSAGE: Record<string, { title: string; body: string }> = {
  'no-source': { title: '검증된 원문이 없다', body: '이 문항은 원문·선지·공식 정답이 확인된 자료가 없어 열지 않는다. 지어낸 원문을 대신 보여 주지 않는다.' },
  'no-analysis': { title: '검수된 분석이 없다', body: '검수 완료 분석이 없어 판단 도구를 열지 않는다.' },
  leak: { title: '공개 전 자료에 정답이 섞여 있다', body: '정답이 보이지 않게 고칠 때까지 이 화면을 열지 않는다.' },
}

export default function F08Candidate({ params, searchParams }: { params: { candidate: string }; searchParams: { fault?: string } }) {
  const meta = CANDIDATES.find((c) => c.id === params.candidate)
  if (!meta) notFound()
  const fault = parseFault(searchParams.fault)
  const built = fault === 'no-source' ? { state: 'no-source' as const, detail: '(?fault=no-source 시험)' } : buildItem('2026#34')

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--csat-muted)]"><Link href="/dev/f08" className="underline">F08 후보 비교</Link> · 2026 수능 34번 · 빈칸</p>
          <h1 className="text-xl font-semibold">후보 {meta.id.toUpperCase()} — {meta.name}</h1>
        </div>
        <nav aria-label="다른 후보" className="flex gap-2 text-sm">
          {CANDIDATES.filter((c) => c.id !== meta.id).map((c) => (
            <Link key={c.id} href={`/dev/f08/${c.id}`} className="inline-flex min-h-[44px] items-center rounded-md border border-[var(--csat-edge)] px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--csat-accent)]">후보 {c.id.toUpperCase()}</Link>
          ))}
        </nav>
      </header>
      {built.state === 'ready' ? (
        <Workbench candidate={meta.id as CandidateId} item={built.item} fault={fault} />
      ) : (
        <div role="alert" className="max-w-xl rounded-md border border-[#9c3a30] bg-[#fbeeec] p-4 break-keep" data-testid="state-error">
          <p className="font-semibold">{MESSAGE[built.state].title}</p>
          <p className="mt-1 text-sm">{MESSAGE[built.state].body}</p>
          <p className="mt-2 text-xs text-[var(--csat-muted)]">{built.detail}</p>
        </div>
      )}
    </div>
  )
}
