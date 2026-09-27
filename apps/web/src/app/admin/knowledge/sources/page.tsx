// apps/web/src/app/admin/knowledge/sources/page.tsx
// 근거 · 출처 — 출처 종류별로 무엇이 들어와 있고 어디까지 확인됐는가. 원문은 어디에도 저장하지 않는다.
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import Link from 'next/link'
import { GradeMark, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { GRADES, GRADE_LABEL } from '@/lib/knowledge/labels'
import { countByGrade, listCsatOrigins, listEvidence, listItems } from '@/lib/knowledge/server'

export const dynamic = 'force-dynamic'

export default async function SourcesPage() {
  await requireAdmin('/admin/knowledge/sources')
  const frame = { title: '근거 · 출처', question: '어떤 출처가 들어와 있고, 어디까지 확인됐는가', help: <AdminScreenHelp screen="knowledge-sources" /> }
  let data
  try {
    const [origins, items] = await Promise.all([listCsatOrigins(), listItems()])
    const evidence = await listEvidence(items.map((i) => i.id))
    data = { origins, evidence }
  } catch {
    return (
      <KnowledgeFrame {...frame}>
        <LoadFailed what="출처" href="/admin/knowledge/sources" />
      </KnowledgeFrame>
    )
  }
  const grades = countByGrade(data.origins)
  const bySource = data.evidence.reduce<Record<string, number>>((m, e) => ((m[e.sourceType] = (m[e.sourceType] ?? 0) + 1), m), {})

  const kinds = [
    {
      name: '기출 원천',
      href: '/admin/knowledge/sources/csat',
      says: '수능·모평 지문이 발췌된 책·논문. 문항 ID·해시·서지·근거 URL 만 보관.',
      count: `${data.origins.length} 지문`,
    },
    {
      name: '가져오기 원장',
      href: '/admin/methodology',
      says: '영상·교재 소개 등 방법론 조사 스냅샷. 한 번 가져온 스냅샷은 바뀌지 않는다.',
      count: null,
    },
  ]

  return (
    <KnowledgeFrame {...frame}>
      <section aria-labelledby="kinds" className="mb-10">
        <h2 id="kinds" className="mb-3 text-lg font-semibold text-[var(--t1)]">출처 종류</h2>
        <ul className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
          {kinds.map((k) => (
            <li key={k.href}>
              <Link
                href={k.href}
                className="flex min-h-11 flex-wrap items-baseline justify-between gap-2 py-4 hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
              >
                <span>
                  <span className="font-semibold text-[var(--t1)]">{k.name}</span>
                  <span className="block text-sm text-[var(--t2)]">{k.says}</span>
                </span>
                {k.count && <span className="tabular-nums text-sm text-[var(--t2)]">{k.count}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="linked">
          <h2 id="linked" className="mb-3 text-lg font-semibold text-[var(--t1)]">항목에 연결된 근거</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['methodology', '가져오기 원장'],
              ['csat_origin', '기출 원천'],
              ['external', '외부 링크'],
            ].map(([key, label]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="text-[var(--t2)]">{label}</dt>
                <dd className="tabular-nums text-[var(--t1)]">{bySource[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="grades">
          <h2 id="grades" className="mb-3 text-lg font-semibold text-[var(--t1)]">기출 원천 등급</h2>
          <ul className="space-y-2">
            {GRADES.map((g) => (
              <li key={g} className="flex items-center justify-between gap-3 text-sm">
                <GradeMark grade={g} label={GRADE_LABEL[g]} />
                <span className="tabular-nums text-[var(--t1)]">{grades[g]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </KnowledgeFrame>
  )
}
