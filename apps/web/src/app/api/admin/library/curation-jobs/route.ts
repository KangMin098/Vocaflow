// apps/web/src/app/api/admin/library/curation-jobs/route.ts
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { fetchCurationJobs, fetchQuizJobs, fetchReviewJobs } from '@/lib/library/admin-queries'

export const dynamic = 'force-dynamic'
const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'cache-control': 'no-store' },
})

export async function GET(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) {
    admin.headers.set('cache-control', 'no-store')
    return admin
  }
  const kind = new URL(request.url).searchParams.get('kind')
  if (kind !== 'voice' && kind !== 'quiz' && kind !== 'review') {
    return reply({ ok: false, error: '올바른 큐 종류를 선택해 주세요.' }, 400)
  }
  try {
    const client = await createClient()
    const data = kind === 'voice' ? await fetchCurationJobs(client)
      : kind === 'quiz' ? await fetchQuizJobs(client) : await fetchReviewJobs(client)
    return reply({ ok: true, data })
  } catch {
    return reply({ ok: false, error: '큐 상태를 불러오지 못했습니다.' }, 503)
  }
}
