// apps/web/src/app/admin/knowledge/gaps/page.tsx
// 공백 — 모르는 것. 「0」이 아니라 「모름」으로, 원인과 다음 행동을 함께 둔다.
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EmptyState, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { GAP_CAUSE_LABEL, LAYER_LABEL } from '@/lib/knowledge/labels'
import { listGaps } from '@/lib/knowledge/server'

export const dynamic = 'force-dynamic'

export default async function GapsPage() {
  await requireAdmin('/admin/knowledge/gaps')
  const frame = { title: '공백', question: '아직 모르는 것은 무엇이고, 다음에 무엇을 하는가', help: <AdminScreenHelp screen="knowledge-gaps" /> }
  let gaps
  try {
    gaps = await listGaps()
  } catch {
    return (
      <KnowledgeFrame {...frame}>
        <LoadFailed what="공백" href="/admin/knowledge/gaps" />
      </KnowledgeFrame>
    )
  }
  return (
    <KnowledgeFrame {...frame}>
      {gaps.length === 0 ? (
        <EmptyState title="기록된 공백이 없습니다" next="모르는 것이 없다는 뜻이 아닙니다 — 조사하면서 막힌 곳을 공백으로 남기세요." />
      ) : (
        <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
          {gaps.map((g) => (
            <li key={g.id} className="grid gap-2 py-4 md:grid-cols-[1fr_14rem]">
              <div className="min-w-0">
                <h3 className="font-semibold text-[var(--t1)]">{g.question}</h3>
                <p className="mt-1 text-sm text-[var(--t2)]">다음 행동 — {g.nextAction}</p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm md:text-right">
                <dt className="text-[var(--t3)]">원인</dt>
                <dd className="text-[var(--t1)]">{GAP_CAUSE_LABEL[g.cause] ?? g.cause}</dd>
                {g.layer && (
                  <>
                    <dt className="text-[var(--t3)]">층</dt>
                    <dd className="text-[var(--t1)]">{LAYER_LABEL[g.layer]}</dd>
                  </>
                )}
                {g.affectedCount !== null && (
                  <>
                    <dt className="text-[var(--t3)]">영향</dt>
                    <dd className="tabular-nums text-[var(--t1)]">{g.affectedCount}</dd>
                  </>
                )}
                <dt className="text-[var(--t3)]">상태</dt>
                <dd className="text-[var(--t1)]">{g.status === 'open' ? '열림' : '닫힘'}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </KnowledgeFrame>
  )
}
