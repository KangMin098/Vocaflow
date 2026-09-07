// apps/web/src/app/admin/quality/gates/page.tsx
//
// /admin/quality/gates — 콘텐츠 품질 게이트 (파이프라인 정확성 자동 검증)
// run_content_quality_gates('global') 결정론 불변식 → 파이프라인별 red/green.
// 목적: 학습자에게 나갈 산출물이 "맞는 단어·맞는 뜻·맞는 레벨"로 정확히 뽑혔나 검증.
//   critical FAIL = 게시 차단 후보 · 실패는 사전DB/파이프라인 수정 신호.
// 근거: docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md
// RLS/guard: run_content_quality_gates 내부 is_admin_or_curator + layout requireAdmin.

import { Suspense } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ShieldCheck } from 'lucide-react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

import { GateCheckClient, type BookOpt, type ArticleOpt } from './GateCheckClient'
import { GlobalGatesClient } from './GlobalGatesClient'

export const metadata = {
  title: '품질 게이트 — Admin',
  description: '파이프라인 정확성 결정론 불변식 (게시 신뢰 게이트)',
}

export const dynamic = 'force-dynamic'

/**
 * ⚠️ 전역 게이트는 **50초짜리 질의**다 (실측 2026-09-06: `run_content_quality_gates('global')`
 *    EXPLAIN ANALYZE **49,706 ms**). 예전에는 이 페이지가 그것을 SSR 에서 `await` 해서
 *    **화면이 45초 안에 안 떴다** — 런타임 전수 훑기가 41화면 중 이 하나를
 *    「네비게이션 실패(타임아웃)」로 잡았다. 관리자에게는 "느린 화면" 이 아니라 **없는 화면**이다.
 *
 *    Suspense 로 감싸는 것으로는 **안 됐다** — 스트리밍 SSR 에서 문서는 모든 경계가 풀려야
 *    끝나고 `DOMContentLoaded` 는 그때 발생한다(수정 후 훑기에서 같은 자리가 다시 잡혔다).
 *    그래서 SSR 에서 아예 뺐다: 전역 게이트는 **버튼을 눌러야** 돈다(`actions.ts`).
 *    덤으로 낭비도 사라졌다 — 콘텐츠별 체크만 하러 온 사람이 매번 50초를 치르지 않는다.
 */
export default async function AdminGatesPage() {
  // admin 게이트(dev-bypass 처리) 후 service-role 클라이언트로 미발행(ready/queued) 콘텐츠까지 조회
  // — RLS(anyone_read_published_safe)가 dev-bypass anon 세션에서 미발행을 차단하므로.
  await requireAdmin('/admin/quality/gates')

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <header>
        <h1 className="inline-flex items-center gap-3 font-display text-[28px] font-[800] text-[var(--t1)]">
          <ShieldCheck size={26} className="text-[#8B5CF6]" aria-hidden="true" /> 품질 게이트
        </h1>
        <p className="mt-2 max-w-2xl font-body text-[14px] leading-[1.6] text-[var(--t2)]">
          학습자에게 나갈 산출물이 <strong className="text-[var(--t1)]">맞는 단어·맞는 뜻·맞는 레벨</strong>로
          정확히 뽑혔는지 결정론 불변식으로 검증합니다. <span className="text-[#9C3A30]">critical FAIL</span>은
          게시 전 수정 대상 — 사전DB나 파이프라인을 고쳐야 한다는 신호입니다.
        </p>
      </header>

      <AdminScreenHelp screen="quality-gates" className="-mt-4" />

      <GlobalGatesClient />

      <Suspense fallback={<ContentCheckSkeleton />}>
        <ContentCheck />
      </Suspense>

      <p className="text-center font-body text-[11px] text-[var(--t2)]">
        게이트: `run_content_quality_gates(scope, id)` 결정론 불변식 · critical FAIL = 게시 차단 후보 ·
        WARN = 위생(추적) · 콘텐츠별 체크로 게시 전 신뢰 확인
      </p>
    </div>
  )
}

/** 콘텐츠별 게시 전 체크 — 목록 조회 두 개라 빠르다. 전역 게이트와 분리해 먼저 쓸 수 있게 한다. */
async function ContentCheck() {
  const supabase = createAdminClient() as unknown as SupabaseClient

  const [{ data: bookRows }, { data: articleRows }] = await Promise.all([
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

  return <GateCheckClient books={bookRows ?? []} articles={articleRows ?? []} />
}

function ContentCheckSkeleton() {
  return (
    <div
      className="h-40 animate-pulse rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)]"
      aria-busy="true"
    />
  )
}
