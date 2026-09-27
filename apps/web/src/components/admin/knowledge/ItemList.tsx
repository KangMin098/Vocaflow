// apps/web/src/components/admin/knowledge/ItemList.tsx
// 층 항목 목록 — 층 표지 · 제목 · 문장 · 상태 · 조건 칩 · 근거 수.
// 근거가 0 인 항목은 「근거 없음」을 글자로 드러낸다(출처 없는 주장은 채택하지 않는다 — SYSTEM §3).
import { LAYER_LABEL, LAYER_RANK, STATUS_LABEL } from '@/lib/knowledge/labels'
import type { KnowledgeItem } from '@/lib/knowledge/server'
import { EmptyState } from './KnowledgeFrame'

interface ItemListProps {
  items: KnowledgeItem[]
  evidenceCount: Record<string, number>
  taxonomyLabel: Record<string, string>
  empty: { title: string; next: string }
}

export function ItemList({ items, evidenceCount, taxonomyLabel, empty }: ItemListProps) {
  if (items.length === 0) return <EmptyState title={empty.title} next={empty.next} />
  return (
    <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
      {items.map((it) => {
        const n = evidenceCount[it.id] ?? 0
        const chips = [...it.skillIds, ...it.conditionIds]
        return (
          <li key={it.id} className="grid gap-2 py-4 md:grid-cols-[7rem_1fr_9rem]">
            <div className="text-sm">
              <span className="font-mono text-xs text-[var(--t3)]">L{LAYER_RANK[it.layer]}</span>{' '}
              <span className="text-[var(--t2)]">{LAYER_LABEL[it.layer]}</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-[var(--t1)]">{it.title}</h3>
              <p className="mt-1 text-sm text-[var(--t1)]">{it.statement}</p>
              {chips.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="조건">
                  {chips.map((c) => (
                    <li key={c} className="rounded border border-[var(--bd)] px-1.5 py-0.5 text-xs text-[var(--t2)]">
                      {taxonomyLabel[c] ?? c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <dl className="text-sm md:text-right">
              <dt className="sr-only">상태</dt>
              <dd className="text-[var(--t1)]">{STATUS_LABEL[it.status]}</dd>
              <dt className="sr-only">근거</dt>
              <dd className={n === 0 ? 'text-[var(--t3)]' : 'text-[var(--t2)]'}>
                {n === 0 ? '근거 없음' : `근거 ${n}`}
              </dd>
              <dt className="sr-only">버전</dt>
              <dd className="font-mono text-xs text-[var(--t3)]">v{it.version}</dd>
            </dl>
          </li>
        )
      })}
    </ul>
  )
}
