// apps/web/src/app/(main)/csat/practice/[slug]/page.tsx
//
// 「주장과 근거」 연습 — 정본(feat/methodology-vnext) 주석 · 적용 게이트 위에 이식한 학습자 화면(docs/csat-learner/PRACTICE_PORT.md).
// 학습자: 적용이 active 이고 채택 사슬이 살아 있는 주석 문항만. 하나도 없으면 404.
// 관리자 ?preview=1: 주석 문항(적용 상태 무관) + 골격 115문항 후보. 기록은 synthetic · 효과 계산 제외.
// 지문 글자는 오지 않는다 — 학습자는 자기 문제지를 보고 문장 번호로 답한다.
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

import { ClaimPractice } from '@/components/knowledge/ClaimPractice'
import { getAdminUser } from '@/lib/auth/require-admin'
import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { PRACTICE_SLUG, capabilityHits, firstAttempts, pickNext } from '@/lib/knowledge/practice'
import { loadMyAttempts, loadPracticePool } from '@/lib/knowledge/practice-server'
import { judgeCapability } from '@/lib/knowledge/protocol'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: '주장과 근거 — 기출' }
export const dynamic = 'force-dynamic'

export default async function PracticePage({ params, searchParams }: { params: { slug: string }; searchParams: { preview?: string; item?: string } }) {
  if (params.slug !== PRACTICE_SLUG) notFound()
  const wantPreview = searchParams.preview === '1'
  const db = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect(loginUrlWithReturn(`/csat/practice/${params.slug}${wantPreview ? '?preview=1' : ''}`))
  const preview = wantPreview && (await getAdminUser()) !== null

  const pool = await loadPracticePool({ preview })
  if (pool.length === 0) notFound()
  const attempts = await loadMyAttempts(db, user.id, { preview })
  const firsts = firstAttempts(attempts)
  const done = new Set(firsts.map((a) => a.itemId))
  const judgement = judgeCapability(capabilityHits(attempts))
  const trainDone = pool.filter((p) => p.phase === 'practice' && done.has(p.itemId)).length
  const next = pickNext(
    { practice: pool.filter((p) => p.phase === 'practice').map((p) => p.itemId), transfer: pool.filter((p) => p.phase === 'transfer').map((p) => p.itemId) },
    done,
    trainDone,
  )
  const chosen = searchParams.item && pool.some((p) => p.itemId === searchParams.item) ? searchParams.item : (next?.itemId ?? pool[0].itemId)

  return (
    <ClaimPractice
      preview={preview}
      judgement={judgement}
      pool={pool.map((p) => ({ ...p, done: done.has(p.itemId) }))}
      initialItemId={chosen}
      recommendedItemId={next?.itemId ?? null}
      history={firsts.slice(-10).map((a) => ({ phase: a.phase, claimHit: a.claimHit, helpLevel: a.helpLevel }))}
    />
  )
}
