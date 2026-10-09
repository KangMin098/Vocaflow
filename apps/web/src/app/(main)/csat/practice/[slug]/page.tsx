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
import { PRACTICE_SLUG, capabilityHits, firstAttempts, pendingReviews, pickNext } from '@/lib/knowledge/practice'
import { loadMyAttempts, loadMyReviewSessions, loadPracticePool, loadReviewResolvers } from '@/lib/knowledge/practice-server'
import { kstDateOf } from '@/lib/knowledge/review-date'
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
  // 내 복습 — 지도에 걸리지 않는 Practice 예약도 여기서 다시 찾는다(E11). 못 읽으면 목록만 빠진다
  const reviewSessions = await loadMyReviewSessions(db, user.id).catch((e) => { console.error('[csat-practice reviews]', e); return [] })
  // 해소 근거는 같은 문항의 모든 판단(Practice + 문항 확인 과제 재평가)
  const resolvers = await loadReviewResolvers(db, user.id, [...new Set(reviewSessions.map((s) => s.item_ref).filter((x): x is string => !!x))])
    .catch((e) => { console.error('[csat-practice review resolvers]', e); return attempts })
  const reviews = pendingReviews(reviewSessions, resolvers, Date.now()).map((r) => {
    const p = pool.find((x) => x.itemId === r.itemId)
    return { itemId: r.itemId, label: p ? `${p.examLabel} ${p.no}번` : r.itemId.replace('#', ' '), date: kstDateOf(r.reviewAt), due: r.due, inPool: !!p }
  })
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
      reviews={reviews}
    />
  )
}
