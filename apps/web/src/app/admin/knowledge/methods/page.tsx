// apps/web/src/app/admin/knowledge/methods/page.tsx
// 방법론(L3) · 공부법(L4) — 조건(학령·숙련도·시험·과정)이 다르면 다른 항목이다(SYSTEM §1).
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { ItemList } from '@/components/admin/knowledge/ItemList'
import { NewItemForm } from '@/components/admin/knowledge/NewItemForm'
import { KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadItemView } from '@/lib/knowledge/server'

export const dynamic = 'force-dynamic'

export default async function MethodsPage() {
  await requireAdmin('/admin/knowledge/methods')
  const frame = { title: '방법론 · 공부법', question: '원리를 어떤 조건에서 어떤 절차로 쓰는가', help: <AdminScreenHelp screen="knowledge-methods" /> }
  let view
  try {
    view = await loadItemView({ layers: ['method', 'practice'] })
  } catch {
    return (
      <KnowledgeFrame {...frame}>
        <LoadFailed what="방법론·공부법" href="/admin/knowledge/methods" />
      </KnowledgeFrame>
    )
  }
  return (
    <KnowledgeFrame {...frame}>
      <NewItemForm layers={['method', 'practice']} taxonomy={view.taxonomy} />
      <ItemList
        {...view}
        empty={{
          title: '방법론·공부법 항목이 아직 없습니다',
          next: '공식 대본(BBC·VOA·British Council)과 강사 공식 자료에서 추출 드레인을 돌리면 「추출됨」으로 쌓이고, 검토 대기에서 채택합니다.',
        }}
      />
    </KnowledgeFrame>
  )
}
