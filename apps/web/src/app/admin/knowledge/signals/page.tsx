// apps/web/src/app/admin/knowledge/signals/page.tsx
// E 제품 적용 · 품질 › 성과 검토 신호(트랙 E · 2026-10-08) — 학습 결과가 원리 · 방법론 검토로 돌아오는 자리.
// 적용마다 적격 첫 시도(실제 · 독립 · 해설 전 · 시각 확실)를 단계별로 세어 「사람이 볼 이유」를 보인다.
// 이 화면은 아무것도 바꾸지 않는다 — 효과를 판정하지 않고, 재검토는 항목 화면의 상태 변경으로 사람이 연다.
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EmptyState, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { STATUS_LABEL, isStatus } from '@/lib/knowledge/labels'
import { loadEffectSignals, type SignalRow } from '@/lib/knowledge/effect-signals-server'
import { APP_STATUS_LABEL, APP_SURFACE_LABEL, isAppStatus, isAppSurface } from '@/lib/knowledge/vnext-labels'

export const dynamic = 'force-dynamic'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const LEVEL_LABEL: Record<SignalRow['level'], string> = { review: '검토 필요', watch: '지켜볼 것', info: '아직 말할 수 없음', none: '신호 없음' }
const ORDER: Record<SignalRow['level'], number> = { review: 0, watch: 1, info: 2, none: 3 }
const PHASE_LABEL: Record<string, string> = { pre: '사전', practice: '연습', post: '사후', delayed: '지연', transfer: '새 지문(전이)', review: '복습' }
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

export default async function KnowledgeSignalsPage() {
  await requireAdmin('/admin/knowledge/signals')
  const help = <AdminScreenHelp screen="knowledge-signals" />
  let rows: SignalRow[]
  try {
    rows = await loadEffectSignals()
  } catch {
    return (
      <KnowledgeFrame title="성과 검토 신호" question="학습 결과가 어떤 원리 · 방법을 다시 볼 이유가 되나" help={help}>
        <LoadFailed what="성과 검토 신호" href="/admin/knowledge/signals" />
      </KnowledgeFrame>
    )
  }
  rows.sort((a, b) => ORDER[a.level] - ORDER[b.level])
  const review = rows.filter((r) => r.level === 'review').length

  return (
    <KnowledgeFrame title="성과 검토 신호" question="학습 결과가 어떤 원리 · 방법을 다시 볼 이유가 되나" help={help}>
      <p className="mb-6 max-w-3xl text-sm text-[var(--t2)]">
        신호는 <b>검토할 이유</b>이지 효과 판정이 아니다. 성과가 낮다고 방법이 틀린 것도, 높다고 입증된 것도 아니다 — 연구 설계 · 표본 · 비교 조건은 학습 설계 · 검증에서 따로 본다.
        검토 필요 <b className="tabular-nums text-[var(--t1)]">{review}</b> / 적용 {rows.length}
      </p>
      {rows.length === 0 ? (
        <EmptyState title="학습자에게 나간 적용이 없습니다" next="제품 적용 · 품질에서 적용을 만들고 켜면 수행 기록이 쌓입니다." />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.applicationId} className="rounded border border-[var(--bd)] p-4" data-testid="signal-row" data-level={r.level}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--t1)]">
                  {r.itemSlug ? (
                    <Link href={`/admin/knowledge/item/${r.itemSlug}`} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>
                      {r.itemTitle ?? r.itemSlug}
                    </Link>
                  ) : (
                    '항목 없음'
                  )}
                </h2>
                <span className="text-sm font-semibold text-[var(--t1)]">{LEVEL_LABEL[r.level]}</span>
              </div>
              <p className="text-xs text-[var(--t2)]">
                {isAppSurface(r.surface) ? APP_SURFACE_LABEL[r.surface] : r.surface} · {r.surfaceRef} · v{r.version} · 적용 {isAppStatus(r.status) ? APP_STATUS_LABEL[r.status] : r.status}
                {r.itemStatus && ` · 항목 ${isStatus(r.itemStatus) ? STATUS_LABEL[r.itemStatus] : r.itemStatus}`} · 표본 문턱 {r.minN}명
              </p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--t1)]">
                {r.signals.map((s) => (
                  <li key={s.kind}>
                    <b>{LEVEL_LABEL[s.level]}</b> — {s.message}
                  </li>
                ))}
              </ul>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-[var(--t3)]">실제 첫 시도 · 제외 · 합성</dt>
                  <dd className="tabular-nums text-[var(--t1)]">
                    {r.counts.real} · {r.counts.excluded} · {r.counts.synthetic}
                  </dd>
                </div>
                {Object.entries(r.eligible).map(([p, s]) => (
                  <div key={p}>
                    <dt className="text-[var(--t3)]">{PHASE_LABEL[p] ?? p} 적격</dt>
                    <dd className="tabular-nums text-[var(--t1)]">
                      학습자 {s.learners} · 정답률 {pct(s.accuracy)}
                    </dd>
                  </div>
                ))}
              </dl>
              {r.level === 'review' && r.itemSlug && (
                <p className="mt-3 text-xs text-[var(--t2)]">
                  재검토를 열려면{' '}
                  <Link href={`/admin/knowledge/item/${r.itemSlug}`} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>
                    항목 화면
                  </Link>
                  에서 상태를 「검토 중」으로 바꾸고 사유에 이 신호를 적는다 — 적용은 DB 가 자동으로 멈춘다.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </KnowledgeFrame>
  )
}
