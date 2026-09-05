// apps/web/src/lib/admin/vrl/queries.ts
// VRL Admin 6 page 데이터 쿼리 (Server-side only)
//
// 데이터 소스: vocaflow_levels · vocaflow_tracks · vocaflow_domains · vocaflow_skills ·
//             vrl_data_integrity_concerns · vrl_diagnostic_tests ·
//             vrl_diagnostic_questions · user_profiles · user_level_snapshots ·
//             user_diagnostic_results
//
// 규약 (2026-09-05):
//   ① **모든 fetch 는 `error` 를 화면까지 올린다.** 예전에는 taxonomy·diagnostic 이
//      error 를 검사조차 하지 않고 빈 배열을 넘겨서, RLS 거부가 "아직 아무것도 없음" 과
//      똑같이 그려졌다. 판정은 `./view-state.ts` 가 한다.
//   ② **select 는 화면이 실제로 그리는 컬럼만.** 안 쓰는 컬럼은 조용한 비용이자,
//      "이건 어디에 쓰이지?" 를 매번 다시 확인하게 만드는 부채다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { mergeQueryErrors } from './view-state'

export interface VrlTaxonomyData {
  levels: Array<{
    level: number
    koreanName: string
    koreanSchool: string | null
    englishName: string | null
    cefrMin: string | null
    cefrMax: string | null
    testScoreHints: string | null
    cumulativeWordCount: number | null
    newWordsInLevel: number | null
    estimatedStudyHours: number | null
    ageRange: string | null
    classificationMethod: string | null
    classificationConfidence: number | null
  }>
  tracks: Array<{
    id: string
    nameKo: string
    nameEn: string | null
    descriptionKo: string | null
    displayHint: string | null
    totalWords: number | null
  }>
  domains: Array<{
    id: string
    nameKo: string
    descriptionKo: string | null
    totalWords: number | null
  }>
  skills: Array<{
    id: string
    nameKo: string
    descriptionKo: string | null
    totalWords: number | null
  }>
  /** 4개 조회 중 하나라도 실패하면 그 원문. 성공이면 null. */
  error: string | null
}

export async function fetchVrlTaxonomy(
  client: SupabaseClient,
): Promise<VrlTaxonomyData> {
  const [levelsRes, tracksRes, domainsRes, skillsRes] = await Promise.all([
    client
      .from('vocaflow_levels')
      .select(
        'level, korean_name, korean_school, english_name, cefr_min, cefr_max, test_score_hints, cumulative_word_count, new_words_in_level, estimated_study_hours, age_range, classification_method, classification_confidence',
      )
      .order('level', { ascending: true }),
    client
      .from('vocaflow_tracks')
      .select('id, name_ko, name_en, description_ko, display_hint, total_words')
      .order('display_order', { ascending: true, nullsFirst: false }),
    client
      .from('vocaflow_domains')
      .select('id, name_ko, description_ko, total_words')
      .order('id', { ascending: true }),
    client
      .from('vocaflow_skills')
      .select('id, name_ko, description_ko, total_words')
      .order('id', { ascending: true }),
  ])

  // 네 축 중 하나만 막혀도 이 화면은 "기준표" 로서 신뢰할 수 없다 — 통째로 못 읽음으로 본다.
  const error = mergeQueryErrors([
    levelsRes.error ? `vocaflow_levels: ${levelsRes.error.message}` : null,
    tracksRes.error ? `vocaflow_tracks: ${tracksRes.error.message}` : null,
    domainsRes.error ? `vocaflow_domains: ${domainsRes.error.message}` : null,
    skillsRes.error ? `vocaflow_skills: ${skillsRes.error.message}` : null,
  ])
  if (error) console.error('[fetchVrlTaxonomy] failed:', error)

  type LevelRow = {
    level: number
    korean_name: string
    korean_school: string | null
    english_name: string | null
    cefr_min: string | null
    cefr_max: string | null
    test_score_hints: string | null
    cumulative_word_count: number | null
    new_words_in_level: number | null
    estimated_study_hours: number | null
    age_range: string | null
    classification_method: string | null
    classification_confidence: number | null
  }
  type TrackRow = {
    id: string
    name_ko: string
    name_en: string | null
    description_ko: string | null
    display_hint: string | null
    total_words: number | null
  }
  type DomainRow = {
    id: string
    name_ko: string
    description_ko: string | null
    total_words: number | null
  }
  type SkillRow = {
    id: string
    name_ko: string
    description_ko: string | null
    total_words: number | null
  }

  return {
    levels: ((levelsRes.data ?? []) as LevelRow[]).map((l) => ({
      level: l.level,
      koreanName: l.korean_name,
      koreanSchool: l.korean_school,
      englishName: l.english_name,
      cefrMin: l.cefr_min,
      cefrMax: l.cefr_max,
      testScoreHints: l.test_score_hints,
      cumulativeWordCount: l.cumulative_word_count,
      newWordsInLevel: l.new_words_in_level,
      estimatedStudyHours: l.estimated_study_hours,
      ageRange: l.age_range,
      classificationMethod: l.classification_method,
      classificationConfidence: l.classification_confidence,
    })),
    tracks: ((tracksRes.data ?? []) as TrackRow[]).map((t) => ({
      id: t.id,
      nameKo: t.name_ko,
      nameEn: t.name_en,
      descriptionKo: t.description_ko,
      displayHint: t.display_hint,
      totalWords: t.total_words,
    })),
    domains: ((domainsRes.data ?? []) as DomainRow[]).map((d) => ({
      id: d.id,
      nameKo: d.name_ko,
      descriptionKo: d.description_ko,
      totalWords: d.total_words,
    })),
    skills: ((skillsRes.data ?? []) as SkillRow[]).map((s) => ({
      id: s.id,
      nameKo: s.name_ko,
      descriptionKo: s.description_ko,
      totalWords: s.total_words,
    })),
    error,
  }
}

// ─────────────────────────────────────────────────────────────
// VRL Concerns
// ─────────────────────────────────────────────────────────────

export interface VrlConcernRow {
  id: number
  word: string
  concernType: string
  detectedAt: string | null
  detectedDuring: string | null
  reasoning: string | null
  suggestedAction: string | null
  resolved: boolean
  /** 처리 시각 — 표의 status 열이 그대로 보여준다(도움말이 "DB 에서 UPDATE" 를 안내하므로 결과가 보여야 한다). */
  resolvedAt: string | null
  /** 처리 메모 — 같은 이유로 표에 노출한다. */
  resolutionNote: string | null
}

export interface VrlConcernsData {
  rows: VrlConcernRow[]
  total: number
  openCount: number
  resolvedCount: number
  /** concern_type 별 (open + resolved 합산) */
  byType: Array<{ type: string; total: number; open: number }>
  error: string | null
}

export async function fetchVrlConcerns(
  client: SupabaseClient,
): Promise<VrlConcernsData> {
  const { data, error } = await client
    .from('vrl_data_integrity_concerns')
    .select(
      'id, word, concern_type, detected_at, detected_during, reasoning, suggested_action, resolved, resolved_at, resolution_note',
    )
    .order('resolved', { ascending: true })
    .order('detected_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[fetchVrlConcerns] failed:', error.message)
    return {
      rows: [],
      total: 0,
      openCount: 0,
      resolvedCount: 0,
      byType: [],
      error: `vrl_data_integrity_concerns: ${error.message}`,
    }
  }

  type Row = {
    id: number
    word: string
    concern_type: string
    detected_at: string | null
    detected_during: string | null
    reasoning: string | null
    suggested_action: string | null
    resolved: boolean
    resolved_at: string | null
    resolution_note: string | null
  }
  const rows = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    word: r.word,
    concernType: r.concern_type,
    detectedAt: r.detected_at,
    detectedDuring: r.detected_during,
    reasoning: r.reasoning,
    suggestedAction: r.suggested_action,
    resolved: r.resolved,
    resolvedAt: r.resolved_at,
    resolutionNote: r.resolution_note,
  }))

  const openCount = rows.filter((r) => !r.resolved).length
  const resolvedCount = rows.length - openCount

  const byTypeMap = new Map<string, { total: number; open: number }>()
  for (const r of rows) {
    const entry = byTypeMap.get(r.concernType) ?? { total: 0, open: 0 }
    entry.total += 1
    if (!r.resolved) entry.open += 1
    byTypeMap.set(r.concernType, entry)
  }
  const byType = [...byTypeMap.entries()]
    .map(([type, v]) => ({ type, total: v.total, open: v.open }))
    .sort((a, b) => b.total - a.total)

  return { rows, total: rows.length, openCount, resolvedCount, byType, error: null }
}

// ─────────────────────────────────────────────────────────────
// VRL Users
// ─────────────────────────────────────────────────────────────

export interface VrlUserRow {
  userId: string
  segment: string | null
  currentVLevel: number | null
  source: string | null
  confidence: number | null
  cefrLevel: string | null
  learningGoal: string | null
  diagnosticCompletedAt: string | null
  lastActiveAt: string | null
  totalWordsSeen: number | null
  totalWordsMastered: number | null
}

export interface VrlUsersData {
  rows: VrlUserRow[]
  total: number
  diagnosticDone: number
  /** L0~L11 distribution counts */
  byLevel: number[]
  error: string | null
}

export async function fetchVrlUsers(client: SupabaseClient): Promise<VrlUsersData> {
  const { data, error } = await client
    .from('user_profiles')
    .select(
      'user_id, segment, current_v_level, current_v_level_meta, cefr_level, learning_goal, diagnostic_completed_at, last_active_at, total_words_seen, total_words_mastered',
    )
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[fetchVrlUsers] failed:', error.message)
    return {
      rows: [],
      total: 0,
      diagnosticDone: 0,
      byLevel: new Array(12).fill(0) as number[],
      error: `user_profiles: ${error.message}`,
    }
  }

  type Row = {
    user_id: string
    segment: string | null
    current_v_level: number | null
    current_v_level_meta: { source?: string; confidence?: number } | null
    cefr_level: string | null
    learning_goal: string | null
    diagnostic_completed_at: string | null
    last_active_at: string | null
    total_words_seen: number | null
    total_words_mastered: number | null
  }

  const rows: VrlUserRow[] = ((data ?? []) as Row[]).map((r) => ({
    userId: r.user_id,
    segment: r.segment,
    currentVLevel: r.current_v_level,
    source: r.current_v_level_meta?.source ?? null,
    confidence:
      typeof r.current_v_level_meta?.confidence === 'number'
        ? r.current_v_level_meta.confidence
        : null,
    cefrLevel: r.cefr_level,
    learningGoal: r.learning_goal,
    diagnosticCompletedAt: r.diagnostic_completed_at,
    lastActiveAt: r.last_active_at,
    totalWordsSeen: r.total_words_seen,
    totalWordsMastered: r.total_words_mastered,
  }))

  const byLevel = new Array(12).fill(0) as number[]
  for (const r of rows) {
    if (typeof r.currentVLevel === 'number' && r.currentVLevel >= 0 && r.currentVLevel <= 11) {
      byLevel[r.currentVLevel] = (byLevel[r.currentVLevel] ?? 0) + 1
    }
  }

  const diagnosticDone = rows.filter((r) => r.diagnosticCompletedAt != null).length

  return { rows, total: rows.length, diagnosticDone, byLevel, error: null }
}

// ─────────────────────────────────────────────────────────────
// VRL Snapshots
// ─────────────────────────────────────────────────────────────

export interface VrlSnapshotRow {
  id: string
  userId: string
  vLevel: number
  previousVLevel: number | null
  vLevelDelta: number | null
  snapshotType: string | null
  triggeredBy: string | null
  takenReason: string
  takenAt: string
  source: string | null
  confidence: number | null
  triggerDetailsKeys: string[]
}

export interface VrlSnapshotsData {
  rows: VrlSnapshotRow[]
  total: number
  byType: Array<{ type: string; n: number }>
  byReason: Array<{ reason: string; n: number }>
  error: string | null
}

export async function fetchVrlSnapshots(
  client: SupabaseClient,
): Promise<VrlSnapshotsData> {
  const { data, error } = await client
    .from('user_level_snapshots')
    .select(
      'id, user_id, v_level, previous_v_level, v_level_delta, snapshot_type, triggered_by, taken_reason, taken_at, v_level_meta, trigger_details',
    )
    .order('taken_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[fetchVrlSnapshots] failed:', error.message)
    return {
      rows: [],
      total: 0,
      byType: [],
      byReason: [],
      error: `user_level_snapshots: ${error.message}`,
    }
  }

  type Row = {
    id: string
    user_id: string
    v_level: number
    previous_v_level: number | null
    v_level_delta: number | null
    snapshot_type: string | null
    triggered_by: string | null
    taken_reason: string
    taken_at: string
    v_level_meta: { source?: string; confidence?: number } | null
    trigger_details: Record<string, unknown> | null
  }

  const rows: VrlSnapshotRow[] = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    vLevel: r.v_level,
    previousVLevel: r.previous_v_level,
    vLevelDelta: r.v_level_delta,
    snapshotType: r.snapshot_type,
    triggeredBy: r.triggered_by,
    takenReason: r.taken_reason,
    takenAt: r.taken_at,
    source: r.v_level_meta?.source ?? null,
    confidence:
      typeof r.v_level_meta?.confidence === 'number' ? r.v_level_meta.confidence : null,
    triggerDetailsKeys:
      r.trigger_details && typeof r.trigger_details === 'object'
        ? Object.keys(r.trigger_details)
        : [],
  }))

  const typeMap = new Map<string, number>()
  const reasonMap = new Map<string, number>()
  for (const r of rows) {
    const t = r.snapshotType ?? '—'
    typeMap.set(t, (typeMap.get(t) ?? 0) + 1)
    reasonMap.set(r.takenReason, (reasonMap.get(r.takenReason) ?? 0) + 1)
  }

  return {
    rows,
    total: rows.length,
    byType: [...typeMap.entries()]
      .map(([type, n]) => ({ type, n }))
      .sort((a, b) => b.n - a.n),
    byReason: [...reasonMap.entries()]
      .map(([reason, n]) => ({ reason, n }))
      .sort((a, b) => b.n - a.n),
    error: null,
  }
}

// ─────────────────────────────────────────────────────────────
// VRL Diagnostic
// ─────────────────────────────────────────────────────────────

export interface VrlDiagnosticTest {
  id: string
  nameKo: string
  testType: string
  targetAxis: string
  targetTrackId: string | null
  targetDomainId: string | null
  questionCount: number
  estimatedMinutes: number
  descriptionKo: string | null
  isActive: boolean
  createdAt: string | null
  /** 실제 등록된 문항 수 (vrl_diagnostic_questions 한 번 조회 후 집계) */
  questionsLoaded: number
}

export interface VrlDiagnosticData {
  tests: VrlDiagnosticTest[]
  totalTests: number
  activeTests: number
  /**
   * ⚠️ `null` = **모름**, `0` = 없음.
   *
   * head + count 요청은 **없는 테이블·막힌 테이블에도** 204 와 `count=null` 을 돌려준다.
   * 이걸 `?? 0` 으로 뭉개면 "문항이 0개" 와 "셀 수 없었다" 가 화면에서 같아지고,
   * 관리자는 멀쩡한 진단을 비어 있다고 판단한다(이 저장소가 실측으로 금지한 안티패턴).
   */
  totalQuestions: number | null
  totalResults: number | null
  /**
   * 문항 집계가 잘렸는가. 테스트마다 head count 를 따로 날리던 것(N+1, 최대 200회)을
   * test_id 한 번 조회 + 집계로 접었는데, 그 한 번이 서버 max-rows 에 걸리면
   * 테스트별 수치가 실제보다 작아진다. 그때는 화면이 그렇다고 말해야 한다.
   */
  questionCountsPartial: boolean
  error: string | null
}

/** test_id 스캔 상한 — 실측 문항 수는 세 자리라 여유가 크다. */
const QUESTION_SCAN_LIMIT = 20_000

export async function fetchVrlDiagnostic(
  client: SupabaseClient,
): Promise<VrlDiagnosticData> {
  const [testsRes, questionIdsRes, qCountRes, rCountRes] = await Promise.all([
    client
      .from('vrl_diagnostic_tests')
      .select(
        'id, name_ko, test_type, target_axis, target_track_id, target_domain_id, question_count, estimated_minutes, description_ko, is_active, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(200),
    // 테스트별 문항 수는 이 한 번의 조회로 전부 집계한다 — 테스트 수만큼 head count 를
    // 날리던 N+1(최대 200 왕복)을 대체한다.
    client.from('vrl_diagnostic_questions').select('test_id').limit(QUESTION_SCAN_LIMIT),
    client.from('vrl_diagnostic_questions').select('*', { count: 'exact', head: true }),
    client.from('user_diagnostic_results').select('*', { count: 'exact', head: true }),
  ])

  const error = mergeQueryErrors([
    testsRes.error ? `vrl_diagnostic_tests: ${testsRes.error.message}` : null,
    questionIdsRes.error
      ? `vrl_diagnostic_questions: ${questionIdsRes.error.message}`
      : null,
    qCountRes.error ? `vrl_diagnostic_questions(count): ${qCountRes.error.message}` : null,
    rCountRes.error ? `user_diagnostic_results: ${rCountRes.error.message}` : null,
  ])
  if (error) console.error('[fetchVrlDiagnostic] failed:', error)

  type TestRow = {
    id: string
    name_ko: string
    test_type: string
    target_axis: string
    target_track_id: string | null
    target_domain_id: string | null
    question_count: number
    estimated_minutes: number
    description_ko: string | null
    is_active: boolean
    created_at: string | null
  }

  const baseTests = (testsRes.data ?? []) as TestRow[]

  const questionRows = (questionIdsRes.data ?? []) as Array<{ test_id: string | null }>
  const loadedByTest = new Map<string, number>()
  for (const q of questionRows) {
    if (!q.test_id) continue
    loadedByTest.set(q.test_id, (loadedByTest.get(q.test_id) ?? 0) + 1)
  }

  // null 을 그대로 올린다 — 0 으로 바꾸는 순간 "못 셌다" 가 "없다" 가 된다.
  const totalQuestions = typeof qCountRes.count === 'number' ? qCountRes.count : null
  const totalResults = typeof rCountRes.count === 'number' ? rCountRes.count : null
  const questionCountsPartial =
    !questionIdsRes.error &&
    totalQuestions !== null &&
    totalQuestions > questionRows.length

  const tests: VrlDiagnosticTest[] = baseTests.map((t) => ({
    id: t.id,
    nameKo: t.name_ko,
    testType: t.test_type,
    targetAxis: t.target_axis,
    targetTrackId: t.target_track_id,
    targetDomainId: t.target_domain_id,
    questionCount: t.question_count,
    estimatedMinutes: t.estimated_minutes,
    descriptionKo: t.description_ko,
    isActive: t.is_active,
    createdAt: t.created_at,
    questionsLoaded: loadedByTest.get(t.id) ?? 0,
  }))

  return {
    tests,
    totalTests: tests.length,
    activeTests: tests.filter((t) => t.isActive).length,
    totalQuestions,
    totalResults,
    questionCountsPartial,
    error,
  }
}
