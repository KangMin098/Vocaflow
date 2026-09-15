// apps/web/src/app/api/topic-corpus/enqueue/route.ts
//
// TCP 큐 적재 — 주제별 강연 URL 을 수확 대기열에 넣는다. 본문은 여기서 건드리지 않는다.
//
// 두 경로:
//   ① discover — TED 주제 페이지가 노출하는 목록을 자동 수집
//   ② urls     — 운영자가 URL 목록을 직접 제공 (전량 수집용)
//
// ── 커버리지를 숨기지 않는다 ──
// ① 은 주제 페이지가 내주는 만큼만 가져온다(실측 16편). TED 가 밝힌 총 편수와 다르면
// 응답의 `coverage_gap` 에 그대로 실어 보낸다 — 화면이 "343편 중 16편" 으로 표시하게 하기
// 위함이다. 여기서 숫자를 감추면 운영자는 다 모았다고 믿고 드레인을 멈춘다.

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createTopicCorpusClient } from '@/lib/topic-corpus/client'
import {
  discoverTedTopic,
  talkUrlFromSlug,
  TedDiscoverError,
  type DiscoveredTalk,
} from '@/lib/topic-corpus/ted-discover'
import { tedSlugFromUrl } from '@/lib/topic-corpus/ted-transcript'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

interface EnqueueBody {
  /** 필수 — topic_corpus_sources.id (예: 'ted:ai') */
  sourceId: string
  /** 주제 페이지 자동 수집 여부 (default true) */
  discover?: boolean
  /** 직접 제공하는 강연 URL 또는 slug 목록 */
  urls?: string[]
}

const MAX_URLS = 2000

export async function POST(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  let body: EnqueueBody
  try {
    body = (await request.json()) as EnqueueBody
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  if (!body?.sourceId) {
    return NextResponse.json({ error: 'bad_request', message: 'sourceId 가 필요합니다.' }, { status: 400 })
  }

  const supabase = createTopicCorpusClient()

  const { data: source, error: srcError } = await supabase
    .from('topic_corpus_sources')
    .select('id, provider, topic_key, label_ko, is_active')
    .eq('id', body.sourceId)
    .maybeSingle()

  if (srcError) {
    return NextResponse.json({ error: 'source_lookup_failed', message: srcError.message }, { status: 500 })
  }
  if (!source) {
    return NextResponse.json(
      { error: 'unknown_source', message: `등록되지 않은 소스입니다: ${body.sourceId}` },
      { status: 404 },
    )
  }
  if (source.provider !== 'ted') {
    return NextResponse.json(
      { error: 'unsupported_provider', message: `아직 지원하지 않는 provider: ${source.provider}` },
      { status: 400 },
    )
  }

  const collected = new Map<string, DiscoveredTalk>()
  let totalCount: number | null = null
  let coverageGap: number | null = null
  let discoverError: string | null = null

  // ── ② 운영자 제공 목록 ──
  for (const raw of (body.urls ?? []).slice(0, MAX_URLS)) {
    const value = String(raw ?? '').trim()
    if (!value) continue
    const slug = value.startsWith('http') ? tedSlugFromUrl(value) : value.replace(/^\/+|\/+$/g, '')
    if (!slug) continue
    collected.set(slug, {
      externalId: slug,
      url: value.startsWith('http') ? value.split('?')[0]! : talkUrlFromSlug(slug),
      title: null,
    })
  }

  // ── ① 주제 페이지 자동 수집 ──
  if (body.discover !== false) {
    try {
      const found = await discoverTedTopic(source.topic_key)
      totalCount = found.totalCount
      coverageGap = found.coverageGap
      for (const talk of found.talks) {
        // 운영자가 준 항목을 덮어쓰지 않는다 (제목이 더 정확할 수 있다).
        if (!collected.has(talk.externalId)) collected.set(talk.externalId, talk)
      }
    } catch (err) {
      // 자동 수집 실패가 운영자 제공 목록까지 버리게 두지 않는다.
      discoverError = err instanceof TedDiscoverError ? err.message : String(err)
      if (collected.size === 0) {
        return NextResponse.json(
          { error: 'discover_failed', message: discoverError },
          { status: 502 },
        )
      }
    }
  }

  const docs = [...collected.values()].map((t) => ({
    external_id: t.externalId,
    url: t.url,
    title: t.title,
  }))

  if (docs.length === 0) {
    return NextResponse.json(
      { error: 'nothing_to_enqueue', message: '적재할 강연이 없습니다.', discover_error: discoverError },
      { status: 400 },
    )
  }

  const { data: inserted, error: enqError } = await supabase.rpc('enqueue_topic_corpus_docs', {
    p_source_id: source.id,
    p_docs: docs,
  })

  if (enqError) {
    return NextResponse.json({ error: 'enqueue_failed', message: enqError.message }, { status: 500 })
  }

  return NextResponse.json({
    source_id: source.id,
    label_ko: source.label_ko,
    candidates: docs.length,
    // 이미 큐에 있던 것은 세지 않는다 — 재실행 시 0 이 정상이다.
    newly_queued: inserted ?? 0,
    ted_total_count: totalCount,
    // 0 이 아니면 이 주제는 아직 전량이 아니다. 화면이 이 숫자를 그대로 보여준다.
    coverage_gap: coverageGap,
    discover_error: discoverError,
  })
}
