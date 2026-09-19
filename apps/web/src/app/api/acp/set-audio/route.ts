// apps/web/src/app/api/acp/set-audio/route.ts
// ACP v1.1 — 글 보이스 연결/해제 (audio_url set/clear)
//
// POST /api/acp/set-audio
// body: { article_id: string; audio_url?: string | null }   // null/빈문자 = 연결 해제
//
// 책 큐레이션의 LibriVox 매핑(save-librivox-audio)에 대응하는 글 버전.
// 글은 단일 섹션이라 챕터 매핑이 없고, 소스(VOA 등)가 제공하는 단일 오디오 URL 1개를
// 큐레이터가 검증/교체/해제한다. service-role 로 UPDATE (dev-bypass 세션 무관 동작).

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SetAudioBody {
  article_id: string
  audio_url?: string | null
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 500 },
    )
  }

  let body: SetAudioBody
  try {
    body = (await request.json()) as SetAudioBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.article_id) {
    return NextResponse.json({ error: 'article_id required' }, { status: 400 })
  }

  // 정규화: 빈 문자열/공백 → null (해제). 값이 있으면 http(s) URL 검증.
  const raw = (body.audio_url ?? '').trim()
  let nextUrl: string | null = null
  if (raw.length > 0) {
    try {
      const u = new URL(raw)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        return NextResponse.json({ error: 'audio_url must be http(s)' }, { status: 400 })
      }
      nextUrl = raw
    } catch {
      return NextResponse.json({ error: 'audio_url is not a valid URL' }, { status: 400 })
    }
  }

  const client = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error } = await client
    .from('library_articles')
    .update({ audio_url: nextUrl })
    .eq('id', body.article_id)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, article_id: body.article_id, audio_url: nextUrl })
}
