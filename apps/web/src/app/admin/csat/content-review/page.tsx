// apps/web/src/app/admin/csat/content-review/page.tsx
//
// **기출분석 콘텐츠 검수 작업 공간(F2).** 공식 원문 · 현재 분석 · 현재 강의 cue · 수정 후보를 한 화면에서 대조한다.
//
// ⚠️ 이 화면은 **DB 에 아무것도 쓰지 않는다.** 상태 버튼은 브라우저 시연 원장에만 남고, 실제 승인 수는
//   서버가 가진 승인 저장소가 없으므로 0 이다(새 승인 테이블·발행 권한은 별도 승인 대상 — 선결정하지 않는다).
// 스냅샷: `lib/csat/content-review/data/snapshot.json` — `scripts/csat/content-review/build-snapshot.mts` 가 만든다.

import { requireAdmin } from '@/lib/auth/require-admin'
import snapshot from '@/lib/csat/content-review/data/snapshot.json'
import { candidateDetail, queueRows, type Snapshot } from '@/lib/csat/content-review/workspace'

import { ContentReviewClient } from './ContentReviewClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatContentReviewPage({ searchParams = {} }: { searchParams?: { id?: string | string[] } }) {
  await requireAdmin('/admin/csat/content-review')
  const s = snapshot as unknown as Snapshot
  const rows = queueRows(s)
  const want = typeof searchParams.id === 'string' ? searchParams.id : null
  const id = want && rows.some((r) => r.id === want) ? want : rows[0]?.id ?? null
  const detail = id ? candidateDetail(s, id) : null
  return (
    <ContentReviewClient
      rows={rows}
      detail={detail}
      unknownId={want != null && want !== id ? want : null}
      generatedFrom={s.generatedFrom}
    />
  )
}
