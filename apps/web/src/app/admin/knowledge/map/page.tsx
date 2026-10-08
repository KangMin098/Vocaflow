// apps/web/src/app/admin/knowledge/map/page.tsx
// B 역량 · 원리 지도(2026-10-08 vNext) — 종류별 열(역량 → 처리 기제 → 학습 기제 → 방법 → 과제) 관계 지도 + 노드 판(위 · 아래 · 옆 연결 · 근거 세 축)
// + 기존 영역 × 층 격자(원리 지도에서 옮김). 수치는 열 때마다 DB 를 다시 센 값이다(I5).
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { KnowledgeGrid } from '@/components/admin/knowledge/KnowledgeGrid'
import { KindForm } from '@/components/admin/knowledge/VnextForms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { buildGrid } from '@/lib/knowledge/grid'
import { GRADE_LABEL, STATUS_LABEL } from '@/lib/knowledge/labels'
import { listEvidence, listItems, listLinks, listTaxonomy } from '@/lib/knowledge/server'
import { APPLICABILITY_LABEL, EVIDENCE_LEVEL_LABEL, KINDS_BY_LAYER, KIND_LABEL, KIND_QUESTION } from '@/lib/knowledge/vnext-labels'
import { kindLanes, neighborhood } from '@/lib/knowledge/vnext-rules'

export const dynamic = 'force-dynamic'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export default async function KnowledgeRelationMapPage({ searchParams }: { searchParams: { node?: string; skill?: string } }) {
  await requireAdmin('/admin/knowledge/map')
  const help = <AdminScreenHelp screen="knowledge-map" />
  let data
  try {
    const [items, links, taxonomy] = await Promise.all([listItems(), listLinks(), listTaxonomy()])
    data = { items, links, taxonomy }
  } catch {
    return (
      <KnowledgeFrame title="역량 · 원리 지도" question="역량 · 기제 · 방법 · 과제가 어떻게 이어지나" help={help}>
        <LoadFailed what="학습 원리 등록부" href="/admin/knowledge/map" />
      </KnowledgeFrame>
    )
  }
  const skills = data.taxonomy.filter((t) => t.dimension === 'skill')
  const skill = skills.some((s) => s.id === searchParams.skill) ? searchParams.skill ?? null : null
  const lanes = kindLanes(data.items, skill)
  const byId = new Map(data.items.map((i) => [i.id, i]))
  const node = data.items.find((i) => i.slug === searchParams.node) ?? null
  const near = node ? neighborhood(node.id, data.links) : null
  const evidence = node ? await listEvidence([node.id]) : []
  const grid = buildGrid(data.items, skills.map((s) => s.id))
  const href = (q: { node?: string | null; skill?: string | null }) => {
    const p = new URLSearchParams()
    const s = q.skill === undefined ? skill : q.skill
    const n = q.node === undefined ? node?.slug ?? null : q.node
    if (s) p.set('skill', s)
    if (n) p.set('node', n)
    const str = p.toString()
    return `/admin/knowledge/map${str ? `?${str}` : ''}`
  }

  return (
    <KnowledgeFrame title="역량 · 원리 지도" question="역량 · 기제 · 방법 · 과제가 어떻게 이어지나" help={help}>
      <nav aria-label="영역" className="mb-4 flex flex-wrap gap-1">
        <Link href={href({ skill: null, node: null })} aria-current={skill === null ? 'true' : undefined} className={`inline-flex min-h-11 items-center rounded border px-3 text-sm ${FOCUS} ${skill === null ? 'border-[var(--p)] text-[var(--p)]' : 'border-[var(--bd)] text-[var(--t2)]'}`}>전체 영역</Link>
        {skills.map((s) => (
          <Link key={s.id} href={href({ skill: s.id, node: null })} aria-current={skill === s.id ? 'true' : undefined} className={`inline-flex min-h-11 items-center rounded border px-3 text-sm ${FOCUS} ${skill === s.id ? 'border-[var(--p)] text-[var(--p)]' : 'border-[var(--bd)] text-[var(--t2)]'}`}>{s.label}</Link>
        ))}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <section aria-labelledby="lanes" className="min-w-0">
          <h2 id="lanes" className="mb-3 text-lg font-semibold text-[var(--t1)]">관계 지도 — 종류별 열</h2>
          <div className="grid gap-3 overflow-x-auto md:grid-cols-3 2xl:grid-cols-6" data-testid="kind-lanes">
            {lanes.map((l) => (
              <div key={l.kind} className="min-w-[12rem] rounded border border-[var(--bd)] p-3">
                <h3 className="text-sm font-semibold text-[var(--t1)]">
                  {l.kind === 'unclassified' ? '미분류' : KIND_LABEL[l.kind]} <span className="tabular-nums text-[var(--t3)]">{l.items.length}</span>
                </h3>
                <p className="mb-2 text-xs text-[var(--t3)]">{l.kind === 'unclassified' ? '종류를 정한다' : KIND_QUESTION[l.kind]}</p>
                {l.items.length === 0 ? (
                  <p className="text-xs text-[var(--t3)]">아직 없음 — 공백이다</p>
                ) : (
                  <ul className="space-y-1">
                    {l.items.slice(0, 40).map((i) => {
                      const on = node?.id === i.id
                      const linked = near && (near.up.includes(i.id) || near.down.includes(i.id) || near.side.some((s) => s.id === i.id))
                      return (
                        <li key={i.id}>
                          <Link href={href({ node: i.slug })} aria-current={on ? 'true' : undefined} className={`block min-h-11 rounded px-2 py-1 text-sm ${FOCUS} ${on ? 'bg-[var(--p)] text-white' : linked ? 'border border-[var(--p)] text-[var(--t1)]' : 'text-[var(--t1)] hover:bg-black/5'}`}>
                            {i.title}
                            <span className={`block text-xs ${on ? 'text-white/80' : 'text-[var(--t3)]'}`}>{STATUS_LABEL[i.status]}</span>
                          </Link>
                        </li>
                      )
                    })}
                    {l.items.length > 40 && <li className="text-xs text-[var(--t3)]">외 {l.items.length - 40}개 — 영역으로 좁힌다</li>}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        <aside aria-labelledby="node" className="rounded border border-[var(--bd)] p-4" data-testid="node-panel">
          <h2 id="node" className="text-lg font-semibold text-[var(--t1)]">{node ? node.title : '노드를 고르세요'}</h2>
          {!node ? (
            <p className="mt-2 text-sm text-[var(--t2)]">열에서 항목을 누르면 위(이 항목이 구현하는 것) · 아래(이 항목을 구현하는 것) · 옆 관계와 근거 세 축이 여기에 펼쳐진다.</p>
          ) : (
            <div className="mt-2 space-y-4 text-sm">
              <p className="text-[var(--t2)]">{node.kind ? KIND_LABEL[node.kind] : '미분류'} · {STATUS_LABEL[node.status]} · v{node.version}</p>
              <p className="text-[var(--t1)]">{node.statement}</p>
              <KindForm itemId={node.id} options={KINDS_BY_LAYER[node.layer]} current={node.kind} />
              {([['위로(구현하는 것)', near!.up], ['아래로(이것을 구현)', near!.down]] as const).map(([label, ids]) => (
                <div key={label}>
                  <h3 className="font-semibold text-[var(--t1)]">{label} <span className="tabular-nums text-[var(--t3)]">{ids.length}</span></h3>
                  <ul>{ids.slice(0, 12).map((id) => { const it = byId.get(id); return it ? <li key={id}><Link href={href({ node: it.slug })} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>{it.title}</Link></li> : null })}</ul>
                </div>
              ))}
              {near!.side.length > 0 && (
                <div><h3 className="font-semibold text-[var(--t1)]">옆 관계</h3>
                  <ul>{near!.side.map((s) => { const it = byId.get(s.id); return it ? <li key={s.id}>{s.kind} · <Link href={href({ node: it.slug })} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>{it.title}</Link></li> : null })}</ul>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-[var(--t1)]">근거 <span className="tabular-nums text-[var(--t3)]">{evidence.length}</span></h3>
                {evidence.length === 0 ? <p className="text-[var(--t3)]">근거 없음 — 이 상태로 채택할 수 없다</p> : (
                  <ul className="space-y-1">
                    {evidence.slice(0, 10).map((e) => (
                      <li key={e.id} className="text-xs text-[var(--t2)]">
                        <b className="font-mono">{e.grade}</b> {GRADE_LABEL[e.grade]} · {EVIDENCE_LEVEL_LABEL[e.evidenceLevel]} · 적합 {APPLICABILITY_LABEL[e.applicability]} — {e.title.slice(0, 60)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Link href={`/admin/knowledge/item/${node.slug}`} className={`inline-flex min-h-11 items-center rounded border border-[var(--p)] px-4 text-[var(--p)] ${FOCUS}`}>항목 상세 · 판정 · 근거 추가</Link>
            </div>
          )}
        </aside>
      </div>

      <section aria-labelledby="grid" className="mt-10">
        <h2 id="grid" className="mb-3 text-lg font-semibold text-[var(--t1)]">영역 × 층(기존 원리 지도)</h2>
        <KnowledgeGrid columns={grid.columns} cells={grid.cells} columnLabel={Object.fromEntries(skills.map((s) => [s.id, s.label]))} />
      </section>
    </KnowledgeFrame>
  )
}
