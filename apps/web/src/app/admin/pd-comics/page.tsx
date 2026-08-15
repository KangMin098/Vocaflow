// apps/web/src/app/admin/pd-comics/page.tsx
//
// PDCP Admin — 퍼블릭도메인 스캔 만화 운영 콘솔. **`/admin/comic`(AI 생성 CCP)과 별도 화면.**
//
// 왜 별도인가: 단계가 다르다.
//   CCP  도서 선택 → 큐 적재 → 생성 → QC(정본 일치) → 발행
//   PDCP 소스 검색 → 취득 → 복원 → 컷분할 → 대사추출 → 검수 → 발행 + **법적 게이트**
// 한 화면에 섞으면 stepper·QC 카드·액션이 전부 분기투성이가 된다.
//
// 서버는 초기 데이터만 싣고, 조작면(소스 대량검색·적재 · 드레인 · 라이브 모니터링 · 도구 점검)은
// 클라이언트가 담당한다 — 드레인이 한 단계씩 반복 호출하며 진행을 보여줘야 하기 때문.

import { ScanLine } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listPdComicsAdmin } from '@/lib/pd-comic/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminPdComicsClient } from './AdminPdComicsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'PD Comic Pipeline · Admin' }

export default async function AdminPdComicsPage() {
  await requireAdmin('/admin/pd-comics')
  const client = createAdminClient() as unknown as SupabaseClient
  const { ready, data: rows } = await listPdComicsAdmin(client)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <AdminPageHeader
        icon={ScanLine}
        title="PD Comic Pipeline"
        description="퍼블릭도메인 스캔 만화 — 소스 대량 취득 · 복원 · 컷분할 · 대사추출 · 검수 · 발행 (AI 생성 만화와 별도)"
      />
      {!ready && <SchemaNotReady />}
      <AdminPdComicsClient initialRows={rows} schemaReady={ready} />
    </div>
  )
}

/** 스키마 미적용 — 에러가 아니라 "아직 준비 안 됨" 상태로 안내한다. */
function SchemaNotReady() {
  return (
    <section className="mb-4 rounded-[var(--r-lg)] border border-[var(--warning)] bg-[var(--warning-light)] px-5 py-4">
      <h2 className="font-display text-[14px] font-[800] text-[var(--t1)]">스키마 미적용</h2>
      <p className="mt-1.5 font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
        PDCP 테이블(<code className="font-mono">pd_comic_issues</code> ·{' '}
        <code className="font-mono">pd_comic_panels</code>)이 없습니다. 검색·도구 점검은 동작하지만
        큐 적재는 불가합니다.
      </p>
      <pre className="mt-2 overflow-x-auto rounded-[var(--r-md)] bg-[var(--bg3)] px-3 py-2 font-mono text-[11px] text-[var(--t2)]">
        supabase/migrations/20260809020000_pdcp_public_domain_comics.sql
      </pre>
    </section>
  )
}
