// apps/web/src/lib/topic-corpus/local-corpus.ts
//
// TCP 로컬 코퍼스 수확 — 이미 DB 에 있는 `library_articles` 에서 어휘 증거를 센다.
//
// ── 왜 이 경로가 생겼나 (2026-08-16) ──
// 원래 대상은 TED 였으나 실측 결과 목록·자막 페이지 모두 Node 에서 403 이었다
// (Cloudflare TLS 지문 차단 — 헤더로는 통과 못 한다). 차단 우회는 이 파이프라인의
// 범위가 아니므로, **가져올 필요조차 없는** 개방 라이선스 코퍼스로 방향을 돌렸다.
//
// `library_articles` 는 ACP 가 이미 채워 둔 자산이다(실측 161편 · 약 204,000 어절):
// PD-Government(nasa · voa · usgs · noaa · factbook) · CC-BY-4.0(owid · plos · elife) ·
// CC-BY-SA-4.0(wikipedia 계열). 네트워크도, 차단도, 라이선스 위험도 없다.
//
// ── 이 경로에서도 원문은 남기지 않는다 ──
// 본문은 이미 `library_articles.content` 에 (합법적으로) 있지만, TCP 쪽 원장인
// `topic_corpus_docs` 에는 여전히 카운트만 들어간다. 두 파이프라인의 책임을 섞지 않기
// 위함이다 — TCP 는 "어휘 관측" 이지 "본문 보관" 이 아니다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { tokenizeText } from '@/lib/text-extract/tokenize'

import { stripBoilerplate } from './boilerplate'
import { contentHash } from './harvest'

/** 로컬 수확 1편의 결과 — 본문 필드 없음 (harvest.ts 와 같은 계약) */
export interface LocalHarvestResult {
  ok: true
  sourceId: string
  externalId: string
  title: string | null
  alreadyIngested: boolean
  runningWords: number
  uniqueWords: number
  resolvedWords: number
  gapWords: number
  /** 상한 초과로 잘린 unique 수. 장문 위키 문서에서 0 이 아닐 수 있다 — 숨기지 않는다. */
  truncated: number
}

export interface LocalHarvestFailure {
  ok: false
  sourceId: string
  externalId: string
  reason: string
}

/** `library_articles` 한 행에서 필요한 것만 */
export interface LocalArticle {
  id: string
  title: string | null
  source_url: string | null
  published_at: string | null
  content: string | null
}

interface IngestPayload {
  doc_id: string
  already_ingested: boolean
  unique_words: number
  resolved_words: number
  gap_words: number
}

/** 본문이 이보다 짧으면 통계 가치가 없다 (harvest.ts 의 자막 하한과 같은 기준) */
const MIN_CHARS = 400

/**
 * 기사 1편 수확. 네트워크를 타지 않으므로 politeness 지연이 필요 없다.
 *
 * 표제어 해석은 여기서 하지 않는다 — `ingest_topic_corpus_doc` 안의
 * `resolve_dict_headword` 5계층이 담당한다. 클라이언트가 흉내 내면 사전이 자라는 순간
 * 통계와 사전이 어긋난다(TED 경로와 같은 이유).
 */
export async function harvestLocalArticle(
  supabase: SupabaseClient,
  sourceId: string,
  article: LocalArticle,
  /**
   * 이 출처에서 검출된 상용구 줄 (`detectBoilerplateLines`). 넘기지 않으면 제거하지 않는다.
   * 제거는 **토큰화 직전**에만 일어나고 `library_articles.content` 는 건드리지 않는다 —
   * 원본은 ACP 의 자산이지 TCP 가 고칠 대상이 아니다.
   */
  boilerplate?: Set<string>,
): Promise<LocalHarvestResult | LocalHarvestFailure> {
  const raw = article.content ?? ''
  const text = boilerplate && boilerplate.size > 0 ? stripBoilerplate(raw, boilerplate) : raw
  if (text.trim().length < MIN_CHARS) {
    return {
      ok: false,
      sourceId,
      externalId: article.id,
      reason: `본문이 너무 짧음 (${text.trim().length}자 < ${MIN_CHARS})`,
    }
  }

  const tokens = tokenizeText(text)
  if (tokens.uniqueFinal === 0) {
    return { ok: false, sourceId, externalId: article.id, reason: '토큰 0개' }
  }

  const { data, error } = await supabase.rpc('ingest_topic_corpus_doc', {
    p_source_id: sourceId,
    p_external_id: article.id,
    p_url: article.source_url ?? `library_article:${article.id}`,
    p_content_hash: contentHash(text),
    p_counts: tokens.counts,
    p_running_words: tokens.totalWords,
    p_truncated: tokens.diagnostics.truncated,
    p_title: article.title,
    p_speaker: null,
    p_published_at: article.published_at,
  })

  if (error) {
    return {
      ok: false,
      sourceId,
      externalId: article.id,
      reason: `ingest RPC 실패: ${error.message}`,
    }
  }

  const payload = data as IngestPayload

  return {
    ok: true,
    sourceId,
    externalId: article.id,
    title: article.title,
    alreadyIngested: payload.already_ingested,
    runningWords: tokens.totalWords,
    uniqueWords: payload.unique_words,
    resolvedWords: payload.resolved_words,
    gapWords: payload.gap_words,
    truncated: tokens.diagnostics.truncated,
  }
}
