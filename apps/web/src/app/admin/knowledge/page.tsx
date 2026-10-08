// apps/web/src/app/admin/knowledge/page.tsx
// A 원리 운영실(2026-10-08 vNext) — 순환(탐구 → 근거 → 채택 → 적용 → 검증) 단계별 현황 · 병목 · 우선 처리 큐.
// 숫자를 누르면 그 일을 하는 화면으로 간다. 기존 「원리 지도」 격자는 B 역량 · 원리 지도(/admin/knowledge/map)로 옮겼다.
// 수치는 열 때마다 DB 를 다시 센 값이다(I5 — 상수 금지).
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { GradeMark, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { GRADES, GRADE_LABEL } from '@/lib/knowledge/labels'
import { countByGrade, listCsatOrigins, listEvidence, listGaps, listItems } from '@/lib/knowledge/server'
import { listApplications, listInquiries } from '@/lib/knowledge/vnext-server'
import { opsSummary } from '@/lib/knowledge/vnext-rules'

export const dynamic = 'force-dynamic'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const STAGE_NAME: Record<string, string> = { inquiry: '탐구 질문', evidence: '연구 근거', adoption: '채택', application: '제품 적용', verification: '효과 검증' }

export default async function KnowledgeOpsPage() {
  await requireAdmin('/admin/knowledge')
  const help = <AdminScreenHelp screen="knowledge" />
  let data
  try {
    const [items, gaps, origins, inquiries, applications] = await Promise.all([listItems(), listGaps(), listCsatOrigins(), listInquiries(), listApplications()])
    const evidence = await listEvidence(items.map((i) => i.id))
    data = { items, gaps, origins, inquiries, applications, evidence }
  } catch {
    return (
      <KnowledgeFrame title="원리 운영실" question="지금 어디가 막혔고 무엇부터 처리하나" help={help} back={{ href: '/admin', label: '관리자' }}>
        <LoadFailed what="학습 원리 등록부" href="/admin/knowledge" />
      </KnowledgeFrame>
    )
  }
  const openGaps = data.gaps.filter((g) => g.status === 'open')
  const s = opsSummary({ items: data.items, evidence: data.evidence, inquiries: data.inquiries, applications: data.applications, openGaps: openGaps.length })
  const grades = countByGrade(data.origins)

  return (
    <KnowledgeFrame title="원리 운영실" question="지금 어디가 막혔고 무엇부터 처리하나" help={help} back={{ href: '/admin', label: '관리자' }}>
      <section aria-labelledby="cycle" className="mb-10">
        <h2 id="cycle" className="mb-3 text-lg font-semibold text-[var(--t1)]">순환 — 탐구에서 검증까지</h2>
        <ol className="grid gap-3 md:grid-cols-5" data-testid="ops-stages">
          {s.stages.map((st, i) => {
            const blocked = s.bottleneck === st.key
            return (
              <li key={st.key}>
                <Link href={st.href} className={`block min-h-11 rounded border p-4 ${FOCUS} ${blocked ? 'border-[var(--error)]' : 'border-[var(--bd)]'} hover:border-[var(--p)]`} data-stage={st.key}>
                  <span className="font-mono text-xs text-[var(--t3)]">{i + 1}</span>
                  <span className="block text-sm text-[var(--t2)]">{st.label}</span>
                  <span className="block text-2xl font-semibold tabular-nums text-[var(--t1)]">
                    {st.value}{st.of !== null && <span className="text-base text-[var(--t3)]"> / {st.of}</span>}
                  </span>
                  <span className="block text-xs text-[var(--t3)]">{st.note}</span>
                  {blocked && <span className="mt-1 block text-xs font-semibold text-[var(--error)]">병목 — 여기서 막혀 있다</span>}
                </Link>
              </li>
            )
          })}
        </ol>
        {s.bottleneck && <p className="mt-3 text-sm text-[var(--t2)]">병목: <b className="text-[var(--t1)]">{STAGE_NAME[s.bottleneck]}</b> — 이 단계가 0 이라 뒤 단계가 움직일 수 없다.</p>}
      </section>

      <section aria-labelledby="queue" className="mb-10">
        <h2 id="queue" className="mb-3 text-lg font-semibold text-[var(--t1)]">우선 처리 <span className="tabular-nums text-[var(--t2)]">{s.queue.length}</span></h2>
        {s.queue.length === 0 ? <p className="text-sm text-[var(--t2)]">지금 막힌 일이 없다.</p> : (
          <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]" data-testid="ops-queue">
            {s.queue.map((q) => (
              <li key={q.title}>
                <Link href={q.href} className={`flex min-h-11 items-start gap-3 py-3 ${FOCUS}`}>
                  <span className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded border px-1 font-mono text-xs ${q.severity === 1 ? 'border-[var(--error)] text-[var(--error)]' : 'border-[var(--bd)] text-[var(--t2)]'}`} aria-label={`우선순위 ${q.severity}`}>{q.severity}</span>
                  <span className="min-w-0"><span className="block font-medium text-[var(--t1)]">{q.title}</span><span className="block text-sm text-[var(--t2)]">{q.detail}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="gaps">
          <h2 id="gaps" className="mb-3 text-lg font-semibold text-[var(--t1)]">열린 공백 <span className="tabular-nums text-[var(--t2)]">{openGaps.length}</span></h2>
          <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
            {openGaps.slice(0, 5).map((g) => <li key={g.id} className="py-3 text-sm text-[var(--t1)]">{g.question}</li>)}
          </ul>
          <Link href="/admin/knowledge/gaps" className={`mt-2 inline-flex min-h-11 items-center text-sm underline ${FOCUS}`}>공백 전체</Link>
        </section>
        <section aria-labelledby="origins">
          <h2 id="origins" className="mb-3 text-lg font-semibold text-[var(--t1)]">기출 원천 <span className="tabular-nums text-[var(--t2)]">{data.origins.length} 지문</span></h2>
          <ul className="space-y-2">
            {GRADES.map((g) => (
              <li key={g} className="flex items-center justify-between gap-3 text-sm"><GradeMark grade={g} label={GRADE_LABEL[g]} /><span className="tabular-nums text-[var(--t1)]">{grades[g]}</span></li>
            ))}
          </ul>
          <Link href="/admin/knowledge/sources/csat" className={`mt-2 inline-flex min-h-11 items-center text-sm underline ${FOCUS}`}>기출 원천 보기</Link>
        </section>
      </div>
    </KnowledgeFrame>
  )
}
