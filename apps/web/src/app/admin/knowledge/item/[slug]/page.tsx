// apps/web/src/app/admin/knowledge/item/[slug]/page.tsx
// 항목 상세 — 위: 층 표지·문장·조건. 가운데: 위층(이 항목이 구현하는 것)·아래층(이 항목을 구현하는 것)·옆 관계.
// 아래: 근거(등급·귀속·위치). 오른쪽: 상태 변경·연결·근거 추가 · 검토 기록.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EvidenceForm, LinkForm, StatusActions } from '@/components/admin/knowledge/ItemEditor'
import { EmptyState, GradeMark, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { GRADE_LABEL, LAYER_LABEL, LAYER_QUESTION, LAYER_RANK, STATUS_LABEL } from '@/lib/knowledge/labels'
import { listCsatOrigins, loadItemDetail } from '@/lib/knowledge/server'

export const dynamic = 'force-dynamic'

const SIDE_LABEL: Record<string, string> = {
  complements: '보완',
  contrasts: '반대',
  condition_variant: '조건만 다름',
  duplicate_candidate: '중복 후보',
}

const ATTRIBUTION_LABEL = { stated: '출처가 직접 말함', inferred: '분석자 추론' } as const

const LINK_CLASS =
  'inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]'

export default async function ItemDetailPage({ params }: { params: { slug: string } }) {
  await requireAdmin(`/admin/knowledge/item/${params.slug}`)
  const help = <AdminScreenHelp screen="knowledge-item" />
  let detail
  let origins
  try {
    ;[detail, origins] = await Promise.all([loadItemDetail(params.slug), listCsatOrigins()])
  } catch {
    return (
      <KnowledgeFrame title="항목" question="이 항목은 무엇에 기대고 무엇을 떠받치는가" help={help}>
        <LoadFailed what="항목" href={`/admin/knowledge/item/${params.slug}`} />
      </KnowledgeFrame>
    )
  }
  if (!detail) notFound()
  const { item, up, down, side, evidence, reviews, taxonomy, others } = detail
  const label = Object.fromEntries(taxonomy.map((t) => [t.id, t.label]))
  const originLabel = new Map(
    origins.map((o) => [o.passageSha256, `${o.itemIds.join('·')} — ${o.sourceTitle ?? '미확인'}`])
  )
  const originOptions = origins
    .filter((o) => o.grade !== 'G')
    .map((o) => ({ passageSha256: o.passageSha256, label: `${o.grade} · ${o.itemIds.join('·')} — ${o.sourceTitle}` }))
  const chips = [...item.skillIds, ...item.conditionIds]
  const backHref = item.layer === 'essence' || item.layer === 'principle' ? '/admin/knowledge/principles' : '/admin/knowledge/methods'

  return (
    <KnowledgeFrame
      title={item.title}
      question={`L${LAYER_RANK[item.layer]} ${LAYER_LABEL[item.layer]} — ${LAYER_QUESTION[item.layer]}`}
      help={help}
      back={{ href: backHref, label: backHref.endsWith('principles') ? '본질 · 원리' : '방법론 · 공부법' }}
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="statement">
            <h2 id="statement" className="sr-only">문장</h2>
            <p className="text-lg leading-relaxed text-[var(--t1)]">{item.statement}</p>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--t2)]">
              <span>{STATUS_LABEL[item.status]}</span>
              <span aria-hidden>·</span>
              <span className="font-mono text-xs">v{item.version}</span>
              <span aria-hidden>·</span>
              <span>효과 {item.efficacy === 'not_assessed' ? '평가 안 함' : item.efficacy}</span>
              {item.statusReason && (
                <>
                  <span aria-hidden>·</span>
                  <span>사유 — {item.statusReason}</span>
                </>
              )}
            </p>
            {chips.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="조건">
                {chips.map((c) => (
                  <li key={c} className="rounded border border-[var(--bd)] px-1.5 py-0.5 text-xs text-[var(--t2)]">
                    {label[c] ?? c}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="chain" className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 id="chain" className="mb-2 text-sm font-semibold text-[var(--t1)]">
                기대는 위층 {item.layer === 'essence' && <span className="font-normal text-[var(--t3)]">(본질이 맨 위)</span>}
              </h2>
              {up.length === 0 ? (
                <p className="text-sm text-[var(--t3)]">{item.layer === 'essence' ? '—' : '아직 잇지 않았다'}</p>
              ) : (
                <ul className="space-y-2">
                  {up.map((l) => (
                    <li key={l.other.id} className="text-sm">
                      <Link href={`/admin/knowledge/item/${l.other.slug}`} className={LINK_CLASS}>
                        ↑ {LAYER_LABEL[l.other.layer]} · {l.other.title}
                      </Link>
                      <span className="block text-[var(--t2)]">{l.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold text-[var(--t1)]">떠받치는 아래층</h2>
              {down.length === 0 ? (
                <p className="text-sm text-[var(--t3)]">{item.layer === 'practice' ? '—' : '아직 없다'}</p>
              ) : (
                <ul className="space-y-2">
                  {down.map((l) => (
                    <li key={l.other.id} className="text-sm">
                      <Link href={`/admin/knowledge/item/${l.other.slug}`} className={LINK_CLASS}>
                        ↓ {LAYER_LABEL[l.other.layer]} · {l.other.title}
                      </Link>
                      <span className="block text-[var(--t2)]">{l.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {side.length > 0 && (
              <div className="md:col-span-2">
                <h2 className="mb-2 text-sm font-semibold text-[var(--t1)]">옆 관계</h2>
                <ul className="space-y-2">
                  {side.map((l) => (
                    <li key={`${l.kind}-${l.other.id}`} className="text-sm">
                      <span className="mr-2 text-[var(--t3)]">{SIDE_LABEL[l.kind] ?? l.kind}</span>
                      <Link href={`/admin/knowledge/item/${l.other.slug}`} className={LINK_CLASS}>
                        {LAYER_LABEL[l.other.layer]} · {l.other.title}
                      </Link>
                      <span className="block text-[var(--t2)]">{l.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section aria-labelledby="evidence">
            <h2 id="evidence" className="mb-2 text-sm font-semibold text-[var(--t1)]">
              근거 <span className="tabular-nums text-[var(--t2)]">{evidence.length}</span>
            </h2>
            {evidence.length === 0 ? (
              <EmptyState title="근거가 없습니다" next="근거가 없으면 채택할 수 없습니다. 오른쪽에서 링크나 기출 원천을 연결하세요." />
            ) : (
              <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
                {evidence.map((e) => (
                  <li key={e.id} className="grid gap-2 py-3 text-sm md:grid-cols-[8rem_1fr]">
                    <div className="space-y-1">
                      <GradeMark grade={e.grade} label={GRADE_LABEL[e.grade]} />
                      <span className="block text-xs text-[var(--t3)]">{ATTRIBUTION_LABEL[e.attribution]}</span>
                    </div>
                    <div className="min-w-0">
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noreferrer noopener" className={LINK_CLASS}>
                          {e.title}
                        </a>
                      ) : (
                        <span className="text-[var(--t1)]">
                          {e.sourceType === 'csat_origin' ? `기출 원천 ${originLabel.get(e.title) ?? ''}` : e.title}
                        </span>
                      )}
                      {e.locator && <span className="ml-2 font-mono text-xs text-[var(--t2)]">{e.locator}</span>}
                      {e.note && <p className="mt-1 text-[var(--t2)]">{e.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-8 lg:border-l lg:border-[var(--bd)] lg:pl-8" aria-label="편집">
          <StatusActions itemId={item.id} status={item.status} />
          <LinkForm
            itemId={item.id}
            layer={item.layer}
            candidates={others.map((o) => ({ id: o.id, title: o.title, layer: o.layer }))}
          />
          <EvidenceForm itemId={item.id} origins={originOptions} />
          <section aria-labelledby="history">
            <h2 id="history" className="mb-2 text-sm font-semibold text-[var(--t1)]">검토 기록</h2>
            <ol className="space-y-2 text-sm">
              {reviews.map((r, i) => (
                <li key={`${r.at}-${i}`} className="text-[var(--t2)]">
                  <span className="font-mono text-xs text-[var(--t3)]">{r.at.slice(0, 16).replace('T', ' ')}</span>{' '}
                  {r.fromStatus ? `${STATUS_LABEL[r.fromStatus as keyof typeof STATUS_LABEL] ?? r.fromStatus} → ` : ''}
                  {STATUS_LABEL[r.toStatus as keyof typeof STATUS_LABEL] ?? r.toStatus}
                  <span className="block text-xs">{r.reviewer}{r.reason ? ` — ${r.reason}` : ''}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </KnowledgeFrame>
  )
}
