// scripts/vcb/03-extract.ts
// VCB Method A — Step 3 Extract: vocab_raw_texts 내용을 WLP 로 처리해
// (lemma, pos) 페어 단위로 vocab_seed_candidates 에 적재.
//
// 사용:
//   pnpm vcb:extract --run-id <id>
//   pnpm vcb:extract --run-id <id> --raw-text-content "<text>"  (테스트용)
//
// CLAUDE.md §19.4 Step 3 정합.
//
// 주: P1 단계에서 vocab_raw_texts 는 content 자체를 저장하지 않고 SHA-256 hash 만 보관.
// 따라서 실제 텍스트는 다음 중 하나로 확보:
//   1. --raw-text-content 플래그로 직접 전달 (테스트/CI)
//   2. Storage 에서 external_ref 로 다시 다운로드 (운영)
//
// P2 는 (1) 만 구현. (2) Storage 재다운로드는 P3 어드민 UI 가 호출 시 처리.

import {
  createDropStats,
  createLogger,
  getSupabaseAdmin,
  IngestError,
  mapWlpPos,
  recordDrop,
  type Pos,
  type PosDropStats,
} from '@vocaflow/vcb-core'
import { processText, type WlpToken } from '@vocaflow/wlp'
import fs from 'node:fs'
import { parseArgs } from 'node:util'

const log = createLogger({ script: '03-extract' })

interface ExtractOptions {
  runId: number
  rawTextContent?: string
  rawTextFile?: string
}

interface SeedAccumulator {
  count: number
  contextSamples: string[]
  firstSeenOffset: number
}

const MAX_CONTEXT_SAMPLES = 3
const MAX_CONTEXT_LENGTH = 200

async function fetchRawTextCount(runId: number): Promise<number> {
  const sb = getSupabaseAdmin()
  const { count, error } = await sb
    .from('vocab_raw_texts')
    .select('*', { count: 'exact', head: true })
    .eq('run_id', runId)

  if (error) {
    throw new IngestError('fetch raw_text count failed', {
      run_id: runId,
      error: error.message,
    })
  }
  return count ?? 0
}

async function updateRunStatus(runId: number, status: string): Promise<void> {
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('vocab_runs').update({ status }).eq('id', runId)

  if (error) {
    throw new IngestError('run status update failed', {
      run_id: runId,
      error: error.message,
    })
  }
}

/**
 * 토큰 1개의 컨텍스트 발췌 (charStart 주변).
 * 문장 경계 안에서 가능한 한 자연스럽게 자름.
 */
function extractContext(fullText: string, charStart: number, charEnd: number): string {
  const halfWindow = Math.floor((MAX_CONTEXT_LENGTH - (charEnd - charStart)) / 2)
  const rawStart = Math.max(0, charStart - halfWindow)
  const rawEnd = Math.min(fullText.length, charEnd + halfWindow)

  // 단어 경계로 보정 — charAt 은 out-of-range 시 빈 string 반환 (strict mode 안전)
  let start = rawStart
  while (start > 0 && !/\s/.test(fullText.charAt(start - 1))) start -= 1
  let end = rawEnd
  while (end < fullText.length && !/\s/.test(fullText.charAt(end))) end += 1

  let snippet = fullText.slice(start, end).trim()
  if (snippet.length > MAX_CONTEXT_LENGTH) {
    snippet = snippet.slice(0, MAX_CONTEXT_LENGTH - 1) + '…'
  }
  return snippet
}

/**
 * WLP 결과를 (lemma, pos) 페어 단위로 집계.
 */
function aggregateTokens(
  text: string,
  tokens: WlpToken[],
  log_: ReturnType<typeof createLogger>
): {
  map: Map<string, { lemma: string; pos: Pos; data: SeedAccumulator }>
  dropStats: PosDropStats
} {
  const dropStats = createDropStats()
  const map = new Map<string, { lemma: string; pos: Pos; data: SeedAccumulator }>()

  for (const tok of tokens) {
    // lemma 정합성
    if (!tok.lemma || tok.lemma.length === 0) {
      recordDrop(dropStats, 'EMPTY_LEMMA')
      continue
    }

    // POS 매핑
    const vcbPos = mapWlpPos(tok.pos)
    if (vcbPos === null) {
      recordDrop(dropStats, tok.pos)
      continue
    }

    const key = `${tok.lemma}|${vcbPos}`
    const existing = map.get(key)

    if (existing) {
      existing.data.count += 1
      if (existing.data.contextSamples.length < MAX_CONTEXT_SAMPLES) {
        const snippet = extractContext(text, tok.charStart, tok.charEnd)
        if (snippet && !existing.data.contextSamples.includes(snippet)) {
          existing.data.contextSamples.push(snippet)
        }
      }
    } else {
      const snippet = extractContext(text, tok.charStart, tok.charEnd)
      map.set(key, {
        lemma: tok.lemma,
        pos: vcbPos,
        data: {
          count: 1,
          contextSamples: snippet ? [snippet] : [],
          firstSeenOffset: tok.charStart,
        },
      })
    }
  }

  if (dropStats.unknown_tags.length > 0) {
    log_.warn({ unknown_pos_tags: dropStats.unknown_tags }, 'unknown POS tags encountered')
  }

  return { map, dropStats }
}

/**
 * 집계된 candidates 를 DB 에 적재.
 */
async function persistCandidates(
  runId: number,
  aggregated: Map<string, { lemma: string; pos: Pos; data: SeedAccumulator }>
): Promise<{ inserted: number; skipped: number }> {
  const sb = getSupabaseAdmin()

  // 빈도 내림차순으로 rank_in_run 할당
  const entries = Array.from(aggregated.values()).sort((a, b) => {
    if (b.data.count !== a.data.count) return b.data.count - a.data.count
    return a.data.firstSeenOffset - b.data.firstSeenOffset
  })

  const rows = entries.map((e, idx) => ({
    run_id: runId,
    lemma: e.lemma,
    pos: e.pos,
    raw_count: e.data.count,
    normalized_freq: null,
    rank_in_run: idx + 1,
    context_samples: e.data.contextSamples,
    seed_origin: 'extracted' as const,
  }))

  if (rows.length === 0) {
    return { inserted: 0, skipped: 0 }
  }

  // ON CONFLICT (run_id, lemma, pos) — Method A 와 Method B 가 같은 run 에 섞이면
  // 기존 row 우선 (Method B 가 먼저 insert 된 경우 그 raw_count 유지).
  const { data, error } = await sb
    .from('vocab_seed_candidates')
    .upsert(rows, {
      onConflict: 'run_id,lemma,pos',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) {
    throw new IngestError('seed_candidates insert failed', {
      error: error.message,
    })
  }

  const inserted = data?.length ?? 0
  return {
    inserted,
    skipped: rows.length - inserted,
  }
}

async function run(opts: ExtractOptions): Promise<void> {
  const childLog = log.child({ run_id: opts.runId })
  childLog.info('extract started')

  // raw text 확보
  let text: string
  if (opts.rawTextContent !== undefined) {
    text = opts.rawTextContent
    childLog.info({ source: 'cli-arg', bytes: text.length }, 'using --raw-text-content')
  } else if (opts.rawTextFile) {
    if (!fs.existsSync(opts.rawTextFile)) {
      throw new IngestError('raw text file not found', { path: opts.rawTextFile })
    }
    text = fs.readFileSync(opts.rawTextFile, 'utf8')
    childLog.info(
      { source: 'file', path: opts.rawTextFile, bytes: text.length },
      'using --raw-text-file'
    )
  } else {
    // 운영 시: vocab_raw_texts 의 external_ref 로 Storage 재다운로드
    // P2 범위 외 — P3 어드민 UI 에서 호출 시 처리
    throw new IngestError(
      'P2 limitation: provide --raw-text-content or --raw-text-file. ' +
        'Storage re-download will be implemented in P3.',
      { run_id: opts.runId }
    )
  }

  if (text.trim().length === 0) {
    throw new IngestError('empty text', { run_id: opts.runId })
  }

  // raw_texts 가 등록되어 있는지 확인 (sanity)
  const rawCount = await fetchRawTextCount(opts.runId)
  if (rawCount === 0) {
    throw new IngestError('no raw_texts registered — run 01-ingest first', { run_id: opts.runId })
  }

  await updateRunStatus(opts.runId, 'extracted')

  // NFC 정규화 (CLAUDE.md §19.4 Step 2 정합 — WLP 호출 전)
  const nfcText = text.normalize('NFC')

  // WLP 처리
  childLog.info('calling WLP processText')
  const result = processText(nfcText, {
    excludeStopWords: true,
    excludePunctuation: true,
    minLemmaLength: 2,
  })

  childLog.info(
    {
      sentences: result.stats.sentenceCount,
      total_tokens: result.stats.totalTokens,
      content_tokens: result.stats.contentTokens,
      unique_lemmas: result.stats.uniqueCount,
    },
    'WLP completed'
  )

  // sentences[].tokens 평탄화 (uniqueLemmas 는 pos 정보 손실되어 사용 X)
  const allTokens: WlpToken[] = []
  for (const sentence of result.sentences) {
    for (const tok of sentence.tokens) {
      allTokens.push(tok)
    }
  }

  // 집계
  const { map: aggregated, dropStats } = aggregateTokens(nfcText, allTokens, childLog)

  childLog.info(
    {
      candidates: aggregated.size,
      dropped_total: dropStats.dropped_total,
      drop_by_tag: dropStats.by_tag,
    },
    'aggregation completed'
  )

  // DB 적재
  const { inserted, skipped } = await persistCandidates(opts.runId, aggregated)
  childLog.info({ inserted, skipped }, 'seed_candidates persisted')

  childLog.info('extract completed')
}

function parseCliArgs(): ExtractOptions {
  const { values } = parseArgs({
    options: {
      'run-id': { type: 'string' },
      'raw-text-content': { type: 'string' },
      'raw-text-file': { type: 'string' },
    },
  })

  if (!values['run-id']) {
    throw new IngestError('--run-id is required')
  }

  return {
    runId: parseInt(values['run-id'], 10),
    rawTextContent: values['raw-text-content'],
    rawTextFile: values['raw-text-file'],
  }
}

const opts = parseCliArgs()
run(opts).catch((err) => {
  log.error(
    {
      err:
        err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              code: (err as any).code,
              context: (err as any).context,
            }
          : err,
    },
    'extract failed'
  )
  process.exit(1)
})
