// apps/web/src/app/admin/knowledge/principles/page.tsx
// 본질(L1) · 원리(L2) — 적고 오래가는 층. 본질은 사람만 쓰고 사람이 승인한다(SYSTEM §1).
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { ItemList } from '@/components/admin/knowledge/ItemList'
import { NewItemForm } from '@/components/admin/knowledge/NewItemForm'
import { KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadItemView } from '@/lib/knowledge/server'

export const dynamic = 'force-dynamic'

export default async function PrinciplesPage() {
  await requireAdmin('/admin/knowledge/principles')
  const frame = { question: '영역마다 「잘한다」는 무엇이고, 왜 그렇게 배워지는가', help: <AdminScreenHelp screen="knowledge-principles" /> }
  let view
  try {
    view = await loadItemView({ layers: ['essence', 'principle'] })
  } catch {
    return (
      <KnowledgeFrame title="본질 · 원리" {...frame}>
        <LoadFailed what="본질·원리" href="/admin/knowledge/principles" />
      </KnowledgeFrame>
    )
  }
  return (
    <KnowledgeFrame title="본질 · 원리" {...frame}>
      <NewItemForm layers={['essence', 'principle']} taxonomy={view.taxonomy} />
      <ItemList
        {...view}
        empty={{
          title: '본질·원리 항목이 없습니다',
          next: '원리는 학습 과학 7 씨앗(import-seed.mjs)으로 시작합니다. 본질은 관리자가 근거를 보고 직접 씁니다.',
        }}
      />
    </KnowledgeFrame>
  )
}
