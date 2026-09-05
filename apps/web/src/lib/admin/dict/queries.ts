// apps/web/src/lib/admin/dict/queries.ts
// 사전DB 종합 모니터링 콘솔 v3 — 다차원 페치 함수 (Server-side only)
//
// 10 fetch + 1 통합 entry (fetchDictSnapshotRaw)
// 모든 함수 병렬 호출 가능 (Promise.all 조합)
//
// **공개 표면은 `fetchDictSnapshotRaw` 하나다.** 개별 fetch 는 이 파일 안에서만 쓰인다.
// 예전에는 13개가 전부 export 였고 그중 3개(fetchSourceDistribution ·
// fetchVerifiedAudit · fetchVcbVrlIntegration)는 **어디서도 호출되지 않은 채** 88줄을
// 차지하고 있었다. export 는 "누군가 쓴다"는 신호라서, 아무도 안 쓰는 export 는
// 다음 사람이 지우지 못하게 만든다 — 그래서 지웠고, 나머지는 비공개로 내렸다.
// 새 소비자가 필요하면 그때 하나씩 다시 열되, 호출처와 함께 연다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { pagedSelect } from '@/lib/supabase/paged-select'
import type {
  DictVolumeData,
  DictCoverageData,
  DictCoverageMetric,
  DictLinguisticData,
  DictLearningData,
  VrlClassificationStatsData,
  VrlLevelDistribution,
  IntegrityDefectsData,
  FreshnessData,
  SchemaPresenceData,
} from './types'

// ─────────────────────────────────────────────────────────────
// 헬퍼 — count: 'exact', head: true 패턴
// ─────────────────────────────────────────────────────────────

/**
 * dict_categorical_distributions() RPC 결과 형식 — types.ts 에서 re-export.
 */
export type { DictCategoricalDistributions } from './types'
import type { DictCategoricalDistributions } from './types'

async function fetchCategoricalDistributions(
  client: SupabaseClient,
): Promise<DictCategoricalDistributions | null> {
  const { data, error } = await client.rpc('dict_categorical_distributions')
  if (error || !data) {
    console.warn('[fetchCategoricalDistributions] RPC failed:', error?.message)
    return null
  }
  return data as DictCategoricalDistributions
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PgQuery = any

/**
 * `count: 'exact', head: true` 카운트 + 재시도.
 *
 * - 250 / 500 / 1000 ms exponential backoff (총 3회 시도)
 * - 모든 시도 실패 시 throw — silent 0 반환 폐지 (직전 버그 원인)
 * - 호출자 (fetchDictSnapshotRaw) 가 Promise.allSettled 로 격리
 */
async function countRows(
  client: SupabaseClient,
  table: string,
  filter?: (q: PgQuery) => PgQuery,
): Promise<number> {
  const backoffs = [0, 250, 500, 1000]
  let lastError: { message: string } | null = null
  for (let attempt = 0; attempt < backoffs.length; attempt++) {
    if (backoffs[attempt] && backoffs[attempt]! > 0) {
      await new Promise((r) => setTimeout(r, backoffs[attempt]))
    }
    let q: PgQuery = client.from(table).select('*', { count: 'exact', head: true })
    if (filter) q = filter(q)
    const { count, error } = await q
    if (!error) {
      return (count as number | null) ?? 0
    }
    lastError = { message: error.message }
    console.warn(
      `[dict/queries] countRows(${table}) attempt ${attempt + 1}/4 failed: ${error.message}`,
    )
  }
  throw new Error(
    `countRows(${table}) failed after 4 attempts: ${lastError?.message ?? 'unknown'}`,
  )
}

function asMetric(filled: number, total: number): DictCoverageMetric {
  return { filled, ratio: total > 0 ? filled / total : 0 }
}

/** segment 자동 단어장 발행이 실제로 쓰는 list_tags — specialty 세트 curation_query 실측 기준 */
export const SEGMENT_TAGS = ['bsl_1.20', 'bel_1.0', 'tsl_1.2', 'nawl_1.2', 'moel_1.0']
/** segment 태그 보유 row 목표치 — 현 specialty 4종(902 row 발행) 유지에 충분한 풀 */
export const SEGMENT_TAGS_TARGET = 3000

// ─────────────────────────────────────────────────────────────
// 1. fetchDictVolume — total + by primary_pos + by source
// ─────────────────────────────────────────────────────────────

async function fetchDictVolume(
  client: SupabaseClient,
  categorical?: DictCategoricalDistributions | null,
): Promise<DictVolumeData> {
  // 이 총계 하나가 0 이 되면 **스냅샷 전체가 0 으로 읽힌다** — 커버리지 비율의 분모이고
  // 화면 최상단 "N entries" 이기도 하다. 예전에는 여기서 raw 질의 + `?? 0` 이라, 조회가
  // 실패해도 조용히 "0 entries · 커버리지 0%" 가 떴다(사전은 실제로 4만 행이 넘는다).
  // 같은 파일의 `countRows` 는 4회 재시도 후 **던진다** — 그 예외를 `_errors` 가 받아
  // 화면 상단 배너로 올린다. 실패를 0 으로 바꾸지 않고 실패라고 말하는 유일한 경로다.
  const [total, cat] = await Promise.all([
    countRows(client, 'shared_dictionary'),
    categorical !== undefined ? Promise.resolve(categorical) : fetchCategoricalDistributions(client),
  ])

  const byPrimaryPos = Object.entries(cat?.by_primary_pos ?? {})
    .map(([pos, count]) => ({ pos, count }))
    .sort((a, b) => b.count - a.count)

  const bySource = Object.entries(cat?.by_source ?? {})
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  return { total, byPrimaryPos, bySource }
}

// ─────────────────────────────────────────────────────────────
// 2. fetchDictCoverage — 14 컬럼 채움률
// ─────────────────────────────────────────────────────────────

async function fetchDictCoverage(
  client: SupabaseClient,
): Promise<DictCoverageData> {
  const [
    total,
    meaning,
    example,
    ipa,
    cefr,
    cefrConf,
    register,
    segTags,
    syn,
    ant,
    coll,
    infl,
    note,
    exKo,
    freq,
    sfi,
    verified,
  ] = await Promise.all([
    countRows(client, 'shared_dictionary'),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('meaning_ko', 'is', null).neq('meaning_ko', ''),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('example_en', 'is', null).neq('example_en', ''),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('ipa', 'is', null).neq('ipa', ''),
    ),
    countRows(client, 'shared_dictionary', (q) => q.not('cefr_level', 'is', null)),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('cefr_confidence', 'is', null),
    ),
    countRows(client, 'shared_dictionary', (q) => q.not('register', 'is', null)),
    countRows(client, 'shared_dictionary', (q) => q.overlaps('list_tags', SEGMENT_TAGS)),
    countRows(client, 'shared_dictionary', (q) => q.not('synonyms', 'eq', '{}')),
    countRows(client, 'shared_dictionary', (q) => q.not('antonyms', 'eq', '{}')),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('collocations', 'eq', '{}'),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('inflections', 'is', null).not('inflections', 'eq', '{}'),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('korean_learner_note', 'is', null),
    ),
    // 예문 해석 — jsonb 첫 원소만 본다. 배열 전체를 순회하려면 RPC 가 필요하고,
    // 그 비용을 들일 만큼 이 지표가 정밀할 필요는 없다(진행 방향만 보면 된다).
    countRows(client, 'shared_dictionary', (q) =>
      q.not('meanings_ko->0->>example_ko', 'is', null),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('frequency_rank', 'is', null),
    ),
    countRows(client, 'shared_dictionary', (q) => q.not('ngsl_sfi', 'is', null)),
    countRows(client, 'shared_dictionary', (q) => q.eq('verified', true)),
  ])

  return {
    total,
    meaningKo: asMetric(meaning, total),
    exampleEn: asMetric(example, total),
    ipa: asMetric(ipa, total),
    cefrLevel: asMetric(cefr, total),
    cefrConfidence: asMetric(cefrConf, total),
    register: asMetric(register, total),
    // ratio = 목표 풀 대비 충족률 (1.0 초과 clamp) — 전체 사전 대비가 아님
    segmentTags: { filled: segTags, ratio: Math.min(1, segTags / SEGMENT_TAGS_TARGET) },
    synonyms: asMetric(syn, total),
    antonyms: asMetric(ant, total),
    collocations: asMetric(coll, total),
    inflections: asMetric(infl, total),
    koreanLearnerNote: asMetric(note, total),
    exampleKo: asMetric(exKo, total),
    frequencyRank: asMetric(freq, total),
    ngslSfi: asMetric(sfi, total),
    verified: asMetric(verified, total),
  }
}

// ─────────────────────────────────────────────────────────────
// 3. fetchDictLinguistic — inflections by POS / polysemy / IPA UK·US
// ─────────────────────────────────────────────────────────────

async function fetchDictLinguistic(
  client: SupabaseClient,
): Promise<DictLinguisticData> {
  // inflections by primary_pos — SECURITY DEFINER RPC dict_inflections_by_pos().
  // 이전 .limit(50000) + 클라이언트 집계는 PostgREST max-rows 한도 + 순서 미지정으로
  // sampling bias 발생 (verb 75%~95% 변동). RPC 1회 호출로 서버 측 GROUP BY 정확 카운트.
  const inflRpc = await client.rpc('dict_inflections_by_pos')
  type InflRpcShape = Record<
    string,
    { total: number; with_inflections: number; pct: number }
  >
  const inflData = (inflRpc.data as InflRpcShape | null) ?? {}
  if (inflRpc.error) {
    console.warn(
      '[fetchDictLinguistic] dict_inflections_by_pos RPC failed:',
      inflRpc.error.message,
    )
  }
  const inflectionsByPos = Object.entries(inflData)
    .map(([primaryPos, v]) => ({
      primaryPos,
      total: v.total,
      withInflections: v.with_inflections,
      ratio: v.total > 0 ? v.with_inflections / v.total : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // polysemy — SECURITY DEFINER RPC dict_polysemy_count() 호출.
  // 이전 PostgREST cs 필터 '[{},{}]' 가 빈 객체로 모든 row 매칭되는 버그 회피.
  // RPC 1회 호출로 정확한 jsonb_array_length(senses) >= 2 count 산출.
  const [total, polysemyRpc, ipaAny, ipaUk, ipaUs, ipaBoth] = await Promise.all([
    countRows(client, 'shared_dictionary'),
    client.rpc('dict_polysemy_count'),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('ipa', 'is', null).neq('ipa', ''),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('ipa_uk', 'is', null).neq('ipa_uk', ''),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('ipa_us', 'is', null).neq('ipa_us', ''),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q
        .not('ipa_uk', 'is', null)
        .neq('ipa_uk', '')
        .not('ipa_us', 'is', null)
        .neq('ipa_us', ''),
    ),
  ])

  type PolysemyRpcShape = {
    total_rows: number
    senses_is_array: number
    senses_single: number
    polysemic_2plus: number
    high_polysemy_5plus: number
  }
  const polysemyData = (polysemyRpc.data as PolysemyRpcShape | null) ?? null
  if (polysemyRpc.error) {
    console.warn(
      '[fetchDictLinguistic] dict_polysemy_count RPC failed:',
      polysemyRpc.error.message,
    )
  }
  const polysemicFinal = polysemyData?.polysemic_2plus ?? 0
  const monosemic = total - polysemicFinal

  return {
    inflectionsByPos,
    polysemy: {
      monosemic,
      polysemic: polysemicFinal,
      polysemicRatio: total > 0 ? polysemicFinal / total : 0,
    },
    ipa: { hasAny: ipaAny, hasUk: ipaUk, hasUs: ipaUs, hasBoth: ipaBoth },
  }
}

// ─────────────────────────────────────────────────────────────
// 4. fetchDictLearning — 사용자 학습 자산 (audio_url 등 schema-aware)
// ─────────────────────────────────────────────────────────────

async function fetchDictLearning(
  client: SupabaseClient,
  schema: SchemaPresenceData,
): Promise<DictLearningData> {
  const [total, ex, syn, coll, note, ipa] = await Promise.all([
    countRows(client, 'shared_dictionary'),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('example_en', 'is', null).neq('example_en', ''),
    ),
    countRows(client, 'shared_dictionary', (q) => q.not('synonyms', 'eq', '{}')),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('collocations', 'eq', '{}'),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('korean_learner_note', 'is', null),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q.not('ipa', 'is', null).neq('ipa', ''),
    ),
  ])

  // Schema-aware 컬럼 — 존재할 때만 count
  const audioUrl = schema.tierColumns['audio_url']
    ? asMetric(
        await countRows(client, 'shared_dictionary', (q) =>
          q.not('audio_url', 'is', null),
        ),
        total,
      )
    : null
  const imageUrl = schema.tierColumns['image_url']
    ? asMetric(
        await countRows(client, 'shared_dictionary', (q) =>
          q.not('image_url', 'is', null),
        ),
        total,
      )
    : null
  const mnemonicKo = schema.tierColumns['mnemonic_ko']
    ? asMetric(
        await countRows(client, 'shared_dictionary', (q) =>
          q.not('mnemonic_ko', 'is', null),
        ),
        total,
      )
    : null

  return {
    total,
    exampleEn: asMetric(ex, total),
    synonyms: asMetric(syn, total),
    collocations: asMetric(coll, total),
    koreanLearnerNote: asMetric(note, total),
    ipa: asMetric(ipa, total),
    audioUrl,
    imageUrl,
    mnemonicKo,
  }
}

// ─────────────────────────────────────────────────────────────
// 5. fetchVrlClassificationStats — v_level 분포 + rule_v1 차이
// ─────────────────────────────────────────────────────────────

async function fetchVrlClassificationStats(
  client: SupabaseClient,
  categorical?: DictCategoricalDistributions | null,
): Promise<VrlClassificationStatsData> {
  const [total, classified, levelsRes, cat, reclassRes] = await Promise.all([
    countRows(client, 'shared_dictionary'),
    countRows(client, 'shared_dictionary', (q) => q.not('v_level', 'is', null)),
    client
      .from('vocaflow_levels')
      .select('level, new_words_in_level, cumulative_word_count')
      .order('level'),
    categorical !== undefined ? Promise.resolve(categorical) : fetchCategoricalDistributions(client),
    client
      .from('shared_dictionary')
      .select('*', { count: 'exact', head: true })
      .not('v_level', 'is', null)
      .not('v_level_rule_v1', 'is', null)
      .filter('v_level', 'neq', 'v_level_rule_v1' as unknown as number),
  ])

  type LevelRow = {
    level: number
    new_words_in_level: number | null
    cumulative_word_count: number | null
  }
  const levels = (levelsRes.data ?? []) as LevelRow[]

  // v_level 분포 — RPC categorical 결과 활용 (서버 측 GROUP BY 정확)
  const dist = new Map<number, number>()
  for (const [k, n] of Object.entries(cat?.by_v_level ?? {})) {
    dist.set(parseInt(k, 10), n)
  }

  const byLevel: VrlLevelDistribution[] = levels.map((l) => ({
    level: l.level,
    classifiedCount: dist.get(l.level) ?? 0,
    targetCount: l.new_words_in_level,
    cumulativeTarget: l.cumulative_word_count,
  }))

  return {
    totalClassified: classified,
    totalUnclassified: total - classified,
    classifiedRatio: total > 0 ? classified / total : 0,
    byLevel,
    reclassifiedCount: reclassRes.count ?? 0,
  }
}

// ─────────────────────────────────────────────────────────────
// 6. fetchIntegrityDefects — vrl_data_integrity_concerns
// ─────────────────────────────────────────────────────────────

async function fetchIntegrityDefects(
  client: SupabaseClient,
): Promise<IntegrityDefectsData> {
  // ⚠️ 여기 있던 `.limit(5000)` 은 **1,000행에서 잘렸다** — PostgREST 가 그 위를 안 준다
  //    (실측 2026-08-30). 받은 행을 세어 화면의 결함 개수로 쓰고 있었으므로, 1,000을
  //    넘는 순간 **적게 세어진 수가 조용히** 떴다.
  //    유형별 분해는 전량이 필요하니 끝까지 받고, 총계·미해결은 이 파일이 이미 가진
  //    정확 카운트(`countRows` — `count: 'exact', head: true`)로 따로 확인한다.
  //    둘이 어긋나면 페이지네이션이 깨진 것이라 그 사실을 로그로 남긴다.
  type Row = { concern_type: string; resolved: boolean }
  let rows: Row[] = []
  let error: { message: string } | null = null
  try {
    rows = await pagedSelect<Row>(
      (lo, hi) =>
        client
          .from('vrl_data_integrity_concerns')
          .select('concern_type, resolved')
          .range(lo, hi),
      'vrl_data_integrity_concerns',
    )
  } catch (e) {
    error = { message: e instanceof Error ? e.message : String(e) }
  }

  if (error) {
    console.warn('[fetchIntegrityDefects] failed:', error.message)
    return { open: 0, resolved: 0, total: 0, byType: [] }
  }

  const open = rows.filter((r) => !r.resolved).length
  const resolved = rows.length - open

  const tMap = new Map<string, { total: number; open: number }>()
  for (const r of rows) {
    const e = tMap.get(r.concern_type) ?? { total: 0, open: 0 }
    e.total += 1
    if (!r.resolved) e.open += 1
    tMap.set(r.concern_type, e)
  }

  return {
    open,
    resolved,
    total: rows.length,
    byType: [...tMap.entries()]
      .map(([type, v]) => ({ type, total: v.total, open: v.open }))
      .sort((a, b) => b.total - a.total),
  }
}

// ─────────────────────────────────────────────────────────────
// 7. fetchFreshness — claude_classified_at / updated_at 추세
// ─────────────────────────────────────────────────────────────

async function fetchFreshness(client: SupabaseClient): Promise<FreshnessData> {
  const now = new Date()
  const days7 = new Date(now.getTime() - 7 * 86400_000).toISOString()
  const days30 = new Date(now.getTime() - 30 * 86400_000).toISOString()
  const days90 = new Date(now.getTime() - 90 * 86400_000).toISOString()

  const [lastClassified, last7, last30, stale, lastUpdated] = await Promise.all([
    client
      .from('shared_dictionary')
      .select('claude_classified_at')
      .not('claude_classified_at', 'is', null)
      .order('claude_classified_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    countRows(client, 'shared_dictionary', (q) =>
      q.gte('claude_classified_at', days7),
    ),
    countRows(client, 'shared_dictionary', (q) =>
      q.gte('claude_classified_at', days30),
    ),
    // stale: classified 됐는데 90일 이상 갱신 없음 (claude_classified_at < 90d ago)
    countRows(client, 'shared_dictionary', (q) =>
      q.not('claude_classified_at', 'is', null).lt('claude_classified_at', days90),
    ),
    client
      .from('shared_dictionary')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    lastClassifiedAt:
      (lastClassified.data as { claude_classified_at: string } | null)?.claude_classified_at ??
      null,
    last7d: last7,
    last30d: last30,
    stale90d: stale,
    lastUpdatedAt: (lastUpdated.data as { updated_at: string } | null)?.updated_at ?? null,
  }
}

// ─────────────────────────────────────────────────────────────
// 8. fetchSchemaPresence — 정적 상수 기반 (Step 1.5 정정)
// ─────────────────────────────────────────────────────────────
//
// information_schema 직접 쿼리 대신 KNOWN_SCHEMA_PRESENCE 사용:
//   - anon/authenticated RLS 차단 위험 회피
//   - 사전 서버 검증: 12개 잠재 컬럼 모두 false 확정
//   - Schema Evolution Migration 적용 시 schema-presence-static.ts 수동 동기화
//
// 미래 — Tier 1 Migration apply 시점에 SECURITY DEFINER RPC 로 업그레이드 검토.

import {
  KNOWN_SCHEMA_PRESENCE,
  KNOWN_SHARED_DICTIONARY_BASE_COLUMNS,
  KNOWN_SHARED_WORD_SETS_BASE_COLUMNS,
  isVcbVrlIntegrated,
} from './schema-presence-static'

async function fetchSchemaPresence(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _client: SupabaseClient,
): Promise<SchemaPresenceData> {
  // 베이스 컬럼 (보유 확정) + Tier 컬럼 중 true 인 것 합쳐 표시
  const tierColumns = { ...KNOWN_SCHEMA_PRESENCE.shared_dictionary }
  const sharedDictionaryColumns = [
    ...KNOWN_SHARED_DICTIONARY_BASE_COLUMNS,
    ...Object.entries(tierColumns)
      .filter(([, present]) => present)
      .map(([name]) => name),
  ]
  const sharedWordSetsColumns = [
    ...KNOWN_SHARED_WORD_SETS_BASE_COLUMNS,
    ...Object.entries(KNOWN_SCHEMA_PRESENCE.shared_word_sets)
      .filter(([, present]) => present)
      .map(([name]) => name),
  ]

  return {
    sharedDictionaryColumns,
    sharedWordSetsColumns,
    tierColumns,
    vcbVrlIntegrated: isVcbVrlIntegrated(),
  }
}

// ─────────────────────────────────────────────────────────────
// 9. fetchPolysemy — RPC dict_polysemy_count() (50K fetch 제거)
// ─────────────────────────────────────────────────────────────

export async function fetchPolysemy(client: SupabaseClient): Promise<{
  total: number
  polysemic: number
  polysemicRatio: number
  /** 5+ senses 보유 단어 수 (고다의어) */
  highPolysemyCount: number
}> {
  const { data, error } = await client.rpc('dict_polysemy_count')
  if (error || !data) {
    console.warn('[fetchPolysemy] RPC failed:', error?.message)
    return { total: 0, polysemic: 0, polysemicRatio: 0, highPolysemyCount: 0 }
  }
  type Shape = {
    total_rows: number
    polysemic_2plus: number
    high_polysemy_5plus: number
  }
  const d = data as Shape
  return {
    total: d.total_rows,
    polysemic: d.polysemic_2plus,
    polysemicRatio: d.total_rows > 0 ? d.polysemic_2plus / d.total_rows : 0,
    highPolysemyCount: d.high_polysemy_5plus,
  }
}

// ─────────────────────────────────────────────────────────────
// 10. fetchDictSnapshotRaw — page entry point 병렬 페치
// ─────────────────────────────────────────────────────────────

export interface DictSnapshotRaw {
  volume: DictVolumeData
  coverage: DictCoverageData
  linguistic: DictLinguisticData
  learning: DictLearningData
  vrlClassification: VrlClassificationStatsData
  integrity: IntegrityDefectsData
  freshness: FreshnessData
  schemaPresence: SchemaPresenceData
  /** dict_categorical_distributions RPC 결과 — Step 8 Distribution Section 사용 */
  categorical: DictCategoricalDistributions | null
  /** 각 fetch 별 실패 메시지 — UI 에 가시화 (silent failure 폐지) */
  _errors: string[]
}

// 안전 기본값 — fetch 실패 시 폴백 (점수화는 정상 진행, UI 가 _errors 표시)
function emptyVolume(): DictVolumeData {
  return { total: 0, byPrimaryPos: [], bySource: [] }
}
function emptyMetric(): DictCoverageMetric {
  return { filled: 0, ratio: 0 }
}
function emptyCoverage(): DictCoverageData {
  const m = emptyMetric()
  return {
    total: 0,
    meaningKo: m,
    exampleEn: m,
    // 실제 집계(위 `asMetric(exKo, total)`)에는 있는데 이 폴백에만 빠져 있었다 —
    // 타입에 필드를 더할 때 안전 기본값 쪽을 같이 고치지 않으면 빌드가 막힌다.
    exampleKo: m,
    ipa: m,
    cefrLevel: m,
    cefrConfidence: m,
    register: m,
    segmentTags: m,
    synonyms: m,
    antonyms: m,
    collocations: m,
    inflections: m,
    koreanLearnerNote: m,
    frequencyRank: m,
    ngslSfi: m,
    verified: m,
  }
}
function emptyLinguistic(): DictLinguisticData {
  return {
    inflectionsByPos: [],
    polysemy: { monosemic: 0, polysemic: 0, polysemicRatio: 0 },
    ipa: { hasAny: 0, hasUk: 0, hasUs: 0, hasBoth: 0 },
  }
}
function emptyLearning(): DictLearningData {
  const m = emptyMetric()
  return {
    total: 0,
    exampleEn: m,
    synonyms: m,
    collocations: m,
    koreanLearnerNote: m,
    ipa: m,
    audioUrl: null,
    imageUrl: null,
    mnemonicKo: null,
  }
}
function emptyVrlClassification(): VrlClassificationStatsData {
  return {
    totalClassified: 0,
    totalUnclassified: 0,
    classifiedRatio: 0,
    byLevel: [],
    reclassifiedCount: 0,
  }
}
function emptyIntegrity(): IntegrityDefectsData {
  return { open: 0, resolved: 0, total: 0, byType: [] }
}
function emptyFreshness(): FreshnessData {
  return {
    lastClassifiedAt: null,
    last7d: 0,
    last30d: 0,
    stale90d: 0,
    lastUpdatedAt: null,
  }
}
function emptySchemaPresence(): SchemaPresenceData {
  return {
    sharedDictionaryColumns: [],
    sharedWordSetsColumns: [],
    tierColumns: {},
    vcbVrlIntegrated: false,
  }
}

/**
 * Promise.allSettled 헬퍼 — 실패 시 fallback + _errors 누적.
 */
async function settledOrFallback<T>(
  label: string,
  promise: Promise<T>,
  fallback: T,
  errors: string[],
): Promise<T> {
  try {
    return await promise
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`${label}: ${msg}`)
    console.error(`[fetchDictSnapshotRaw] ${label} failed:`, msg)
    return fallback
  }
}

export async function fetchDictSnapshotRaw(
  client: SupabaseClient,
): Promise<DictSnapshotRaw> {
  const errors: string[] = []

  // 선행: schemaPresence + categorical (모두 다수 함수에 공유)
  //   - schemaPresence: learning 이 schema 의존
  //   - categorical: volume.byPrimaryPos/bySource + vrlClassification.byLevel + verified_by_v_level
  //                  하나의 RPC로 1회 fetch → 5개 함수 공유 (network 절감)
  const [schema, categorical] = await Promise.all([
    settledOrFallback(
      'schemaPresence',
      fetchSchemaPresence(client),
      emptySchemaPresence(),
      errors,
    ),
    settledOrFallback(
      'categorical',
      fetchCategoricalDistributions(client),
      null,
      errors,
    ),
  ])

  // 7개 fetch 격리 — 한 개 실패해도 나머지 정상 진행
  const [volume, coverage, linguistic, learning, vrlClassification, integrity, freshness] =
    await Promise.all([
      settledOrFallback(
        'volume',
        fetchDictVolume(client, categorical),
        emptyVolume(),
        errors,
      ),
      settledOrFallback('coverage', fetchDictCoverage(client), emptyCoverage(), errors),
      settledOrFallback(
        'linguistic',
        fetchDictLinguistic(client),
        emptyLinguistic(),
        errors,
      ),
      settledOrFallback(
        'learning',
        fetchDictLearning(client, schema),
        emptyLearning(),
        errors,
      ),
      settledOrFallback(
        'vrlClassification',
        fetchVrlClassificationStats(client, categorical),
        emptyVrlClassification(),
        errors,
      ),
      settledOrFallback(
        'integrity',
        fetchIntegrityDefects(client),
        emptyIntegrity(),
        errors,
      ),
      settledOrFallback('freshness', fetchFreshness(client), emptyFreshness(), errors),
    ])

  return {
    volume,
    coverage,
    linguistic,
    learning,
    vrlClassification,
    integrity,
    freshness,
    schemaPresence: schema,
    categorical,
    _errors: errors,
  }
}
