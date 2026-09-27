// apps/web/src/components/admin/knowledge/KnowledgeGrid.tsx
// 원리 지도 격자 — 영역 열 × 층 행. 칸 = 「채택 n」 / 「초안 n」 / 「모름」.
// 빈칸을 비워 두지 않는다: 모르는 것이 보여야 다음 조사가 정해진다. 색만으로 전하지 않고 글자를 같이 쓴다.
import Link from 'next/link'
import { COMMON, cellTone, type GridCell } from '@/lib/knowledge/grid'
import { LAYERS, LAYER_LABEL, LAYER_RANK, type Layer } from '@/lib/knowledge/labels'

interface KnowledgeGridProps {
  columns: string[]
  cells: Record<Layer, Record<string, GridCell>>
  columnLabel: Record<string, string>
}

const TONE_CLASS = {
  unknown: 'border-dashed border-[var(--bd)] text-[var(--t3)]',
  draft: 'border-[var(--bd)] text-[var(--t2)]',
  known: 'border-[var(--p)] text-[var(--t1)]',
} as const

function cellHref(layer: Layer, cell: GridCell): string {
  if (cell.slugs.length === 1) return `/admin/knowledge/item/${cell.slugs[0]}`
  return layer === 'essence' || layer === 'principle' ? '/admin/knowledge/principles' : '/admin/knowledge/methods'
}

function CellBody({ cell }: { cell: GridCell }) {
  const tone = cellTone(cell)
  if (tone === 'unknown') return <span>모름</span>
  if (tone === 'draft') return <span>초안 <b className="tabular-nums">{cell.total}</b></span>
  return (
    <span>
      채택 <b className="tabular-nums text-[var(--p)]">{cell.adopted}</b>
      {cell.total > cell.adopted && <span className="text-[var(--t3)]"> / {cell.total}</span>}
    </span>
  )
}

export function KnowledgeGrid({ columns, cells, columnLabel }: KnowledgeGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">영역 × 층 — 칸마다 채택·초안·모름</caption>
        <thead>
          <tr>
            <th scope="col" className="w-28" />
            {columns.map((c) => (
              <th
                key={c}
                scope="col"
                className={`px-1 pb-2 text-left align-bottom text-xs font-medium ${c === COMMON ? 'text-[var(--t3)]' : 'text-[var(--t2)]'}`}
              >
                {c === COMMON ? '공통 (영역 무관)' : columnLabel[c] ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LAYERS.map((layer) => (
            <tr key={layer}>
              <th scope="row" className="pr-2 text-left align-middle font-normal">
                <span className="font-mono text-xs text-[var(--t3)]">L{LAYER_RANK[layer]}</span>{' '}
                <span className="font-semibold text-[var(--t1)]">{LAYER_LABEL[layer]}</span>
              </th>
              {columns.map((c) => {
                const cell = cells[layer][c]
                const tone = cellTone(cell)
                const body = <CellBody cell={cell} />
                const base = `flex min-h-11 items-center rounded border px-2 py-2 text-xs ${TONE_CLASS[tone]}`
                return (
                  <td key={c} className="align-stretch">
                    {tone === 'unknown' ? (
                      <div className={base}>{body}</div>
                    ) : (
                      <Link
                        href={cellHref(layer, cell)}
                        className={`${base} hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]`}
                      >
                        {body}
                      </Link>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
