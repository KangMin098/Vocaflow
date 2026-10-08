// apps/web/src/app/admin/knowledge/lab/[slug]/page.tsx
// 탐구 질문 상세 — 입장을 태도별 네 칸(지지·반박·조건부·반례)에 나란히 놓고, 근거마다 세 축(출처 확인도·연구 수준·적합성)을 보인다.
// 결론 후보는 사람이 쓰고, 불확실성 없이 결론으로 닫을 수 없다(DB CHECK).
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { InquiryEditor, PositionForm } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { LAYER_LABEL, STATUS_LABEL } from '@/lib/knowledge/labels'
import { DESIGN_STATUS_LABEL, FIT_LABEL, INQUIRY_STATUS_LABEL, RESEARCH_LEVEL_LABEL, STANCES, STANCE_LABEL } from '@/lib/knowledge/vnext'
import { loadInquiryDetail } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'

export default async function InquiryPage({ params }: { params: { slug: string } }) {
  await requireAdmin(`/admin/knowledge/lab/${params.slug}`)
  let d
  try {
    d = await loadInquiryDetail(params.slug)
  } catch {
    return (
      <KnowledgeFrame title="탐구 질문" question="출처들은 이 질문에 무엇이라 말하는가" help={<AdminScreenHelp screen="knowledge-lab-item" />} back={{ href: '/admin/knowledge/lab', label: '탐구·근거 연구소' }}>
        <LoadFailed what="탐구 질문" href={`/admin/knowledge/lab/${params.slug}`} />
      </KnowledgeFrame>
    )
  }
  if (!d) notFound()
  const q = d.inquiry
  return (
    <KnowledgeFrame title={q.question} question={`탐구 질문 · ${INQUIRY_STATUS_LABEL[q.status]}`} help={<AdminScreenHelp screen="knowledge-lab-item" />} back={{ href: '/admin/knowledge/lab', label: '탐구·근거 연구소' }}>
      {d.capability && (
        <p className="mb-6 text-sm text-[var(--t2)]">
          대상 역량:{' '}
          <Link href={`/admin/knowledge/map?node=${d.capability.slug}#node-panel`} className="inline-flex min-h-11 items-center underline">
            {d.capability.title}
          </Link>{' '}
          ({STATUS_LABEL[d.capability.status]})
        </p>
      )}
      <section aria-labelledby="pos" className="mb-10">
        <h2 id="pos" className="mb-3 text-lg font-semibold text-[var(--t1)]">입장 비교</h2>
        <div className="grid gap-4 lg:grid-cols-4">
          {STANCES.map((s) => {
            const xs = d.positions.filter((p) => p.stance === s)
            return (
              <div key={s} className={`rounded-[var(--r-lg)] border p-4 ${s === 'supports' ? 'border-[var(--bd)]' : 'border-dashed border-[var(--bd)]'}`}>
                <h3 className="text-sm font-semibold text-[var(--t1)]">
                  {STANCE_LABEL[s]} <span className="tabular-nums text-[var(--t2)]">{xs.length}</span>
                </h3>
                {xs.length === 0 && (
                  <p className="mt-2 text-xs text-[var(--t3)]">{s === 'supports' ? '없음' : '아직 찾지 않았거나 없음 — 반례 탐색을 공백으로 남긴다'}</p>
                )}
                <ul className="mt-2 space-y-3">
                  {xs.map((p) => (
                    <li key={p.id} className="text-sm">
                      <p className="text-[var(--t1)]">{p.note}</p>
                      {p.evidence && (
                        <p className="mt-1 text-xs text-[var(--t2)]">
                          <b className="font-mono">{p.evidence.grade}</b> · {RESEARCH_LEVEL_LABEL[p.evidence.researchLevel]} · 적합성 {FIT_LABEL[p.evidence.fit]}
                          {p.evidence.url && (
                            <>
                              {' · '}
                              <a href={p.evidence.url} className="inline-flex min-h-11 items-center underline" rel="noreferrer" target="_blank">
                                {p.evidence.title ?? '출처'}
                              </a>
                            </>
                          )}
                        </p>
                      )}
                      {p.item && (
                        <p className="mt-1 text-xs text-[var(--t2)]">
                          {LAYER_LABEL[p.item.layer]}{' '}
                          <Link href={`/admin/knowledge/item/${p.item.slug}`} className="inline-flex min-h-11 items-center underline">
                            {p.item.title}
                          </Link>{' '}
                          ({STATUS_LABEL[p.item.status]})
                        </p>
                      )}
                      <p className="text-xs text-[var(--t3)]">{p.createdBy}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="conc">
          <h2 id="conc" className="mb-3 text-lg font-semibold text-[var(--t1)]">결론 후보</h2>
          <InquiryEditor id={q.id} updatedAt={q.updatedAt} status={q.status} conclusion={q.conclusion ?? ''} uncertainty={q.uncertainty ?? ''} nextAction={q.nextAction ?? ''} />
        </section>
        <section aria-labelledby="add">
          <h2 id="add" className="mb-3 text-lg font-semibold text-[var(--t1)]">입장 더하기</h2>
          <PositionForm inquiryId={q.id} />
          <h2 className="mb-2 mt-8 text-lg font-semibold text-[var(--t1)]">이 질문에서 나온 학습 설계</h2>
          {d.designs.length === 0 ? (
            <p className="text-sm text-[var(--t2)]">아직 없다.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {d.designs.map((x) => (
                <li key={x.id}>
                  <Link href={`/admin/knowledge/design/${x.slug}`} className="inline-flex min-h-11 items-center underline">
                    {x.title}
                  </Link>{' '}
                  — {DESIGN_STATUS_LABEL[x.status]} · v{x.version}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </KnowledgeFrame>
  )
}
