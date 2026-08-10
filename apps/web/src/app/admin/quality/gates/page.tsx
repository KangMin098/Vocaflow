// apps/web/src/app/admin/quality/gates/page.tsx
//
// /admin/quality/gates — 콘텐츠 품질 게이트 (파이프라인 정확성 자동 검증)
// run_content_quality_gates('global') 결정론 불변식 → 파이프라인별 red/green.
// 목적: 학습자에게 나갈 산출물이 "맞는 단어·맞는 뜻·맞는 레벨"로 정확히 뽑혔나 검증.
//   critical FAIL = 게시 차단 후보 · 실패는 사전DB/파이프라인 수정 신호.
// 근거: docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md
// RLS/guard: run_content_quality_gates 내부 is_admin_or_curator + layout requireAdmin.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ShieldCheck } from 'lucide-react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

import { GateCheckClient, type BookOpt, type ArticleOpt } from './GateCheckClient'

export const metadata = {
  title: '품질 게이트 — Admin',
  description: '파이프라인 정확성 결정론 불변식 (게시 신뢰 게이트)',
}

export const dynamic = 'force-dynamic'

interface GateRow {
  pipeline: string
  invariant: string
  severity: 'critical' | 'warning'
  fail_count: number
  verdict: 'PASS' | 'FAIL' | 'WARN'
  detail: Record<string, unknown> | null
}

const VERDICT_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PASS: { bg: 'bg-[#2E7D5A]/10', fg: 'text-[#2E7D5A]', label: 'PASS' },
  FAIL: { bg: 'bg-[#9C3A30]/12', fg: 'text-[#9C3A30]', label: 'FAIL' },
  WARN: { bg: 'bg-[#B5803A]/12', fg: 'text-[#B5803A]', label: 'WARN' },
}

export default async function AdminGatesPage() {
  // admin 게이트(dev-bypass 처리) 후 service-role 클라이언트로 미발행(ready/queued) 콘텐츠까지 조회
  // — RLS(anyone_read_published_safe)가 dev-bypass anon 세션에서 미발행을 차단하므로.
  await requireAdmin('/admin/quality/gates')
  const supabase = createAdminClient() as unknown as SupabaseClient

  const [{ data: gateData, error }, { data: bookRows }, { data: articleRows }] = await Promise.all([
    supabase.rpc('run_content_quality_gates', { p_scope: 'global' }),
    // 게시 전 체크는 미발행(ready/queued) 콘텐츠도 대상 — 소스 GET → 추출 후 게시 전 검증
    supabase
      .from('library_books')
      .select('id, title, book_v_level, status')
      .in('status', ['published', 'ready', 'queued'])
      .order('status', { ascending: true })
      .order('title', { ascending: true })
      .returns<BookOpt[]>(),
    supabase
      .from('library_articles')
      .select('id, title, register, status')
      .in('status', ['published', 'ready', 'queued'])
      .order('status', { ascending: true })
      .order('title', { ascending: true })
      .returns<ArticleOpt[]>(),
  ])

  if (error) console.warn('[admin/quality/gates] gate rpc failed:', error.message)

  const rows = (gateData ?? []) as GateRow[]
  const byPipeline = new Map<string, GateRow[]>()
  for (const r of rows) {
    const list = byPipeline.get(r.pipeline) ?? []
    list.push(r)
    byPipeline.set(r.pipeline, list)
  }
  const criticalFails = rows.filter((r) => r.severity === 'critical' && r.verdict === 'FAIL')
  const warns = rows.filter((r) => r.verdict === 'WARN')
  const allGreen = rows.length > 0 && criticalFails.length === 0

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <header>
        <h1 className="inline-flex items-center gap-2.5 font-display text-[28px] font-[800] text-[var(--t1)]">
          <ShieldCheck size={26} className="text-[#8B5CF6]" aria-hidden="true" /> 품질 게이트
        </h1>
        <p className="mt-2 max-w-2xl font-body text-[14px] leading-[1.6] text-[var(--t2)]">
          학습자에게 나갈 산출물이 <strong className="text-[var(--t1)]">맞는 단어·맞는 뜻·맞는 레벨</strong>로
          정확히 뽑혔는지 결정론 불변식으로 검증합니다. <span className="text-[#9C3A30]">critical FAIL</span>은
          게시 전 수정 대상 — 사전DB나 파이프라인을 고쳐야 한다는 신호입니다.
        </p>
      </header>

      <AdminScreenHelp screen="quality-gates" className="-mt-4" />

      {/* 전역 요약 배너 */}
      <section
        className={`rounded-[var(--r-lg)] border p-6 ${
          rows.length === 0
            ? 'border-[var(--bd)] bg-[var(--bg)]'
            : allGreen
              ? 'border-[#2E7D5A]/40 bg-[#2E7D5A]/6'
              : 'border-[#9C3A30]/40 bg-[#9C3A30]/6'
        }`}
      >
        {rows.length === 0 ? (
          <p className="font-body text-[14px] text-[var(--t2)]">
            게이트 결과가 없어요 — admin 권한을 확인해 주세요.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-[20px] font-[800] text-[var(--t1)]">
                {allGreen ? '전역 게이트 통과 — 게시 신뢰 가능' : `critical FAIL ${criticalFails.length}건 — 수정 필요`}
              </p>
              <p className="mt-1 font-body text-[13px] text-[var(--t2)]">
                불변식 {rows.length}개 검사 · critical FAIL {criticalFails.length} · warning {warns.length}
              </p>
            </div>
            <div
              className={`grid h-14 w-14 place-items-center rounded-full text-[22px] font-[800] ${
                allGreen ? 'bg-[#2E7D5A] text-white' : 'bg-[#9C3A30] text-white'
              }`}
            >
              {allGreen ? '✓' : criticalFails.length}
            </div>
          </div>
        )}
      </section>

      {/* 파이프라인별 불변식 */}
      {[...byPipeline.entries()].map(([pipeline, list]) => (
        <section key={pipeline} className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
          <h2 className="mb-4 flex items-center gap-2.5">
            <span className="rounded-[var(--r-sm)] bg-[#8B5CF6]/10 px-2 py-0.5 font-mono text-[11px] font-[700] uppercase tracking-[0.08em] text-[#8B5CF6]">
              {pipeline}
            </span>
          </h2>
          <ul className="space-y-2">
            {list
              .sort((a, b) => (a.verdict === 'PASS' ? 1 : 0) - (b.verdict === 'PASS' ? 1 : 0))
              .map((r) => {
                const st = VERDICT_STYLE[r.verdict] ?? VERDICT_STYLE.WARN
                return (
                  <li
                    key={r.invariant}
                    className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`rounded-[var(--r-sm)] px-2 py-0.5 font-mono text-[10px] font-[700] ${st.bg} ${st.fg}`}>
                        {st.label}
                      </span>
                      <span className="font-body text-[13px] text-[var(--t1)]">{r.invariant}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[var(--t2)]">
                      {r.verdict === 'PASS' ? '0' : `${r.fail_count}건`}
                    </span>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}

      {/* 콘텐츠별 게시 전 체크 */}
      <GateCheckClient books={bookRows ?? []} articles={articleRows ?? []} />

      <p className="text-center font-body text-[11px] text-[var(--t2)]">
        게이트: `run_content_quality_gates(scope, id)` 결정론 불변식 · critical FAIL = 게시 차단 후보 ·
        WARN = 위생(추적) · 콘텐츠별 체크로 게시 전 신뢰 확인
      </p>
    </div>
  )
}
