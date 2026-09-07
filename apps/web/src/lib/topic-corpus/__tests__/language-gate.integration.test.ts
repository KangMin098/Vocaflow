// apps/web/src/lib/topic-corpus/__tests__/language-gate.integration.test.ts
//
// 회귀 고정: **비영어 문서는 적재되기 전에 거부된다.**
//
// 2026-08-25 실측 — `pending_words` 11,081행 중 학습자가 만든 것은 39개뿐이고, 큐를 채운
// 베트남어·스페인어·프랑스어의 출처는 1,935편 중 **4행**이었다(자막이 통째로 비영어인 TED talk).
// 그때까지 유일한 언어 가드는 `harvest.ts` 의 "토큰 0개면 거부" 하나뿐이라, 자막이 다른 언어여도
// 토큰이 하나만 살아 있으면 통과했다.
//
// 게이트는 **사전 해석률**로 판정한다 — 사전이 곧 언어 판별기다.
// 임계 0.30 의 근거: unique_words>=100 인 1,889편의 실제 gap 비율 평균 2.4% · 정상 최대 12.3% ·
// 비영어 4행 61.8~92.1%. 0.25/0.30/0.40 어디로 잡아도 걸리는 문서는 똑같이 그 4행뿐이다.
//
// 이 테스트는 **부작용이 없다** — 거부 경로는 아무것도 쓰지 않는 것이 계약이고,
// 그 "쓰지 않았음" 자체를 아래에서 단언한다.
// 환경변수(SERVICE_ROLE_KEY) 없으면 skip — CI 정상.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

/** 사전에 절대 없는 토큰 — 비영어 자막을 흉내 낸다. 실제 낱말을 쓰면 해석돼 게이트가 안 걸린다. */
const NONSENSE_PREFIX = 'zzqgate'
const EXTERNAL_ID = '__language_gate_regression__'

interface IngestResult {
  doc_id: string | null
  already_ingested: boolean
  rejected?: boolean
  reason?: string
  gap_ratio?: number
  unique_words: number
  resolved_words: number
  gap_words: number
}

function nonsenseCounts(n: number): Record<string, number> {
  const counts: Record<string, number> = {}
  for (let i = 0; i < n; i += 1) counts[`${NONSENSE_PREFIX}${i}xk`] = 3
  return counts
}

describe.skipIf(skipIfNoEnv)('주제 코퍼스 언어 게이트 (실 DB)', () => {
  let db: SupabaseClient
  let sourceId: string

  beforeAll(async () => {
    db = createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
      auth: { persistSession: false },
    })
    const { data, error } = await db.from('topic_corpus_sources').select('id').limit(1)
    if (error) throw new Error(`source 조회 실패: ${error.message}`)
    const rows = (data ?? []) as Array<{ id: string }>
    if (rows.length === 0) throw new Error('topic_corpus_sources 가 비어 있다')
    sourceId = rows[0]!.id
  })

  async function ingest(counts: Record<string, number>): Promise<IngestResult> {
    const { data, error } = await db.rpc('ingest_topic_corpus_doc', {
      p_source_id: sourceId,
      p_external_id: EXTERNAL_ID,
      p_url: 'https://example.invalid/language-gate-regression',
      p_content_hash: 'language-gate-regression',
      p_counts: counts,
      p_running_words: 400,
      p_truncated: 0,
      p_title: 'language gate regression',
      p_speaker: null,
      p_published_at: null,
      p_proper_nouns: [],
    })
    if (error) throw new Error(`ingest RPC 실패: ${error.message}`)
    return data as IngestResult
  }

  it('해석률이 낮은 문서를 rejected 로 돌려준다', async () => {
    const result = await ingest(nonsenseCounts(120))
    expect(result.rejected, '비영어 문서가 통과했다').toBe(true)
    expect(result.reason).toBe('non_english_doc')
    expect(result.doc_id).toBeNull()
    expect(result.gap_ratio ?? 0).toBeGreaterThan(0.3)
  })

  it('거부된 문서는 **아무것도** 쓰지 않는다 — 이것이 게이트의 계약이다', async () => {
    await ingest(nonsenseCounts(120))

    const [{ count: docs }, { count: pending }, { count: stats }] = await Promise.all([
      db
        .from('topic_corpus_docs')
        .select('*', { count: 'exact', head: true })
        .eq('external_id', EXTERNAL_ID),
      db
        .from('pending_words')
        .select('*', { count: 'exact', head: true })
        .like('lemma', `${NONSENSE_PREFIX}%`),
      db
        .from('topic_word_stats')
        .select('*', { count: 'exact', head: true })
        .like('word', `${NONSENSE_PREFIX}%`),
    ])

    expect(docs ?? 0, 'topic_corpus_docs 에 행이 생겼다').toBe(0)
    expect(pending ?? 0, 'pending_words 가 오염됐다').toBe(0)
    expect(stats ?? 0, 'topic_word_stats 가 오염됐다').toBe(0)
  })

  // ⚠️ 하한(unique_words >= 100) 아래에서 게이트가 안 걸리는 것은 **여기서 시험하지 않는다.**
  //   통과 경로는 정의상 문서·통계·pending 행을 실제로 쓰기 때문에, 시험하려면 운영 테이블에
  //   쓰레기를 넣었다가 지워야 한다. 하한의 근거(NASA 이미지 캡션 unique 40~56 이 정상인데도
  //   gap 24.5%)는 마이그레이션 주석에 실측으로 남겼고, 통과 경로 자체는 기존 적재가 매일 검증한다.
})
