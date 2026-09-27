// apps/web/src/app/admin/knowledge/page.tsx
// 원리 지도 — 층(본질·원리·방법론·공부법) × 상태 개수와 공백·기출 원천 등급을 한 장에.
// 수치는 열 때마다 DB 를 다시 센 값이다(I5 — 상수 금지).
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import Link from 'next/link'
import { EmptyState, GradeMark, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  GRADES,
  GRADE_LABEL,
  LAYERS,
  LAYER_LABEL,
  LAYER_QUESTION,
  LAYER_RANK,
  STATUSES,
  STATUS_LABEL,
} from '@/lib/knowledge/labels'
import { countByGrade, countByLayerStatus, listCsatOrigins, listGaps, listItems } from '@/lib/knowledge/server'

export const dynamic = 'force-dynamic'

export default async function KnowledgeMapPage() {
  await requireAdmin('/admin/knowledge')
  let data
  try {
    const [items, gaps, origins] = await Promise.all([listItems(), listGaps(), listCsatOrigins()])
    data = { items, gaps, origins }
  } catch {
    return (
      <KnowledgeFrame title="원리 지도" question="무엇을 알고, 무엇을 모르는가" help={<AdminScreenHelp screen="knowledge" />} back={{ href: '/admin', label: '관리자' }}>
        <LoadFailed what="학습 원리 등록부" href="/admin/knowledge" />
      </KnowledgeFrame>
    )
  }

  const grid = countByLayerStatus(data.items)
  const grades = countByGrade(data.origins)
  const openGaps = data.gaps.filter((g) => g.status === 'open')

  return (
    <KnowledgeFrame title="원리 지도" question="무엇을 알고, 무엇을 모르는가" help={<AdminScreenHelp screen="knowledge" />} back={{ href: '/admin', label: '관리자' }}>
      <section aria-labelledby="layers" className="mb-10">
        <h2 id="layers" className="mb-3 text-lg font-semibold text-[var(--t1)]">층별 항목</h2>
        {data.items.length === 0 ? (
          <EmptyState title="등록된 항목이 없습니다" next="씨앗 가져오기(scripts/knowledge/import-seed.mjs --commit)를 먼저 실행하세요." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">층 × 상태별 항목 수</caption>
              <thead>
                <tr className="border-b border-[var(--bd)] text-left text-[var(--t2)]">
                  <th scope="col" className="py-2 pr-4 font-medium">층</th>
                  {STATUSES.map((s) => (
                    <th key={s} scope="col" className="px-3 py-2 text-right font-medium">{STATUS_LABEL[s]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LAYERS.map((l) => (
                  <tr key={l} className="border-b border-[var(--bd)]">
                    <th scope="row" className="py-3 pr-4 text-left font-normal">
                      <span className="font-mono text-xs text-[var(--t3)]">L{LAYER_RANK[l]}</span>{' '}
                      <span className="font-semibold text-[var(--t1)]">{LAYER_LABEL[l]}</span>
                      <span className="block text-xs text-[var(--t3)]">{LAYER_QUESTION[l]}</span>
                    </th>
                    {STATUSES.map((s) => (
                      <td key={s} className="px-3 py-3 text-right tabular-nums text-[var(--t1)]">
                        {grid[l][s] === 0 ? <span className="text-[var(--t3)]">·</span> : grid[l][s]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="gaps">
          <h2 id="gaps" className="mb-3 text-lg font-semibold text-[var(--t1)]">
            열린 공백 <span className="tabular-nums text-[var(--t2)]">{openGaps.length}</span>
          </h2>
          <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
            {openGaps.slice(0, 5).map((g) => (
              <li key={g.id} className="py-3 text-sm text-[var(--t1)]">{g.question}</li>
            ))}
          </ul>
          <Link href="/admin/knowledge/gaps" className="mt-2 inline-flex min-h-11 items-center text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
            공백 전체
          </Link>
        </section>

        <section aria-labelledby="origins">
          <h2 id="origins" className="mb-3 text-lg font-semibold text-[var(--t1)]">
            기출 원천 <span className="tabular-nums text-[var(--t2)]">{data.origins.length} 지문</span>
          </h2>
          <ul className="space-y-2">
            {GRADES.map((g) => (
              <li key={g} className="flex items-center justify-between gap-3 text-sm">
                <GradeMark grade={g} label={GRADE_LABEL[g]} />
                <span className="tabular-nums text-[var(--t1)]">{grades[g]}</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/knowledge/sources/csat" className="mt-2 inline-flex min-h-11 items-center text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
            기출 원천 보기
          </Link>
        </section>
      </div>
    </KnowledgeFrame>
  )
}
