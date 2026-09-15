// apps/web/src/app/api/pdcp/oplog/route.ts
//
// 자기발전 타임라인 — 오퍼레이터 루프 로그(work/_oplog.jsonl)를 읽어 반환. "무엇을 시도 → 단계별 평가
// → 평가 기반 자기발전(개선/채택/반려/피벗)" 흐름을 모니터가 한눈에 렌더하도록. dev 전용 · admin.
//   GET [?issueId=<uuid>]  — issueId 있으면 그 콘텐츠(slug)만, 없으면 전체.

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Step = {
  seq: number; ts: string | null; slug: string; content: string; phase: string
  action: 'evaluate' | 'adopt' | 'reject' | 'improve' | 'pivot' | 'note'
  title: string; detail: string; verdict: string | null; next: string | null
}

// work/_oplog.jsonl 을 cwd 기준 후보 경로에서 찾는다(모노레포 cwd 가 apps/web 또는 루트일 수 있음).
function resolveOplog(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'work', '_oplog.jsonl'),
    path.resolve(process.cwd(), '..', '..', 'work', '_oplog.jsonl'),
    path.resolve(process.cwd(), '..', 'work', '_oplog.jsonl'),
  ]
  return candidates.find((p) => fs.existsSync(p)) ?? null
}

export async function GET(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'dev 전용' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const issueId = searchParams.get('issueId')

  let slug: string | null = null
  if (issueId) {
    const client = createAdminClient() as unknown as SupabaseClient
    const { data: row } = await client.from('pd_comic_issues').select('slug').eq('id', issueId).maybeSingle()
    slug = (row?.slug as string | undefined) ?? null
  }

  const file = resolveOplog()
  if (!file) return NextResponse.json({ steps: [], contents: [] })

  let steps: Step[] = []
  try {
    steps = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as Step } catch { return null } })
      .filter((s): s is Step => s !== null)
  } catch { /* noop */ }

  if (slug) steps = steps.filter((s) => s.slug === slug)

  // 콘텐츠별 요약(한눈 집계): 최신 상태 + 스텝 수 + 마지막 next.
  const byContent = new Map<string, { slug: string; content: string; total: number; lastAction: string; lastVerdict: string | null; next: string | null }>()
  for (const s of steps) {
    const cur = byContent.get(s.slug) ?? { slug: s.slug, content: s.content, total: 0, lastAction: s.action, lastVerdict: s.verdict, next: s.next }
    cur.total += 1; cur.lastAction = s.action; cur.lastVerdict = s.verdict; cur.next = s.next; cur.content = s.content
    byContent.set(s.slug, cur)
  }

  return NextResponse.json({ steps, contents: [...byContent.values()] })
}
