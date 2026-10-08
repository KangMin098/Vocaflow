// apps/web/src/app/admin/knowledge/design/page.tsx
// D 학습 설계·검증 — 원리를 학습자가 실제로 하는 과제로 바꾼 설계 목록 + 새 초안.
import Link from 'next/link'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EmptyState, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { NewDesignForm } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { DESIGN_STATUS_LABEL, LEARNER_MODULES, isLearnerModuleKey } from '@/lib/knowledge/vnext'
import { listDesigns, listInquiries } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'

export default async function KnowledgeDesignListPage() {
  await requireAdmin('/admin/knowledge/design')
  let data
  try {
    const [designs, inquiries] = await Promise.all([listDesigns(), listInquiries()])
    data = { designs, inquiries }
  } catch {
    return (
      <KnowledgeFrame title="학습 설계·검증" question="원리가 학습자의 어떤 행동이 되고, 어떻게 확인하나" help={<AdminScreenHelp screen="knowledge-design" />} back={{ href: '/admin/knowledge', label: '원리 운영실' }}>
        <LoadFailed what="학습 설계" href="/admin/knowledge/design" />
      </KnowledgeFrame>
    )
  }
  return (
    <KnowledgeFrame title="학습 설계·검증" question="원리가 학습자의 어떤 행동이 되고, 어떻게 확인하나" help={<AdminScreenHelp screen="knowledge-design" />} back={{ href: '/admin/knowledge', label: '원리 운영실' }}>
      <section aria-labelledby="list" className="mb-10">
        <h2 id="list" className="mb-3 text-lg font-semibold text-[var(--t1)]">
          설계 <span className="tabular-nums text-[var(--t2)]">{data.designs.length}</span>
        </h2>
        {data.designs.length === 0 ? (
          <EmptyState title="학습 설계가 없습니다" next="아래에서 초안을 만들거나, 시범 시드를 승인 후 적재하세요." />
        ) : (
          <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
            {data.designs.map((d) => (
              <li key={d.id} className="grid gap-1 py-3 md:grid-cols-[1fr_auto_auto] md:items-center md:gap-6">
                <Link href={`/admin/knowledge/design/${d.slug}`} className="inline-flex min-h-11 items-center font-semibold text-[var(--t1)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
                  {d.title}
                </Link>
                <span className="text-sm text-[var(--t2)]">{isLearnerModuleKey(d.moduleKey) ? LEARNER_MODULES[d.moduleKey].label : d.moduleKey}</span>
                <span className="text-sm text-[var(--t1)]">
                  {DESIGN_STATUS_LABEL[d.status]} · v{d.version}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="new">
        <h2 id="new" className="mb-3 text-lg font-semibold text-[var(--t1)]">새 설계 초안</h2>
        <NewDesignForm inquiries={data.inquiries.map((q) => ({ id: q.id, question: q.question }))} />
      </section>
    </KnowledgeFrame>
  )
}
