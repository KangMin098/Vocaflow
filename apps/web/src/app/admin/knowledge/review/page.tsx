// apps/web/src/app/admin/knowledge/review/page.tsx
// 검토 대기 — 추출됨·검토 중 항목. 사람이 판단해야 채택/반려로 넘어간다.
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { ItemList } from '@/components/admin/knowledge/ItemList'
import { KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { NEEDS_REVIEW } from '@/lib/knowledge/labels'
import { loadItemView } from '@/lib/knowledge/server'

export const dynamic = 'force-dynamic'

export default async function ReviewPage() {
  await requireAdmin('/admin/knowledge/review')
  const frame = { title: '검토 대기', question: '사람의 판단을 기다리는 항목은 무엇인가', help: <AdminScreenHelp screen="knowledge-review" /> }
  let view
  try {
    view = await loadItemView({ statuses: [...NEEDS_REVIEW] })
  } catch {
    return (
      <KnowledgeFrame {...frame}>
        <LoadFailed what="검토 대기열" href="/admin/knowledge/review" />
      </KnowledgeFrame>
    )
  }
  return (
    <KnowledgeFrame {...frame}>
      <p className="mb-4 text-sm text-[var(--t2)]">
        대기 <b className="tabular-nums text-[var(--t1)]">{view.items.length}</b>건 · 근거 없는 항목{' '}
        <b className="tabular-nums text-[var(--t1)]">{view.items.filter((i) => !view.evidenceCount[i.id]).length}</b>건
      </p>
      <ItemList
        {...view}
        empty={{ title: '검토할 항목이 없습니다', next: '추출 드레인이 새 항목을 넣으면 여기에 뜹니다.' }}
      />
    </KnowledgeFrame>
  )
}
