// apps/web/src/app/(main)/csat/dissect/page.tsx
import type { Metadata } from 'next'
import { SessionRunner } from '@/components/csat/session/SessionRunner'
import { loadDissectionCatalog } from '@/lib/csat/dissect-catalog'
import { fromItemSlug } from '@/lib/csat/item-slug'
export const metadata: Metadata = { title: '기출 해부' }
export const dynamic = 'force-dynamic'
export default async function DissectPage({ searchParams }: { searchParams: { set?: string; formula?: string; item?: string; resume?: string } }) {
  const catalog = await loadDissectionCatalog()
  const initial = (searchParams.set ?? '').split(',').filter(s => /^[A-Za-z0-9_]{1,16}-\d{1,2}$/.test(s)).slice(0, 3).map(fromItemSlug)
  const explore = searchParams.item && /^[A-Za-z0-9_]{1,16}-\d{1,2}$/.test(searchParams.item) ? fromItemSlug(searchParams.item) : undefined
  return <SessionRunner key={explore ?? searchParams.set ?? searchParams.resume ?? 'recommended'} catalog={catalog} initial={initial} formulaTag={searchParams.formula} explore={explore} resume={searchParams.resume === '1'} />
}
// @form: 시험지 사물 — 실제 문제지를 reflow 한 판면 위에서 근거 구절을 골라 예측 3수를 남긴다(정답 선공개 → 두 문항 대조)
