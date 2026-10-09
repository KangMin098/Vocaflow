// apps/web/src/app/admin/knowledge/design/page.tsx
// D 학습 설계 · 검증(2026-10-08 vNext) — 원리 기반 과제 · 방법이 어느 기제 · 역량에 기대는지, 어떤 학습 표면에 적용할지(초안),
// 효과를 어떻게 잴지(사전 · 사후 · 지연 · 전이 · 비교 조건 · 최소 표본). 학습자에게 내는 일은 E 제품 적용에서 한다.
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { ApplicationForm, TrialForm } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { STATUS_LABEL } from '@/lib/knowledge/labels'
import { listItems, listLinks } from '@/lib/knowledge/server'
import { APP_STATUS_LABEL, APP_SURFACE_LABEL, KIND_LABEL, TRIAL_RESULT_LABEL, TRIAL_STATUS_LABEL } from '@/lib/knowledge/vnext-labels'
import { trialReportLevel } from '@/lib/knowledge/vnext-rules'
import { listApplications } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export default async function KnowledgeDesignPage() {
  await requireAdmin('/admin/knowledge/design')
  const help = <AdminScreenHelp screen="knowledge-design" />
  let data
  try {
    const [items, links, apps] = await Promise.all([listItems(), listLinks(), listApplications()])
    data = { items, links, apps }
  } catch {
    return (
      <KnowledgeFrame title="학습 설계 · 검증" question="원리를 어떤 과제로 만들고 효과를 어떻게 잴까" help={help}>
        <LoadFailed what="학습 설계" href="/admin/knowledge/design" />
      </KnowledgeFrame>
    )
  }
  const byId = new Map(data.items.map((i) => [i.id, i]))
  // 설계 후보: 방법 · 과제 중 위층(기제 · 역량)에 이어진 것 — 원리에 기대지 않는 과제는 설계 근거가 없다
  const designable = data.items.filter((i) => i.kind === 'method' || i.kind === 'task')
  const upOf = (id: string) => data.links.filter((l) => l.fromId === id && l.kind === 'implements').map((l) => byId.get(l.toId)).filter(Boolean)
  const grounded = designable.filter((i) => upOf(i.id).length > 0)
  const methods = data.items.filter((i) => i.kind === 'method')

  return (
    <KnowledgeFrame title="학습 설계 · 검증" question="원리를 어떤 과제로 만들고 효과를 어떻게 잴까" help={help}>
      <section aria-labelledby="apps" className="mb-8">
        <h2 id="apps" className="mb-3 text-lg font-semibold text-[var(--t1)]">적용 설계 · 검증 계획 <span className="tabular-nums text-[var(--t2)]">{data.apps.length}</span></h2>
        {data.apps.length === 0 ? <p className="text-sm text-[var(--t2)]">아직 적용 초안이 없다 — 아래에서 과제 · 방법을 골라 초안을 만든다.</p> : (
          <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]" data-testid="design-apps">
            {data.apps.map((a) => {
              const it = byId.get(a.itemId)
              return (
                <li key={a.id} className="py-3 text-sm">
                  <span className="font-medium text-[var(--t1)]">{a.surfaceRef}</span> · {APP_SURFACE_LABEL[a.surface]} · {APP_STATUS_LABEL[a.status]}
                  {it && <> · <Link href={`/admin/knowledge/item/${it.slug}`} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>{it.title}</Link> ({STATUS_LABEL[it.status]})</>}
                  <ul className="mt-1 space-y-1 text-xs text-[var(--t2)]">
                    {a.trials.length === 0 && <li className="text-[var(--error)]">검증 계획 없음 — 학습자에게 켤 수 없다</li>}
                    {a.trials.map((t) => {
                      const d = t.design as { delayed_days?: number | null; transfer?: boolean; comparison?: string | null; min_n?: number; measures?: string[] }
                      return (
                        <li key={t.id}>
                          {t.synthetic ? '합성(경로 검증)' : '실제 학습자'} · {TRIAL_STATUS_LABEL[t.status]}{t.reviewRequiredAt ? ' · 재계산 필요(결과를 근거로 쓰지 않음)' : t.result ? ` · ${TRIAL_RESULT_LABEL[t.result]}` : ''} · 사전 · 사후
                          {d.delayed_days ? ` · 지연 ${d.delayed_days}일` : ''}{d.transfer ? ' · 전이' : ''} · 최소 표본 {d.min_n ?? 1} · {(d.measures ?? []).join(', ')}
                          {' — '}{trialReportLevel({ pre: true, post: true, delayedDays: d.delayed_days ?? null, transfer: Boolean(d.transfer), comparison: d.comparison ?? null, minN: d.min_n ?? 1, measures: d.measures ?? [] })}
                        </li>
                      )
                    })}
                    <li>수행 기록 실제 {a.attempts.real} · 합성 {a.attempts.synthetic}</li>
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <ApplicationForm itemOptions={designable.map((i) => ({ slug: i.slug, label: `${KIND_LABEL[i.kind!]} · ${i.title} (${STATUS_LABEL[i.status]})` }))} />
        <TrialForm applications={data.apps.filter((a) => a.status !== 'rolled_back').map((a) => ({ id: a.id, label: `${a.surfaceRef} · ${APP_STATUS_LABEL[a.status]}` }))} />
      </div>

      <section aria-labelledby="methods" className="mt-8">
        <h2 id="methods" className="mb-1 text-lg font-semibold text-[var(--t1)]">방법론 — 어느 기제에 기대나</h2>
        <p className="mb-3 text-sm text-[var(--t2)]">방법 · 과제 {designable.length} 중 위층(기제 · 역량)에 이어진 것 <span className="tabular-nums">{grounded.length}</span></p>
        <ul className="grid gap-2 md:grid-cols-2" data-testid="design-methods">
          {methods.map((m) => {
            const up = upOf(m.id)
            const tasks = data.links.filter((l) => l.toId === m.id && l.kind === 'implements').length
            return (
              <li key={m.id} className="rounded border border-[var(--bd)] p-3 text-sm">
                <Link href={`/admin/knowledge/map?node=${m.slug}`} className={`inline-flex min-h-11 items-center font-medium text-[var(--t1)] underline ${FOCUS}`}>{m.title}</Link>
                <span className="block text-xs text-[var(--t2)]">기대는 기제: {up.length ? up.map((u) => u!.title).join(' · ') : '없음 — 원리 근거 없는 방법'} · 과제 {tasks}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </KnowledgeFrame>
  )
}
