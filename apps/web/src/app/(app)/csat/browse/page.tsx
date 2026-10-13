// apps/web/src/app/(app)/csat/browse/page.tsx
//
// **전체 기출 서가** — 기출분석공간(`/csat`)의 하위 화면. 홈과 같은 메뉴 · 같은 결(3B 앱 메인)이다.
// 세 입구(목적별 · 유형별 · 회차별)가 쿼리로 들어온다: `?type=` · `?exam=` · `?status=map` · `?from=<학년도>` · `?q=`.
// `(app)` 풀스크린 그룹 — 앱 셸 머리 없이 선다. 진입 계측은 `(app)/layout.tsx` 가 맡는다(D2).
import type { Metadata } from 'next'

import { CsatWorkspace, type BrowseEntry } from '@/components/csat/browse/CsatWorkspace'
import { loadBrowseCatalog } from '@/lib/csat/browse'
import { parseBrowseParams } from '@/lib/csat/browse-url'
import { railExams } from '@/lib/csat/rail-data'

export const metadata: Metadata = { title: '전체 서가 — 기출분석공간', description: '수능·모의평가 기출을 유형·회차·목적으로 골라 근거와 오답 설계를 봅니다.' }
export const dynamic = 'force-dynamic'

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

export default async function CsatBrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [browse, params] = await Promise.all([loadBrowseCatalog(), searchParams])
  // 기출 탐구 조건(v3 M1) — 목적 · 유형 · 회차 · 상태 · 학년도 · 출처 · 학년 · 검색어. 닫힌 값만(browse-url)
  const entry: BrowseEntry = parseBrowseParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, one(v)])))
  // 쿼리가 바뀌면 다시 세운다 — 메뉴의 유형 · 회차 · 목적 링크는 같은 경로 안의 이동이다
  return <CsatWorkspace key={JSON.stringify(entry)} browse={browse} exams={await railExams()} entry={entry} />
}
