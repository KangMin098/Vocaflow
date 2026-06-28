// apps/web/src/app/api/acp/dev-drain-queue/route.ts
//
// ACP dev-only 일괄 처리 — status='queued' 글들을 N개씩 /api/acp/dev-process 로 순차 실행.
// LCP /api/lcp/dev-drain-queue 미러 (글=단일 섹션). MyLibraryTab 의 "Dev 일괄/큐 처리" 와 동형.
//
// NODE_ENV=production 차단 (배포 환경은 별도 워커 경로).

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface DrainBody {
  /** 한 호출에 처리할 최대 글 수 (default 5, max 20) */
  max?: number
}

interface DrainItemResult {
  article_id: string
  ok: boolean
  cefr_level?: string | null
  vocab_count?: number
  error?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'dev-drain-queue disabled in production' },
      { status: 403 },
    )
  }

  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 500 },
    )
  }

  let body: DrainBody
  try {
    body = (await request.json()) as DrainBody
  } catch {
    body = {}
  }
  const max = Math.min(Math.max(1, body.max ?? 5), 20)

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // status='queued' 글 N개 (오래된 순)
  const { data: rows, error: pickErr } = await client
    .from('library_articles')
    .select('id, title')
    .eq('status', 'queued')
    .order('updated_at', { ascending: true })
    .limit(max)

  if (pickErr) {
    return NextResponse.json({ error: `Pick queued articles failed: ${pickErr.message}` }, { status: 500 })
  }
  const queued = (rows ?? []) as Array<{ id: string; title: string }>

  if (queued.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
      results: [],
      message: '큐가 비어 있습니다 (status=queued 글 없음).',
    })
  }

  // self origin — dev-process 를 같은 호스트로 호출 (쿠키 전달)
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`
  const cookie = h.get('cookie') ?? ''

  const results: DrainItemResult[] = []
  for (const a of queued) {
    try {
      const res = await fetch(`${baseUrl}/api/acp/dev-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ article_id: a.id }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        cefr_level?: string | null
        vocab_count?: number
      }
      if (res.ok && data?.ok) {
        results.push({
          article_id: a.id,
          ok: true,
          cefr_level: data.cefr_level ?? null,
          vocab_count: data.vocab_count ?? 0,
        })
      } else {
        results.push({ article_id: a.id, ok: false, error: data?.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      results.push({ article_id: a.id, ok: false, error: e instanceof Error ? e.message : 'unknown' })
    }
  }

  // 남은 queued 카운트 (다음 호출 안내)
  const { count: remainingCount } = await client
    .from('library_articles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')

  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    remaining: remainingCount ?? 0,
    results,
  })
}
