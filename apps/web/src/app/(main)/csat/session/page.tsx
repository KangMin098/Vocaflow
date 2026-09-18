// apps/web/src/app/(main)/csat/session/page.tsx
// @form: 시험지 사물 — 한 문항을 풀고 같은 판면에서 근거를 확인한 뒤 다음 문항으로 넘긴다
//
// **학습 — 한 문항 = 한 화면.** ① 풀기 → ② 이해 → ③ 한 줄 → 다음 문항.
//
// 세션 구성은 `?set=2026-31,M2706-36,2025-38&k=weak,order,review` 로 온다(홈이 짠 것).
// 여기서는 **후보에 있는 문항만** 통과시킨다 — 없는 id 로 빈 화면을 만들지 않고, 사용자 입력이
// 골격 파일 이름으로 흐르지 않게 모양부터 좁힌다.
//
// ⚠️ 이 화면의 서버 렌더에는 해설이 **한 글자도 없다** — 답을 고른 뒤 API 로만 온다(지시문 A4).

import type { Metadata } from 'next'

import { SessionRunner } from '@/components/csat/session/SessionRunner'
import { fromItemSlug } from '@/lib/csat/item-slug'
import { isSessionItem, loadSessionCatalog } from '@/lib/csat/session/catalog'
import type { SlotKind } from '@/lib/csat/session/model'

export const metadata: Metadata = {
  title: '기출 세션',
}

export const dynamic = 'force-dynamic'

const KINDS: SlotKind[] = ['weak', 'order', 'review', 'new']

export default async function CsatSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; k?: string }>
}) {
  const sp = await searchParams
  const slugs = (sp.set ?? '').split(',').filter((s) => /^[A-Za-z0-9_]{1,16}-\d{1,2}$/.test(s)).slice(0, 5)
  const kinds = (sp.k ?? '').split(',')
  const initial = slugs
    .map((s, i) => ({
      id: fromItemSlug(s),
      kind: (KINDS.includes(kinds[i] as SlotKind) ? kinds[i] : 'order') as SlotKind,
    }))
    .filter((s) => isSessionItem(s.id))

  const { catalog } = await loadSessionCatalog()
  return <SessionRunner catalog={catalog} initial={initial.length ? initial : null} />
}
