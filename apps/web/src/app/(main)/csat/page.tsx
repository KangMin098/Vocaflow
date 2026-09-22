// apps/web/src/app/(main)/csat/page.tsx
import type { Metadata } from 'next'
import { SessionHome } from '@/components/csat/session/SessionHome'
import { loadBrowseCatalog } from '@/lib/csat/browse'
import { loadDissectionCatalog } from '@/lib/csat/dissect-catalog'
export const metadata: Metadata = { title: '기출 — 전체 탐색과 오늘의 해부', description: '수능·모의평가 802문항을 유형·학년도로 골라 근거와 오답 설계를 봅니다.' }
export const dynamic = 'force-dynamic'
export default async function CsatHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [catalog, browse, params] = await Promise.all([loadDissectionCatalog(), loadBrowseCatalog(), searchParams])
  const type = params.type
  return <SessionHome catalog={catalog} browse={browse} initialType={typeof type === 'string' ? type : undefined} />
}
