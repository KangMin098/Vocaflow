// apps/web/src/app/admin/knowledge/lab/research/page.tsx
// C 연구 서지(2026-10-08 vNext) — SLA · 응용언어학 · 인지과학 연구의 서지 · 설계 · 대상. 원문은 저장하지 않는다(서지 · DOI 만).
// 근거의 연구 수준은 여기 설계에서만 나온다(DB 트리거 knowledge_evidence_sync_level). 설계는 바꿀 수 없다 — 새 서지로.
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EmptyState, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { ResearchSourceForm } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { RESEARCH_DESIGN_LABEL } from '@/lib/knowledge/vnext-labels'
import { listResearchSources } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'

export default async function KnowledgeResearchPage() {
  await requireAdmin('/admin/knowledge/lab/research')
  const help = <AdminScreenHelp screen="knowledge-research" />
  let sources
  try {
    sources = await listResearchSources()
  } catch {
    return (
      <KnowledgeFrame title="연구 서지" question="연구는 무엇을 · 누구를 대상으로 · 어떤 설계로 보였나" help={help} back={{ href: '/admin/knowledge/lab', label: '탐구 · 근거 연구소' }}>
        <LoadFailed what="연구 서지" href="/admin/knowledge/lab/research" />
      </KnowledgeFrame>
    )
  }
  return (
    <KnowledgeFrame title="연구 서지" question="연구는 무엇을 · 누구를 대상으로 · 어떤 설계로 보였나" help={help} back={{ href: '/admin/knowledge/lab', label: '탐구 · 근거 연구소' }}>
      <ResearchSourceForm />
      {sources.length === 0 ? (
        <EmptyState title="연구 서지가 없습니다" next="탐구 질문에 답할 연구를 서지 · DOI 로 등록한다. 등록한 서지는 항목 상세에서 근거로 붙인다." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-sm" data-testid="research-table">
            <caption className="sr-only">연구 서지</caption>
            <thead><tr className="border-b border-[var(--bd)] text-left text-[var(--t2)]">
              <th scope="col" className="py-2 pr-3 font-medium">서지</th><th scope="col" className="px-3 py-2 font-medium">설계</th>
              <th scope="col" className="px-3 py-2 font-medium">대상 · L2</th><th scope="col" className="px-3 py-2 text-right font-medium">이은 근거</th>
            </tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b border-[var(--bd)] align-top">
                  <td className="py-3 pr-3 text-[var(--t1)]">{s.citation}{s.doi && <span className="block font-mono text-xs text-[var(--t3)]">doi:{s.doi}</span>}</td>
                  <td className="px-3 py-3">{RESEARCH_DESIGN_LABEL[s.design]}</td>
                  <td className="px-3 py-3 text-[var(--t2)]">{s.population ?? '—'} · {s.l2Context === null ? 'L2 미확인' : s.l2Context ? 'L2 맥락' : 'L1/일반'}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </KnowledgeFrame>
  )
}
