// apps/web/src/app/(app)/csat/browse/page.tsx
//
// **전체 기출 서가 — 별도 화면.** 기출 메인(`/csat`, 3B 앱 화면)에서 「전체 서가」로 띄운다. `(main)` 셸(상단 메뉴 · 나침반 띠) 밖, `(app)` 풀스크린 그룹에 선다.
// 문항 해설 극장과 같은 3B 워크스페이스 판(`components/csat/browse/CsatWorkspace.tsx`)을 쓴다.
// 하위 경로(`/csat/item` · `/csat/dissect` …)는 그대로 `(main)/csat` 에 있다 — 같은 URL 트리를
// 두 그룹이 나눠 가질 수 있고, 겹치는 경로는 없다. 진입 계측은 `(app)/layout.tsx` 가 맡는다(D2).
import type { Metadata } from 'next'
import { CsatWorkspace } from '@/components/csat/browse/CsatWorkspace'
import { loadBrowseCatalog } from '@/lib/csat/browse'
import { loadDissectionCatalog } from '@/lib/csat/dissect-catalog'
export const metadata: Metadata = { title: '기출 — 전체 탐색과 오늘의 해부', description: '수능·모의평가 기출을 유형·학년도로 골라 근거와 오답 설계를 봅니다.' }
export const dynamic = 'force-dynamic'
export default async function CsatHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [catalog, browse, params] = await Promise.all([loadDissectionCatalog(), loadBrowseCatalog(), searchParams])
  const type = params.type
  return <CsatWorkspace catalog={catalog} browse={browse} initialType={typeof type === 'string' ? type : undefined} />
}
