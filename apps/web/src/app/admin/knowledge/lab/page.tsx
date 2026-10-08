// apps/web/src/app/admin/knowledge/lab/page.tsx
// C 탐구·근거 연구소 — 탐구 질문 목록. 질문마다 지지·반박·조건부·반례 입장 수를 나란히 둔다(지지만 모이면 그게 신호다).
import Link from 'next/link'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EmptyState, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { NewInquiryForm } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listItems } from '@/lib/knowledge/server'
import { INQUIRY_STATUS_LABEL, STANCES, STANCE_LABEL } from '@/lib/knowledge/vnext'
import { listInquiries } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'

export default async function KnowledgeLabPage() {
  await requireAdmin('/admin/knowledge/lab')
  let data
  try {
    const [inquiries, essences] = await Promise.all([listInquiries(), listItems({ layers: ['essence'] })])
    data = { inquiries, essences }
  } catch {
    return (
      <KnowledgeFrame title="탐구·근거 연구소" question="무엇을 알고 싶고, 출처들은 서로 무엇이라 말하는가" help={<AdminScreenHelp screen="knowledge-lab" />} back={{ href: '/admin/knowledge', label: '원리 운영실' }}>
        <LoadFailed what="탐구 질문" href="/admin/knowledge/lab" />
      </KnowledgeFrame>
    )
  }
  return (
    <KnowledgeFrame title="탐구·근거 연구소" question="무엇을 알고 싶고, 출처들은 서로 무엇이라 말하는가" help={<AdminScreenHelp screen="knowledge-lab" />} back={{ href: '/admin/knowledge', label: '원리 운영실' }}>
      <section aria-labelledby="inq" className="mb-10">
        <h2 id="inq" className="mb-3 text-lg font-semibold text-[var(--t1)]">
          탐구 질문 <span className="tabular-nums text-[var(--t2)]">{data.inquiries.length}</span>
        </h2>
        {data.inquiries.length === 0 ? (
          <EmptyState title="탐구 질문이 없습니다" next="아래에서 질문을 열거나, 시범 시드(scripts/knowledge/vnext-pilot-seed.mjs)를 승인 후 적재하세요." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">탐구 질문과 입장 수</caption>
              <thead>
                <tr className="border-b border-[var(--bd)] text-left text-[var(--t2)]">
                  <th scope="col" className="py-2 pr-4 font-medium">질문</th>
                  <th scope="col" className="px-3 py-2 font-medium">상태</th>
                  {STANCES.map((s) => (
                    <th key={s} scope="col" className="px-3 py-2 text-right font-medium">{STANCE_LABEL[s]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.inquiries.map((q) => (
                  <tr key={q.id} className="border-b border-[var(--bd)]">
                    <th scope="row" className="py-2 pr-4 text-left font-normal">
                      <Link href={`/admin/knowledge/lab/${q.slug}`} className="inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
                        {q.question}
                      </Link>
                    </th>
                    <td className="px-3 py-2 text-[var(--t2)]">{INQUIRY_STATUS_LABEL[q.status]}</td>
                    {STANCES.map((s) => (
                      <td key={s} className="px-3 py-2 text-right tabular-nums">
                        {q.stances[s] === 0 ? <span className="text-[var(--t3)]">·</span> : q.stances[s]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section aria-labelledby="new-inq" className="mb-10">
        <h2 id="new-inq" className="mb-3 text-lg font-semibold text-[var(--t1)]">새 질문</h2>
        <NewInquiryForm capabilities={data.essences.map((e) => ({ id: e.id, title: e.title }))} />
      </section>
      <section aria-labelledby="more">
        <h2 id="more" className="mb-2 text-lg font-semibold text-[var(--t1)]">근거 창고</h2>
        <ul className="flex flex-wrap gap-4 text-sm">
          {[
            ['/admin/knowledge/sources', '근거 · 출처'],
            ['/admin/knowledge/sources/csat', '기출 원천'],
            ['/admin/knowledge/experts', '전문가 · 채널'],
            ['/admin/knowledge/gaps', '공백'],
            ['/admin/methodology', '가져오기 원장'],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </KnowledgeFrame>
  )
}
