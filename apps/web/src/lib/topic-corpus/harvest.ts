// apps/web/src/lib/topic-corpus/harvest.ts
//
// TCP 수확 1편 — 가져오기 → 토큰화 → **카운트만 적재** → 원문 폐기.
//
// ── 이 파일이 지키는 계약 ──
// 원문(`TedTranscript.text`)이 함수 밖으로 나가지 않는다. `harvestTedTalk` 의 반환 타입에는
// 본문 필드가 없고, DB 로 가는 것은 `ingest_topic_corpus_doc(p_counts)` 의 숫자뿐이다.
// 라이선스(CC BY-NC-ND) 상 원문 보관이 불가하므로, 이건 취향이 아니라 **제약**이다.
// 회귀 잠금: `__tests__/topic-corpus-no-text.test.ts`.
//
// ── 표제어 해석을 클라이언트에서 하지 않는 이유 ──
// `resolve_dict_headword` 는 사전 상태(등재 굴절형·파생·영미 철자)에 의존하는 5계층 함수다.
// 여기서 흉내 내면 사전이 자라는 순간 통계와 사전이 어긋난다. 그래서 **표면형 카운트를 그대로**
// 넘기고 접기는 서버가 한다 — 같은 이유로 학습자 추출도 서버가 해석한다.

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import { tokenizeText } from '@/lib/text-extract/tokenize'

import { fetchTedTranscript, TedTranscriptError } from './ted-transcript'

/** 수확 1편의 결과 — **본문 필드가 없다** (위 계약 참조) */
export interface HarvestResult {
  ok: true
  sourceId: string
  externalId: string
  url: string
  title: string | null
  alreadyIngested: boolean
  runningWords: number
  uniqueWords: number
  /** 표제어 해석 성공 — 주제 통계로 들어간 수 */
  resolvedWords: number
  /** 해석 실패 = 사전 갭. pending_words 로 적재됐다 */
  gapWords: number
  truncated: number
  /** TED 자체 주제 태그 — 수확 주제가 맞는지 교차 확인용 */
  tedTopics: string[]
}

export interface HarvestFailure {
  ok: false
  sourceId: string
  externalId: string
  url: string
  reason: string
  /** 재시도해도 같은 결과인가 — true 면 큐를 skipped 로 닫는다 */
  permanent: boolean
}

/** 정규화 본문의 sha256 — 원문 없이 중복 수확을 판정하는 유일한 흔적 */
export function contentHash(text: string): string {
  return createHash('sha256').update(text.normalize('NFKC').toLowerCase()).digest('hex')
}

interface IngestPayload {
  doc_id: string
  already_ingested: boolean
  unique_words: number
  resolved_words: number
  gap_words: number
}

/**
 * TED 강연 1편 수확.
 *
 * 실패는 두 갈래로 나뉜다:
 *   · `permanent` — 자막이 없거나 너무 짧다. 재시도해도 같으므로 큐를 **skipped** 로 닫는다.
 *   · 일시적    — HTTP/네트워크. 큐를 **pending** 으로 돌려 다음 드레인이 다시 잡는다.
 * 이 구분이 없으면 자막 없는 강연이 큐에 영원히 남아 드레인이 끝나지 않는다.
 */
export async function harvestTedTalk(
  supabase: SupabaseClient,
  sourceId: string,
  talkUrl: string,
  signal?: AbortSignal,
): Promise<HarvestResult | HarvestFailure> {
  let externalId = talkUrl

  try {
    const transcript = await fetchTedTranscript(talkUrl, signal)
    externalId = transcript.externalId

    // ── 원문이 살아 있는 유일한 구간 ──
    const tokens = tokenizeText(transcript.text)
    const hash = contentHash(transcript.text)
    const tedTopics = transcript.tedTopics
    const meta = {
      title: transcript.title,
      speaker: transcript.speaker,
      publishedAt: transcript.publishedAt,
    }
    // 여기서부터 transcript.text 는 쓰지 않는다. 남는 것은 tokens.counts 와 hash 뿐이다.

    if (tokens.uniqueFinal === 0) {
      return {
        ok: false,
        sourceId,
        externalId,
        url: talkUrl,
        reason: '토큰 0개 — 자막이 영어가 아닐 가능성',
        permanent: true,
      }
    }

    const { data, error } = await supabase.rpc('ingest_topic_corpus_doc', {
      p_source_id: sourceId,
      p_external_id: externalId,
      p_url: transcript.url,
      p_content_hash: hash,
      p_counts: tokens.counts,
      p_running_words: tokens.totalWords,
      p_truncated: tokens.diagnostics.truncated,
      p_title: meta.title,
      p_speaker: meta.speaker,
      p_published_at: meta.publishedAt,
    })

    if (error) {
      return {
        ok: false,
        sourceId,
        externalId,
        url: talkUrl,
        reason: `ingest RPC 실패: ${error.message}`,
        permanent: false,
      }
    }

    const payload = data as IngestPayload

    return {
      ok: true,
      sourceId,
      externalId,
      url: transcript.url,
      title: meta.title,
      alreadyIngested: payload.already_ingested,
      runningWords: tokens.totalWords,
      uniqueWords: payload.unique_words,
      resolvedWords: payload.resolved_words,
      gapWords: payload.gap_words,
      truncated: tokens.diagnostics.truncated,
      tedTopics,
    }
  } catch (err) {
    if (err instanceof TedTranscriptError) {
      return {
        ok: false,
        sourceId,
        externalId,
        url: talkUrl,
        reason: err.message,
        // 구조 변경(no-next-data)은 재시도 가치가 있다 — 일시적 A/B 렌더일 수 있다.
        // 반면 'blocked'(403 봇 차단)는 재시도로 풀리지 않는다. 3회씩 다시 때리는 것은
        // 차단한 사이트에 부담만 주므로 즉시 닫는다.
        permanent:
          err.reason === 'no-transcript' ||
          err.reason === 'too-short' ||
          err.reason === 'blocked',
      }
    }
    return {
      ok: false,
      sourceId,
      externalId,
      url: talkUrl,
      reason: err instanceof Error ? err.message : String(err),
      permanent: false,
    }
  }
}
