// apps/web/src/components/admin/knowledge/AdminItemHandoff.tsx
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAdminItemApplications } from '@/lib/admin/item-applications'
import { PATTERN_LABEL, TRANSFORM_LABEL, type PassageDesign } from '@/lib/csat/design'
import { withScope, type CsatScope } from '@/lib/csat/scope'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'

const LINK = 'inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]'
export async function AdminItemHandoff({ itemId, scope, design, analysisVersion }: {
  itemId: string; scope: CsatScope; design: PassageDesign | null; analysisVersion: number | string | null
}) {
  const result = await loadAdminItemApplications(createAdminClient() as unknown as SupabaseClient, itemId)
  const query = new URLSearchParams({ view: 'questions', item: itemId, exam: itemId.split('#')[0]! })
  return (
    <details className="mb-6 rounded-[var(--r-md)] border border-[var(--bd)] p-4" data-admin-item-handoff>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]">출제 사고·근거 검수·원리 적용</summary>
      <p className="mt-2 break-keep text-xs text-[var(--t2)]">문항 {itemId} · 분석 버전 {analysisVersion ?? '기록 없음'}. 분석 설명, 검수 통과, 학습자 노출과 실제 학습 효과는 별개입니다.</p>
      <AdminScreenHelp screen="kice-product-handoff" className="mt-2" />
      {design ? (
        <dl className="my-3 space-y-2 break-keep text-sm text-[var(--t2)]">
          <div><dt className="font-semibold">지문 선택 이유</dt><dd>{design.selection || '기록 없음'}</dd></div>
          <div><dt className="font-semibold">지문 구조</dt><dd>{PATTERN_LABEL[design.pattern] ?? design.pattern}</dd></div>
          <div><dt className="font-semibold">정답 설계·변환</dt><dd>{TRANSFORM_LABEL[design.transform] ?? design.transform} · {design.transform_note || '설명 없음'}</dd></div>
        </dl>
      ) : <p className="my-3 text-sm text-[var(--t2)]">이 문항의 지문 선정·정답 변환 주석은 아직 없습니다.</p>}
      <Link href={withScope(`/admin/csat/evidence?${query}`, scope)} className={LINK}>이 문항의 원문·근거 검수</Link>
      <h3 className="mt-3 text-sm font-semibold">연결된 TASK·원리·제품 적용</h3>
      {result.state === 'error' ? <p role="status" className="text-sm text-[var(--error)]">적용 연결을 조회하지 못했습니다. 연결 없음으로 판정하지 않습니다.</p>
        : result.rows.length === 0 ? <p className="text-sm text-[var(--t2)]">등록된 적용 연결이 없습니다. 원리·TASK를 검토한 뒤 설계에서 실제 적용을 등록해야 합니다.</p>
        : <ul>{result.rows.map(row => <li key={row.id}><Link href={`/admin/knowledge/product/${row.id}`} className={LINK}>{row.surface_ref} · 적용 v{row.version} · {row.status}</Link></li>)}</ul>}
      <Link href="/admin/knowledge/design" className={LINK}>학습 과제·검증 설계</Link>
    </details>
  )
}
