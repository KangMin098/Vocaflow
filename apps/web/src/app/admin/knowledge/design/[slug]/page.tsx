// apps/web/src/app/admin/knowledge/design/[slug]/page.tsx
// 학습 설계 상세 — 학습자에게 보이는 것(이유·절차) · 기대는 항목(역할별) · 배포 문턱 · 효과 검증 계획과 현재 수치 · 배포 구간 · 미리보기.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { DesignLinkForm, DesignStatusActions, RollbackButton } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { LAYER_LABEL, STATUS_LABEL } from '@/lib/knowledge/labels'
import {
  DESIGN_ROLES,
  DESIGN_ROLE_LABEL,
  END_REASON_LABEL,
  FIT_LABEL,
  LEARNER_MODULES,
  RESEARCH_LEVEL_LABEL,
  VERDICT_LABEL,
  isLearnerModuleKey,
  parseThresholds,
} from '@/lib/knowledge/vnext'
import { loadDesignDetail } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

export default async function DesignDetailPage({ params }: { params: { slug: string } }) {
  await requireAdmin(`/admin/knowledge/design/${params.slug}`)
  let d
  try {
    d = await loadDesignDetail(params.slug)
  } catch {
    return (
      <KnowledgeFrame title="학습 설계" question="이 과제는 무엇에 기대고, 어떻게 확인하나" help={<AdminScreenHelp screen="knowledge-design-item" />} back={{ href: '/admin/knowledge/design', label: '학습 설계·검증' }}>
        <LoadFailed what="학습 설계" href={`/admin/knowledge/design/${params.slug}`} />
      </KnowledgeFrame>
    )
  }
  if (!d) notFound()
  const { design } = d
  const th = parseThresholds(design.assessment)
  const learnerPath = isLearnerModuleKey(design.moduleKey) ? LEARNER_MODULES[design.moduleKey].path(design.slug) : null
  const p = d.liveProtocol
  const evByItem = new Map<string, typeof d.evidence>()
  for (const e of d.evidence) evByItem.set(e.itemId, [...(evByItem.get(e.itemId) ?? []), e])

  return (
    <KnowledgeFrame title={design.title} question="이 과제는 무엇에 기대고, 어떻게 확인하나" help={<AdminScreenHelp screen="knowledge-design-item" />} back={{ href: '/admin/knowledge/design', label: '학습 설계·검증' }}>
      <div className="grid gap-10 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-10">
          <section aria-labelledby="learner">
            <h2 id="learner" className="mb-2 text-lg font-semibold text-[var(--t1)]">학습자에게 보이는 것</h2>
            <p className="text-sm leading-7 text-[var(--t1)]">{design.learnerSummary}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {design.procedure.map((s, i) => (
                <li key={i}>
                  <b>{s.title}</b>
                  {s.detail && <span className="text-[var(--t2)]"> — {s.detail}</span>}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-[var(--t2)]">
              훈련 {design.trainTypeIds.join(', ') || '—'} · 전이 {design.transferTypeIds.join(', ') || '—'}
              {design.mapCodes.length > 0 && ` · 학습 지도 ${design.mapCodes.join(', ')}`}
              {design.excludeConditions.length > 0 && ` · 제외 ${design.excludeConditions.join(', ')}`}
            </p>
            {learnerPath && (
              <Link href={`${learnerPath}?preview=1`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--p)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
                학습자 화면 미리보기(기록은 미리보기로만 남는다)
              </Link>
            )}
          </section>

          <section aria-labelledby="links">
            <h2 id="links" className="mb-2 text-lg font-semibold text-[var(--t1)]">기대는 항목</h2>
            <div className="space-y-4">
              {DESIGN_ROLES.map((role) => {
                const xs = d.links.filter((l) => l.role === role)
                if (xs.length === 0) return null
                return (
                  <div key={role}>
                    <h3 className="text-sm font-semibold text-[var(--t2)]">{DESIGN_ROLE_LABEL[role]}</h3>
                    <ul className="mt-1 space-y-2">
                      {xs.map((l) => {
                        const ev = evByItem.get(l.item.id) ?? []
                        return (
                          <li key={l.item.id} className="text-sm">
                            <Link href={`/admin/knowledge/item/${l.item.slug}`} className="inline-flex min-h-11 items-center underline">
                              {l.item.title}
                            </Link>{' '}
                            <span className={l.item.status === 'adopted' || l.item.status === 'applied' ? 'text-[var(--t1)]' : 'font-semibold text-[var(--error-ink)]'}>
                              {STATUS_LABEL[l.item.status]}
                            </span>
                            <span className="text-[var(--t3)]"> · {LAYER_LABEL[l.item.layer]} · 근거 {ev.length}</span>
                            {ev.length > 0 && (
                              <span className="block text-xs text-[var(--t2)]">
                                {ev.map((e) => `${e.grade}/${RESEARCH_LEVEL_LABEL[e.researchLevel]}/${FIT_LABEL[e.fit]}`).join(' · ')}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
            {design.status !== 'deployed' && (
              <div className="mt-4">
                <DesignLinkForm designId={design.id} />
              </div>
            )}
          </section>

          <section aria-labelledby="protocol">
            <h2 id="protocol" className="mb-2 text-lg font-semibold text-[var(--t1)]">효과 검증 — v{design.version} 실학습 기록</h2>
            <p className="text-sm text-[var(--t2)]">
              사전 = 첫 {th.preCount}회 · 사후 = 그 뒤(학습자당 {th.minPostPerLearner}회 이상) · 지연 = {th.delayDays}일 쉰 뒤 첫 수행 · 전이 = 훈련하지 않은 유형 · 판정 문턱 실학습자 {th.minLearners}명
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              {[
                ['실학습자', `${d.runCounts.learners}명 (자격 ${p.nQualified})`],
                ['실기록', String(d.runCounts.real)],
                ['미리보기 · 합성', `${d.runCounts.preview} · ${d.runCounts.synthetic}`],
                ['판정', VERDICT_LABEL[p.verdict]],
                ['주장 적중 사전→사후', `${pct(p.metrics.preHit)} → ${pct(p.metrics.postHit)}`],
                ['선지 정답 사전→사후', `${pct(p.metrics.preCorrect)} → ${pct(p.metrics.postCorrect)}`],
                ['지연', `${pct(p.metrics.delayedHit)} (${p.metrics.nDelayed}명)`],
                ['전이', `${pct(p.metrics.transferHit)} (${p.metrics.nTransfer}명)`],
              ].map(([k, v]) => (
                <div key={k} className="rounded border border-[var(--bd)] p-3">
                  <dt className="text-xs text-[var(--t3)]">{k}</dt>
                  <dd className="tabular-nums text-[var(--t1)]">{v}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 list-disc pl-5 text-xs text-[var(--t2)]">
              {p.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-8">
          <section aria-labelledby="gate">
            <h2 id="gate" className="mb-2 text-sm font-semibold text-[var(--t1)]">배포 문턱</h2>
            {d.readiness.ok ? (
              <p className="text-sm text-[var(--t1)]">통과 — 연결된 항목이 모두 채택됐다.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--t1)]">
                {d.readiness.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
          <DesignStatusActions designId={design.id} status={design.status} version={design.version} readyToDeploy={d.readiness.ok} />
          {design.statusReason && <p className="text-sm text-[var(--t2)]">사유: {design.statusReason}</p>}
          {d.inquiry && (
            <p className="text-sm text-[var(--t2)]">
              탐구 질문:{' '}
              <Link href={`/admin/knowledge/lab/${d.inquiry.slug}`} className="inline-flex min-h-11 items-center underline">
                {d.inquiry.question}
              </Link>
            </p>
          )}
          <section aria-labelledby="deps">
            <h2 id="deps" className="mb-2 text-sm font-semibold text-[var(--t1)]">배포 구간</h2>
            {d.deployments.length === 0 ? (
              <p className="text-sm text-[var(--t2)]">배포한 적 없음</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {d.deployments.map((x) => (
                  <li key={x.id}>
                    v{x.designVersion} · {x.startedAt.slice(0, 10)} ~ {x.endedAt ? x.endedAt.slice(0, 10) : '진행 중'}
                    {x.endReason && <span className="block text-xs text-[var(--t2)]">{END_REASON_LABEL[x.endReason] ?? x.endReason}</span>}
                    {x.endedAt && design.status !== 'deployed' && x.designVersion !== design.version && (
                      <RollbackButton designId={design.id} deploymentId={x.id} version={design.version} label={`v${x.designVersion} 내용으로 되돌리기`} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </KnowledgeFrame>
  )
}
