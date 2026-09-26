// apps/web/src/app/admin/video/requests/[id]/page.tsx
// @form: 계보 — 요청이 rev 와 검토 코멘트로 이어지는 이력(5칸 스테퍼 · rev 고르기 · 수정 요청 코멘트가 다음 rev 로)
//
// 영상 요청 한 건 — 기획 · 설계 · 검토 · 적용 · 평가를 한 화면에서.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadRequestDetail } from '@/lib/admin/video-requests'
import { videoById } from '@/lib/video/catalog'

import { RequestDetailClient } from './RequestDetailClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: '영상 요청' }

export default async function VideoRequestPage({ params }: { params: { id: string } }) {
  await requireAdmin(`/admin/video/requests/${params.id}`)
  const db = createAdminClient()
  const detail = await loadRequestDetail(db as never, params.id)
  if (!detail) notFound()
  // 발행돼 manifest 에 들어간 편이면 미리보기 — 없으면 null(아직 안 뜬다)
  const video = detail.request.video_id ? videoById(detail.request.video_id, 'wide') : null
  return <RequestDetailClient detail={detail} video={video} />
}
