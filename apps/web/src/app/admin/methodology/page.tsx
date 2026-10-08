// apps/web/src/app/admin/methodology/page.tsx
// @form: 주묵 문법 — 주장을 고르면 같은 줄의 난외에서 실제 출처와 근거 위치가 열린다
import Link from 'next/link'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { WorkspaceNav } from '@/components/admin/knowledge/WorkspaceNav'
import { MethodologyWorkbench } from '@/components/admin/methodology/MethodologyWorkbench'
import { requireAdmin } from '@/lib/auth/require-admin'
import { readMethodologySnapshot } from '@/lib/methodology/server'

export const dynamic = 'force-dynamic'
export default async function MethodologyPage() {
  await requireAdmin('/admin/methodology')
  let snapshot: Awaited<ReturnType<typeof readMethodologySnapshot>> = null
  let failed = false
  try { snapshot = await readMethodologySnapshot() } catch { failed = true }
  return <div className="p-4 md:p-8 break-keep">
    {/* 학습 원리 vNext — 탐구 · 근거 연구소의 하위 탭(URL 그대로) */}
    <WorkspaceNav />
    <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div><Link href="/admin" className="inline-flex min-h-11 items-center text-[var(--t2)]">← 관리자</Link><h1 className="text-2xl">가져오기 원장</h1><p className="mt-2 text-[var(--t2)]">누가, 어떤 조건에서, 무엇을 권하는지 원문 근거와 함께 읽습니다.</p></div>
      <AdminScreenHelp screen="methodology" />
    </header>
    {snapshot ? <MethodologyWorkbench bundle={snapshot.bundle} snapshotId={snapshot.id} /> : <section aria-live="polite" className="border-y border-[var(--bd)] py-8">
      <h2>{failed ? '연구 자료를 불러오지 못했습니다' : '적재된 연구 자료가 없습니다'}</h2>
      <p className="my-3">{failed ? '저장소 연결과 자료 검증 결과를 확인한 뒤 다시 시도하세요.' : '검증된 연구 번들을 드레인 절차에 따라 적재하세요.'}</p>
      <Link href="/admin/methodology" className="inline-flex min-h-11 items-center underline">다시 불러오기</Link>
    </section>}
  </div>
}
