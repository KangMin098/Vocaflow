// apps/web/src/app/api/lcp/dev-drain-queue/route.ts
//
// Dev-only batch drainer — pgmq library_pipeline 큐의 메시지를 한 번에 N개 처리.
//
// 배경 (v06.34): get_lcp_config() 가 dev 환경에선 비어 있어 cron worker 가
//   pgmq 메시지를 read 하지 않음. 대신 admin 이 이 endpoint 를 호출하면
//   status='queued' 인 도서들을 찾아 /api/lcp/dev-process 로 순차 실행한다.
//   dev-process 자체가 archive_book_pipeline_messages 로 큐 정리도 함.
//
// NODE_ENV=production 차단 (배포 환경은 cron 정상 경로 사용).

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface DrainBody {
  /** 한 번 호출에 처리할 최대 도서 수 (default 5, max 20) */
  max?: number
}

interface DrainItemResult {
  book_id: string
  ok: boolean
  cefr_level?: string | null
  vocab_count?: number
  error?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'dev-drain-queue disabled in production — use pg_cron worker' },
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

  // status='queued' 인 도서 N권 (오래된 순)
  const { data: rows, error: pickErr } = await client
    .from('library_books')
    .select('id, title')
    .eq('status', 'queued')
    .order('updated_at', { ascending: true })
    .limit(max)

  if (pickErr) {
    return NextResponse.json(
      { error: `Pick queued books failed: ${pickErr.message}` },
      { status: 500 },
    )
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
      message: '큐가 비어 있습니다 (status=queued 도서 없음).',
    })
  }

  // self origin — dev-process 를 같은 호스트로 호출
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`
  const cookie = h.get('cookie') ?? ''

  const results: DrainItemResult[] = []
  for (const b of queued) {
    try {
      const res = await fetch(`${baseUrl}/api/lcp/dev-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie,
        },
        body: JSON.stringify({ book_id: b.id }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        cefr_level?: string | null
        vocab_count?: number
      }
      if (res.ok && data?.ok) {
        results.push({
          book_id: b.id,
          ok: true,
          cefr_level: data.cefr_level ?? null,
          vocab_count: data.vocab_count ?? 0,
        })
      } else {
        results.push({
          book_id: b.id,
          ok: false,
          error: data?.error ?? `HTTP ${res.status}`,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      results.push({ book_id: b.id, ok: false, error: msg })
    }
  }

  // 남은 queued 카운트 (다음 호출 안내용)
  const { count: remainingCount } = await client
    .from('library_books')
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
