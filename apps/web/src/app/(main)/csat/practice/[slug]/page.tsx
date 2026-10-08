// apps/web/src/app/(main)/csat/practice/[slug]/page.tsx
//
// 학습 원리 과제 — 배포된 학습 설계가 학습자의 실제 행동이 되는 자리(docs/methodology/VNEXT.md §5·§6).
// 배포 중인 설계만 열린다. 관리자는 ?preview=1 로 배포 전 설계를 실행해 볼 수 있다(기록은 preview 로 따로 남는다).
// 지문 글자는 오지 않는다 — 학습자는 자기 문제지를 보고 문장 번호로 답한다.
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ClaimPractice } from '@/components/knowledge/ClaimPractice'
import { getAdminUser } from '@/lib/auth/require-admin'
import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { loadMyRuns, loadPracticeDesign, practicePool, taskFor } from '@/lib/knowledge/learner-practice'
import { pickNext, toLearnerTask } from '@/lib/knowledge/practice'
import { judgeCapability } from '@/lib/knowledge/vnext'

export const metadata: Metadata = { title: '주장과 근거 — 기출' }
export const dynamic = 'force-dynamic'

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { preview?: string; item?: string }
}) {
  const wantPreview = searchParams.preview === '1'
  const preview = wantPreview && (await getAdminUser()) !== null
  const design = await loadPracticeDesign(params.slug, { preview })
  if (!design) notFound()

  const { userId, runs } = await loadMyRuns(design.id)
  if (!userId) redirect(loginUrlWithReturn(`/csat/practice/${params.slug}${wantPreview ? '?preview=1' : ''}`))

  const pool = practicePool(design)
  const done = new Set(runs.map((r) => r.itemId))
  const trainHits = runs.filter((r) => r.phase === 'train').map((r) => r.claimHit)
  const judgement = judgeCapability(trainHits)
  const next = pickNext(
    { train: pool.filter((p) => p.phase === 'train').map((p) => p.itemId), transfer: pool.filter((p) => p.phase === 'transfer').map((p) => p.itemId) },
    done,
    trainHits.length,
  )
  const chosen = searchParams.item && pool.some((p) => p.itemId === searchParams.item) ? searchParams.item : (next?.itemId ?? pool[0]?.itemId ?? null)
  const tasks = Object.fromEntries(
    pool.map((p) => {
      const t = taskFor(p.itemId)
      return [p.itemId, t ? toLearnerTask(t).bars : []]
    }),
  )

  return (
    <ClaimPractice
      design={{ slug: design.slug, title: design.title, learnerSummary: design.learnerSummary, procedure: design.procedure, status: design.status }}
      preview={preview}
      judgement={judgement}
      pool={pool.map((p) => ({ ...p, done: done.has(p.itemId) }))}
      bars={tasks}
      initialItemId={chosen}
      recommendedItemId={next?.itemId ?? null}
      history={runs.slice(-10).map((r) => ({ phase: r.phase, claimHit: r.claimHit }))}
    />
  )
}
