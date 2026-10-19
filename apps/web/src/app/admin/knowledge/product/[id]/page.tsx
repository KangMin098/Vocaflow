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
import { STATUS_LABEL } from '@/lib/knowledge/labels'
import { resolveChain } from '@/lib/knowledge/live-chain'
import { currentItemTask } from '@/lib/knowledge/item-tasks'
import { anchorGate, findTargetsOf, itemTaskRef, loadChainGraph, loadLiveApplication, parseItemTaskRef } from '@/lib/knowledge/product-server'
import { loadApplicationAttempts, summarizeApplicationAttempts } from '@/lib/admin/application-attempts'
import { itemRevealDecision } from '@/lib/csat/embargo-gate'
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
  const { data: app, error: appError } = await db.from('knowledge_applications').select('*').eq('id', params.id).maybeSingle()
  if (appError) throw new Error(`적용 조회 실패: ${appError.message}`)
  if (!app) notFound()
  const parsed = parseItemTaskRef(String(app.surface_ref))
  const itemRef = parsed ? parsed.itemId : typeof (app.audience as Row)?.item === 'string' ? String((app.audience as Row).item) : null
  const revealTargets = [...new Set([...(parsed ? [parsed.itemId] : []), ...findTargetsOf(app.audience)])]
  if (revealTargets.length) {
    const gate = await itemRevealDecision(revealTargets, {db})
    if (gate.failed) throw new Error('적용 문항 보류 판정 실패')
    if (revealTargets.some(ref => gate.held.has(ref))) return <KnowledgeFrame title="적용 사슬 추적" question="보류 중인 문항의 적용" help={<AdminScreenHelp screen="knowledge-trace" />}><p role="status">보류 문항의 적용 사슬·정오·검증 결과는 표시하지 않습니다.</p></KnowledgeFrame>
  }
  const graph = await loadChainGraph(db)
  const chain = resolveChain(String(app.item_id), graph.items, graph.links)
  const ids = chain.path.map((p) => p.id)
  const attempts = await loadApplicationAttempts(db, params.id)
  const [evidence, inqLinks, trials] = await Promise.all([
    db.from('knowledge_evidence').select('id, item_id, source_type, evidence_level, grade, applicability').in('item_id', ids),
    db.from('knowledge_inquiry_links').select('inquiry_id, item_id, role').in('item_id', ids),
    attempts.heldCount > 0 ? { data: [], error: null } : db.from('knowledge_trials').select('*').eq('application_id', params.id),
  ])
  for (const r of [evidence, inqLinks, trials]) if (r.error) throw new Error(`추적 읽기 실패: ${r.error.message}`)
  const inquiryIds = [...new Set((inqLinks.data ?? []).map((l: Row) => String(l.inquiry_id)))]
  const { data: inquiries, error: inquiryError } = inquiryIds.length ? await db.from('knowledge_inquiries').select('id, slug, question, status, uncertainty').in('id', inquiryIds) : { data: [] as Row[], error: null }
  if (inquiryError) throw new Error(`탐구 조회 실패: ${inquiryError.message}`)
  const ev = (evidence.data ?? []) as Row[]
  const research = ev.filter((e) => e.source_type === 'research')
  const attemptSummary = summarizeApplicationAttempts(attempts.rows, Number(app.version))
  const tr = (trials.data ?? []) as Row[]
  const task = chain.path[0]
  // 문항 과제면 주석 상태도 사슬의 한 칸이다
  const itemTask = itemRef ? currentItemTask(itemRef) : null
  const annotation = itemTask?.ann ?? null
  const selected = await loadLiveApplication(String(app.surface), String(app.surface_ref), db)
  const currentSelection = !!selected && selected.app.id === app.id && selected.app.version === app.version
  const itemBinding = app.surface !== 'csat_item_task' || !!(parsed && itemTask && parsed.taskKey === itemTask.def.key && await anchorGate(itemRef!, db, true))
  // 지도 FIND 적용은 목적지(문항 과제 적용)가 살아 있어야 학습자에게 링크가 보인다 — 추적도 같은 조건으로(Codex P2)
  const target = app.surface === 'learning_map_find' && itemRef ? itemTask ? await loadLiveApplication('csat_item_task', itemTaskRef(itemTask.def.key, itemRef), db) : null : null

  const breaks = [
    ...(inquiries?.length ? [] : ['탐구 질문에 이어진 사슬 항목이 없다']),
    ...chain.breaks.map((b) => `${LAYER_WORD[b.layer]} — ${b.reason}${b.slug ? ` (${b.slug})` : ''}`),
    ...(attempts.heldCount > 0 ? ['보류 원장으로 검증 계획·결과 확인을 보류했습니다'] : tr.length ? [] : ['검증 계획(trial)이 없다 — 켤 수 없다']),
    ...(app.status === 'active' ? [] : [`적용이 ${APP_STATUS_LABEL[app.status as AppStatus]} — 학습자에게 나가지 않는다`]),
    ...(currentSelection ? [] : ['현재 제품이 선택하는 적용 ID·버전과 다릅니다']),
    ...(itemBinding ? [] : ['현재 문항 TASK·원문 결속을 확인하지 못했습니다']),
    ...(itemRef && !annotation ? ['문항 주석이 없거나 골격 서명이 바뀌었다 — 채점하지 않는다'] : []),
    ...(app.surface === 'learning_map_find' && itemRef && !target ? ['목적지 문항 과제 적용이 꺼져 있다 — 지도 링크가 학습자에게 보이지 않는다'] : []),
  ]

  return (
    <KnowledgeFrame title="적용 사슬 추적" question="이 과제는 어디서 왔고, 지금 어디가 끊겼나" help={<AdminScreenHelp screen="knowledge-trace" />}>
      <section aria-labelledby="breaks" className="mb-8" data-testid="trace-breaks" data-registration-current={breaks.length === 0}>
        <h2 id="breaks" className="mb-2 text-lg font-semibold text-[var(--t1)]">끊긴 곳 <span className="tabular-nums text-[var(--t2)]">{breaks.length}</span></h2>
        {breaks.length === 0 ? <p className="text-sm text-[var(--t2)]">등록 사슬과 현재 선택 적용을 확인했습니다. 실제 노출·수행·효과는 별도 근거가 필요합니다.</p> : (
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
          <p className="mt-1">현재 선택 적용: {selected ? <Link href={`/admin/knowledge/product/${selected.app.id}`} className={`inline-flex min-h-11 items-center underline ${FOCUS}`}>v{selected.app.version} · {currentSelection ? '이 적용과 일치' : '다른 적용'}</Link> : '없음'}</p>
          {itemRef && <p className="mt-1">문항 {itemRef} · 과제 {itemTask?.def.key ?? '—'} · 주석 {annotation ? `${annotation.version}(Claude · Codex 맹검 합의)` : '없음'}</p>}
        </li>
        <li className="rounded border border-[var(--bd)] p-4" data-step="attempts">
          <h3 className="font-semibold text-[var(--t1)]">적용 버전에 결속된 수행 원장</h3>
          {attempts.heldCount > 0 && <p role="status">보류 문항의 수행 {attempts.heldCount}건은 원장 집계에서 제외했습니다. 해당 문항을 포함할 수 있는 trial 결과도 표시하지 않습니다.</p>}
          <p className="mt-1" data-testid="trace-attempts">표시 가능한 이 적용 v{String(app.version)} 기록 {attemptSummary.current}건 · 다른 버전 {attemptSummary.other}건 · 버전 미상 {attemptSummary.unknown}건</p>
          <p className="mt-1">현재 버전의 비합성 표시 {attemptSummary.nonSynthetic}건({attemptSummary.accounts}계정, 정답 {attemptSummary.correct}건) · 합성 {attemptSummary.synthetic}건 · 합성 여부 미상 {attemptSummary.syntheticUnknown}건</p>
          <p className="mt-1">단계별 기록: {attemptSummary.phases.map(p => `${p.phase} ${p.count}건`).join(' · ') || '표시 가능한 기록 없음'}. 비합성 표시는 외부 실사용자 검증이나 독립 수행·노출·효과의 증명이 아닙니다.</p>
        </li>
        <li className="rounded border border-[var(--bd)] p-4" data-step="trial">
          <h3 className="font-semibold text-[var(--t1)]">효과 검증</h3>
          {(attempts.heldCount > 0 ? [] : tr).map((t) => {
            const d = (t.design ?? {}) as Row
            return <p key={String(t.id)} className="mt-1">{t.synthetic ? '합성' : '실제'} · {TRIAL_STATUS_LABEL[t.status as TrialStatus]} · 최소 표본 {String(d.min_n ?? '—')} · 지연 {d.delayed_days ? `${String(d.delayed_days)}일` : '없음'} · 전이 {d.transfer ? '있음' : '없음'}{t.review_required_at ? ' · 재계산 필요(결과를 근거로 쓰지 않음)' : t.result ? ` · 결과 ${String(t.result)}` : ''}</p>
          })}
          <p className="mt-1" data-testid="trace-efficacy">{attempts.heldCount > 0 ? '보류 원장과의 결속 확인 전에는 이 적용의 효과 결과를 표시하지 않습니다.' : <>연결 원리 항목의 전역 효과 상태: {task?.efficacy ?? '미상'}. 이 적용·버전의 효과 판정과 다릅니다. 위 trial의 분석 상태·합성 여부·재계산 요구를 개별 확인하세요.</>}</p>
        </li>
      </ol>
    </KnowledgeFrame>
  )
}
