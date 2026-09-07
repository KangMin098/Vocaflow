// apps/web/src/app/api/topic-corpus/drain/route.ts
//
// TCP 드레인 — 큐에서 N편을 claim 해 수확하고, 카운트만 적재한다.
//
// ⚠️ **본체는 여기 없다.** 2026-08-26 에 `lib/topic-corpus/drain.ts` 로 옮겼다 —
//    같은 로직을 헤드리스 워커(`scripts/topic-corpus/drain-loop.mts`)도 써야 하는데,
//    라우트 안에 두면 큐를 비우는 데 **브라우저 탭이 필요**했다(실측 당시 대기 85,179건).
//    이 파일이 하는 일은 인증 · 본문 파싱 · 응답 변환뿐이다.
//
// ── 재실행 안전 ──
// claim 은 `FOR UPDATE SKIP LOCKED` 라 동시 호출해도 같은 문서를 두 번 잡지 않고,
// `ingest_topic_corpus_doc` 은 이미 수확한 (source, external_id) 를 통계에 다시 더하지 않는다.
// 그러므로 이 endpoint 는 **몇 번을 눌러도 안전하다** — 중단됐던 지점부터 이어서 마른다.

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createTopicCorpusClient } from '@/lib/topic-corpus/client'
import { drainTopicCorpusBatch } from '@/lib/topic-corpus/drain'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface DrainBody {
  /** 특정 주제만 드레인. 생략하면 전 주제에서 오래된 것부터 */
  sourceId?: string
  /** 한 번 호출에 처리할 최대 편수 (default 5, max 10) */
  max?: number
}

export async function POST(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  let body: DrainBody = {}
  try {
    body = (await request.json()) as DrainBody
  } catch {
    // 본문 없이 호출해도 기본값으로 동작한다.
  }

  const supabase = createTopicCorpusClient()
  const out = await drainTopicCorpusBatch(supabase, { sourceId: body.sourceId ?? null, max: body.max })

  if (out.error) {
    return NextResponse.json({ error: 'claim_failed', message: out.error }, { status: 500 })
  }

  return NextResponse.json({
    claimed: out.claimed,
    harvested: out.harvested,
    skipped: out.skipped,
    failed: out.failed,
    drained: out.drained,
    results: out.results,
  })
}
