// apps/web/src/app/admin/knowledge/lab/compare/page.tsx
// 탐구 · 근거 연구소 › 원리 근거 비교(작업 4 · 2026-10-10) — 원리마다 근거를 종류별로 따로 세고, 적용 조건 · 반대 설명 · 다음 연구 업무를 보인다.
// 영역 지도: 8 기능 영역 × 층 — 원리 층이 빈 영역을 보인다. 이 화면은 아무것도 바꾸지 않는다.
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { EmptyState, KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { STATUS_LABEL, isStatus } from '@/lib/knowledge/labels'
import { DOMAINS, DOMAIN_LABEL, principleGaps, type ResearchStanding } from '@/lib/knowledge/research-compare'
import { loadResearchCompare, type ResearchCompareData } from '@/lib/knowledge/research-compare-server'

export const dynamic = 'force-dynamic'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const STANDING_LABEL: Record<ResearchStanding, string> = {
  research_backed: '연구 근거 있음',
  contested: '설명이 충돌함',
  observation_only: '관찰 · 주장뿐(연구 없음)',
  no_evidence: '근거 없음',
}
const LAYER_LABEL: Record<string, string> = { essence: '본질', principle: '원리', method: '방법', practice: '과제' }
const BUCKETS: { key: keyof ResearchCompareData['principles'][number]['buckets']; label: string }[] = [
  { key: 'research', label: '연구' },
  { key: 'expert', label: '전문가 주장' },
  { key: 'practitioner', label: '현장(강사) 주장' },
  { key: 'exam', label: '기출 관찰' },
  { key: 'inferred', label: '분석자 추론' },
  { key: 'unrated', label: '미분류' },
]

export default async function ResearchComparePage() {
  await requireAdmin('/admin/knowledge/lab/compare')
  const help = <AdminScreenHelp screen="knowledge-research-compare" />
  const frame = (body: React.ReactNode) => (
    <KnowledgeFrame title="원리 근거 비교" question="이 원리는 무엇으로 뒷받침되고, 어디서 통하며, 어떤 설명과 부딪히나" help={help}>{body}</KnowledgeFrame>
  )
  let data: ResearchCompareData
  try {
    data = await loadResearchCompare()
  } catch {
    return frame(<LoadFailed what="원리 근거 비교" href="/admin/knowledge/lab/compare" />)
  }
  const gaps = principleGaps(data.matrix)
  const counts = data.principles.reduce<Record<string, number>>((a, p) => ({ ...a, [p.standing]: (a[p.standing] ?? 0) + 1 }), {})

  return frame(
    <>
      <p className="mb-6 max-w-3xl text-sm text-[var(--t2)]">
        근거 종류를 한 숫자로 합치지 않는다 — 연구 · 전문가 주장 · 현장 주장 · 기출 관찰 · 분석자 추론은 서로 다른 것이다. 「연구 근거 있음」은 연구 설계 서지가 연결되고 적용 가능성이 높음 · 부분일 때만이며, 효과 입증과는 별개다.
        {' '}본질 · 원리 {data.principles.length}개 — {Object.entries(counts).map(([k, n]) => `${STANDING_LABEL[k as ResearchStanding]} ${n}`).join(' · ')}
      </p>

      <section aria-labelledby="matrix-h" className="mb-10">
        <h2 id="matrix-h" className="text-base font-semibold text-[var(--t1)]">영역 지도 — 채택 / 전체</h2>
        {gaps.length > 0 && (
          <p className="mt-1 text-sm text-[var(--t2)]" data-testid="principle-gaps">원리 층이 빈 영역: <b className="text-[var(--t1)]">{gaps.map((d) => DOMAIN_LABEL[d as keyof typeof DOMAIN_LABEL]).join(' · ')}</b></p>
        )}
        <table className="mt-3 w-full max-w-3xl text-sm" data-testid="domain-matrix">
          <thead>
            <tr className="text-left text-[var(--t3)]">
              <th scope="col" className="py-2 pr-4 font-normal">영역</th>
              {Object.keys(LAYER_LABEL).map((l) => <th key={l} scope="col" className="py-2 pr-4 font-normal">{LAYER_LABEL[l]}</th>)}
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map((d) => (
              <tr key={d} className="border-t border-[var(--bd)]">
                <th scope="row" className="py-2 pr-4 text-left font-medium text-[var(--t1)]">{DOMAIN_LABEL[d]}</th>
                {Object.keys(LAYER_LABEL).map((l) => {
                  const c = data.matrix[d][l]
                  return <td key={l} className="py-2 pr-4 tabular-nums text-[var(--t1)]" data-empty={c.total === 0}>{c.total === 0 ? '— 없음' : `${c.adopted} / ${c.total}`}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.principles.length === 0 ? (
        <EmptyState title="본질 · 원리 항목이 없습니다" next="본질 · 원리 화면에서 항목을 쓰면 여기서 근거를 비교합니다." />
      ) : (
        <ul className="space-y-4">
          {data.principles.map((p) => (
            <li key={p.item.id} className="rounded border border-[var(--bd)] p-4" data-testid="principle-compare" data-standing={p.standing}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--t1)]">
                  <Link href={`/admin/knowledge/item/${p.item.slug}`} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>{p.item.title}</Link>
                </h2>
                <span className="text-sm font-semibold text-[var(--t1)]">{STANDING_LABEL[p.standing]}</span>
              </div>
              <p className="text-xs text-[var(--t2)]">
                {LAYER_LABEL[p.item.layer] ?? p.item.layer} · {isStatus(p.item.status) ? STATUS_LABEL[p.item.status] : p.item.status} · {p.item.skillIds.map((s) => DOMAIN_LABEL[s as keyof typeof DOMAIN_LABEL] ?? s).join(' · ') || '영역 미지정'}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                {BUCKETS.map((b) => (
                  <div key={b.key}>
                    <dt className="text-[var(--t3)]">{b.label}</dt>
                    <dd className="tabular-nums text-[var(--t1)]">{p.buckets[b.key]}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-[var(--t2)]">탐구 연결 — 지지 · 후보 {p.support} · 반대 {p.counter} · 불확실 {p.uncertain}</p>
              {p.conditions.length > 0 && (
                <p className="mt-1 text-xs text-[var(--t2)]">적용 조건: {p.conditions.slice(0, 3).join(' / ')}</p>
              )}
              {p.gaps.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-[var(--t1)]">
                  {p.gaps.map((g) => <li key={g}>{g}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>,
  )
}
