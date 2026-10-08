// apps/web/src/app/admin/knowledge/lab/[slug]/page.tsx
// C 탐구 질문 상세(2026-10-08 vNext) — 주장 비교(결론 후보 · 지지 · 반례 · 불확실) · 근거 세 축 대조 · 결론 · 남은 불확실성.
// 강사 주장은 실무자 주장(가설)이다 — 다수 동의나 AI 합의가 효과 수준을 올리지 않는다(정본 §3-1 · §4).
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { InquiryLinkForm, InquiryStatusForm } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { GRADE_LABEL, STATUS_LABEL } from '@/lib/knowledge/labels'
import { listEvidence, listItems } from '@/lib/knowledge/server'
import { APPLICABILITY_LABEL, EVIDENCE_LEVEL_LABEL, INQUIRY_ROLES, INQUIRY_ROLE_LABEL, INQUIRY_STATUS_LABEL, KIND_LABEL, STRONG_LEVELS } from '@/lib/knowledge/vnext-labels'
import { loadInquiry } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export default async function KnowledgeInquiryPage({ params }: { params: { slug: string } }) {
  await requireAdmin(`/admin/knowledge/lab/${params.slug}`)
  const help = <AdminScreenHelp screen="knowledge-inquiry" />
  let data
  try {
    const q = await loadInquiry(params.slug)
    if (!q) notFound()
    const items = await listItems()
    // 이을 수 있는 근거 전체(항목 근거 — 수백 건 규모) · 이은 근거 한 건도 여기서 찾는다
    const evidence = await listEvidence(items.map((i) => i.id))
    data = { ...q, items, evidence }
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_NOT_FOUND')) throw e
    return (
      <KnowledgeFrame title="탐구 질문" question="이 질문에 근거는 어디까지 답하나" help={help} back={{ href: '/admin/knowledge/lab', label: '탐구 · 근거 연구소' }}>
        <LoadFailed what="탐구 질문" href={`/admin/knowledge/lab/${params.slug}`} />
      </KnowledgeFrame>
    )
  }
  const byId = new Map(data.items.map((i) => [i.id, i]))
  const evById = new Map(data.evidence.map((e) => [e.id, e]))
  const candidates = data.links.filter((l) => l.role === 'candidate' && l.itemId).map((l) => byId.get(l.itemId!)).filter(Boolean).map((i) => ({ slug: i!.slug, title: i!.title }))
  const evidenceOptions = data.evidence.map((e) => ({ id: e.id, label: `${byId.get(e.itemId)?.title ?? ''} — ${e.grade} · ${EVIDENCE_LEVEL_LABEL[e.evidenceLevel]} · ${e.title.slice(0, 40)}` }))
  const strongCount = data.evidence.filter((e) => STRONG_LEVELS.includes(e.evidenceLevel)).length

  return (
    <KnowledgeFrame title="탐구 질문" question={data.inquiry.question} help={help} back={{ href: '/admin/knowledge/lab', label: '탐구 · 근거 연구소' }}>
      <p className="mb-6 text-sm text-[var(--t2)]">
        상태 <b className="text-[var(--t1)]">{INQUIRY_STATUS_LABEL[data.inquiry.status]}</b> · 이은 주장 · 근거 <span className="tabular-nums">{data.links.length}</span> ·
        이은 항목의 근거 중 효과 판단 가능 수준(준실험 이상) <span className="tabular-nums">{strongCount}</span>
        {data.inquiry.conclusionItemId && <> · 결론 <Link className={`inline-flex min-h-11 items-center underline ${FOCUS}`} href={`/admin/knowledge/item/${byId.get(data.inquiry.conclusionItemId)?.slug}`}>{byId.get(data.inquiry.conclusionItemId)?.title}</Link></>}
      </p>
      {data.inquiry.uncertainty && <p className="mb-6 border-l-2 border-[var(--bd)] pl-3 text-sm text-[var(--t2)]">남은 불확실성: {data.inquiry.uncertainty}</p>}

      <section aria-labelledby="compare" className="mb-8">
        <h2 id="compare" className="mb-3 text-lg font-semibold text-[var(--t1)]">주장 비교</h2>
        <div className="grid gap-3 md:grid-cols-4" data-testid="inquiry-compare">
          {INQUIRY_ROLES.map((role) => {
            const rows = data.links.filter((l) => l.role === role)
            return (
              <div key={role} className="rounded border border-[var(--bd)] p-3">
                <h3 className="text-sm font-semibold text-[var(--t1)]">{INQUIRY_ROLE_LABEL[role]} <span className="tabular-nums text-[var(--t3)]">{rows.length}</span></h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {rows.length === 0 && <li className="text-xs text-[var(--t3)]">없음</li>}
                  {rows.map((l) => {
                    const it = l.itemId ? byId.get(l.itemId) : null
                    const ev = l.evidenceId ? evById.get(l.evidenceId) : null
                    return (
                      <li key={l.id}>
                        {it ? (
                          <Link href={`/admin/knowledge/item/${it.slug}`} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>{it.title}</Link>
                        ) : ev ? (
                          <span>{ev.title.slice(0, 60)}</span>
                        ) : <span className="text-[var(--t3)]">(근거 한 건)</span>}
                        <span className="block text-xs text-[var(--t3)]">
                          {it && `${it.kind ? KIND_LABEL[it.kind] : '미분류'} · ${STATUS_LABEL[it.status]}`}
                          {ev && `${ev.grade} ${GRADE_LABEL[ev.grade]} · ${EVIDENCE_LEVEL_LABEL[ev.evidenceLevel]} · 적합 ${APPLICABILITY_LABEL[ev.applicability]}`}
                        </span>
                        {l.note && <span className="block text-xs text-[var(--t2)]">{l.note}</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--t3)]">실무자 주장 · 전문가 견해는 가설이다. 지지가 많아도 효과 수준은 오르지 않는다 — 연구 서지(설계)가 정한다.</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <InquiryLinkForm inquiryId={data.inquiry.id} evidenceOptions={evidenceOptions} />
        <InquiryStatusForm id={data.inquiry.id} from={data.inquiry.status} candidates={candidates} />
      </div>
    </KnowledgeFrame>
  )
}
