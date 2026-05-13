// scripts/vcb/04-dict-lookup.ts
// VCB Step 4 Dictionary Lookup: vocab_seed_candidates 의 (lemma, pos) 를
// 내부 사전에서 찾아 vocab_dict_hits + vocab_enrichment_queue 생성.
//
// 매칭 순서 (CLAUDE.md §19.4 Step 4):
//   1. word_lexicon (lexicon-v2.1) — 현재 비활성 (LexiconLookupDisabled)
//   2. shared_dictionary (21,740 단어) — 활성
//   3. NGSL/오픈 사전 시드 — shared_dictionary 에 흡수되어 있다고 가정
//
// 사용:
//   pnpm vcb:dict-lookup --run-id <id>
//
// CLAUDE.md §19.4 Step 4 정합.

import {
  createLogger,
  getSupabaseAdmin,
  IngestError,
  mapVcbToSharedDictPos,
  type DictHitLevel,
  type Pos,
  type VocabSeedCandidateRow,
} from '@vocaflow/vcb-core'
import { parseArgs } from 'node:util'

const log = createLogger({ script: '04-dict-lookup' })

interface DictLookupOptions {
  runId: number
}

/**
 * VCB enrichment payload 의 필수 필드.
 * shared_dictionary 실제 스키마 (2026-05-13 확인) 와의 차이:
 *   - 제공:    cefr (← cefr_level alias), definitions_ko (← meanings_ko 변환)
 *   - 부재:    ipa, definitions_en, examples(en/ko pair), collocations, korean_learner_note
 * 따라서 shared_dictionary hit 은 모두 'partial' — 'full' 은 cache 도입 (옵션 C) 이후.
 */
const REQUIRED_FIELDS = [
  'ipa',
  'cefr',
  'definitions_ko',
  'definitions_en',
  'examples',
  'synonyms',
  'antonyms',
  'collocations',
  'korean_learner_note',
] as const

/** shared_dictionary 가 실제 채울 수 있는 필드 (alias 적용 후 VCB 도메인 키). */
const SHARED_DICT_PROVIDABLE_FIELDS = ['cefr', 'definitions_ko'] as const

const WORD_LEXICON_ENABLED = false // lexicon-v2.1 deployment pending — re-enable when DDL applied

interface LookupResult {
  hitLevel: DictHitLevel
  sourceTable: 'shared_dictionary' | 'word_lexicon' | null
  existingPayload: Record<string, unknown> | null
  missingFields: string[]
}

/**
 * word_lexicon lookup — 현재 비활성.
 * 활성화 시 (lexicon-v2.1 deploy 후) WORD_LEXICON_ENABLED = true 로 변경 + 본문 구현.
 */
async function lookupWordLexicon(
  _lemma: string,
  _pos: Pos,
  log_: ReturnType<typeof createLogger>
): Promise<LookupResult | null> {
  if (!WORD_LEXICON_ENABLED) {
    log_.debug(
      { lookup: 'word_lexicon', status: 'disabled', reason: 'lexicon-v2.1 not deployed' },
      'word_lexicon lookup skipped'
    )
    return null
  }
  // 활성화 시 구현 — P3 이후
  throw new Error('WORD_LEXICON_ENABLED=true but lookupWordLexicon not implemented')
}

/** shared_dictionary 실제 컬럼 형태 (2026-05-13 검증). */
interface SharedDictRawRow {
  word: string
  pos: string
  meaning_ko: string | null
  meanings_ko: Array<{ pos: string; meaning: string }> | null
  cefr_level: string | null
  frequency_rank: number | null
  ngsl_sfi: number | null
}

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  return true
}

/**
 * shared_dictionary lookup — 실제 스키마 정합.
 * VCB Pos (대문자 약어) → shared_dictionary.pos (소문자 풀네임) 변환.
 * 반환 payload 는 VCB 도메인 키로 alias 적용.
 */
async function lookupSharedDictionary(lemma: string, pos: Pos): Promise<LookupResult> {
  const sb = getSupabaseAdmin()
  const sharedPos = mapVcbToSharedDictPos(pos)

  const { data, error } = await sb
    .from('shared_dictionary')
    .select('word, pos, meaning_ko, meanings_ko, cefr_level, frequency_rank, ngsl_sfi')
    .eq('word', lemma)
    .eq('pos', sharedPos)
    .maybeSingle()

  if (error) {
    throw new IngestError('shared_dictionary lookup failed', {
      lemma,
      pos,
      shared_pos: sharedPos,
      error: error.message,
    })
  }

  if (!data) {
    return {
      hitLevel: 'miss',
      sourceTable: null,
      existingPayload: null,
      missingFields: [...REQUIRED_FIELDS],
    }
  }

  const row = data as SharedDictRawRow

  // VCB 도메인 키로 alias 변환 + enrichment 가 참고할 보조 필드 보존
  const payload: Record<string, unknown> = {
    cefr: row.cefr_level,
    meanings_ko: row.meanings_ko,
    meaning_ko_primary: row.meaning_ko,
    frequency_rank: row.frequency_rank,
    ngsl_sfi: row.ngsl_sfi,
  }

  // missing_fields 계산: VCB 도메인 키 기준
  // - cefr: row.cefr_level 채워졌으면 만족
  // - definitions_ko: meanings_ko 가 비어있지 않으면 부분 충족 (enrichment 가 register 만 추가)
  // - 나머지 (ipa/definitions_en/examples/synonyms/antonyms/collocations/korean_learner_note): 항상 missing
  const missing: string[] = []
  if (!isFilled(row.cefr_level)) missing.push('cefr')
  if (!isFilled(row.meanings_ko)) missing.push('definitions_ko')
  for (const field of REQUIRED_FIELDS) {
    if (SHARED_DICT_PROVIDABLE_FIELDS.includes(field as 'cefr' | 'definitions_ko')) continue
    missing.push(field)
  }

  return {
    // shared_dictionary 만으로는 full 도달 불가 — cache(옵션 C) 도입 전까지 항상 partial/miss
    hitLevel: missing.length === REQUIRED_FIELDS.length ? 'miss' : 'partial',
    sourceTable: 'shared_dictionary',
    existingPayload: payload,
    missingFields: missing,
  }
}

async function fetchCandidates(runId: number): Promise<VocabSeedCandidateRow[]> {
  const sb = getSupabaseAdmin()
  const PAGE_SIZE = 1000
  const all: VocabSeedCandidateRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await sb
      .from('vocab_seed_candidates')
      .select('*')
      .eq('run_id', runId)
      .order('rank_in_run', { ascending: true, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new IngestError('fetch candidates failed', {
        run_id: runId,
        offset,
        error: error.message,
      })
    }
    const page = (data ?? []) as VocabSeedCandidateRow[]
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

async function upsertDictHit(opts: { seedId: number; result: LookupResult }): Promise<void> {
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('vocab_dict_hits').upsert(
    {
      seed_id: opts.seedId,
      hit_level: opts.result.hitLevel,
      source_table: opts.result.sourceTable,
      existing_payload: opts.result.existingPayload,
      missing_fields: opts.result.missingFields,
    },
    { onConflict: 'seed_id' }
  )

  if (error) {
    throw new IngestError('dict_hit upsert failed', {
      seed_id: opts.seedId,
      error: error.message,
    })
  }
}

async function upsertEnrichmentQueue(opts: {
  seedId: number
  result: LookupResult
}): Promise<'pending' | 'enriched_full'> {
  const sb = getSupabaseAdmin()

  // full hit: enrichment 불필요 → status='enriched' + payload 그대로
  if (opts.result.hitLevel === 'full') {
    const { error } = await sb.from('vocab_enrichment_queue').upsert(
      {
        seed_id: opts.seedId,
        status: 'enriched',
        hit_level: 'full',
        missing_fields: [],
        enriched_payload: opts.result.existingPayload,
        enriched_at: new Date().toISOString(),
        qa_flags: [],
      },
      { onConflict: 'seed_id' }
    )
    if (error) {
      throw new IngestError('queue upsert (full) failed', {
        seed_id: opts.seedId,
        error: error.message,
      })
    }
    return 'enriched_full'
  }

  // partial / miss: enrichment 필요 → status='pending'
  const { error } = await sb.from('vocab_enrichment_queue').upsert(
    {
      seed_id: opts.seedId,
      status: 'pending',
      hit_level: opts.result.hitLevel,
      missing_fields: opts.result.missingFields,
      enriched_payload: null,
      qa_flags: [],
    },
    { onConflict: 'seed_id' }
  )
  if (error) {
    throw new IngestError('queue upsert (pending) failed', {
      seed_id: opts.seedId,
      error: error.message,
    })
  }
  return 'pending'
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

async function run(opts: DictLookupOptions): Promise<void> {
  const childLog = log.child({ run_id: opts.runId })
  childLog.info('dict-lookup started')

  const candidates = await fetchCandidates(opts.runId)
  childLog.info({ count: candidates.length }, 'candidates fetched')

  if (candidates.length === 0) {
    throw new IngestError('no seed_candidates found — run 03-extract or 01b-ingest-ai-seed first', {
      run_id: opts.runId,
    })
  }

  await updateRunStatus(opts.runId, 'looked_up')

  let fullHits = 0
  let partialHits = 0
  let misses = 0
  let enrichedFull = 0
  let pending = 0

  for (const cand of candidates) {
    // Step 1: word_lexicon (현재 비활성)
    const lexResult = await lookupWordLexicon(cand.lemma, cand.pos, childLog)
    let result: LookupResult
    if (lexResult) {
      result = lexResult
    } else {
      // Step 2: shared_dictionary
      result = await lookupSharedDictionary(cand.lemma, cand.pos)
    }

    if (result.hitLevel === 'full') fullHits += 1
    else if (result.hitLevel === 'partial') partialHits += 1
    else misses += 1

    await upsertDictHit({ seedId: cand.id, result })
    const queueResult = await upsertEnrichmentQueue({ seedId: cand.id, result })
    if (queueResult === 'enriched_full') enrichedFull += 1
    else pending += 1
  }

  childLog.info(
    {
      total: candidates.length,
      full_hits: fullHits,
      partial_hits: partialHits,
      misses,
      queue_enriched_full: enrichedFull,
      queue_pending: pending,
    },
    'dict-lookup completed'
  )
}

function parseCliArgs(): DictLookupOptions {
  const { values } = parseArgs({
    options: {
      'run-id': { type: 'string' },
    },
  })

  if (!values['run-id']) {
    throw new IngestError('--run-id is required')
  }

  return { runId: parseInt(values['run-id'], 10) }
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
    'dict-lookup failed'
  )
  process.exit(1)
})
