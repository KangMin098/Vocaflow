// apps/web/src/app/admin/knowledge/product/[id]/page.tsx
// 적용 하나의 사슬 추적(Phase 3 · 2026-10-08) — 탐구 질문 → 근거 → 처리 기제 → 방법 → 실행 과제 → 제품 적용 → 실제 수행 → 효과 검증.
// 어디가 끊겼는지(채택 전 · 연결 없음 · 검증 계획 없음 · 주석 없음)를 위에서 먼저 보인다. 수치는 열 때마다 DB 를 다시 센 값(I5).
// 수행 기록은 **과제 수행**이다 — 효과(efficacy)는 실제 학습자 · 최소 표본 · 사전/사후 검증이 분석 완료돼야만 말한다.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { KnowledgeFrame } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { fromItemSlug } from '@/lib/csat/item-slug'
import { STATUS_LABEL } from '@/lib/knowledge/labels'
import { resolveChain } from '@/lib/knowledge/live-chain'
import { CLAIM_SUPPORT_TASK, currentAnnotation, itemTaskRef, loadChainGraph, loadLiveApplication } from '@/lib/knowledge/product-server'
import { APP_STATUS_LABEL, APP_SURFACE_LABEL, EVIDENCE_LEVEL_LABEL, TRIAL_STATUS_LABEL, type AppStatus, type AppSurface, type TrialStatus } from '@/lib/knowledge/vnext-labels'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const LAYER_WORD: Record<string, string> = { practice: '실행 과제', method: '방법', principle: '처리 기제', essence: '본질 묶음' }

type Row = Record<string, unknown>

export default async function ApplicationTracePage({ params }: { params: { id: string } }) {
  await requireAdmin(`/admin/knowledge/product/${params.id}`)
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound()
  const db = createAdminClient() as unknown as SupabaseClient
  const { data: app } = await db.from('knowledge_applications').select('*').eq('id', params.id).maybeSingle()
  if (!app) notFound()
  const graph = await loadChainGraph(db)
  const chain = resolveChain(String(app.item_id), graph.items, graph.links)
  const ids = chain.path.map((p) => p.id)
  const [evidence, inqLinks, trials, attempts] = await Promise.all([
    db.from('knowledge_evidence').select('id, item_id, source_type, evidence_level, grade, applicability').in('item_id', ids),
    db.from('knowledge_inquiry_links').select('inquiry_id, item_id, role').in('item_id', ids),
    db.from('knowledge_trials').select('id, status, synthetic, result, design').eq('application_id', params.id),
    db.from('learning_task_attempts').select('user_id, is_correct, synthetic, phase').eq('application_id', params.id).limit(1000),
  ])
  for (const r of [evidence, inqLinks, trials, attempts]) if (r.error) throw new Error(`추적 읽기 실패: ${r.error.message}`)
  const inquiryIds = [...new Set((inqLinks.data ?? []).map((l: Row) => String(l.inquiry_id)))]
  const { data: inquiries } = inquiryIds.length ? await db.from('knowledge_inquiries').select('id, slug, question, status, uncertainty').in('id', inquiryIds) : { data: [] as Row[] }
  const ev = (evidence.data ?? []) as Row[]
  const research = ev.filter((e) => e.source_type === 'research')
  const at = (attempts.data ?? []) as Row[]
  // 1,000 행에서 끊긴다 — 넘으면 「이상」으로 표시한다(지금은 수십 행)
  const capped = at.length >= 1000
  const real = at.filter((a) => !a.synthetic)
  const learners = new Set(real.map((a) => String(a.user_id))).size
  const correct = real.filter((a) => a.is_correct === true).length
  const tr = (trials.data ?? []) as Row[]
  const task = chain.path[0]
  // 문항 과제면 주석 상태도 사슬의 한 칸이다
  const itemRef = String(app.surface_ref).startsWith(`${CLAIM_SUPPORT_TASK}:`) ? fromItemSlug(String(app.surface_ref).slice(CLAIM_SUPPORT_TASK.length + 1)) : typeof (app.audience as Row)?.item === 'string' ? String((app.audience as Row).item) : null
  const annotation = itemRef ? currentAnnotation(itemRef) : null
  // 지도 FIND 적용은 목적지(문항 과제 적용)가 살아 있어야 학습자에게 링크가 보인다 — 추적도 같은 조건으로(Codex P2)
  const target = app.surface === 'learning_map_find' && itemRef ? await loadLiveApplication('csat_item_task', itemTaskRef(itemRef), db) : null

  const breaks = [
    ...(inquiries?.length ? [] : ['탐구 질문에 이어진 사슬 항목이 없다']),
    ...chain.breaks.map((b) => `${LAYER_WORD[b.layer]} — ${b.reason}${b.slug ? ` (${b.slug})` : ''}`),
    ...(tr.length ? [] : ['검증 계획(trial)이 없다 — 켤 수 없다']),
    ...(app.status === 'active' ? [] : [`적용이 ${APP_STATUS_LABEL[app.status as AppStatus]} — 학습자에게 나가지 않는다`]),
    ...(itemRef && !annotation ? ['문항 주석이 없거나 골격 서명이 바뀌었다 — 채점하지 않는다'] : []),
    ...(app.surface === 'learning_map_find' && itemRef && !target ? ['목적지 문항 과제 적용이 꺼져 있다 — 지도 링크가 학습자에게 보이지 않는다'] : []),
  ]

  return (
    <KnowledgeFrame title="적용 사슬 추적" question="이 과제는 어디서 왔고, 지금 어디가 끊겼나" help={<AdminScreenHelp screen="knowledge-trace" />}>
      <section aria-labelledby="breaks" className="mb-8" data-testid="trace-breaks" data-live={breaks.length === 0}>
        <h2 id="breaks" className="mb-2 text-lg font-semibold text-[var(--t1)]">끊긴 곳 <span className="tabular-nums text-[var(--t2)]">{breaks.length}</span></h2>
        {breaks.length === 0 ? <p className="text-sm text-[var(--t2)]">사슬 전체가 살아 있고 학습자에게 나가 있다.</p> : (
          <ul className="list-disc pl-5 text-sm text-[var(--error)]">{breaks.map((b) => <li key={b}>{b}</li>)}</ul>
        )}
      </section>

      <ol className="grid gap-4 text-sm" data-testid="trace-chain">
        <li className="rounded border border-[var(--bd)] p-4" data-step="inquiry">
          <h3 className="font-semibold text-[var(--t1)]">1. 탐구 질문</h3>
          {(inquiries ?? []).map((q: Row) => (
            <p key={String(q.id)} className="mt-1"><Link href={`/admin/knowledge/lab/${q.slug}`} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>{String(q.question)}</Link> · {String(q.status)}{q.uncertainty ? ` · 남은 불확실성: ${String(q.uncertainty)}` : ''}</p>
          ))}
        </li>
        <li className="rounded border border-[var(--bd)] p-4" data-step="evidence">
          <h3 className="font-semibold text-[var(--t1)]">2. 근거 <span className="tabular-nums text-[var(--t2)]">{ev.length}</span></h3>
          <p className="mt-1">수준별: {Object.entries(ev.reduce<Record<string, number>>((m, e) => { const k = String(e.evidence_level); m[k] = (m[k] ?? 0) + 1; return m }, {})).map(([k, n]) => `${EVIDENCE_LEVEL_LABEL[k as keyof typeof EVIDENCE_LEVEL_LABEL] ?? k} ${n}`).join(' · ') || '없음'}</p>
          <p className="mt-1" data-testid="trace-research">연구 근거: {research.length === 0 ? '없음 — 효과를 연구로 말할 수 없다' : `${research.length}건`}</p>
        </li>
        {[...chain.path].reverse().map((p, i) => (
          <li key={p.id} className="rounded border border-[var(--bd)] p-4" data-step={p.layer} data-status={p.status}>
            <h3 className="font-semibold text-[var(--t1)]">{i + 3}. {LAYER_WORD[p.layer]}</h3>
            <p className="mt-1"><Link href={`/admin/knowledge/item/${p.slug}`} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>{p.title}</Link> · {STATUS_LABEL[p.status as keyof typeof STATUS_LABEL] ?? p.status} · v{p.version}</p>
          </li>
        ))}
        <li className="rounded border border-[var(--bd)] p-4" data-step="application" data-status={String(app.status)}>
          <h3 className="font-semibold text-[var(--t1)]">제품 적용</h3>
          <p className="mt-1">{APP_SURFACE_LABEL[app.surface as AppSurface]} · {String(app.surface_ref)} · v{String(app.version)} · {APP_STATUS_LABEL[app.status as AppStatus]}{app.released_at ? ` · 배포 ${String(app.released_at).slice(0, 10)}` : ''}</p>
          {itemRef && <p className="mt-1">문항 {itemRef} · 주석 {annotation ? `${annotation.version}(${annotation.provenance.annotator.split(' ')[0]} + ${annotation.provenance.independentReviewer.split(' ')[0]} 맹검)` : '없음'}</p>}
        </li>
        <li className="rounded border border-[var(--bd)] p-4" data-step="attempts">
          <h3 className="font-semibold text-[var(--t1)]">실제 수행(과제 수행 — 효과 아님)</h3>
          <p className="mt-1" data-testid="trace-attempts">실제 학습자 {learners}명 · 기록 {real.length}건{capped ? ' 이상' : ''} · 정확 {correct}건 · 합성 {at.length - real.length}건</p>
        </li>
        <li className="rounded border border-[var(--bd)] p-4" data-step="trial">
          <h3 className="font-semibold text-[var(--t1)]">효과 검증</h3>
          {tr.map((t) => {
            const d = (t.design ?? {}) as Row
            return <p key={String(t.id)} className="mt-1">{t.synthetic ? '합성' : '실제'} · {TRIAL_STATUS_LABEL[t.status as TrialStatus]} · 최소 표본 {String(d.min_n ?? '—')} · 지연 {d.delayed_days ? `${String(d.delayed_days)}일` : '없음'} · 전이 {d.transfer ? '있음' : '없음'}{t.result ? ` · 결과 ${String(t.result)}` : ''}</p>
          })}
          <p className="mt-1" data-testid="trace-efficacy">효과 판정: {task?.efficacy === 'not_assessed' ? '미확정 — 분석 완료된 실제 학습자 검증이 없다' : String(task?.efficacy)}</p>
        </li>
      </ol>
    </KnowledgeFrame>
  )
}
