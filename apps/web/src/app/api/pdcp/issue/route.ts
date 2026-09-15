// apps/web/src/app/api/pdcp/issue/route.ts
//
// 호 단위 수동 조작 — 삭제 / 단계 되돌리기.
//
// 왜 필요한가:
//   대량 적재는 잘못 담기 마련이고(검색 결과에 만화가 아닌 자료가 섞인다),
//   빼낼 수단이 없으면 큐가 영구히 오염된다. 되돌리기는 파라미터를 바꿔
//   같은 호를 복원부터 다시 돌릴 때 쓴다(취득물은 그대로 재사용).
//
// 발행된 호는 삭제하지 않는다 — 학습자에게 노출 중인 콘텐츠가 조용히 사라지면 안 된다.
// 먼저 보관(archived)으로 내린 뒤 삭제하도록 강제한다. 그 보관 경로는 발행 패널의
// POST /api/pdcp/publish { action:'archive' } 다 — 예전엔 이 안내만 있고 **길이 없었다**.

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { PD_STATUS_KEYS, pdActionAllowed } from '@/lib/pd-comic/model'
import { workDir } from '@/lib/pd-comic/pipeline-bridge'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const purge = searchParams.get('purge') === '1'
  if (!id) return NextResponse.json({ error: 'id 가 필요합니다' }, { status: 400 })

  const client = createAdminClient() as unknown as SupabaseClient
  const { data: row, error: readErr } = await client
    .from('pd_comic_issues')
    .select('id, slug, status')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: '해당 호가 없습니다' }, { status: 404 })

  const r = row as { id: string; slug: string; status: string }
  if (!pdActionAllowed('delete', r.status)) {
    return NextResponse.json(
      {
        error:
          '발행된 호는 삭제할 수 없습니다 — 발행 패널의 "발행 회수(보관)" 로 먼저 내린 뒤 삭제하세요',
      },
      { status: 409 },
    )
  }

  const { error } = await client.from('pd_comic_issues').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 작업 디렉터리는 기본 보존 — 재취득은 느리고 대역폭도 든다. purge=1 일 때만 지운다.
  let purged = false
  if (purge) {
    const dir = workDir(r.slug)
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      purged = true
    }
  }
  return NextResponse.json({ deleted: r.slug, purged })
}

/** 단계 되돌리기 — 취득물을 재사용해 복원부터 다시 돌릴 때. */
export async function PATCH(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  let body: { issueId?: string; status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const { issueId, status } = body
  if (!issueId || !status) {
    return NextResponse.json({ error: 'issueId 와 status 가 필요합니다' }, { status: 400 })
  }
  if (!PD_STATUS_KEYS.has(status)) {
    return NextResponse.json({ error: `알 수 없는 단계: ${status}` }, { status: 400 })
  }
  // 발행·보관은 이 경로로 하지 않는다 — PD 근거 게이트와 회수 절차를 우회하게 되므로
  // 발행 패널(POST /api/pdcp/publish)에서만. 여기는 **자동 단계 되돌리기 전용**이다.
  if (status === 'published' || status === 'archived') {
    return NextResponse.json(
      { error: '발행·보관 전이는 발행 패널에서만 가능합니다 (POST /api/pdcp/publish)' },
      { status: 400 },
    )
  }

  const client = createAdminClient() as unknown as SupabaseClient
  const { error } = await client
    .from('pd_comic_issues')
    .update({ status, last_error: null })
    .eq('id', issueId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ issueId, status })
}
