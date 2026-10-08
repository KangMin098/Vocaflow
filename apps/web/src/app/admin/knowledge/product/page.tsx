// apps/web/src/app/admin/knowledge/product/page.tsx
// E 제품 적용 · 품질(2026-10-08 vNext) — 학습자에게 나가 있는 적용 · 배포 버전 · 학습 결과 · 근거 변경 영향 · 켜기 · 중단 · 롤백.
// 켜기는 채택 항목 + 검증 계획이 있어야 DB 가 받는다. 항목이 재검토로 가면 DB 가 적용을 자동 중단한다(학습자에게서 내린다).
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EmptyState, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { ApplicationStatusForm } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { STATUS_LABEL } from '@/lib/knowledge/labels'
import { listItems } from '@/lib/knowledge/server'
import { APP_STATUSES, APP_STATUS_LABEL, APP_SURFACE_LABEL, TRIAL_RESULT_LABEL, TRIAL_STATUS_LABEL } from '@/lib/knowledge/vnext-labels'
import { listApplications } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export default async function KnowledgeProductPage() {
  await requireAdmin('/admin/knowledge/product')
  const help = <AdminScreenHelp screen="knowledge-product" />
  let data
  try {
    const [items, apps] = await Promise.all([listItems(), listApplications()])
    data = { items, apps }
  } catch {
    return (
      <KnowledgeFrame title="제품 적용 · 품질" question="학습자에게 무엇이 나가 있고 결과는 어떤가" help={help}>
        <LoadFailed what="제품 적용" href="/admin/knowledge/product" />
      </KnowledgeFrame>
    )
  }
  const byId = new Map(data.items.map((i) => [i.id, i]))
  // 근거 변경 영향 — 자동 중단된 적용(항목이 재검토 · 반려로 감) · 항목 상태가 적용과 어긋난 것
  const impacted = data.apps.filter((a) => a.status === 'paused' && (a.statusReason ?? '').includes('자동 중단'))
  const drift = data.apps.filter((a) => a.status === 'active' && !['adopted', 'applied'].includes(byId.get(a.itemId)?.status ?? ''))

  return (
    <KnowledgeFrame title="제품 적용 · 품질" question="학습자에게 무엇이 나가 있고 결과는 어떤가" help={help}>
      <section aria-labelledby="impact" className="mb-8">
        <h2 id="impact" className="mb-3 text-lg font-semibold text-[var(--t1)]">근거 변경 영향 <span className="tabular-nums text-[var(--t2)]">{impacted.length + drift.length}</span></h2>
        {impacted.length + drift.length === 0 ? <p className="text-sm text-[var(--t2)]">근거 변경으로 멈춘 적용이 없다.</p> : (
          <ul className="divide-y divide-[var(--bd)] border-y border-[var(--error)] text-sm" data-testid="product-impact">
            {impacted.map((a) => <li key={a.id} className="py-2">{a.surfaceRef} — {a.statusReason}</li>)}
            {drift.map((a) => <li key={a.id} className="py-2">{a.surfaceRef} — 항목이 {STATUS_LABEL[byId.get(a.itemId)?.status ?? 'in_review']} 인데 적용 중(확인 필요)</li>)}
          </ul>
        )}
      </section>

      {data.apps.length === 0 ? (
        <EmptyState title="제품 적용이 없습니다" next="D 학습 설계 · 검증에서 채택된 과제 · 방법으로 적용 초안과 검증 계획을 만든 뒤 여기서 켠다." />
      ) : (
        APP_STATUSES.map((st) => {
          const rows = data.apps.filter((a) => a.status === st)
          if (rows.length === 0) return null
          return (
            <section key={st} aria-labelledby={`st-${st}`} className="mb-8">
              <h2 id={`st-${st}`} className="mb-3 text-lg font-semibold text-[var(--t1)]">{APP_STATUS_LABEL[st]} <span className="tabular-nums text-[var(--t2)]">{rows.length}</span></h2>
              <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]" data-testid={`product-${st}`}>
                {rows.map((a) => {
                  const it = byId.get(a.itemId)
                  const real = a.trials.filter((t) => !t.synthetic)
                  return (
                    <li key={a.id} className="space-y-2 py-3 text-sm">
                      <p>
                        <Link href={`/admin/knowledge/product/${a.id}`} className={`inline-flex min-h-11 items-center font-medium text-[var(--t1)] underline ${FOCUS}`} data-testid="trace-link">{a.surfaceRef}</Link> v{a.version} · {APP_SURFACE_LABEL[a.surface]}
                        {a.releasedAt && ` · 배포 ${a.releasedAt.slice(0, 10)}`}
                        {it && <> · <Link href={`/admin/knowledge/item/${it.slug}`} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>{it.title}</Link> ({STATUS_LABEL[it.status]} · 효과 {it.efficacy === 'not_assessed' ? '평가 안 함' : it.efficacy})</>}
                      </p>
                      <p className="text-xs text-[var(--t2)]">
                        학습 결과: 수행 기록 실제 {a.attempts.real} · 합성 {a.attempts.synthetic} · 검증 {a.trials.length}(실제 {real.length})
                        {a.trials.map((t) => ` · ${t.synthetic ? '합성' : '실제'} ${TRIAL_STATUS_LABEL[t.status]}${t.result ? ` ${TRIAL_RESULT_LABEL[t.result]}` : ''}`).join('')}
                        {a.statusReason && ` · 사유: ${a.statusReason}`}
                      </p>
                      <ApplicationStatusForm id={a.id} from={a.status} />
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })
      )}
    </KnowledgeFrame>
  )
}
