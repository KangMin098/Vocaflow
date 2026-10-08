// apps/web/src/app/admin/knowledge/quality/page.tsx
// E 제품 적용·품질 — 설계별 배포 구간 · 수행 기록(실·미리보기·합성 분리) · 현재 판정과 저장된 검증 실행 · 근거 변경 영향(채택에서 벗어난 연결 항목).
// 중단·재개·종료·롤백은 설계 상세에서 한다(이 화면은 어디를 눌러야 하는지 가리킨다).
import Link from 'next/link'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EmptyState, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { ValidationButton } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { STATUS_LABEL } from '@/lib/knowledge/labels'
import { DESIGN_ROLE_LABEL, DESIGN_STATUS_LABEL, END_REASON_LABEL, VERDICT_LABEL } from '@/lib/knowledge/vnext'
import { loadQuality } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'

export default async function KnowledgeQualityPage() {
  await requireAdmin('/admin/knowledge/quality')
  let rows
  try {
    rows = await loadQuality()
  } catch {
    return (
      <KnowledgeFrame title="제품 적용·품질" question="배포한 과제가 학습자에게 닿고, 근거가 바뀌면 멈추는가" help={<AdminScreenHelp screen="knowledge-quality" />} back={{ href: '/admin/knowledge', label: '원리 운영실' }}>
        <LoadFailed what="배포·검증 현황" href="/admin/knowledge/quality" />
      </KnowledgeFrame>
    )
  }
  return (
    <KnowledgeFrame title="제품 적용·품질" question="배포한 과제가 학습자에게 닿고, 근거가 바뀌면 멈추는가" help={<AdminScreenHelp screen="knowledge-quality" />} back={{ href: '/admin/knowledge', label: '원리 운영실' }}>
      {rows.length === 0 ? (
        <EmptyState title="배포 준비 이상인 설계가 없습니다" next="학습 설계·검증에서 설계를 「배포 준비」로 올리면 여기에 나타납니다." />
      ) : (
        <div className="space-y-8">
          {rows.map((r) => {
            const open = r.deployments.find((x) => !x.endedAt) ?? null
            const last = r.deployments[0] ?? null
            return (
              <article key={r.design.id} className="rounded-[var(--r-lg)] border border-[var(--bd)] p-5">
                <header className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold text-[var(--t1)]">
                    <Link href={`/admin/knowledge/design/${r.design.slug}`} className="inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
                      {r.design.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-[var(--t1)]">
                    {DESIGN_STATUS_LABEL[r.design.status]} · v{r.design.version}
                    {open ? ` · ${open.startedAt.slice(0, 10)}부터 배포` : last?.endReason ? ` · 마지막 구간: ${END_REASON_LABEL[last.endReason] ?? last.endReason}` : ''}
                  </p>
                </header>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                  {[
                    ['실기록', String(r.realRuns)],
                    ['미리보기', String(r.previewRuns)],
                    ['합성', String(r.syntheticRuns)],
                    ['현재 판정', VERDICT_LABEL[r.live.verdict]],
                    ['저장된 검증', r.latest ? `${VERDICT_LABEL[r.latest.verdict]} · ${r.latest.computedAt.slice(0, 10)}${r.latest.synthetic ? ' · 합성' : ''}` : '없음'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded border border-[var(--bd)] p-3">
                      <dt className="text-xs text-[var(--t3)]">{k}</dt>
                      <dd className="tabular-nums text-[var(--t1)]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <section aria-label="근거 변경 영향" className="mt-4">
                  <h3 className="text-sm font-semibold text-[var(--t1)]">근거 변경 영향</h3>
                  {r.notAdopted.length === 0 ? (
                    <p className="text-sm text-[var(--t2)]">연결 항목이 모두 채택 상태다.</p>
                  ) : (
                    <ul className="mt-1 list-disc pl-5 text-sm">
                      {r.notAdopted.map((x) => (
                        <li key={x.slug}>
                          {DESIGN_ROLE_LABEL[x.role]}{' '}
                          <Link href={`/admin/knowledge/item/${x.slug}`} className="inline-flex min-h-11 items-center underline">
                            {x.title}
                          </Link>{' '}
                          — {STATUS_LABEL[x.status]}
                          {r.design.status === 'deployed' ? ' (배포 중인데 채택이 아니다 — 있을 수 없는 상태, DB 트리거 확인)' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <ul className="mt-2 list-disc pl-5 text-xs text-[var(--t2)]">
                  {r.live.caveats.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <div className="mt-4">
                  <ValidationButton designId={r.design.id} />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </KnowledgeFrame>
  )
}
