// apps/web/src/app/api/topic-corpus/promote/route.ts
//
// TCP 승격 — 관측된 주제 어휘를 `dictionary_word_categories` 로 올린다.
//
// ── 기본이 dry-run 인 이유 ──
// 승격은 사전의 주제 분류를 바꾸는 쓰기다. 임계값을 잘못 잡으면 수백 개 단어가 엉뚱한
// 카테고리에 붙고, 그건 학습자가 보는 단어장 구성까지 흘러간다. 그래서 `apply=true` 를
// 명시하지 않으면 **몇 개가 대상인지만** 세고 아무것도 쓰지 않는다.
//
// 되돌리기: 이 경로로 붙은 링크는 `source='corpus-derived'` 이므로 출처로 골라 지울 수 있다.
// 기존 'imported' 링크는 어떤 경우에도 건드리지 않는다 (RPC 안에서 제외).

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createTopicCorpusClient } from '@/lib/topic-corpus/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PromoteBody {
  sourceId: string
  /** 서로 다른 글 몇 편 이상에서 나와야 하는가 (default 3) */
  minDocFreq?: number
  /** 배경 대비 로그오즈비 하한 (default 1.0 ≈ 2.7배 과대표집) */
  minSalience?: number
  /** 한 번에 승격할 최대 단어 수 (default 500) */
  maxWords?: number
  /** true 여야 실제로 쓴다. 생략하면 dry-run */
  apply?: boolean
}

export async function POST(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  let body: PromoteBody
  try {
    body = (await request.json()) as PromoteBody
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  if (!body?.sourceId) {
    return NextResponse.json({ error: 'bad_request', message: 'sourceId 가 필요합니다.' }, { status: 400 })
  }

  const supabase = createTopicCorpusClient()

  const { data, error } = await supabase.rpc('apply_topic_categories', {
    p_source_id: body.sourceId,
    p_min_doc_freq: body.minDocFreq ?? 3,
    p_min_salience: body.minSalience ?? 1.0,
    p_max_words: body.maxWords ?? 500,
    p_dry_run: body.apply !== true,
  })

  if (error) {
    return NextResponse.json({ error: 'promote_failed', message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
