// apps/web/src/app/admin/knowledge/experts/page.tsx
// 전문가 · 채널 — 가져오기 원장 최신 스냅샷의 전문가와 소유 채널. 목록은 순위가 아니다.
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EmptyState, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listExperts } from '@/lib/knowledge/server'

export const dynamic = 'force-dynamic'

const RESEARCH_LABEL: Record<string, string> = {
  candidate: '후보',
  profile_verified: '프로필 확인',
}

export default async function ExpertsPage() {
  await requireAdmin('/admin/knowledge/experts')
  const frame = { title: '전문가 · 채널', question: '누구의 무엇을 근거로 삼는가', help: <AdminScreenHelp screen="knowledge-experts" /> }
  let experts
  try {
    experts = await listExperts()
  } catch {
    return (
      <KnowledgeFrame {...frame}>
        <LoadFailed what="전문가" href="/admin/knowledge/experts" />
      </KnowledgeFrame>
    )
  }
  return (
    <KnowledgeFrame {...frame}>
      {experts.length === 0 ? (
        <EmptyState
          title="가져온 전문가가 없습니다"
          next="강사·채널 조사(docs/methodology/instructor-roster.md)를 가져오기 원장에 적재하면 여기에 뜹니다."
        />
      ) : (
        <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
          {experts.map((e) => (
            <li key={e.id} className="grid gap-2 py-4 md:grid-cols-[12rem_1fr_8rem]">
              <div>
                <h3 className="font-semibold text-[var(--t1)]">{e.name}</h3>
                <p className="text-sm text-[var(--t2)]">{e.organization}</p>
              </div>
              <div className="min-w-0 text-sm">
                <p className="text-[var(--t1)]">{e.specialties.join(' · ')}</p>
                {e.channels.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {e.channels.map((c) => (
                      <li key={c.url}>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                        >
                          {c.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[var(--t3)]">확인된 채널 없음</p>
                )}
              </div>
              <p className="text-sm text-[var(--t2)] md:text-right">{RESEARCH_LABEL[e.researchStatus] ?? e.researchStatus}</p>
            </li>
          ))}
        </ul>
      )}
    </KnowledgeFrame>
  )
}
