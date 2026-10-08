// apps/web/src/app/admin/knowledge/lab/page.tsx
// C 탐구 · 근거 연구소 — 탐구 질문(2026-10-08 vNext). 수집은 질문에서 시작한다(질문 없는 대량 수집 금지 — 정본 §4).
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EmptyState, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { InquiryForm } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listTaxonomy } from '@/lib/knowledge/server'
import { INQUIRY_STATUS_LABEL } from '@/lib/knowledge/vnext-labels'
import { listInquiries } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export default async function KnowledgeLabPage() {
  await requireAdmin('/admin/knowledge/lab')
  const help = <AdminScreenHelp screen="knowledge-lab" />
  let data
  try {
    const [inquiries, taxonomy] = await Promise.all([listInquiries(), listTaxonomy()])
    data = { inquiries, skills: taxonomy.filter((t) => t.dimension === 'skill') }
  } catch {
    return (
      <KnowledgeFrame title="탐구 · 근거 연구소" question="무엇을 알고 싶고, 근거는 어디까지 말하나" help={help}>
        <LoadFailed what="탐구 질문" href="/admin/knowledge/lab" />
      </KnowledgeFrame>
    )
  }
  const label = Object.fromEntries(data.skills.map((s) => [s.id, s.label]))
  return (
    <KnowledgeFrame title="탐구 · 근거 연구소" question="무엇을 알고 싶고, 근거는 어디까지 말하나" help={help}>
      <InquiryForm skills={data.skills.map((s) => ({ id: s.id, label: s.label }))} />
      {data.inquiries.length === 0 ? (
        <EmptyState title="열린 탐구 질문이 없습니다" next="위에서 첫 질문을 연다 — 근거 수집은 질문을 따라간다(예: 「글의 주장과 근거 관계를 아는 능력은 어떻게 기르고 확인하는가」)." />
      ) : (
        <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]" data-testid="inquiry-list">
          {data.inquiries.map((q) => (
            <li key={q.id}>
              <Link href={`/admin/knowledge/lab/${q.slug}`} className={`block min-h-11 py-3 ${FOCUS}`}>
                <span className="block font-medium text-[var(--t1)]">{q.question}</span>
                <span className="block text-sm text-[var(--t2)]">
                  {INQUIRY_STATUS_LABEL[q.status]} · 이은 주장 · 근거 <span className="tabular-nums">{q.links}</span>
                  {q.skillIds.length > 0 && ` · ${q.skillIds.map((s) => label[s] ?? s).join(' · ')}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </KnowledgeFrame>
  )
}
