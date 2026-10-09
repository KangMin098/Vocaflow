// apps/web/src/app/(app)/csat/dissect/page.tsx
import type { Metadata } from 'next'
import { Sparkles } from 'lucide-react'
import { CsatShell } from '@/components/csat/home/CsatShell'
import { SessionRunner } from '@/components/csat/session/SessionRunner'
import { railExams } from '@/lib/csat/rail-data'
import { loadDissectionCatalog } from '@/lib/csat/dissect-catalog'
import { fromItemSlug } from '@/lib/csat/item-slug'
export const metadata: Metadata = { title: '기출 해부' }
export const dynamic = 'force-dynamic'
export default async function DissectPage({ searchParams }: { searchParams: { set?: string; formula?: string; item?: string; resume?: string } }) {
  const [catalog, exams] = await Promise.all([loadDissectionCatalog(), railExams()])
  const initial = (searchParams.set ?? '').split(',').filter(s => /^[A-Za-z0-9_]{1,16}-\d{1,2}$/.test(s)).slice(0, 3).map(fromItemSlug)
  const explore = searchParams.item && /^[A-Za-z0-9_]{1,16}-\d{1,2}$/.test(searchParams.item) ? fromItemSlug(searchParams.item) : undefined
  return (
    <CsatShell place="dissect" exams={exams} pill={<><Sparkles size={13} aria-hidden="true" />기출 해부</>} bare>
      <SessionRunner key={explore ?? searchParams.set ?? searchParams.resume ?? 'recommended'} catalog={catalog} initial={initial} formulaTag={searchParams.formula} explore={explore} resume={searchParams.resume === '1'} />
    </CsatShell>
  )
}
// @form: 시험지 사물 — 실제 문제지를 reflow 한 판면 위에서 근거 구절을 골라 예측 3수를 남긴다(정답 선공개 → 두 문항 대조)
