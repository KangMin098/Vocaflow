// apps/web/src/lib/admin/vrl/queries.ts
// VRL Admin 6 page 데이터 쿼리 (Server-side only)
//
// 데이터 소스: shared_dictionary · vocaflow_levels · vocaflow_tracks ·
//             vocaflow_domains · vocaflow_skills · vrl_data_integrity_concerns ·
//             vrl_diagnostic_tests · vrl_diagnostic_questions ·
//             user_profiles · user_level_snapshots · user_diagnostic_results

import type { SupabaseClient } from '@supabase/supabase-js'

export interface VrlDashboardData {
  kpi: {
    totalWords: number
    classified: number
    classifiedPct: number
    concernsOpen: number
    concernsTotal: number
    diagnosticTests: number
    userProfiles: number
    snapshots: number
  }
  /** V-Level별 — totalInLevel = rule_v1, doneInLevel = v_level NOT NULL */
  byLevel: Array<{
    level: number
    koreanName: string
    cumulativeWordCount: number | null
    newWordsInLevel: number | null
    classifiedCount: number
    pct: number
    method: string | null
    confidence: number | null
  }>
}

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
}

export async function fetchVrlDashboard(
  client: SupabaseClient,
): Promise<VrlDashboardData> {
  // 1. KPI 8종 — 병렬 (count: 'exact', head: true 패턴)
  const [
    totalRes,
    classRes,
    concernOpenRes,
    concernTotalRes,
    diagRes,
    profRes,
    snapRes,
    levelsRes,
  ] = await Promise.all([
    client.from('shared_dictionary').select('*', { count: 'exact', head: true }),
    client
      .from('shared_dictionary')
      .select('*', { count: 'exact', head: true })
      .not('v_level', 'is', null),
    client
      .from('vrl_data_integrity_concerns')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false),
    client.from('vrl_data_integrity_concerns').select('*', { count: 'exact', head: true }),
    client
      .from('vrl_diagnostic_tests')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    client.from('user_profiles').select('*', { count: 'exact', head: true }),
    client.from('user_level_snapshots').select('*', { count: 'exact', head: true }),
    client
      .from('vocaflow_levels')
      .select(
        'level, korean_name, cumulative_word_count, new_words_in_level, classification_method, classification_confidence',
      )
      .order('level', { ascending: true }),
  ])

  const totalWords = totalRes.count ?? 0
  const classified = classRes.count ?? 0

  // 2. V-Level별 classified 카운트 (shared_dictionary v_level GROUP BY)
  const { data: perLevel } = await client
    .from('shared_dictionary')
    .select('v_level')
    .not('v_level', 'is', null)

  const byLevelMap = new Map<number, number>()
  for (const row of (perLevel ?? []) as Array<{ v_level: number }>) {
    byLevelMap.set(row.v_level, (byLevelMap.get(row.v_level) ?? 0) + 1)
  }

  type LevelRow = {
    level: number
    korean_name: string
    cumulative_word_count: number | null
    new_words_in_level: number | null
    classification_method: string | null
    classification_confidence: number | null
  }
  const levels = (levelsRes.data ?? []) as LevelRow[]

  const byLevel: VrlDashboardData['byLevel'] = levels.map((l) => {
    const cls = byLevelMap.get(l.level) ?? 0
    const newCount = l.new_words_in_level ?? 0
    const pct = newCount > 0 ? Math.min(100, (cls / newCount) * 100) : 0
    return {
      level: l.level,
      koreanName: l.korean_name,
      cumulativeWordCount: l.cumulative_word_count,
      newWordsInLevel: l.new_words_in_level,
      classifiedCount: cls,
      pct: Math.round(pct * 10) / 10,
      method: l.classification_method,
      confidence: l.classification_confidence,
    }
  })

  return {
    kpi: {
      totalWords,
      classified,
      classifiedPct:
        totalWords > 0 ? Math.round((classified / totalWords) * 1000) / 10 : 0,
      concernsOpen: concernOpenRes.count ?? 0,
      concernsTotal: concernTotalRes.count ?? 0,
      diagnosticTests: diagRes.count ?? 0,
      userProfiles: profRes.count ?? 0,
      snapshots: snapRes.count ?? 0,
    },
    byLevel,
  }
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
  resolvedAt: string | null
  resolutionNote: string | null
}

export interface VrlConcernsData {
  rows: VrlConcernRow[]
  total: number
  openCount: number
  resolvedCount: number
  /** concern_type 별 (open + resolved 합산) */
  byType: Array<{ type: string; total: number; open: number }>
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
    return { rows: [], total: 0, openCount: 0, resolvedCount: 0, byType: [] }
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

  return { rows, total: rows.length, openCount, resolvedCount, byType }
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
  nextLevelReviewDueAt: string | null
  totalWordsSeen: number | null
  totalWordsMastered: number | null
}

export interface VrlUsersData {
  rows: VrlUserRow[]
  total: number
  diagnosticDone: number
  /** L0~L11 distribution counts */
  byLevel: number[]
}

export async function fetchVrlUsers(client: SupabaseClient): Promise<VrlUsersData> {
  const { data, error } = await client
    .from('user_profiles')
    .select(
      'user_id, segment, current_v_level, current_v_level_meta, cefr_level, learning_goal, diagnostic_completed_at, last_active_at, next_level_review_due_at, total_words_seen, total_words_mastered',
    )
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[fetchVrlUsers] failed:', error.message)
    return { rows: [], total: 0, diagnosticDone: 0, byLevel: new Array(12).fill(0) }
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
    next_level_review_due_at: string | null
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
    nextLevelReviewDueAt: r.next_level_review_due_at,
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

  return { rows, total: rows.length, diagnosticDone, byLevel }
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
  segment: string | null
  cefrLevel: string | null
  triggerDetailsKeys: string[]
}

export interface VrlSnapshotsData {
  rows: VrlSnapshotRow[]
  total: number
  byType: Array<{ type: string; n: number }>
  byReason: Array<{ reason: string; n: number }>
}

export async function fetchVrlSnapshots(
  client: SupabaseClient,
): Promise<VrlSnapshotsData> {
  const { data, error } = await client
    .from('user_level_snapshots')
    .select(
      'id, user_id, v_level, previous_v_level, v_level_delta, snapshot_type, triggered_by, taken_reason, taken_at, v_level_meta, trigger_details, segment, cefr_level',
    )
    .order('taken_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[fetchVrlSnapshots] failed:', error.message)
    return { rows: [], total: 0, byType: [], byReason: [] }
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
    segment: string | null
    cefr_level: string | null
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
    segment: r.segment,
    cefrLevel: r.cefr_level,
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
  /** 실제 등록된 문항 수 (vrl_diagnostic_questions COUNT) */
  questionsLoaded: number
}

export interface VrlDiagnosticData {
  tests: VrlDiagnosticTest[]
  totalTests: number
  activeTests: number
  totalQuestions: number
  totalResults: number
}

export async function fetchVrlDiagnostic(
  client: SupabaseClient,
): Promise<VrlDiagnosticData> {
  const [testsRes, qCountRes, rCountRes] = await Promise.all([
    client
      .from('vrl_diagnostic_tests')
      .select(
        'id, name_ko, test_type, target_axis, target_track_id, target_domain_id, question_count, estimated_minutes, description_ko, is_active, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(200),
    client.from('vrl_diagnostic_questions').select('*', { count: 'exact', head: true }),
    client.from('user_diagnostic_results').select('*', { count: 'exact', head: true }),
  ])

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

  // 각 test 의 실제 문항 수 — 병렬 head count
  const counts = await Promise.all(
    baseTests.map((t) =>
      client
        .from('vrl_diagnostic_questions')
        .select('*', { count: 'exact', head: true })
        .eq('test_id', t.id)
        .then((res) => res.count ?? 0),
    ),
  )

  const tests: VrlDiagnosticTest[] = baseTests.map((t, i) => ({
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
    questionsLoaded: counts[i] ?? 0,
  }))

  return {
    tests,
    totalTests: tests.length,
    activeTests: tests.filter((t) => t.isActive).length,
    totalQuestions: qCountRes.count ?? 0,
    totalResults: rCountRes.count ?? 0,
  }
}
