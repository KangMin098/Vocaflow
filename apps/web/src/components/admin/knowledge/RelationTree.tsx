// apps/web/src/components/admin/knowledge/RelationTree.tsx
// 역량 → 기제(언어 처리 / 학습) → 방법론 → 공부법 수 · 학습 설계로 내려가는 관계 트리와 노드 상세 패널.
// 노드를 누르면 ?node=<slug> 로 같은 화면이 다시 그려지고 오른쪽(좁으면 아래)에 상세가 열린다 — 자바스크립트 없이 동작한다.
// 상태·근거 수는 글자로 쓴다(색만으로 전하지 않는다).
import Link from 'next/link'
import { GRADE_LABEL, LAYER_LABEL, STATUS_LABEL, type ItemStatus, type Layer } from '@/lib/knowledge/labels'
import {
  DESIGN_STATUS_LABEL,
  FACET_LABEL,
  FIT_LABEL,
  RESEARCH_LEVEL_LABEL,
  type DesignStatus,
  type Facet,
} from '@/lib/knowledge/vnext'
import type { EvidenceAxes } from '@/lib/knowledge/vnext-server'
import { EvidenceAxesForm, FacetPicker } from './VnextForms'

export interface GraphNode {
  id: string
  slug: string
  title: string
  layer: Layer
  status: ItemStatus
  facet: Facet | null
  evidenceCount: number
  skills: string[]
  designs: { slug: string; title: string; status: DesignStatus }[]
}

interface Link_ {
  from: string
  to: string
  kind: string
}

const linkCls =
  'inline-flex min-h-11 items-center gap-2 rounded px-1 text-left text-sm text-[var(--t1)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]'

function NodeLink({ n, focus }: { n: GraphNode; focus: boolean }) {
  return (
    <Link href={`/admin/knowledge/map?node=${n.slug}#node-panel`} className={linkCls} aria-current={focus ? 'true' : undefined}>
      <span className={focus ? 'font-semibold underline' : ''}>{n.title}</span>
      <span className="whitespace-nowrap text-xs text-[var(--t3)]">
        {STATUS_LABEL[n.status]} · 근거 {n.evidenceCount}
      </span>
    </Link>
  )
}

export function RelationTree({ nodes, links, focusSlug }: { nodes: GraphNode[]; links: Link_[]; focusSlug: string | null }) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const up = (fromLayer: Layer, toId: string) =>
    links
      .filter((l) => l.kind === 'implements' && l.to === toId)
      .map((l) => byId.get(l.from))
      .filter((n): n is GraphNode => !!n && n.layer === fromLayer)
  const essences = nodes.filter((n) => n.layer === 'essence')
  const linkedPrinciples = new Set(essences.flatMap((e) => up('principle', e.id).map((p) => p.id)))
  const orphanPrinciples = nodes.filter((n) => n.layer === 'principle' && !linkedPrinciples.has(n.id))
  const facetOrder: (Facet | null)[] = ['language', 'learning', null]

  const principleBlock = (p: GraphNode) => {
    const methods = up('method', p.id)
    return (
      <li key={p.id} className="border-l border-[var(--bd)] pl-3">
        <NodeLink n={p} focus={p.slug === focusSlug} />
        {methods.length > 0 && (
          <ul className="ml-2 border-l border-dashed border-[var(--bd)] pl-3">
            {methods.map((m) => {
              const practices = up('practice', m.id)
              return (
                <li key={m.id}>
                  <NodeLink n={m} focus={m.slug === focusSlug} />
                  <span className="ml-2 text-xs text-[var(--t3)]">
                    공부법 {practices.length}
                    {m.designs.length > 0 && ` · 설계 ${m.designs.map((d) => `${d.title}(${DESIGN_STATUS_LABEL[d.status]})`).join(', ')}`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </li>
    )
  }

  return (
    <section aria-labelledby="tree" className="mb-10">
      <h2 id="tree" className="mb-1 text-lg font-semibold text-[var(--t1)]">역량에서 과제까지</h2>
      <p className="mb-4 text-sm text-[var(--t2)]">
        실선 = 역량을 받치는 기제 · 점선 = 기제를 쓰는 방법론. 노드를 누르면 근거 세 축과 연결된 학습 설계가 열린다.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {essences.map((e) => {
          const ps = up('principle', e.id)
          return (
            <article key={e.id} className="rounded-[var(--r-lg)] border border-[var(--bd)] p-4">
              <p className="text-xs font-semibold text-[var(--t3)]">역량 · {LAYER_LABEL.essence}</p>
              <NodeLink n={e} focus={e.slug === focusSlug} />
              {e.designs.length > 0 && (
                <p className="text-xs text-[var(--t2)]">설계: {e.designs.map((d) => `${d.title}(${DESIGN_STATUS_LABEL[d.status]})`).join(', ')}</p>
              )}
              {facetOrder.map((f) => {
                const xs = ps.filter((p) => p.facet === f)
                if (xs.length === 0) return null
                return (
                  <div key={f ?? 'none'} className="mt-3">
                    <p className="text-xs font-semibold text-[var(--t2)]">{f ? FACET_LABEL[f] : '면 분류 전'}</p>
                    <ul className="mt-1 space-y-1">{xs.map(principleBlock)}</ul>
                  </div>
                )
              })}
              {ps.length === 0 && <p className="mt-2 text-sm text-[var(--t3)]">이어진 기제가 없다 — 공백</p>}
            </article>
          )
        })}
      </div>
      {orphanPrinciples.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[var(--t1)]">역량에 아직 안 이어진 기제 {orphanPrinciples.length}</h3>
          <ul className="mt-2 grid gap-1 md:grid-cols-2">{orphanPrinciples.map(principleBlock)}</ul>
        </div>
      )}
    </section>
  )
}

export function NodePanel({ node, evidence }: { node: GraphNode; evidence: EvidenceAxes[] }) {
  const count = <K extends string>(key: (e: EvidenceAxes) => K) => {
    const m = new Map<K, number>()
    for (const e of evidence) m.set(key(e), (m.get(key(e)) ?? 0) + 1)
    return [...m.entries()]
  }
  return (
    <aside id="node-panel" aria-labelledby="node-title" className="mb-10 rounded-[var(--r-lg)] border-2 border-[var(--p)] p-5">
      <p className="text-xs font-semibold text-[var(--t3)]">
        {LAYER_LABEL[node.layer]}
        {node.facet ? ` · ${FACET_LABEL[node.facet]}` : ''} · {STATUS_LABEL[node.status]}
      </p>
      <h2 id="node-title" className="text-xl font-semibold text-[var(--t1)]">{node.title}</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold">출처 확인도</h3>
          <ul className="mt-1 text-sm">
            {count((e) => e.grade).map(([g, n]) => (
              <li key={g}>
                {g} {GRADE_LABEL[g as 'A' | 'B' | 'C'] ?? ''} <b className="tabular-nums">{n}</b>
              </li>
            ))}
            {evidence.length === 0 && <li className="text-[var(--t3)]">근거 없음 — 채택할 수 없다</li>}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">연구 근거 수준</h3>
          <ul className="mt-1 text-sm">
            {count((e) => e.researchLevel).map(([l, n]) => (
              <li key={l}>
                {RESEARCH_LEVEL_LABEL[l]} <b className="tabular-nums">{n}</b>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">학습 적용 적합성</h3>
          <ul className="mt-1 text-sm">
            {count((e) => e.fit).map(([f, n]) => (
              <li key={f}>
                {FIT_LABEL[f]} <b className="tabular-nums">{n}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {node.layer === 'principle' && (
        <div className="mt-4">
          <FacetPicker itemId={node.id} facet={node.facet} />
        </div>
      )}
      {evidence.length > 0 && (
        <details className="mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold">근거 {evidence.length}건 — 축 고치기</summary>
          <ul className="mt-2 divide-y divide-[var(--bd)]">
            {evidence.slice(0, 30).map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-sm text-[var(--t1)]">
                  <b className="font-mono">{e.grade}</b> {e.title ?? e.sourceType} {e.locator ? `· ${e.locator}` : ''}
                </p>
                <EvidenceAxesForm evidenceId={e.id} researchLevel={e.researchLevel} fit={e.fit} fitNote={e.fitNote ?? ''} />
              </li>
            ))}
          </ul>
          {evidence.length > 30 && <p className="text-xs text-[var(--t3)]">앞 30건만 — 나머지는 항목 상세에서</p>}
        </details>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href={`/admin/knowledge/item/${node.slug}`} className={linkCls}>
          항목 상세(상태·연결·근거 추가)
        </Link>
        {node.designs.map((d) => (
          <Link key={d.slug} href={`/admin/knowledge/design/${d.slug}`} className={linkCls}>
            설계 「{d.title}」 — {DESIGN_STATUS_LABEL[d.status]}
          </Link>
        ))}
      </div>
    </aside>
  )
}
